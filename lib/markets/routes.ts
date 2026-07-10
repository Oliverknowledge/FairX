import { computeFairValueFromEvent } from "@/lib/markets/fairValue";
import { hashNormalizedEvent } from "@/lib/proof/eventHash";
import { evaluateLineGuard, type EvaluateLineGuardResult } from "@/lib/lineguard/evaluate";
import {
  clampFairXPrice,
  cloneFairXMarket,
  displayedFairXSidePrice,
  fairXSidePrice,
  isExecutionMode,
  isFairXMarketStale,
  roundPrice,
  type ExecutionMode,
  type FairXMarket,
  type FairXMarketEventSummary,
  type FairXSource,
  type GuardedOrder,
  type GuardedOrderPreview,
  type GuardedOrderSide,
} from "@/lib/markets/fairx";
import type { Market } from "@/lib/markets/types";
import { createReceipt } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";
import type { NormalizedTxLineEvent, TxLineEventType, TxLineProofStatus } from "@/lib/txline/types";

export type { GuardedOrderPreview } from "@/lib/markets/fairx";

/** Input accepted by the generic stale-window simulator and TxLINE adapters. */
export interface MaterialEventInput {
  eventType: TxLineEventType;
  fixtureId?: string;
  /** Defaults to one more than the highest known market register. */
  seq?: number;
  timestamp?: number;
  source?: FairXSource;
  team?: string;
  player?: string;
  minute?: number;
  /** An explicit fair YES price is useful for controlled custom-market demos. */
  fairPrice?: number;
  raw?: unknown;
  rawPayloadHash?: string;
  proofStatus?: TxLineProofStatus;
}

export interface MarketEventResult {
  market: FairXMarket;
  event: FairXMarketEventSummary;
  material: boolean;
  openedStaleWindow: boolean;
  /** False for settled, wrong-fixture, or sequence-regression events. */
  accepted: boolean;
  reason: string;
}

export interface GuardedOrderInput {
  side: GuardedOrderSide;
  stake: number;
  actor?: "bot" | "user";
  id?: string;
  /** Used only for a controlled preview; the chosen value is frozen on create. */
  observedPrice?: number;
  timestamp?: number;
  executionMode?: ExecutionMode;
  /** Attach only a proof produced by an actual devnet/localnet transaction. */
  onChain?: OnChainProof;
  txSignatures?: string[];
}

export interface CreatedGuardedOrder {
  order: GuardedOrder;
  preview: GuardedOrderPreview;
  guard: EvaluateLineGuardResult;
  receipt: LineGuardReceipt;
}

export class GuardedOrderValidationError extends Error {
  readonly preview: GuardedOrderPreview;

  constructor(preview: GuardedOrderPreview) {
    super(preview.validationErrors.join(" ") || "Guarded order input is invalid.");
    this.name = "GuardedOrderValidationError";
    this.preview = preview;
  }
}

function validPrice(value: number): boolean {
  return Number.isFinite(value) && value >= 0.01 && value <= 0.99;
}

function validStake(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1_000_000;
}

function nextEventSeq(market: FairXMarket): number {
  return Math.max(market.materialSeq, market.pricedAtSeq, market.lastEvent?.seq ?? 0) + 1;
}

function highestKnownEventSeq(market: FairXMarket): number {
  return Math.max(market.materialSeq, market.pricedAtSeq, market.lastEvent?.seq ?? 0);
}

function toNormalizedEvent(market: FairXMarket, input: MaterialEventInput, at: number): NormalizedTxLineEvent {
  const fixtureId = input.fixtureId ?? market.fixtureId ?? `custom:${market.id}`;
  // The one-click simulator has no score-picker.  For a controlled generated
  // GOAL/PENALTY event, use the YES team's identifier so the canonical market
  // demonstrates the intended stale-YES attack.  Real normalized feed events
  // always keep their supplied team untouched.
  const generatedTeam =
    input.team ??
    ((input.eventType === "GOAL" || input.eventType === "PENALTY") && market.type !== "TOTAL_GOALS" ? market.backedTeam : undefined);
  return {
    provider: "TXLINE",
    source: input.source ?? market.source,
    fixtureId,
    seq: input.seq ?? nextEventSeq(market),
    ts: input.timestamp ?? at,
    eventType: input.eventType,
    team: generatedTeam,
    player: input.player,
    minute: input.minute,
    raw: input.raw ?? (input.fairPrice === undefined ? {} : { fairPrice: input.fairPrice }),
    proofStatus: input.proofStatus ?? (input.source === "live" ? "api_verified" : "simulated"),
    trace: {
      seqField: input.seq === undefined ? "generated" : "seq",
      tsField: input.timestamp === undefined ? "generated" : "timestamp",
      eventTypeField: "eventType",
      eventTypeMethod: "explicit",
    },
  };
}

function eventAllowedByRules(market: FairXMarket, event: NormalizedTxLineEvent): boolean {
  if (market.fixtureId && event.fixtureId !== market.fixtureId) return false;
  switch (event.eventType) {
    case "GOAL":
      return market.materialityRules.goals;
    case "RED_CARD":
      return market.materialityRules.redCards;
    case "PENALTY":
      return market.materialityRules.penalties;
    case "ODDS_UPDATE":
      return market.materialityRules.oddsUpdates;
    default:
      // VAR may be informational, but is intentionally not a hidden material
      // trigger because creation UI exposes only the four rules above.
      return false;
  }
}

/** Exported for market-detail diagnostics and focused tests. */
export function eventImpactsFairXMarket(market: FairXMarket, event: MaterialEventInput, at = Date.now()): boolean {
  const normalized = toNormalizedEvent(market, event, at);
  return market.status !== "SETTLED" && normalized.seq > highestKnownEventSeq(market) && eventAllowedByRules(market, normalized);
}

function legacyMarketShape(market: FairXMarket): Market {
  return {
    id: market.id,
    title: market.title,
    resolutionNote: market.resolutionNote ?? market.targetSide ?? market.title,
    kind: market.type === "TOTAL_GOALS" ? "OVER_UNDER" : "WINNER",
    fixtureId: market.fixtureId ?? `custom:${market.id}`,
    backedTeam: market.backedTeam ?? market.targetSide,
    line: market.type === "TOTAL_GOALS" ? 2.5 : undefined,
    yes: market.displayedPrice,
    fairYes: market.fairPrice,
    materialSeq: market.materialSeq,
    pricedAtSeq: market.pricedAtSeq,
    status: market.status === "TRADING" ? "trading" : market.status === "SETTLED" ? "settled" : market.status === "REPRICING" ? "repricing" : "stale",
    lastMaterialEvent: null,
    lastReprice: null,
    staleOpenedAt: market.staleOpenedAt ?? null,
  };
}

function customFairPrice(market: FairXMarket, event: NormalizedTxLineEvent): number {
  if (event.eventType === "ODDS_UPDATE") {
    return computeFairValueFromEvent(event, legacyMarketShape(market), market.fairPrice);
  }

  // Creator markets should normally pass `fairPrice` from their data adapter.
  // This small deterministic fallback keeps the visual simulator interactive
  // while never claiming to be a production odds model.
  const target = (market.backedTeam ?? market.targetSide ?? "").toLowerCase();
  const affectsYes = Boolean(target && event.team && target.includes(event.team.toLowerCase()));
  const direction = affectsYes ? 1 : -1;
  const shift = event.eventType === "RED_CARD" ? 0.12 : event.eventType === "PENALTY" ? 0.07 : 0.1;
  return clampFairXPrice(market.fairPrice + direction * shift);
}

function computeEventFairPrice(market: FairXMarket, event: NormalizedTxLineEvent, explicitFairPrice?: number): number {
  if (explicitFairPrice !== undefined && validPrice(explicitFairPrice)) return clampFairXPrice(explicitFairPrice);
  if (market.type === "CUSTOM_YES_NO") return customFairPrice(market, event);
  return computeFairValueFromEvent(event, legacyMarketShape(market), market.fairPrice);
}

function impactText(event: NormalizedTxLineEvent, material: boolean, reason?: string): string {
  if (!material) return reason ?? `${event.eventType} was recorded but did not open a material stale window.`;
  const subject = event.team ? `${event.team} ` : "";
  return `${subject}${event.eventType.replace(/_/g, " ").toLowerCase()} advanced the material register; displayed price remains frozen until reprice.`;
}

/**
 * Apply one normalized/material event.  This is a pure transition: it never
 * touches storage or the network, and deliberately never moves displayedPrice.
 */
export function applyMarketEvent(market: FairXMarket, input: MaterialEventInput, at = Date.now()): MarketEventResult {
  const event = toNormalizedEvent(market, input, at);
  const eventSummaryBase: Omit<FairXMarketEventSummary, "material" | "impact"> = {
    fixtureId: event.fixtureId,
    seq: event.seq,
    timestamp: event.ts,
    eventType: event.eventType,
    source: event.source,
    team: event.team,
    player: event.player,
    minute: event.minute,
    rawPayloadHash: input.rawPayloadHash,
    proofStatus: event.proofStatus,
  };

  if (market.status === "SETTLED") {
    const reason = "Settled markets do not accept new material events.";
    return { market, event: { ...eventSummaryBase, material: false, impact: impactText(event, false, reason) }, material: false, openedStaleWindow: false, accepted: false, reason };
  }
  if (market.fixtureId && event.fixtureId !== market.fixtureId) {
    const reason = `Event fixture ${event.fixtureId} does not match ${market.fixtureId}.`;
    return { market, event: { ...eventSummaryBase, material: false, impact: impactText(event, false, reason) }, material: false, openedStaleWindow: false, accepted: false, reason };
  }
  if (!Number.isSafeInteger(event.seq) || event.seq <= highestKnownEventSeq(market)) {
    const reason = `Event seq ${event.seq} is not newer than the latest known source seq ${highestKnownEventSeq(market)}.`;
    return { market, event: { ...eventSummaryBase, material: false, impact: impactText(event, false, reason) }, material: false, openedStaleWindow: false, accepted: false, reason };
  }

  const material = eventAllowedByRules(market, event);
  if (!material) {
    const reason = `${event.eventType} is not enabled by this market's materiality rules.`;
    const summary = { ...eventSummaryBase, material: false, impact: impactText(event, false, reason) };
    return {
      market: { ...cloneFairXMarket(market), lastEvent: summary, updatedAt: at },
      event: summary,
      material: false,
      openedStaleWindow: false,
      accepted: true,
      reason,
    };
  }

  const wasStale = isFairXMarketStale(market);
  const fairPrice = computeEventFairPrice(market, event, input.fairPrice);
  const summary = { ...eventSummaryBase, material: true, impact: impactText(event, true) };
  const next: FairXMarket = {
    ...cloneFairXMarket(market),
    fairPrice,
    materialSeq: event.seq,
    // displayedPrice and pricedAtSeq stay untouched: this gap is what the
    // actual LineGuard evaluator receives when an order is submitted.
    status: "STALE",
    source: event.source,
    staleOpenedAt: wasStale ? market.staleOpenedAt ?? event.ts : event.ts,
    updatedAt: at,
    lastEvent: summary,
  };
  return {
    market: next,
    event: summary,
    material: true,
    openedStaleWindow: !wasStale,
    accepted: true,
    reason: "Material event accepted; the market is stale until repriced.",
  };
}

/** Visual intermediate state for clients that animate the reprice transition. */
export function markFairXMarketRepricing(market: FairXMarket, at = Date.now()): FairXMarket {
  if (!isFairXMarketStale(market) || market.status === "SETTLED") return cloneFairXMarket(market);
  return { ...cloneFairXMarket(market), status: "REPRICING", updatedAt: at };
}

/** Catch displayed price up to fair price and close the stale window. */
export function repriceFairXMarket(market: FairXMarket, at = Date.now()): FairXMarket {
  if (market.status === "SETTLED") return cloneFairXMarket(market);
  return {
    ...cloneFairXMarket(market),
    displayedPrice: market.fairPrice,
    pricedAtSeq: market.materialSeq,
    status: "TRADING",
    staleOpenedAt: null,
    lastRepriceAt: at,
    updatedAt: at,
  };
}

/** Concise alias used by clients that do not need the FairX-specific name. */
export const repriceMarket = repriceFairXMarket;

function resolveExecutionMode(market: FairXMarket, input: GuardedOrderInput): ExecutionMode {
  if (input.executionMode && isExecutionMode(input.executionMode)) {
    // A devnet label requires a concrete proof, not merely an initialized
    // market descriptor.  Fall back honestly when an app has no transaction.
    if (input.executionMode !== "devnet_verified" || input.onChain) return input.executionMode;
  }
  if (market.createdBy === "demo" && (market.source === "demo" || market.source === "captured")) return "demo_replay";
  return "local_simulation";
}

function validateOrder(market: FairXMarket, input: GuardedOrderInput, observedPrice: number): string[] {
  const errors: string[] = [];
  if (market.status === "SETTLED") errors.push("This market is settled and cannot accept orders.");
  if (input.side !== "YES" && input.side !== "NO") errors.push("Choose YES or NO.");
  if (!validStake(input.stake)) errors.push("Stake must be a finite amount greater than zero.");
  if (!validPrice(observedPrice)) errors.push("Observed price must be between 1¢ and 99¢.");
  if (!validPrice(market.fairPrice)) errors.push("Market fair price is outside the supported range.");
  if (!Number.isFinite(market.tolerance) || market.tolerance < 0 || market.tolerance > 1) errors.push("Market tolerance is invalid.");
  return errors;
}

/**
 * Use the exact same `evaluateLineGuard` primitive as the terminal and the
 * program model.  This makes the pre-submit prediction judge-visible and
 * guarantees `createGuardedOrder` cannot drift from its preview.
 */
export function previewGuardedOrder(market: FairXMarket, input: GuardedOrderInput): GuardedOrderPreview {
  const observedPrice = roundPrice(input.observedPrice ?? displayedFairXSidePrice(market, input.side));
  const fairSidePrice = fairXSidePrice(market, input.side);
  const errors = validateOrder(market, input, observedPrice);
  const shares = validStake(input.stake) && validPrice(observedPrice) ? roundPrice(input.stake / observedPrice) : 0;
  const estimatedPayout = shares;
  const executionMode = resolveExecutionMode(market, input);

  if (errors.length) {
    return {
      marketId: market.id,
      side: input.side,
      stake: input.stake,
      observedPrice,
      fairSidePrice,
      edge: roundPrice(fairSidePrice - observedPrice),
      staleness: market.materialSeq - market.pricedAtSeq,
      tolerance: market.tolerance,
      verdict: null,
      reason: errors.join(" "),
      guard: null,
      canSubmit: false,
      validationErrors: errors,
      wouldFill: false,
      wouldRefund: false,
      shares,
      estimatedPayout,
      estimatedRefund: 0,
      executionMode,
    };
  }

  const guard = evaluateLineGuard({
    side: input.side,
    observedPrice,
    fairYes: market.fairPrice,
    materialSeq: market.materialSeq,
    pricedAtSeq: market.pricedAtSeq,
    tolerance: market.tolerance,
    orderId: input.id ?? `preview-${market.id}`,
    marketId: market.id,
    actor: input.actor ?? "user",
    timestamp: input.timestamp ?? Date.now(),
  });
  const wouldRefund = guard.verdict === "VOIDED_REFUNDED";

  return {
    marketId: market.id,
    side: input.side,
    stake: input.stake,
    observedPrice: guard.observedPrice,
    fairSidePrice: guard.fairSidePrice,
    edge: guard.edge,
    staleness: guard.staleness,
    tolerance: market.tolerance,
    verdict: guard.verdict,
    reason: guard.reason,
    guard,
    canSubmit: true,
    validationErrors: [],
    wouldFill: !wouldRefund,
    wouldRefund,
    shares,
    estimatedPayout,
    estimatedRefund: wouldRefund ? input.stake : 0,
    executionMode,
  };
}

function createOrderId(marketId: string, at: number): string {
  const entropy = Math.random().toString(36).slice(2, 8);
  return `fxo-${marketId.slice(0, 30)}-${at.toString(36)}-${entropy}`;
}

/**
 * Freeze and immediately locally settle an order for the simulator.  The
 * generated receipt uses the original receipt primitive and can therefore be
 * opened by the existing verifier or encoded into its normal `?r=` URL.
 */
export function createGuardedOrder(market: FairXMarket, input: GuardedOrderInput, at = Date.now()): CreatedGuardedOrder {
  const id = input.id ?? createOrderId(market.id, at);
  const preview = previewGuardedOrder(market, { ...input, id, timestamp: input.timestamp ?? at });
  if (!preview.canSubmit || !preview.guard || !preview.verdict) throw new GuardedOrderValidationError(preview);

  const guard = preview.guard;
  const finalStatus = guard.verdict === "VOIDED_REFUNDED" ? "refunded" : "filled";
  const executionMode = preview.executionMode;
  const onChain = executionMode === "devnet_verified" ? input.onChain : undefined;
  const transitions: GuardedOrder["transitions"] = [
    { status: "submitted", at, note: "Observed price frozen at submission." },
    { status: "escrowed", at, note: "Sandbox stake escrowed while LineGuard evaluates." },
    { status: "evaluating", at, note: "LineGuard evaluated frozen quote against current registers." },
    {
      status: finalStatus,
      at,
      note: finalStatus === "refunded" ? "Stale positive-edge order voided and sandbox stake refunded." : "Order allowed and marked filled.",
    },
  ];
  const lastEvent = market.lastEvent;
  const normalizedEventHash = lastEvent
    ? hashNormalizedEvent({
        source: lastEvent.source,
        fixtureId: lastEvent.fixtureId,
        seq: lastEvent.seq,
        ts: lastEvent.timestamp,
        eventType: lastEvent.eventType,
        team: lastEvent.team,
        player: lastEvent.player,
        minute: lastEvent.minute,
        proofStatus: lastEvent.proofStatus,
      })
    : undefined;
  const receipt = createReceipt({
    marketId: market.id,
    marketTitle: market.title,
    fixtureId: market.fixtureId ?? `custom:${market.id}`,
    orderId: id,
    actor: input.actor ?? "user",
    side: input.side,
    stake: input.stake,
    stakeUnit: "SANDBOX",
    observedPrice: guard.observedPrice,
    fairSidePrice: guard.fairSidePrice,
    fairYes: market.fairPrice,
    materialSeq: market.materialSeq,
    pricedAtSeq: market.pricedAtSeq,
    staleness: guard.staleness,
    edge: guard.edge,
    tolerance: market.tolerance,
    verdict: guard.verdict,
    reason: guard.reason,
    txlineEventSeq: lastEvent?.seq,
    txlineEventType: lastEvent?.eventType,
    txlineTimestamp: lastEvent?.timestamp,
    sourceMode: lastEvent?.source === "live" ? "live" : lastEvent?.source === "captured" ? "captured" : "guided",
    sourceEndpoint: lastEvent?.source === "live" ? "TxLINE via FairX server proxy" : lastEvent?.source === "captured" ? "Captured payload replay" : "FairX guided scenario generator",
    rawEventHash: lastEvent?.rawPayloadHash,
    normalizedEventHash,
    settlementDestination: guard.verdict === "VOIDED_REFUNDED" ? "REFUNDED_TO_TRADER" : "RETAINED_IN_ESCROW",
    proofStatus: lastEvent?.proofStatus ?? (onChain ? "onchain_verified" : "simulated"),
    createdAt: at,
    onChain,
  });
  const txSignatures = input.txSignatures ?? onChain?.txSignatures;
  const order: GuardedOrder = {
    id,
    marketId: market.id,
    side: input.side,
    stake: input.stake,
    observedPrice: guard.observedPrice,
    fairSidePrice: guard.fairSidePrice,
    fairPrice: market.fairPrice,
    edge: guard.edge,
    tolerance: market.tolerance,
    materialSeq: market.materialSeq,
    pricedAtSeq: market.pricedAtSeq,
    status: finalStatus,
    verdict: guard.verdict,
    actor: input.actor ?? "user",
    executionMode,
    mode: executionMode,
    receiptId: receipt.receiptId,
    txSignatures: txSignatures ? [...txSignatures] : undefined,
    onChain,
    shares: preview.shares,
    estimatedPayout: preview.estimatedPayout,
    reason: guard.reason,
    submittedAt: at,
    evaluatedAt: at,
    settledAt: at,
    transitions,
  };
  return { order, preview, guard, receipt };
}
