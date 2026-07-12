import { describe, expect, it } from "vitest";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import { deriveMatchWinnerHomePrice, findStablePriceRecord, normalizeStablePriceSelection } from "@/lib/txline/pricing";

describe("deterministic TxLINE pricing", () => {
  it("derives the committed home-win price from genuine StablePrice Pct", () => {
    const result = deriveMatchWinnerHomePrice(canonicalCapture.odds.rawPayload, canonicalCapture.fixtureId);
    expect(result.selection).toBe("part1");
    expect(result.fairPriceMicros).toBe(865_050);
    expect(result.impliedProbability).toBe(0.86505);
  });

  it("rejects fixture substitution", () => {
    expect(() => deriveMatchWinnerHomePrice(canonicalCapture.odds.rawPayload, "99999999")).toThrow(/fixture/i);
  });

  it("rejects unsupported market substitution", () => {
    const tampered = { ...canonicalCapture.odds.rawPayload, SuperOddsType: "TOTAL_GOALS" };
    expect(() => deriveMatchWinnerHomePrice(tampered, canonicalCapture.fixtureId)).toThrow(/1X2/i);
  });

  it("recomputes rather than trusting a supplied fair price", () => {
    const payload = { ...canonicalCapture.odds.rawPayload, fairPriceMicros: 1 };
    expect(normalizeStablePriceSelection(payload, "part1").fairPriceMicros).toBe(865_050);
  });

  it("finds a StablePrice record inside a genuine endpoint envelope", () => {
    expect(findStablePriceRecord({ data: [canonicalCapture.odds.rawPayload] }, canonicalCapture.fixtureId).MessageId).toBe(canonicalCapture.odds.rawPayload.MessageId);
  });
});
