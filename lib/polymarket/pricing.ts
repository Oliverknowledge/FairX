import { getPolymarketConfig, type PolymarketReferenceConfig, type ReferenceMethod } from "@/lib/polymarket/config";
import { computeDepthWeightedQuote, computeOrderBookMetrics } from "@/lib/polymarket/orderbook";
import { REFERENCE_MICROS_ONE } from "@/lib/polymarket/config";
import type { ReferenceQuote, RawOrderBook } from "@/lib/polymarket/types";

/**
 * Deterministic reference-price policy.
 *
 * The default reference is the YES-token order-book midpoint, recomputed from
 * best bid and best ask. A quote is REJECTED (method UNAVAILABLE, quoteValid
 * false) — never silently defaulted to 0.5 or silently downgraded to last
 * trade — whenever any of these hold:
 *   empty side · crossed book · spread too wide · depth too thin · quote too
 *   old · market closed · price out of [0,1] · invalid timestamp · the simple
 *   and depth-weighted midpoints diverge beyond tolerance.
 *
 * A fallback (depth-weighted, or last-trade) is used ONLY when explicitly
 * configured, and is always reported in `method`.
 */

export interface BuildQuoteOptions {
  now?: number;
  /** Market closed flag from Gamma discovery — a closed book is never a live reference. */
  marketClosed?: boolean;
  config?: PolymarketReferenceConfig;
}

export const REJECTION = {
  EMPTY_BID: "EMPTY_BID",
  EMPTY_ASK: "EMPTY_ASK",
  CROSSED_BOOK: "CROSSED_BOOK",
  SPREAD_TOO_WIDE: "SPREAD_TOO_WIDE",
  INSUFFICIENT_DEPTH: "INSUFFICIENT_DEPTH",
  QUOTE_TOO_OLD: "QUOTE_TOO_OLD",
  INVALID_TIMESTAMP: "INVALID_TIMESTAMP",
  MARKET_CLOSED: "MARKET_CLOSED",
  PRICE_OUT_OF_RANGE: "PRICE_OUT_OF_RANGE",
  METHOD_DIVERGENCE: "METHOD_DIVERGENCE",
  DEPTH_WINDOW_UNFILLED: "DEPTH_WINDOW_UNFILLED",
  NO_LAST_TRADE: "NO_LAST_TRADE",
} as const;

const inUnitRange = (micros: number): boolean => micros > 0 && micros < REFERENCE_MICROS_ONE;

export function buildReferenceQuote(book: RawOrderBook, opts: BuildQuoteOptions = {}): ReferenceQuote {
  const cfg = opts.config ?? getPolymarketConfig();
  const now = opts.now ?? Date.now();
  const method: ReferenceMethod = cfg.referenceMethod;

  const metrics = computeOrderBookMetrics(book);
  const depthWeighted = computeDepthWeightedQuote(book, cfg.depthWindowSize);
  const rawAgeMs = now - book.timestamp;
  const quoteAgeMs = Math.max(0, rawAgeMs);

  const reasons: string[] = [];

  // Timestamp validity first — a bad clock invalidates every age-based check.
  const timestampValid = book.timestamp > 0 && book.timestamp <= now + 5_000;
  if (!timestampValid) reasons.push(REJECTION.INVALID_TIMESTAMP);

  if (metrics.bidLevels === 0) reasons.push(REJECTION.EMPTY_BID);
  if (metrics.askLevels === 0) reasons.push(REJECTION.EMPTY_ASK);

  const bothSides = metrics.bidLevels > 0 && metrics.askLevels > 0;
  if (bothSides && metrics.bestBidMicros >= metrics.bestAskMicros) reasons.push(REJECTION.CROSSED_BOOK);
  if (bothSides && metrics.spreadMicros > cfg.maxSpreadMicros) reasons.push(REJECTION.SPREAD_TOO_WIDE);
  if (metrics.bidDepth < cfg.minVisibleDepth || metrics.askDepth < cfg.minVisibleDepth) {
    reasons.push(REJECTION.INSUFFICIENT_DEPTH);
  }
  if (timestampValid && rawAgeMs > cfg.maxQuoteAgeMs) reasons.push(REJECTION.QUOTE_TOO_OLD);
  if (opts.marketClosed) reasons.push(REJECTION.MARKET_CLOSED);
  if (bothSides && (!inUnitRange(metrics.bestBidMicros) || !inUnitRange(metrics.bestAskMicros) || !inUnitRange(metrics.midpointMicros))) {
    reasons.push(REJECTION.PRICE_OUT_OF_RANGE);
  }
  // Do not hide disagreement between quote methods.
  if (bothSides && depthWeighted.filled) {
    const divergence = Math.abs(depthWeighted.weightedMidpointMicros - metrics.midpointMicros);
    if (divergence > cfg.maxMethodDivergenceMicros) reasons.push(REJECTION.METHOD_DIVERGENCE);
  }

  const base = {
    bestBidMicros: metrics.bestBidMicros,
    bestAskMicros: metrics.bestAskMicros,
    spreadMicros: metrics.spreadMicros,
    bidDepth: metrics.bidDepth,
    askDepth: metrics.askDepth,
    lastTradeMicros: metrics.lastTradeMicros,
    quoteTimestamp: book.timestamp,
    quoteAgeMs,
    tokenId: book.assetId,
    conditionId: book.market,
    orderBookHash: book.hash,
    depthWeighted,
  };

  // Method selection. Default ORDERBOOK_MIDPOINT; alternatives only when configured.
  if (method === "DEPTH_WEIGHTED_MIDPOINT") {
    if (!depthWeighted.filled) reasons.push(REJECTION.DEPTH_WINDOW_UNFILLED);
    const valid = reasons.length === 0;
    return {
      ...base,
      method: valid ? "DEPTH_WEIGHTED_MIDPOINT" : "UNAVAILABLE",
      quoteValid: valid,
      rejectionReasons: reasons,
      midpointMicros: valid ? depthWeighted.weightedMidpointMicros : metrics.midpointMicros,
    };
  }

  if (method === "LAST_TRADE_FALLBACK") {
    // Explicit degraded mode: use last trade, but still refuse closed/stale/bad-timestamp.
    const lastTrade = metrics.lastTradeMicros;
    const blockers: string[] = reasons.filter((r) =>
      r === REJECTION.MARKET_CLOSED || r === REJECTION.QUOTE_TOO_OLD || r === REJECTION.INVALID_TIMESTAMP
    );
    if (lastTrade === null || !inUnitRange(lastTrade)) blockers.push(REJECTION.NO_LAST_TRADE);
    const valid = blockers.length === 0;
    return {
      ...base,
      method: valid ? "LAST_TRADE_FALLBACK" : "UNAVAILABLE",
      quoteValid: valid,
      rejectionReasons: valid ? [] : Array.from(new Set([...reasons, ...blockers])),
      midpointMicros: valid && lastTrade !== null ? lastTrade : metrics.midpointMicros,
    };
  }

  // Default: ORDERBOOK_MIDPOINT.
  const valid = reasons.length === 0;
  return {
    ...base,
    method: valid ? "ORDERBOOK_MIDPOINT" : "UNAVAILABLE",
    quoteValid: valid,
    rejectionReasons: reasons,
    midpointMicros: metrics.midpointMicros,
  };
}
