import { describe, expect, it } from "vitest";
import capture from "@/fixtures/polymarket/fifwc-fra-esp-2026-07-14-france-win.capture.json";
import {
  POLYMARKET_PRICING_MODEL,
  buildOddsCommitmentFromCapture,
  buildSignedConstraints,
  polymarketPricingModelHash,
} from "@/lib/polymarket/commitment";
import type { PolymarketReferenceCapture } from "@/lib/polymarket/types";

const cap = capture as unknown as PolymarketReferenceCapture;

describe("on-chain odds commitment from a Polymarket capture", () => {
  it("maps the reference midpoint + hashes into commit_txline_odds_v2 args", () => {
    const c = buildOddsCommitmentFromCapture(cap);
    expect(c.fairPriceMicros).toBe(cap.derived.midpointMicros);
    expect(c.oddsPayloadHash).toBe(cap.normalizedQuoteHash);
    expect(c.oddsPayloadHashBytes).toHaveLength(32);
    expect(c.pricingModelHashBytes).toHaveLength(32);
    expect(c.pricingModelVersion).toBe(1);
    expect(c.pricingModelVersion).toBe(POLYMARKET_PRICING_MODEL.version);
    expect(c.oddsSequence).toBe(Number(cap.orderbook.timestamp));
  });

  it("pricing-model hash is deterministic and canonical", () => {
    expect(polymarketPricingModelHash(cap)).toBe(polymarketPricingModelHash(cap));
    expect(polymarketPricingModelHash(cap)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to commit an invalid reference quote", () => {
    const bad = { ...cap, derived: { ...cap.derived, quoteValid: false, rejectionReasons: ["SPREAD_TOO_WIDE"] } };
    expect(() => buildOddsCommitmentFromCapture(bad)).toThrow(/invalid reference quote/);
  });

  it("signed constraints pin the exact committed quote (YES)", () => {
    const c = buildOddsCommitmentFromCapture(cap);
    const signed = buildSignedConstraints({
      side: "YES",
      stakeLamports: 10_000_000,
      displayedPriceMicros: cap.derived.midpointMicros,
      pricedAtSeq: 1,
      oddsSequence: c.oddsSequence,
      maxSlippageMicros: 5_000,
      maxAcceptedEdgeMicros: 20_000,
      expirySlot: 1_000,
    });
    expect(signed.expectedExecutionPriceMicros).toBe(cap.derived.midpointMicros);
    expect(signed.expectedOddsSequence).toBe(c.oddsSequence);
  });

  it("signed constraints price the NO side as the complement", () => {
    const signed = buildSignedConstraints({
      side: "NO",
      stakeLamports: 10_000_000,
      displayedPriceMicros: 411_250,
      pricedAtSeq: 1,
      oddsSequence: 1,
      maxSlippageMicros: 5_000,
      maxAcceptedEdgeMicros: 20_000,
      expirySlot: 1_000,
    });
    expect(signed.expectedExecutionPriceMicros).toBe(1_000_000 - 411_250);
  });
});
