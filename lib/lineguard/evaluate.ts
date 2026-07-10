import { fairSidePrice, type Side } from "@/lib/markets/types";

/**
 * LineGuard — the core mechanism, as a single pure function.
 *
 * Stale-price protection for live sports prediction markets. Two sequence
 * numbers per market tell you everything:
 *
 *   materialSeq  — latest officiated (TxLINE) event sequence affecting the market
 *   pricedAtSeq  — latest event sequence the displayed price has repriced through
 *
 * A market is stale when materialSeq > pricedAtSeq: the feed knows something
 * the price doesn't yet. But LineGuard doesn't freeze the market — it checks
 * whether *this specific order* profits from the un-repriced event. Only
 * orders that capture unfair edge above tolerance are voided.
 *
 * Pure, synchronous, deterministic: same inputs → same verdict, always. This
 * is the whole protocol; everything else in the app is presentation around it.
 * The same condition is the on-chain enforcement target:
 *
 *   if market.material_seq > market.priced_at_seq && edge > tolerance {
 *       refund_unfair_trade();
 *   }
 */

export type { Side };

export type Verdict =
  | "ALLOWED" // market in sync — nothing to exploit
  | "VOIDED_REFUNDED" // stale AND order captures unfair edge → killed
  | "STALE_ALLOWED_NO_EDGE"; // stale but order takes no advantage → passes

export interface EvaluateLineGuardInput {
  side: Side;
  /** Price the order would execute at (the displayed, possibly stale, quote). */
  observedPrice: number;
  /** True fair YES/OVER price given every known event, including un-repriced ones. */
  fairYes: number;
  materialSeq: number;
  pricedAtSeq: number;
  /** Edge below this (in price units, e.g. 0.02 = 2¢) is noise, not exploitation. */
  tolerance: number;
  orderId: string;
  marketId: string;
  actor: "bot" | "user";
  timestamp: number;
}

export interface EvaluateLineGuardResult {
  verdict: Verdict;
  /** materialSeq − pricedAtSeq. > 0 means the market is stale. */
  staleness: number;
  /** fairSidePrice − observedPrice. Positive = the order is buying below fair. */
  edge: number;
  /** Fair price for the side being bought (YES/OVER: fairYes, NO/UNDER: 1 − fairYes). */
  fairSidePrice: number;
  observedPrice: number;
  reason: string;
  /** The individual checks, in evaluation order — receipts and the UI show these. */
  checks: {
    registersInSync: boolean;
    staleWindowOpen: boolean;
    sideBenefits: boolean;
    edgeAboveTolerance: boolean;
  };
  orderId: string;
  marketId: string;
  actor: "bot" | "user";
  timestamp: number;
}

/** Back-compat aliases for the elemental app's names. */
export type GuardInput = EvaluateLineGuardInput;
export type GuardResult = EvaluateLineGuardResult;

const round = (x: number): number => Math.round(x * 1e4) / 1e4;

export function evaluateLineGuard(input: EvaluateLineGuardInput): EvaluateLineGuardResult {
  const { side, observedPrice, fairYes, materialSeq, pricedAtSeq, tolerance, orderId, marketId, actor, timestamp } = input;

  const staleness = materialSeq - pricedAtSeq;
  const fair = round(fairSidePrice(fairYes, side));
  const edge = round(fair - observedPrice);

  const checks = {
    registersInSync: staleness <= 0,
    staleWindowOpen: staleness > 0,
    sideBenefits: edge > 0,
    edgeAboveTolerance: edge > tolerance,
  };

  const base = {
    staleness,
    edge,
    fairSidePrice: fair,
    observedPrice,
    checks,
    orderId,
    marketId,
    actor,
    timestamp,
  };

  // 1. Market is in sync — the quote already reflects every known event.
  if (checks.registersInSync) {
    return {
      ...base,
      verdict: "ALLOWED",
      reason: `Market in sync (materialSeq ${materialSeq} ≤ pricedAtSeq ${pricedAtSeq}). Trade executes at a fair quote.`,
    };
  }

  // 2. Stale AND the order profits from the un-repriced event → void + refund.
  if (checks.edgeAboveTolerance) {
    return {
      ...base,
      verdict: "VOIDED_REFUNDED",
      reason: `Stale window: materialSeq ${materialSeq} > pricedAtSeq ${pricedAtSeq}. Buying ${side} at ${cents(observedPrice)} vs fair ${cents(fair)} captures +${cents(edge)} of unfair edge (> ${cents(tolerance)} tolerance). Order voided and stake refunded.`,
    };
  }

  // 3. Stale, but this order takes no advantage → let it through.
  return {
    ...base,
    verdict: "STALE_ALLOWED_NO_EDGE",
    reason: `Stale window open, but a ${side} order captures no unfair edge (${
      edge <= 0 ? `${cents(edge)} — it trades against the un-repriced event` : `+${cents(edge)} ≤ ${cents(tolerance)} tolerance`
    }). Allowed: LineGuard blocks exploitation, not the market.`,
  };
}

/** 0.63 → "63¢" — shared price formatting used in verdict reasons. */
export function cents(price: number): string {
  return `${Math.round(price * 100)}¢`;
}
