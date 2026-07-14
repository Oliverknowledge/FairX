import { REFERENCE_MICROS_ONE } from "@/lib/polymarket/config";
import type { DepthWeightedQuote, OrderBookMetrics, RawBookLevel, RawOrderBook } from "@/lib/polymarket/types";

/**
 * Order-book math. Everything here is recomputed from the raw levels — the
 * adapter never trusts Polymarket's precomputed `midpoint`/`spread`/`bestBid`
 * fields for the canonical quote. Best bid is the highest bid, best ask the
 * lowest ask; we sort defensively rather than assume array ordering.
 */

export function priceToMicros(price: number | string): number {
  const n = typeof price === "number" ? price : Number(price);
  return Math.round(n * REFERENCE_MICROS_ONE);
}

function sizeOf(level: RawBookLevel): number {
  const n = Number(level.size);
  return Number.isFinite(n) ? n : 0;
}
function priceOf(level: RawBookLevel): number {
  const n = Number(level.price);
  return Number.isFinite(n) ? n : NaN;
}

/** Bids sorted best (highest price) first. */
export function sortedBids(book: RawOrderBook): RawBookLevel[] {
  return [...book.bids].filter((l) => Number.isFinite(priceOf(l))).sort((a, b) => priceOf(b) - priceOf(a));
}
/** Asks sorted best (lowest price) first. */
export function sortedAsks(book: RawOrderBook): RawBookLevel[] {
  return [...book.asks].filter((l) => Number.isFinite(priceOf(l))).sort((a, b) => priceOf(a) - priceOf(b));
}

export function computeOrderBookMetrics(book: RawOrderBook): OrderBookMetrics {
  const bids = sortedBids(book);
  const asks = sortedAsks(book);
  const bestBid = bids.length ? priceOf(bids[0]) : NaN;
  const bestAsk = asks.length ? priceOf(asks[0]) : NaN;

  const bidDepth = bids.reduce((sum, l) => sum + sizeOf(l), 0);
  const askDepth = asks.reduce((sum, l) => sum + sizeOf(l), 0);

  const bestBidMicros = Number.isFinite(bestBid) ? priceToMicros(bestBid) : 0;
  const bestAskMicros = Number.isFinite(bestAsk) ? priceToMicros(bestAsk) : 0;
  const bothSides = Number.isFinite(bestBid) && Number.isFinite(bestAsk);

  return {
    bestBidMicros,
    bestAskMicros,
    midpointMicros: bothSides ? Math.round((bestBidMicros + bestAskMicros) / 2) : 0,
    spreadMicros: bothSides ? bestAskMicros - bestBidMicros : 0,
    bidDepth: round4(bidDepth),
    askDepth: round4(askDepth),
    bidLevels: bids.length,
    askLevels: asks.length,
    lastTradeMicros:
      typeof book.lastTradePrice === "number" && Number.isFinite(book.lastTradePrice)
        ? priceToMicros(book.lastTradePrice)
        : null,
  };
}

/**
 * Size-weighted midpoint over a fixed cumulative-size window on each side. A
 * diagnostic only: the canonical quote stays the simple midpoint unless the
 * two agree. If a side cannot fill the window, `filled` is false.
 */
export function computeDepthWeightedQuote(book: RawOrderBook, windowSize: number): DepthWeightedQuote {
  const bidSide = consume(sortedBids(book), windowSize);
  const askSide = consume(sortedAsks(book), windowSize);
  const weightedBidMicros = bidSide.filledSize > 0 ? priceToMicros(bidSide.notional / bidSide.filledSize) : 0;
  const weightedAskMicros = askSide.filledSize > 0 ? priceToMicros(askSide.notional / askSide.filledSize) : 0;
  const filled = bidSide.filled && askSide.filled;
  return {
    windowSize,
    bidNotional: round4(bidSide.notional),
    askNotional: round4(askSide.notional),
    weightedBidMicros,
    weightedAskMicros,
    weightedMidpointMicros: filled ? Math.round((weightedBidMicros + weightedAskMicros) / 2) : 0,
    filled,
  };
}

function consume(levels: RawBookLevel[], windowSize: number): {
  notional: number;
  filledSize: number;
  filled: boolean;
} {
  let remaining = windowSize;
  let notional = 0;
  let filledSize = 0;
  for (const level of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, sizeOf(level));
    notional += take * priceOf(level);
    filledSize += take;
    remaining -= take;
  }
  return { notional, filledSize, filled: remaining <= 0 && windowSize > 0 };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
