import type { EvaluateLineGuardResult } from "@/lib/lineguard/evaluate";
import { BOT_STAKE_USD, type SniperReading } from "@/lib/bot/sniper";
import { INITIAL_LEDGER, type EscrowLedger, type Order } from "@/lib/escrow/types";
import { isStale, type Market, type Side } from "@/lib/markets/types";
import type { LineGuardReceipt, OnChainProof, ReceiptVerification } from "@/lib/receipts/types";
import { DEMO_FIXTURE_ID, DEMO_KICKOFF_EVENT } from "@/lib/txline/demoFeed";
import type { NormalizedTxLineEvent, StreamStatus, TxLineHealth } from "@/lib/txline/types";

/**
 * Terminal state — one deterministic tree driven by the reducer. Panels are
 * pure functions of this; timers and network live in hooks and only ever
 * dispatch actions.
 */

export type Mode = "demo" | "live";

export interface TxLineSlice {
  /** Sanitized server config (never secrets), from /api/txline/health. */
  health: TxLineHealth | null;
  scores: StreamStatus;
  odds: StreamStatus;
  error: string | null;
  lastErrorAt: number | null;
  lastRaw: unknown | null;
  /** Which stream the last raw payload arrived on (for the "save captured" affordance). */
  lastPayloadStream: "scores" | "odds" | null;
  /** Last normalized event seen on any stream, material or not. */
  lastEvent: NormalizedTxLineEvent | null;
  eventsSeen: number;
  /** Most recent connection attempt (fires on every retry, not just the first). */
  lastConnectionAttemptAt: number | null;
  /** Most recent payload actually received over SSE. */
  lastPayloadAt: number | null;
}

/** Registers + fair value frozen at the moment the verdict was revealed. */
export interface VerdictContext {
  materialSeq: number;
  pricedAtSeq: number;
  fairYes: number;
  event: NormalizedTxLineEvent | null;
}

export interface LogEntry {
  id: string;
  tone: "neutral" | "amber" | "red" | "green" | "blue";
  text: string;
}

export interface TerminalState {
  mode: Mode;
  txline: TxLineSlice;
  market: Market;
  /** Demo color: broadcast has seen the goal; the officiated feed hasn't published yet. */
  goalOnPitch: boolean;
  /** Which side the bot will attack — the toggle that proves side-awareness. */
  botSide: Side;
  /** The bot's prepared read of the stale market (attack-ready highlight). */
  botPlan: (SniperReading & { detectedAt: number }) | null;
  order: Order | null;
  ledger: EscrowLedger;
  verdict: EvaluateLineGuardResult | null;
  verdictContext: VerdictContext | null;
  onChainProof: OnChainProof | null;
  receipt: LineGuardReceipt | null;
  receiptVerification: ReceiptVerification | null;
  /** Ingested feed events, oldest first (timeline source). */
  events: NormalizedTxLineEvent[];
  log: LogEntry[];
  logSeq: number;
  tolerance: number;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const TOLERANCE = 0.02; // 2¢
export { BOT_STAKE_USD };

export const INITIAL_MARKET: Market = {
  id: "eng-win",
  title: "England wins",
  resolutionNote: "Resolves YES if England beat France in regulation.",
  kind: "WINNER",
  fixtureId: DEMO_FIXTURE_ID,
  backedTeam: "England",
  yes: 0.4,
  fairYes: 0.4,
  materialSeq: 1,
  pricedAtSeq: 1,
  status: "trading",
  lastMaterialEvent: null,
  lastReprice: null,
  staleOpenedAt: null,
};

const INITIAL_TXLINE: TxLineSlice = {
  health: null,
  scores: "disconnected",
  odds: "disconnected",
  error: null,
  lastErrorAt: null,
  lastRaw: null,
  lastPayloadStream: null,
  lastEvent: null,
  eventsSeen: 0,
  lastConnectionAttemptAt: null,
  lastPayloadAt: null,
};

export function createInitialState(mode: Mode = "demo"): TerminalState {
  return {
    mode,
    txline: INITIAL_TXLINE,
    market: { ...INITIAL_MARKET },
    goalOnPitch: false,
    botSide: "YES",
    botPlan: null,
    order: null,
    ledger: { ...INITIAL_LEDGER },
    verdict: null,
    verdictContext: null,
    onChainProof: null,
    receipt: null,
    receiptVerification: null,
    events: [DEMO_KICKOFF_EVENT],
    log: [
      {
        id: "log-0",
        tone: "neutral",
        text: "Market open · England wins trading at 40¢ · in sync at seq 1/1.",
      },
    ],
    logSeq: 1,
    tolerance: TOLERANCE,
  };
}

// ── Derived helpers (shared by components) ────────────────────────────────────

export { isStale };

export const cents = (price: number): string => `${Math.round(price * 100)}¢`;
export const pct = (price: number): string => `${Math.round(price * 100)}%`;
export const usd = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Is the order past a given lifecycle stage? (for steppers) */
const ORDER_PROGRESS: Record<Order["status"], number> = {
  draft: 0,
  submitted: 1,
  escrowed: 2,
  evaluating: 3,
  voided: 4,
  filled: 4,
  refunded: 5,
};

export function orderProgress(order: Order | null): number {
  return order ? ORDER_PROGRESS[order.status] : 0;
}

/** The market is fully repriced through the demo's material event. */
export function isRepriced(state: TerminalState): boolean {
  return state.market.materialSeq >= 2 && state.market.pricedAtSeq >= state.market.materialSeq;
}

// ── Data-source honesty ───────────────────────────────────────────────────────
// The app must always be able to say, in one glance, which of three states
// produced what's on screen. This is derived from the actual provenance of
// the last ingested event — not just which toggle is selected — so the badge
// can never claim "live" for data that didn't come from a live connection.

export type DataSourceKind = "live" | "captured" | "demo";

export const DATA_SOURCE_LABEL: Record<DataSourceKind, string> = {
  live: "Live TxLINE",
  captured: "Captured TxLINE replay",
  demo: "Guided scenario",
};

export const DATA_SOURCE_TONE: Record<DataSourceKind, "green" | "blue" | "amber"> = {
  live: "green",
  captured: "blue",
  demo: "amber",
};

/** What actually produced the most recent event — falls back to the mode toggle only when nothing has been ingested yet. */
export function activeDataSource(state: TerminalState): DataSourceKind {
  const source = state.txline.lastEvent?.source ?? state.market.lastMaterialEvent?.source;
  if (source) return source;
  return state.mode === "live" ? "live" : "demo";
}
