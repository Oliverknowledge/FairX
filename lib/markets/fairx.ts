import type { EvaluateLineGuardResult, Verdict } from "@/lib/lineguard/evaluate";
import type { OnChainProof } from "@/lib/receipts/types";
import type { TxLineEventType, TxLineProofStatus } from "@/lib/txline/types";

/**
 * FairX is the marketplace-facing market model.  It deliberately sits beside
 * the original `Market` model in `types.ts`: the original model powers the
 * canonical LineGuard terminal, while this one powers a catalog of controlled
 * demo/devnet markets without changing that proven flow.
 */
export type FairXMarketType = "MATCH_WINNER" | "TOTAL_GOALS" | "NEXT_GOAL" | "CUSTOM_YES_NO";

export type FairXMarketStatus = "TRADING" | "STALE" | "REPRICING" | "SETTLED";

export type FairXSource = "live" | "captured" | "demo";

/** Honest execution provenance.  Custom markets never become devnet verified by inference. */
export type ExecutionMode = "devnet_verified" | "local_simulation" | "demo_replay";

export type GuardedOrderSide = "YES" | "NO";

export type GuardedOrderStatus = "draft" | "submitted" | "escrowed" | "evaluating" | "filled" | "refunded";

export interface MaterialityRules {
  goals: boolean;
  redCards: boolean;
  penalties: boolean;
  oddsUpdates: boolean;
}

export const DEFAULT_MATERIALITY_RULES: Readonly<MaterialityRules> = Object.freeze({
  goals: true,
  redCards: true,
  penalties: true,
  oddsUpdates: true,
});

export interface FairXOnChainMarket {
  /** True only after an actual market-initialization transaction has succeeded. */
  initialized: boolean;
  marketPda?: string;
  marketConfigPda?: string;
  marketType?: FairXMarketType;
  fixtureIdHash?: string;
  marketTitleHash?: string;
  materialityConfigHash?: string;
  settlementConfigHash?: string;
  oracleAuthority?: string;
  txSignatures?: string[];
  cluster?: "devnet" | "localnet";
  programId?: string;
}

/** A serialisable summary of the latest normalized feed event. */
export interface FairXMarketEventSummary {
  fixtureId: string;
  seq: number;
  timestamp: number;
  eventType: TxLineEventType;
  source: FairXSource;
  team?: string;
  player?: string;
  minute?: number;
  rawPayloadHash?: string;
  proofStatus: TxLineProofStatus;
  material: boolean;
  impact: string;
}

export interface FairXMarket {
  id: string;
  title: string;
  fixtureId?: string;
  type: FairXMarketType;
  status: FairXMarketStatus;
  /** Displayed YES quote.  NO is always its complement. */
  displayedPrice: number;
  /** Fair YES quote incorporating all known material events. */
  fairPrice: number;
  materialSeq: number;
  pricedAtSeq: number;
  tolerance: number;
  source: FairXSource;
  materialityRules: MaterialityRules;
  createdBy?: "demo" | "user";
  onChain?: FairXOnChainMarket;
  /** Optional metadata used by cards and the market-detail explanation. */
  backedTeam?: string;
  targetSide?: string;
  resolutionNote?: string;
  liquidity?: number;
  escrow?: number;
  createdAt?: number;
  updatedAt?: number;
  staleOpenedAt?: number | null;
  lastRepriceAt?: number | null;
  lastEvent?: FairXMarketEventSummary | null;
}

export interface GuardedOrderTransition {
  status: GuardedOrderStatus;
  at: number;
  note: string;
}

/**
 * A frozen order record.  The price, fair value, sequence registers and
 * tolerance all belong to the instant the order was submitted; UI repricing
 * must never mutate these values after the fact.
 */
export interface GuardedOrder {
  id: string;
  marketId: string;
  side: GuardedOrderSide;
  stake: number;
  observedPrice: number;
  fairSidePrice: number;
  fairPrice: number;
  edge: number;
  tolerance: number;
  materialSeq: number;
  pricedAtSeq: number;
  status: GuardedOrderStatus;
  verdict: Verdict;
  actor: "bot" | "user";
  executionMode: ExecutionMode;
  /** Alias retained for compact UI cards that render a generic mode field. */
  mode: ExecutionMode;
  receiptId?: string;
  txSignatures?: string[];
  onChain?: OnChainProof;
  shares: number;
  estimatedPayout: number;
  reason: string;
  submittedAt: number;
  evaluatedAt: number;
  settledAt: number;
  transitions: GuardedOrderTransition[];
}

/** The pre-submit view of a guarded order, shared by market-detail clients. */
export interface GuardedOrderPreview {
  marketId: string;
  side: GuardedOrderSide;
  stake: number;
  observedPrice: number;
  fairSidePrice: number;
  edge: number;
  staleness: number;
  tolerance: number;
  verdict: Verdict | null;
  reason: string;
  guard: EvaluateLineGuardResult | null;
  canSubmit: boolean;
  validationErrors: string[];
  wouldFill: boolean;
  wouldRefund: boolean;
  shares: number;
  estimatedPayout: number;
  estimatedRefund: number;
  executionMode: ExecutionMode;
}

export interface FairXStoreSnapshot {
  version: 1;
  markets: FairXMarket[];
  orders: GuardedOrder[];
  /** Receipts are structurally typed in store.ts to avoid a runtime dependency here. */
  receipts: import("@/lib/receipts/types").LineGuardReceipt[];
  hydrated: boolean;
}

export function isFairXMarketStale(market: Pick<FairXMarket, "materialSeq" | "pricedAtSeq">): boolean {
  return market.materialSeq > market.pricedAtSeq;
}

/** Price for an order side at the currently displayed quote. */
export function displayedFairXSidePrice(market: Pick<FairXMarket, "displayedPrice">, side: GuardedOrderSide): number {
  return side === "YES" ? market.displayedPrice : roundPrice(1 - market.displayedPrice);
}

/** Price for an order side at the fair quote. */
export function fairXSidePrice(market: Pick<FairXMarket, "fairPrice">, side: GuardedOrderSide): number {
  return side === "YES" ? market.fairPrice : roundPrice(1 - market.fairPrice);
}

export function normalizeMaterialityRules(rules?: Partial<MaterialityRules> | null): MaterialityRules {
  return {
    goals: rules?.goals ?? DEFAULT_MATERIALITY_RULES.goals,
    redCards: rules?.redCards ?? DEFAULT_MATERIALITY_RULES.redCards,
    penalties: rules?.penalties ?? DEFAULT_MATERIALITY_RULES.penalties,
    oddsUpdates: rules?.oddsUpdates ?? DEFAULT_MATERIALITY_RULES.oddsUpdates,
  };
}

export function isExecutionMode(value: unknown): value is ExecutionMode {
  return value === "devnet_verified" || value === "local_simulation" || value === "demo_replay";
}

export function isFairXMarketStatus(value: unknown): value is FairXMarketStatus {
  return value === "TRADING" || value === "STALE" || value === "REPRICING" || value === "SETTLED";
}

export function isFairXMarketType(value: unknown): value is FairXMarketType {
  return value === "MATCH_WINNER" || value === "TOTAL_GOALS" || value === "NEXT_GOAL" || value === "CUSTOM_YES_NO";
}

/** Round prices at the same 4-decimal precision as LineGuard's pure guard. */
export function roundPrice(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function clampFairXPrice(value: number): number {
  return Math.min(0.99, Math.max(0.01, roundPrice(value)));
}

export function cloneFairXMarket<T extends FairXMarket>(market: T): T {
  return {
    ...market,
    materialityRules: { ...market.materialityRules },
    onChain: market.onChain
      ? {
          ...market.onChain,
          txSignatures: market.onChain.txSignatures ? [...market.onChain.txSignatures] : undefined,
        }
      : undefined,
    lastEvent: market.lastEvent ? { ...market.lastEvent } : market.lastEvent,
  };
}

export function cloneGuardedOrder<T extends GuardedOrder>(order: T): T {
  return {
    ...order,
    txSignatures: order.txSignatures ? [...order.txSignatures] : undefined,
    onChain: order.onChain
      ? {
          ...order.onChain,
          txSignatures: [...order.onChain.txSignatures],
          explorerUrls: [...order.onChain.explorerUrls],
        }
      : undefined,
    transitions: order.transitions.map((transition) => ({ ...transition })),
  };
}
