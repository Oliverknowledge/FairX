import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/integration-kit/reference-order/route";
import { CANONICAL_POST_GOAL_QUOTE, CANONICAL_PRE_GOAL_QUOTE } from "@/lib/quote-guard/canonical";

function request(quote: typeof CANONICAL_PRE_GOAL_QUOTE, latestMaterialEventSequence: number, submittedAtMs: number) {
  return new Request("http://localhost/api/integration-kit/reference-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      marketId: "fairx-v4-france-morocco",
      side: "YES",
      stakeLamports: "10000000",
      quote,
      latestMaterialEventSequence,
      submittedAtMs,
    }),
  });
}

describe("IntegrationKit reference route", () => {
  it("returns the two public outcomes", async () => {
    const stale = await POST(request(CANONICAL_PRE_GOAL_QUOTE, 739, CANONICAL_PRE_GOAL_QUOTE.sourceTimestampMs + 110_000));
    expect(await stale.json()).toMatchObject({ status: "STALE_SEQUENCE_RETURNED", returnedPrincipalLamports: "10000000", reservedLiabilityLamports: "0" });

    const accepted = await POST(request(CANONICAL_POST_GOAL_QUOTE, 739, CANONICAL_POST_GOAL_QUOTE.sourceTimestampMs + 1_000));
    expect(await accepted.json()).toMatchObject({ status: "ACCEPTED", returnedPrincipalLamports: "0", reservedLiabilityLamports: "1431275" });
  });

  it("rejects a price that does not recompute", async () => {
    const tampered = { ...CANONICAL_POST_GOAL_QUOTE, generatedYesQuoteMicros: 999_999 };
    const response = await POST(request(tampered, 739, tampered.sourceTimestampMs + 1_000));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "QUOTE_UNVERIFIED" });
  });
});
