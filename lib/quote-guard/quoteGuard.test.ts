import { describe, expect, it } from "vitest";
import lifecycleFixture from "@/fixtures/lineguard/v4-france-morocco-lifecycle.json";
import { CANONICAL_POST_GOAL_QUOTE, CANONICAL_PRE_GOAL_QUOTE, CANONICAL_QUOTE_GUARD } from "@/lib/quote-guard/canonical";
import { verifyQuoteGuard } from "@/lib/quote-guard";

describe("QuoteGuard", () => {
  it("reproduces the exact odds hashes committed by deployed V4", () => {
    expect(CANONICAL_PRE_GOAL_QUOTE.oddsHash).toBe(lifecycleFixture.txline.preQuotePayloadHashHex);
    expect(CANONICAL_POST_GOAL_QUOTE.oddsHash).toBe(lifecycleFixture.txline.postQuotePayloadHashHex);
  });

  it("deterministically derives implied probability and executable prices", () => {
    expect(CANONICAL_PRE_GOAL_QUOTE.impliedProbabilityMicros).toBe(522_785);
    expect(CANONICAL_PRE_GOAL_QUOTE.generatedYesQuoteMicros).toBe(532_785);
    expect(CANONICAL_PRE_GOAL_QUOTE.generatedNoQuoteMicros).toBe(487_215);
    expect(CANONICAL_POST_GOAL_QUOTE.impliedProbabilityMicros).toBe(864_793);
    expect(CANONICAL_POST_GOAL_QUOTE.generatedYesQuoteMicros).toBe(874_793);
  });

  it("verifies both canonical quote receipts eight checks out of eight", () => {
    expect(CANONICAL_QUOTE_GUARD.pre.verification.status).toBe("VERIFIED");
    expect(CANONICAL_QUOTE_GUARD.post.verification.status).toBe("VERIFIED");
    expect(CANONICAL_QUOTE_GUARD.pre.verification.checks).toHaveLength(8);
    expect(CANONICAL_QUOTE_GUARD.post.verification.checks.every((check) => check.passed)).toBe(true);
  });

  it("rejects an operator-chosen price that did not come from the odds", () => {
    const tampered = { ...CANONICAL_POST_GOAL_QUOTE, generatedYesQuoteMicros: 999_999 };
    const result = verifyQuoteGuard(tampered, CANONICAL_QUOTE_GUARD.post.odds, lifecycleFixture.txline.postQuotePayloadHashHex);
    expect(result.status).toBe("FAILED");
    expect(result.checks.find((check) => check.id === "generated-quote")?.passed).toBe(false);
  });

  it("rejects fixture, odds, expiry and on-chain-anchor substitution", () => {
    const tampered = { ...CANONICAL_PRE_GOAL_QUOTE, fixtureId: 1, expiresAtMs: CANONICAL_PRE_GOAL_QUOTE.sourceTimestampMs };
    const result = verifyQuoteGuard(tampered, CANONICAL_QUOTE_GUARD.pre.odds, "00".repeat(32));
    expect(result.status).toBe("FAILED");
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(expect.arrayContaining(["fixture", "timestamp-expiry", "onchain-anchor"]));
  });
});
