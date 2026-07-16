import { describe, expect, it, vi } from "vitest";
import { submitProtectedOrder, IntegrationKitError } from "@/lib/integration-kit";
import { evaluateReferenceProtectedOrder } from "@/lib/integration-kit/reference";
import { CANONICAL_POST_GOAL_QUOTE, CANONICAL_PRE_GOAL_QUOTE } from "@/lib/quote-guard/canonical";

const base = {
  marketId: "fairx-v4-france-morocco",
  side: "YES" as const,
  stakeLamports: 10_000_000n,
};

describe("IntegrationKit", () => {
  it("returns stale principal without creating liability", () => {
    const result = evaluateReferenceProtectedOrder({ ...base, quote: CANONICAL_PRE_GOAL_QUOTE, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_PRE_GOAL_QUOTE.sourceTimestampMs + 110_000 });
    expect(result.status).toBe("STALE_SEQUENCE_RETURNED");
    expect(result.returnedPrincipalLamports).toBe("10000000");
    expect(result.reservedLiabilityLamports).toBe("0");
  });

  it("accepts a synchronized verified quote and reserves exact liability", () => {
    const result = evaluateReferenceProtectedOrder({ ...base, quote: CANONICAL_POST_GOAL_QUOTE, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_POST_GOAL_QUOTE.sourceTimestampMs + 1_000 });
    expect(result.status).toBe("ACCEPTED");
    expect(result.returnedPrincipalLamports).toBe("0");
    expect(result.reservedLiabilityLamports).toBe("1431275");
  });

  it("rejects arbitrary, expired and future quotes", () => {
    expect(() => evaluateReferenceProtectedOrder({ ...base, quote: { ...CANONICAL_POST_GOAL_QUOTE, generatedYesQuoteMicros: 999_999 }, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_POST_GOAL_QUOTE.sourceTimestampMs + 1_000 })).toThrowError(IntegrationKitError);
    expect(() => evaluateReferenceProtectedOrder({ ...base, quote: CANONICAL_POST_GOAL_QUOTE, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_POST_GOAL_QUOTE.expiresAtMs + 1 })).toThrow(/expired/i);
    expect(() => evaluateReferenceProtectedOrder({ ...base, quote: CANONICAL_POST_GOAL_QUOTE, latestMaterialEventSequence: 738, submittedAtMs: CANONICAL_POST_GOAL_QUOTE.sourceTimestampMs + 1_000 })).toThrow(/future/i);
  });

  it("exposes one typed frontend function", async () => {
    const expected = evaluateReferenceProtectedOrder({ ...base, quote: CANONICAL_PRE_GOAL_QUOTE, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_PRE_GOAL_QUOTE.sourceTimestampMs + 110_000 });
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).stakeLamports).toBe("10000000");
      return Response.json(expected);
    }) as typeof fetch;
    const result = await submitProtectedOrder({ ...base, quote: CANONICAL_PRE_GOAL_QUOTE, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_PRE_GOAL_QUOTE.sourceTimestampMs + 110_000 }, { endpoint: "https://operator.example/fairx", fetchImpl });
    expect(result.status).toBe("STALE_SEQUENCE_RETURNED");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
