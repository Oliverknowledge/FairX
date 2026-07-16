import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { reverificationNotice, V4LifecycleEvidence } from "@/components/v4/V4LifecycleEvidence";
import { initialV4VerificationResponse } from "@/lib/proof/v4VerificationSnapshot";

describe("V4 lifecycle evidence reliability UX", () => {
  it("renders the latest VERIFIED result immediately with timestamp and explicit refresh", () => {
    const response = initialV4VerificationResponse(false, Date.parse("2026-07-16T15:38:52.122Z"));
    const html = renderToStaticMarkup(<V4LifecycleEvidence initialResponse={response} />);
    expect(html).toContain("VERIFIED 20/20");
    expect(html).toContain("Last independently rechecked from Solana 4 minutes ago");
    expect(html).toContain("Re-verify from Solana");
    expect(html).not.toContain("Re-reading the finalized V4 lifecycle");
  });

  it("preserves prior VERIFIED truth when a fresh attempt is UNKNOWN", () => {
    const response = initialV4VerificationResponse(false);
    response.latestAttempt = { status: "UNKNOWN", checkedAt: new Date().toISOString(), durationMs: 45_000, rpcRequestCount: 3, message: "RPC timeout" };
    expect(response.verification?.status).toBe("VERIFIED");
    expect(reverificationNotice(response)).toBe("Fresh re-verification unavailable; displaying the last successful verified result.");
  });

  it("reports fresh success without calling a cached response live", () => {
    const response = initialV4VerificationResponse(true);
    response.latestAttempt = { status: "VERIFIED", checkedAt: response.verification!.checkedAt, durationMs: 9_000, rpcRequestCount: 8 };
    response.cache = { ...response.cache, cached: false, source: "fresh", stale: false, ageSeconds: 0, verifiedAt: response.verification!.checkedAt };
    expect(reverificationNotice(response)).toBe("Fresh Solana re-verification completed successfully.");
    expect(JSON.stringify(response)).not.toContain("rpcUrl");
  });
});
