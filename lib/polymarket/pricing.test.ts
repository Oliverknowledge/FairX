import { describe, expect, it } from "vitest";
import { getPolymarketConfig, type PolymarketReferenceConfig } from "@/lib/polymarket/config";
import { REJECTION, buildReferenceQuote } from "@/lib/polymarket/pricing";
import type { RawOrderBook } from "@/lib/polymarket/types";

const NOW = 1_783_960_000_000;

const cfg = (o: Partial<PolymarketReferenceConfig> = {}): PolymarketReferenceConfig => ({ ...getPolymarketConfig(), ...o });

const book = (bids: [number, number][], asks: [number, number][], extra: Partial<RawOrderBook> = {}): RawOrderBook => ({
  market: "0xcond",
  assetId: "123456",
  timestamp: NOW - 1_000,
  hash: "abc",
  bids: bids.map(([price, size]) => ({ price: String(price), size: String(size) })),
  asks: asks.map(([price, size]) => ({ price: String(price), size: String(size) })),
  lastTradePrice: 0.4,
  ...extra,
});

const good = () => book([[0.41, 5000], [0.4, 5000]], [[0.42, 5000], [0.43, 5000]]);

describe("reference-price policy", () => {
  it("produces an ORDERBOOK_MIDPOINT quote for a healthy book", () => {
    const q = buildReferenceQuote(good(), { now: NOW, config: cfg() });
    expect(q.method).toBe("ORDERBOOK_MIDPOINT");
    expect(q.quoteValid).toBe(true);
    expect(q.rejectionReasons).toEqual([]);
    expect(q.midpointMicros).toBe(415_000);
  });

  it("rejects an empty bid side", () => {
    const q = buildReferenceQuote(book([], [[0.42, 5000]]), { now: NOW, config: cfg() });
    expect(q.quoteValid).toBe(false);
    expect(q.method).toBe("UNAVAILABLE");
    expect(q.rejectionReasons).toContain(REJECTION.EMPTY_BID);
  });

  it("rejects an empty ask side", () => {
    const q = buildReferenceQuote(book([[0.41, 5000]], []), { now: NOW, config: cfg() });
    expect(q.rejectionReasons).toContain(REJECTION.EMPTY_ASK);
  });

  it("rejects a crossed book", () => {
    const q = buildReferenceQuote(book([[0.6, 5000]], [[0.5, 5000]]), { now: NOW, config: cfg() });
    expect(q.rejectionReasons).toContain(REJECTION.CROSSED_BOOK);
  });

  it("rejects a spread wider than the configured max", () => {
    const q = buildReferenceQuote(book([[0.3, 5000]], [[0.7, 5000]]), { now: NOW, config: cfg({ maxSpreadMicros: 50_000 }) });
    expect(q.rejectionReasons).toContain(REJECTION.SPREAD_TOO_WIDE);
  });

  it("rejects insufficient visible depth", () => {
    const q = buildReferenceQuote(book([[0.41, 10]], [[0.42, 10]]), { now: NOW, config: cfg({ minVisibleDepth: 100 }) });
    expect(q.rejectionReasons).toContain(REJECTION.INSUFFICIENT_DEPTH);
  });

  it("rejects a stale quote", () => {
    const q = buildReferenceQuote(good(), { now: NOW + 120_000, config: cfg({ maxQuoteAgeMs: 60_000 }) });
    expect(q.rejectionReasons).toContain(REJECTION.QUOTE_TOO_OLD);
  });

  it("rejects a future/invalid timestamp", () => {
    const q = buildReferenceQuote(book([[0.41, 5000]], [[0.42, 5000]], { timestamp: NOW + 60_000 }), { now: NOW, config: cfg() });
    expect(q.rejectionReasons).toContain(REJECTION.INVALID_TIMESTAMP);
  });

  it("rejects a closed market", () => {
    const q = buildReferenceQuote(good(), { now: NOW, marketClosed: true, config: cfg() });
    expect(q.rejectionReasons).toContain(REJECTION.MARKET_CLOSED);
  });

  it("does not hide divergence between simple and depth-weighted midpoints", () => {
    // simple mid 0.505; depth-weighted bid ~0.3002 over a 1000 window → mid ~0.4051.
    const q = buildReferenceQuote(book([[0.5, 1], [0.3, 1000]], [[0.51, 1000]]), {
      now: NOW,
      config: cfg({ depthWindowSize: 1000, maxMethodDivergenceMicros: 20_000, minVisibleDepth: 100 }),
    });
    expect(q.rejectionReasons).toContain(REJECTION.METHOD_DIVERGENCE);
  });

  it("uses last-trade fallback only when explicitly configured", () => {
    const q = buildReferenceQuote(book([], [], { lastTradePrice: 0.4 }), {
      now: NOW,
      config: cfg({ referenceMethod: "LAST_TRADE_FALLBACK" }),
    });
    expect(q.method).toBe("LAST_TRADE_FALLBACK");
    expect(q.quoteValid).toBe(true);
    expect(q.midpointMicros).toBe(400_000);
  });

  it("depth-weighted method rejects an unfilled window", () => {
    const q = buildReferenceQuote(book([[0.41, 10]], [[0.42, 10]]), {
      now: NOW,
      config: cfg({ referenceMethod: "DEPTH_WEIGHTED_MIDPOINT", depthWindowSize: 1000, minVisibleDepth: 1 }),
    });
    expect(q.rejectionReasons).toContain(REJECTION.DEPTH_WINDOW_UNFILLED);
    expect(q.method).toBe("UNAVAILABLE");
  });

  it("never silently defaults to 0.5", () => {
    const q = buildReferenceQuote(book([], []), { now: NOW, config: cfg() });
    expect(q.quoteValid).toBe(false);
    expect(q.midpointMicros).not.toBe(500_000);
  });
});
