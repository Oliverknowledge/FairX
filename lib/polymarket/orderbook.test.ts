import { describe, expect, it } from "vitest";
import { computeDepthWeightedQuote, computeOrderBookMetrics, priceToMicros } from "@/lib/polymarket/orderbook";
import type { RawOrderBook } from "@/lib/polymarket/types";

const book = (bids: [number, number][], asks: [number, number][], extra: Partial<RawOrderBook> = {}): RawOrderBook => ({
  market: "0xcond",
  assetId: "123456",
  timestamp: 1_783_960_000_000,
  hash: "abc",
  bids: bids.map(([price, size]) => ({ price: String(price), size: String(size) })),
  asks: asks.map(([price, size]) => ({ price: String(price), size: String(size) })),
  lastTradePrice: 0.41,
  ...extra,
});

describe("order book metrics", () => {
  it("recomputes best bid/ask/midpoint/spread from UNORDERED levels", () => {
    const m = computeOrderBookMetrics(book([[0.4, 100], [0.41, 50]], [[0.44, 100], [0.42, 60]]));
    expect(m.bestBidMicros).toBe(410_000);
    expect(m.bestAskMicros).toBe(420_000);
    expect(m.midpointMicros).toBe(415_000);
    expect(m.spreadMicros).toBe(10_000);
    expect(m.bidDepth).toBe(150);
    expect(m.askDepth).toBe(160);
    expect(m.lastTradeMicros).toBe(410_000);
  });

  it("marks a side empty without inventing a midpoint", () => {
    const m = computeOrderBookMetrics(book([[0.4, 100]], []));
    expect(m.askLevels).toBe(0);
    expect(m.bestAskMicros).toBe(0);
    expect(m.midpointMicros).toBe(0);
    expect(m.spreadMicros).toBe(0);
  });

  it("priceToMicros rounds to the micro", () => {
    expect(priceToMicros("0.411250")).toBe(411_250);
    expect(priceToMicros(0.5)).toBe(500_000);
  });
});

describe("depth-weighted quote", () => {
  it("size-weights across levels within the window", () => {
    const q = computeDepthWeightedQuote(book([[0.41, 60], [0.4, 60]], [[0.42, 60], [0.43, 60]]), 100);
    // bid: 60@0.41 + 40@0.40 = 40.6/100 = 0.406
    expect(q.weightedBidMicros).toBe(406_000);
    // ask: 60@0.42 + 40@0.43 = 42.4/100 = 0.424
    expect(q.weightedAskMicros).toBe(424_000);
    expect(q.weightedMidpointMicros).toBe(415_000);
    expect(q.filled).toBe(true);
  });

  it("reports unfilled when a side cannot fill the window", () => {
    const q = computeDepthWeightedQuote(book([[0.41, 10]], [[0.42, 10]]), 100);
    expect(q.filled).toBe(false);
  });
});
