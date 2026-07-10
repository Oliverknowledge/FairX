import type { Side } from "@/lib/markets/types";
import type { OnChainProof } from "@/lib/receipts/types";
import type { NormalizedTxLineEvent, StreamStatus, TxLineHealth } from "@/lib/txline/types";
import type { Mode } from "@/lib/terminal/state";

/**
 * Every state transition, as data. The reducer is a pure function of
 * (state, action); network hooks and timers are the only things that create
 * actions — never the reducer itself.
 */
export type Action =
  | { type: "RESET_DEMO"; mode?: Mode }
  | { type: "SET_MODE"; mode: Mode }
  | { type: "SET_HEALTH"; health: TxLineHealth }
  | { type: "TXLINE_CONNECTING"; stream: "scores" | "odds"; at: number }
  | { type: "TXLINE_CONNECTED"; stream: "scores" | "odds"; at: number }
  | { type: "TXLINE_ERROR"; stream: "scores" | "odds"; error: string; at: number }
  | { type: "TXLINE_STATUS"; stream: "scores" | "odds"; status: StreamStatus }
  | { type: "TXLINE_RAW"; raw: unknown; stream: "scores" | "odds"; at: number }
  // Demo-only affordance: the goal is visible on the broadcast before the feed publishes.
  | { type: "GOAL_ON_PITCH" }
  // The one event that drives everything — normalized, from live OR demo.
  | { type: "INGEST_TXLINE_EVENT"; event: NormalizedTxLineEvent; at: number }
  | { type: "OPEN_STALE_WINDOW"; at: number }
  | { type: "SET_BOT_SIDE"; side: Side }
  | { type: "BOT_PREPARE_ORDER"; at: number }
  | { type: "BOT_SUBMIT_ORDER"; at: number }
  | { type: "ESCROW_ORDER" }
  | { type: "EVALUATE_ORDER" }
  | { type: "REVEAL_VERDICT"; at: number }
  | { type: "REFUND_ORDER" }
  | { type: "FILL_ORDER" }
  | { type: "REPRICE_MARKET"; at: number }
  | { type: "CREATE_RECEIPT"; at: number }
  | { type: "VERIFY_RECEIPT"; at: number }
  | { type: "ATTACH_ONCHAIN_PROOF"; proof: OnChainProof }
  | { type: "CLEAR_ONCHAIN_PROOF" }
  | { type: "RUN_REPLAY_STEP"; step: number; at: number };

export type ActionType = Action["type"];
