import { sha256 } from "js-sha256";
import { canonicalize } from "@/lib/receipts/create";
import { REFERENCE_MICROS_ONE } from "@/lib/polymarket/config";
import { HASH_RE } from "@/lib/polymarket/hash";
import type { OrderSide, SignedOrderConstraints } from "@/lib/polymarket/execution";
import type { PolymarketReferenceCapture } from "@/lib/polymarket/types";

/**
 * Adapt a Polymarket reference capture into the DEPLOYED LineGuard V2 pricing
 * commitment — with no program change. The reference midpoint becomes
 * `fair_price_micros`; the capture's normalized-quote hash becomes
 * `odds_payload_hash`; a Polymarket pricing-policy descriptor becomes
 * `pricing_model_hash`. `commit_txline_odds_v2` accepts exactly these.
 *
 * Pure and isomorphic (no Buffer) so it runs in a script, the server, or a test.
 */

/** The FairX pricing policy for a Polymarket-referenced market. Version === PRICING_MODEL_VERSION_V1. */
export const POLYMARKET_PRICING_MODEL = {
  id: "MATCH_WINNER_HOME_POLYMARKET_CLOB_MIDPOINT_V1",
  version: 1,
  source: "POLYMARKET_CLOB",
  method: "ORDERBOOK_MIDPOINT",
  microsScale: REFERENCE_MICROS_ONE,
} as const;

function hexToBytes32(hex: string): number[] {
  if (!HASH_RE.test(hex)) throw new Error(`expected a 32-byte hex hash, got ${hex}`);
  const out: number[] = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/**
 * `pricing_model_hash` binds the model descriptor AND the exact policy
 * thresholds in force (so a market cannot later be repriced under looser rules
 * without changing the committed model hash).
 */
export function polymarketPricingModelHash(capture: PolymarketReferenceCapture): string {
  return sha256(canonicalize({ model: POLYMARKET_PRICING_MODEL, policyHash: capture.pricingPolicyHash }));
}

export interface OnChainOddsCommitment {
  /** Monotonic odds sequence — the capture's book timestamp (ms). */
  oddsSequence: number;
  /** = recomputed reference midpoint. */
  fairPriceMicros: number;
  /** hex + bytes for `commit_txline_odds_v2` / `initialize_market_v2`. */
  oddsPayloadHash: string;
  oddsPayloadHashBytes: number[];
  pricingModelVersion: number;
  pricingModelHash: string;
  pricingModelHashBytes: number[];
}

/**
 * Build the odds-commitment args from a VALID capture. Throws on an invalid or
 * out-of-range quote — a rejected reference is never committed on-chain.
 */
export function buildOddsCommitmentFromCapture(
  capture: PolymarketReferenceCapture,
  oddsSequence: number = Number(capture.orderbook.timestamp)
): OnChainOddsCommitment {
  if (!capture.derived.quoteValid) {
    throw new Error(`refusing to commit an invalid reference quote: ${capture.derived.rejectionReasons.join(", ")}`);
  }
  const fairPriceMicros = capture.derived.midpointMicros;
  if (!(fairPriceMicros > 0 && fairPriceMicros < REFERENCE_MICROS_ONE)) {
    throw new Error(`reference midpoint ${fairPriceMicros} is out of range`);
  }
  const pricingModelHash = polymarketPricingModelHash(capture);
  return {
    oddsSequence,
    fairPriceMicros,
    oddsPayloadHash: capture.normalizedQuoteHash,
    oddsPayloadHashBytes: hexToBytes32(capture.normalizedQuoteHash),
    pricingModelVersion: POLYMARKET_PRICING_MODEL.version,
    pricingModelHash,
    pricingModelHashBytes: hexToBytes32(pricingModelHash),
  };
}

/**
 * Build the trader's signed `place_order_v2` constraints so the exact committed
 * Polymarket quote is pinned: `expected_odds_sequence` = this quote's sequence,
 * `expected_execution_price` = the side price at the displayed quote.
 */
export function buildSignedConstraints(params: {
  side: OrderSide;
  stakeLamports: number;
  displayedPriceMicros: number;
  pricedAtSeq: number;
  oddsSequence: number;
  maxSlippageMicros: number;
  maxAcceptedEdgeMicros: number;
  expirySlot: number;
}): SignedOrderConstraints {
  const expectedExecutionPriceMicros =
    params.side === "YES" ? params.displayedPriceMicros : REFERENCE_MICROS_ONE - params.displayedPriceMicros;
  return {
    side: params.side,
    stakeLamports: params.stakeLamports,
    expectedExecutionPriceMicros,
    maxSlippageMicros: params.maxSlippageMicros,
    maxAcceptedEdgeMicros: params.maxAcceptedEdgeMicros,
    expectedPricingSequence: params.pricedAtSeq,
    expectedOddsSequence: params.oddsSequence,
    expirySlot: params.expirySlot,
  };
}
