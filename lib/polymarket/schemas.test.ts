import { describe, expect, it } from "vitest";
import {
  parseClobBook,
  parseClobMidpoint,
  parseClobSpread,
  parseGammaEvent,
  parseGammaMarket,
} from "@/lib/polymarket/schemas";

const COND = "0x20fac1c925b7a2fed6b3b2736f47a800b4d0d4001b9deaeb7b918868eb63d081";
const YES = "25312457392074064866955638920139332428292497556441446372623464789018436410183";
const NO = "114008288197553961583518307739897802587067075299935011621746237390478872496575";

const gammaMarket = (o: Record<string, unknown> = {}) => ({
  id: "2879968",
  conditionId: COND,
  clobTokenIds: JSON.stringify([YES, NO]),
  outcomes: JSON.stringify(["Yes", "No"]),
  question: "Will France win on 2026-07-14?",
  slug: "fifwc-fra-esp-2026-07-14",
  description: "resolves on 90 minutes plus stoppage",
  active: true,
  closed: false,
  enableOrderBook: true,
  endDate: "2026-07-14T19:00:00Z",
  ...o,
});

describe("gamma market parsing", () => {
  it("parses a valid market with JSON-string token ids", () => {
    const d = parseGammaMarket(gammaMarket(), "691040");
    expect(d.yesTokenId).toBe(YES);
    expect(d.noTokenId).toBe(NO);
    expect(d.outcomes).toEqual(["Yes", "No"]);
    expect(d.conditionId).toBe(COND);
    expect(d.enableOrderBook).toBe(true);
    expect(d.eventId).toBe("691040");
  });

  it("accepts clobTokenIds as a real array too", () => {
    const d = parseGammaMarket(gammaMarket({ clobTokenIds: [YES, NO] }), "e");
    expect(d.yesTokenId).toBe(YES);
  });

  it("rejects a missing token in the pair", () => {
    expect(() => parseGammaMarket(gammaMarket({ clobTokenIds: JSON.stringify([YES]) }), "e")).toThrow();
  });

  it("rejects a malformed condition id", () => {
    expect(() => parseGammaMarket(gammaMarket({ conditionId: "0x123" }), "e")).toThrow();
  });

  it("rejects non-numeric token ids", () => {
    expect(() => parseGammaMarket(gammaMarket({ clobTokenIds: JSON.stringify(["abc", NO]) }), "e")).toThrow();
  });

  it("parses closed / inactive flags", () => {
    const d = parseGammaMarket(gammaMarket({ closed: true, active: false }), "e");
    expect(d.closed).toBe(true);
    expect(d.active).toBe(false);
  });
});

describe("gamma event parsing", () => {
  it("collects valid sub-markets and skips malformed ones", () => {
    const event = parseGammaEvent({
      id: "691040",
      slug: "fifwc-fra-esp-2026-07-14",
      title: "France vs. Spain",
      closed: false,
      active: true,
      markets: [gammaMarket(), gammaMarket({ conditionId: "nope" })],
    });
    expect(event.eventId).toBe("691040");
    expect(event.markets).toHaveLength(1);
  });

  it("throws without an event id", () => {
    expect(() => parseGammaEvent({ markets: [] })).toThrow();
  });
});

describe("clob book parsing", () => {
  const book = (o: Record<string, unknown> = {}) => ({
    market: COND,
    asset_id: YES,
    timestamp: "1783960137668",
    hash: "eb59176708560aa53a6cb6645dfa431930d71510",
    bids: [{ price: "0.41", size: "13899.84" }],
    asks: [{ price: "0.42", size: "30083.82" }],
    tick_size: "0.001",
    neg_risk: true,
    last_trade_price: 0.41,
    ...o,
  });

  it("accepts string and number timestamps", () => {
    expect(parseClobBook(book()).timestamp).toBe(1783960137668);
    expect(parseClobBook(book({ timestamp: 1783960137668 })).timestamp).toBe(1783960137668);
  });

  it("drops out-of-range levels rather than trusting them", () => {
    const parsed = parseClobBook(book({ bids: [{ price: "1.5", size: "10" }, { price: "0.41", size: "10" }] }));
    expect(parsed.bids).toHaveLength(1);
    expect(parsed.bids[0].price).toBe("0.41");
  });

  it("requires market and asset_id", () => {
    expect(() => parseClobBook(book({ market: undefined }))).toThrow();
    expect(() => parseClobBook(book({ asset_id: undefined }))).toThrow();
  });

  it("parses midpoint and spread", () => {
    expect(parseClobMidpoint({ mid: "0.415" })).toBe(0.415);
    expect(parseClobSpread({ spread: "0.01" })).toBe(0.01);
    expect(() => parseClobMidpoint({ mid: "x" })).toThrow();
  });
});
