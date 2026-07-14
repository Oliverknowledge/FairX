import { describe, expect, it } from "vitest";
import { buildReferenceCapture, serializeReferenceCapture } from "@/lib/polymarket/capture";
import { getPolymarketConfig } from "@/lib/polymarket/config";
import { FRANCE_SPAIN_MAPPING } from "@/lib/polymarket/mapping";
import { buildReferenceQuote } from "@/lib/polymarket/pricing";
import type { PolymarketMarketDescriptor, PolymarketReferenceCapture, RawOrderBook } from "@/lib/polymarket/types";
import { verifyReferenceCapture } from "@/lib/polymarket/verify";

const NOW = 1_783_960_000_000;
const m = FRANCE_SPAIN_MAPPING;

const descriptor: PolymarketMarketDescriptor = {
  eventId: m.polymarketEventId,
  marketId: m.polymarketMarketId,
  conditionId: m.polymarketConditionId,
  slug: m.polymarketSlug,
  question: m.polymarketQuestion,
  yesTokenId: m.polymarketYesTokenId,
  noTokenId: m.polymarketNoTokenId,
  outcomes: ["Yes", "No"],
  resolutionRules: m.polymarketResolutionRules,
  active: true,
  closed: false,
  enableOrderBook: true,
};

const rawBook: RawOrderBook = {
  market: m.polymarketConditionId,
  assetId: m.polymarketYesTokenId,
  timestamp: NOW - 1_000,
  hash: "bookhash1234",
  bids: [
    { price: "0.41", size: "5000" },
    { price: "0.4", size: "5000" },
  ],
  asks: [
    { price: "0.42", size: "5000" },
    { price: "0.43", size: "5000" },
  ],
  lastTradePrice: 0.41,
};

function freshCapture(): PolymarketReferenceCapture {
  const quote = buildReferenceQuote(rawBook, { now: NOW, config: getPolymarketConfig() });
  return buildReferenceCapture({
    mapping: m,
    descriptor,
    book: rawBook,
    quote,
    mode: "HISTORICAL_CAPTURE",
    capturedAt: new Date(NOW).toISOString(),
  });
}

const clone = (c: PolymarketReferenceCapture): PolymarketReferenceCapture => JSON.parse(JSON.stringify(c));

describe("reference capture build + verify", () => {
  it("a fresh capture verifies with every status green", () => {
    const result = verifyReferenceCapture(freshCapture());
    expect(result.valid).toBe(true);
    expect(result.mode).toBe("RECORDED_EVIDENCE");
    expect(result.statuses).toEqual({
      mappingVerified: true,
      fixtureOrientationVerified: true,
      orderbookIntegrityVerified: true,
      referenceQuoteVerified: true,
    });
  });

  it("hashes are deterministic and canonical", () => {
    expect(freshCapture().rawPayloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(serializeReferenceCapture(freshCapture())).toBe(serializeReferenceCapture(freshCapture()));
  });

  it("detects a tampered order-book level", () => {
    const t = clone(freshCapture());
    t.orderbook.bids[0].price = "0.99";
    const r = verifyReferenceCapture(t);
    expect(r.valid).toBe(false);
    expect(r.statuses.orderbookIntegrityVerified).toBe(false);
  });

  it("detects a forged midpoint", () => {
    const t = clone(freshCapture());
    t.derived.midpointMicros = 990_000;
    expect(verifyReferenceCapture(t).valid).toBe(false);
  });

  it("detects a tampered mapping (team swap)", () => {
    const t = clone(freshCapture());
    t.mapping.txlineHomeTeam = "Spain";
    const r = verifyReferenceCapture(t);
    expect(r.valid).toBe(false);
    expect(r.statuses.mappingVerified).toBe(false);
  });

  it("detects a swapped token id (substitution)", () => {
    const t = clone(freshCapture());
    t.market.yesTokenId = "111111111";
    const r = verifyReferenceCapture(t);
    expect(r.valid).toBe(false);
    expect(r.statuses.fixtureOrientationVerified).toBe(false);
  });

  it("detects a tampered timestamp", () => {
    const t = clone(freshCapture());
    t.orderbook.timestamp = String(NOW - 999_999);
    expect(verifyReferenceCapture(t).valid).toBe(false);
  });

  it("detects a forged normalized quote hash", () => {
    const t = clone(freshCapture());
    t.normalizedQuoteHash = "0".repeat(64);
    expect(verifyReferenceCapture(t).valid).toBe(false);
  });

  it("serialization refuses secret metadata", () => {
    const t = clone(freshCapture()) as PolymarketReferenceCapture & { orderbook: { authorization?: string } };
    (t.orderbook as { authorization?: string }).authorization = "Bearer leaked";
    expect(() => serializeReferenceCapture(t)).toThrow(/secret/);
  });
});
