import { REFERENCE_MICROS_ONE } from "@/lib/polymarket/config";

/**
 * Pure off-chain mirror of the DEPLOYED LineGuard V2 execution path, so a
 * Polymarket reference quote can be previewed, receipt-verified, and demo-
 * prepared without sending a transaction — and so tests pin the exact accept /
 * reject / verdict logic the on-chain program enforces.
 *
 * Mirrors `place_order_v2` (signed constraints) and `evaluate_order_v2`
 * (verdict) from programs/lineguard/src/lib.rs. NO program change is required:
 * the Polymarket reference quote is committed through the existing
 * `commit_txline_odds_v2` slot (odds_sequence + odds_payload_hash +
 * fair_price_micros), and the trader signs the existing constraint fields.
 */

export const MICROS_ONE = REFERENCE_MICROS_ONE;

export type OrderSide = "YES" | "NO";

/** The reference state committed on-chain (fair price sourced from Polymarket midpoint). */
export interface CommittedMarketState {
  oddsSequence: number;
  pricedAtSeq: number;
  materialSeq: number;
  /** YES displayed price; NO is the complement. */
  displayedPriceMicros: number;
  /** YES fair price = the committed Polymarket reference midpoint. */
  fairPriceMicros: number;
  oddsPayloadHash: string;
  toleranceMicros: number;
  closeTimeSec: number;
  tradingClosed: boolean;
  resolved: boolean;
}

/** Exactly what the trader signs in `place_order_v2`. */
export interface SignedOrderConstraints {
  side: OrderSide;
  stakeLamports: number;
  expectedExecutionPriceMicros: number;
  maxSlippageMicros: number;
  maxAcceptedEdgeMicros: number;
  expectedPricingSequence: number;
  expectedOddsSequence: number;
  expirySlot: number;
}

export interface ExecutionContext {
  currentSlot: number;
  nowSec: number;
}

export type PlacementRejection =
  | "INVALID_STAKE"
  | "INVALID_PRICE"
  | "TRADING_CLOSED"
  | "MARKET_RESOLVED"
  | "PAST_CLOSE_TIME"
  | "ORDER_EXPIRED"
  | "PRICING_SEQUENCE_MISMATCH"
  | "ODDS_SEQUENCE_MISMATCH"
  | "SLIPPAGE_EXCEEDED";

export interface PlacementResult {
  accepted: boolean;
  rejection: PlacementRejection | null;
  observedPriceMicros: number;
}

export function sidePriceMicros(displayedYesMicros: number, side: OrderSide): number {
  return side === "YES" ? displayedYesMicros : MICROS_ONE - displayedYesMicros;
}

/** Mirror of `place_order_v2`'s require! chain. Returns the first failing check. */
export function evaluatePlacement(
  market: CommittedMarketState,
  signed: SignedOrderConstraints,
  ctx: ExecutionContext
): PlacementResult {
  const observedPriceMicros = sidePriceMicros(market.displayedPriceMicros, signed.side);
  const reject = (rejection: PlacementRejection): PlacementResult => ({ accepted: false, rejection, observedPriceMicros });

  if (!(signed.stakeLamports > 0)) return reject("INVALID_STAKE");
  if (
    !(signed.expectedExecutionPriceMicros > 0 && signed.expectedExecutionPriceMicros < MICROS_ONE) ||
    signed.maxSlippageMicros > MICROS_ONE
  ) {
    return reject("INVALID_PRICE");
  }
  if (market.tradingClosed) return reject("TRADING_CLOSED");
  if (market.resolved) return reject("MARKET_RESOLVED");
  if (!(ctx.nowSec < market.closeTimeSec)) return reject("PAST_CLOSE_TIME");
  if (!(ctx.currentSlot <= signed.expirySlot)) return reject("ORDER_EXPIRED");
  if (market.pricedAtSeq !== signed.expectedPricingSequence) return reject("PRICING_SEQUENCE_MISMATCH");
  if (market.oddsSequence !== signed.expectedOddsSequence) return reject("ODDS_SEQUENCE_MISMATCH");
  if (Math.abs(observedPriceMicros - signed.expectedExecutionPriceMicros) > signed.maxSlippageMicros) {
    return reject("SLIPPAGE_EXCEEDED");
  }
  return { accepted: true, rejection: null, observedPriceMicros };
}

export type GuardVerdict = "FILLED" | "VOIDED_REFUNDED";

export interface GuardEvaluation {
  verdict: GuardVerdict;
  fairSidePriceMicros: number;
  observedPriceMicros: number;
  edgeMicros: number;
  stale: boolean;
  acceptedEdgeMicros: number;
  refunded: boolean;
}

/**
 * Mirror of `evaluate_order_v2`:
 *   refund = trading_closed || resolved || (stale && edge > min(maxAcceptedEdge, tolerance))
 * `stale` compares the CURRENT material_seq against the order's snapshotted
 * priced_at_seq. The trader's `maxAcceptedEdge` can only tighten protection.
 */
export function evaluateGuardVerdict(
  market: Pick<CommittedMarketState, "fairPriceMicros" | "materialSeq" | "toleranceMicros" | "tradingClosed" | "resolved">,
  order: { side: OrderSide; observedPriceMicros: number; pricedAtSeq: number; maxAcceptedEdgeMicros: number }
): GuardEvaluation {
  const fairSidePriceMicros = order.side === "YES" ? market.fairPriceMicros : MICROS_ONE - market.fairPriceMicros;
  const edgeMicros = fairSidePriceMicros - order.observedPriceMicros;
  const stale = market.materialSeq > order.pricedAtSeq;
  const acceptedEdgeMicros = Math.min(order.maxAcceptedEdgeMicros, market.toleranceMicros);
  const refunded = market.tradingClosed || market.resolved || (stale && edgeMicros > acceptedEdgeMicros);
  return {
    verdict: refunded ? "VOIDED_REFUNDED" : "FILLED",
    fairSidePriceMicros,
    observedPriceMicros: order.observedPriceMicros,
    edgeMicros,
    stale,
    acceptedEdgeMicros,
    refunded,
  };
}
