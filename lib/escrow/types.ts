import type { Side } from "@/lib/markets/types";

/** Explicit escrow lifecycle — every dollar is accounted for at every step. */

export type OrderStatus =
  | "draft"
  | "submitted"
  | "escrowed"
  | "evaluating"
  | "filled"
  | "voided"
  | "refunded";

export interface Order {
  id: string;
  marketId: string;
  actor: "bot" | "user";
  side: Side;
  stakeUsd: number;
  /** Price frozen at submission — the (possibly stale) quote the order fills at. */
  observedPrice: number;
  /** stake / observedPrice, frozen at submission. */
  shares: number;
  status: OrderStatus;
  submittedAt: number;
}

export interface EscrowLedger {
  botStartingBalance: number;
  botAvailableBalance: number;
  escrowedAmount: number;
  /** Cumulative refunds paid back out of escrow. */
  refundedAmount: number;
  /** Cumulative stake consumed by fills. */
  filledAmount: number;
  /** Stake the protocol holds as position collateral after fills. */
  protocolBalance: number;
}

export const INITIAL_LEDGER: EscrowLedger = {
  botStartingBalance: 10_000,
  botAvailableBalance: 10_000,
  escrowedAmount: 0,
  refundedAmount: 0,
  filledAmount: 0,
  protocolBalance: 0,
};

/** Conservation check: money never appears or disappears. */
export function ledgerBalances(ledger: EscrowLedger): boolean {
  const accounted = ledger.botAvailableBalance + ledger.escrowedAmount + ledger.protocolBalance;
  return Math.abs(accounted - ledger.botStartingBalance) < 1e-6;
}
