import { getPolymarketConfig, type PolymarketReferenceConfig } from "@/lib/polymarket/config";
import {
  HASH_RE,
  computeMappingHash,
  computeNormalizedQuoteHash,
  computePricingPolicyHash,
  computeRawPayloadHash,
} from "@/lib/polymarket/hash";
import { verifyMapping } from "@/lib/polymarket/mapping";
import { computeOrderBookMetrics } from "@/lib/polymarket/orderbook";
import { buildReferenceQuote } from "@/lib/polymarket/pricing";
import type { PolymarketReferenceCapture, RawOrderBook } from "@/lib/polymarket/types";

/**
 * Deep, offline verifier for a durable reference capture. It RECOMPUTES every
 * hash and re-derives the whole quote from the stored raw book using the stored
 * policy — so tampering with any level, the midpoint, the spread, the method,
 * the mapping, the timestamp, or a hash is detected.
 *
 * This is RECORDED-EVIDENCE verification: it proves the bundled capture is
 * internally consistent and untampered. It does NOT re-fetch Polymarket, so it
 * never claims LIVE VERIFIED — a separate live path owns that label.
 */

export interface ReferenceCaptureVerification {
  valid: boolean;
  mode: "RECORDED_EVIDENCE";
  errors: string[];
  statuses: {
    mappingVerified: boolean;
    fixtureOrientationVerified: boolean;
    orderbookIntegrityVerified: boolean;
    referenceQuoteVerified: boolean;
  };
  recomputed: {
    rawPayloadHash: string;
    mappingHash: string;
    normalizedQuoteHash: string;
    pricingPolicyHash: string;
    bestBidMicros: number;
    bestAskMicros: number;
    midpointMicros: number;
    spreadMicros: number;
  };
}

function configFromPolicy(policy: PolymarketReferenceCapture["policy"]): PolymarketReferenceConfig {
  return { ...getPolymarketConfig(), ...policy };
}

/** Reconstruct the exact RawOrderBook the pricing policy originally consumed. */
export function reconstructBook(capture: PolymarketReferenceCapture): RawOrderBook {
  return {
    market: capture.market.conditionId,
    assetId: capture.market.yesTokenId,
    timestamp: Number(capture.orderbook.timestamp),
    hash: capture.orderbook.hash,
    bids: capture.orderbook.bids,
    asks: capture.orderbook.asks,
    lastTradePrice:
      capture.orderbook.lastTradePrice !== undefined ? Number(capture.orderbook.lastTradePrice) : undefined,
  };
}

function sameReasons(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function verifyReferenceCapture(capture: PolymarketReferenceCapture): ReferenceCaptureVerification {
  const errors: string[] = [];

  // 1. Structural.
  if (capture.version !== 1) errors.push("version must be 1");
  if (capture.source !== "POLYMARKET_CLOB") errors.push("source must be POLYMARKET_CLOB");
  if (capture.mode !== "LIVE" && capture.mode !== "HISTORICAL_CAPTURE") errors.push("mode is invalid");
  for (const [k, v] of Object.entries({
    rawPayloadHash: capture.rawPayloadHash,
    mappingHash: capture.mappingHash,
    normalizedQuoteHash: capture.normalizedQuoteHash,
    pricingPolicyHash: capture.pricingPolicyHash,
  })) {
    if (!HASH_RE.test(v ?? "")) errors.push(`${k} is malformed`);
  }

  // 2. Mapping identity + orientation.
  const mappingErrors = verifyMapping(capture.mapping);
  errors.push(...mappingErrors.map((e) => `mapping: ${e}`));
  const orientationOk =
    capture.market.conditionId === capture.mapping.polymarketConditionId &&
    capture.market.yesTokenId === capture.mapping.polymarketYesTokenId &&
    capture.market.noTokenId === capture.mapping.polymarketNoTokenId &&
    capture.market.marketId === capture.mapping.polymarketMarketId;
  if (!orientationOk) errors.push("market identity does not match mapping (possible token/condition substitution)");
  if (capture.mappingHash !== capture.mapping.mappingHash) errors.push("capture mappingHash != mapping.mappingHash");

  // 3. Order-book integrity: raw payload hash + recomputed metrics.
  const recomputedRawHash = computeRawPayloadHash(capture.orderbook);
  if (recomputedRawHash !== capture.rawPayloadHash) errors.push("raw payload hash mismatch (order book tampered)");
  const book = reconstructBook(capture);
  const metrics = computeOrderBookMetrics(book);
  if (metrics.bestBidMicros !== capture.derived.bestBidMicros) errors.push("best bid does not recompute");
  if (metrics.bestAskMicros !== capture.derived.bestAskMicros) errors.push("best ask does not recompute");
  if (metrics.spreadMicros !== capture.derived.spreadMicros) errors.push("spread does not recompute");
  if (String(metrics.bidDepth) !== capture.derived.bidDepth) errors.push("bid depth does not recompute");
  if (String(metrics.askDepth) !== capture.derived.askDepth) errors.push("ask depth does not recompute");

  // 4. Reference quote: re-derive with stored policy at capture time.
  const cfg = configFromPolicy(capture.policy);
  const now = Date.parse(capture.capturedAt);
  const requote = buildReferenceQuote(book, {
    now: Number.isFinite(now) ? now : undefined,
    marketClosed: capture.derived.rejectionReasons.includes("MARKET_CLOSED"),
    config: cfg,
  });
  if (requote.midpointMicros !== capture.derived.midpointMicros) errors.push("midpoint does not recompute");
  if (requote.method !== capture.derived.method) errors.push("reference method does not recompute");
  if (requote.quoteValid !== capture.derived.quoteValid) errors.push("quoteValid does not recompute");
  if (!sameReasons(requote.rejectionReasons, capture.derived.rejectionReasons)) {
    errors.push("rejection reasons do not recompute");
  }

  const recomputedNormalizedQuoteHash = computeNormalizedQuoteHash({
    conditionId: capture.mapping.polymarketConditionId,
    yesTokenId: capture.mapping.polymarketYesTokenId,
    bestBidMicros: capture.derived.bestBidMicros,
    bestAskMicros: capture.derived.bestAskMicros,
    midpointMicros: capture.derived.midpointMicros,
    spreadMicros: capture.derived.spreadMicros,
    bidDepth: capture.derived.bidDepth,
    askDepth: capture.derived.askDepth,
    method: capture.derived.method,
    quoteTimestamp: capture.orderbook.timestamp,
    orderBookHash: capture.orderbook.hash,
  });
  if (recomputedNormalizedQuoteHash !== capture.normalizedQuoteHash) errors.push("normalized quote hash mismatch");
  const recomputedPolicyHash = computePricingPolicyHash(capture.policy);
  if (recomputedPolicyHash !== capture.pricingPolicyHash) errors.push("pricing policy hash mismatch");

  const statuses = {
    mappingVerified: mappingErrors.length === 0 && capture.mappingHash === capture.mapping.mappingHash,
    fixtureOrientationVerified: orientationOk,
    orderbookIntegrityVerified:
      recomputedRawHash === capture.rawPayloadHash &&
      metrics.bestBidMicros === capture.derived.bestBidMicros &&
      metrics.bestAskMicros === capture.derived.bestAskMicros &&
      metrics.spreadMicros === capture.derived.spreadMicros,
    referenceQuoteVerified:
      requote.midpointMicros === capture.derived.midpointMicros &&
      requote.method === capture.derived.method &&
      requote.quoteValid === capture.derived.quoteValid &&
      recomputedNormalizedQuoteHash === capture.normalizedQuoteHash &&
      recomputedPolicyHash === capture.pricingPolicyHash,
  };

  return {
    valid: errors.length === 0,
    mode: "RECORDED_EVIDENCE",
    errors,
    statuses,
    recomputed: {
      rawPayloadHash: recomputedRawHash,
      mappingHash: computeMappingHash((({ mappingHash, ...rest }) => rest)(capture.mapping)),
      normalizedQuoteHash: recomputedNormalizedQuoteHash,
      pricingPolicyHash: recomputedPolicyHash,
      bestBidMicros: metrics.bestBidMicros,
      bestAskMicros: metrics.bestAskMicros,
      midpointMicros: metrics.midpointMicros,
      spreadMicros: metrics.spreadMicros,
    },
  };
}

export function assertReferenceCapture(capture: PolymarketReferenceCapture): void {
  const result = verifyReferenceCapture(capture);
  if (!result.valid) throw new Error(`Invalid Polymarket reference capture: ${result.errors.join("; ")}`);
}
