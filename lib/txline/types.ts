/**
 * TxLINE integration types. Raw payloads are treated as untrusted `unknown`
 * and normalized defensively into NormalizedTxLineEvent before anything in
 * the app touches them.
 */

export type TxLineRawEvent = unknown;

export type TxLineEventType =
  | "GOAL"
  | "RED_CARD"
  | "YELLOW_CARD"
  | "PENALTY"
  | "VAR"
  | "ODDS_UPDATE"
  | "MATCH_STATE"
  | "UNKNOWN";

export type TxLineProofStatus = "unverified" | "api_verified" | "onchain_verified" | "simulated";

/**
 * Provenance of a normalized event — the honesty axis the whole UI keys off:
 *   live      — arrived over a real SSE connection to TxLINE, this session
 *   captured  — a payload actually received (or manually pasted) earlier,
 *               replayed through the same normalizer/reducer path
 *   demo      — the scripted fixture (Saka/seq 2), never claimed to be real
 */
export type TxLineSource = "live" | "captured" | "demo";

/** Which field (if any) supplied each extracted value — surfaced in diagnostics so nothing is a black box. */
export interface NormalizeTrace {
  seqField: string | null;
  tsField: string | null;
  eventTypeField: string | null;
  eventTypeMethod: "explicit" | "structural" | "default";
}

export interface NormalizedTxLineEvent {
  provider: "TXLINE";
  source: TxLineSource;
  fixtureId: string;
  /** Monotonic event sequence — the register LineGuard keys off. */
  seq: number;
  /** Epoch ms. */
  ts: number;
  eventType: TxLineEventType;
  team?: string;
  player?: string;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  /** Original payload, always preserved for the raw drawer / receipts. */
  raw: TxLineRawEvent;
  signature?: string;
  merkleRoot?: string;
  proofStatus: TxLineProofStatus;
  /** Which fields were found vs. inferred vs. defaulted — for diagnostics only, never logic. */
  trace: NormalizeTrace;
}

/** Connection state for one SSE stream (scores or odds). */
export type StreamStatus = "disconnected" | "connecting" | "live" | "error" | "demo";

export interface TxLineStreamState {
  scores: StreamStatus;
  odds: StreamStatus;
  /** Human-readable last error, if any. */
  error: string | null;
  /** Last raw payload seen on any stream (for the raw drawer). */
  lastRaw: TxLineRawEvent | null;
  /** Last normalized event seen (material or not). */
  lastEvent: NormalizedTxLineEvent | null;
  eventsSeen: number;
}

/** Browser-safe TxLINE config (no secrets) served by /api/txline/health. */
export interface TxLineHealth {
  configuredMode: "live" | "demo" | "live_or_demo";
  network: string;
  apiOrigin: string;
  fixtureId: string | null;
  hasJwt: boolean;
  hasApiToken: boolean;
  /** True when enough credentials exist to attempt a live connection. */
  liveCapable: boolean;
}
