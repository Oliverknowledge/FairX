import { describe, expect, it } from "vitest";
import { FAIRX_SOURCE_BASE_COMMIT, getBuildProvenance, V4_DEPLOYMENT_SLOT, V4_DEPLOYMENT_TIMESTAMP } from "@/lib/provenance";

describe("build and deployment provenance", () => {
  it("uses the deployed Vercel commit when available", () => {
    const provenance = getBuildProvenance({ VERCEL_GIT_COMMIT_SHA: "abc123", NEXT_PUBLIC_BUILD_TIMESTAMP: "2026-07-16T12:00:00Z" }, new Date(0));
    expect(provenance.commitSha).toBe("abc123");
    expect(provenance.commitLabel).toBe("Deployed commit");
    expect(provenance.buildTimestamp).toBe("2026-07-16T12:00:00Z");
  });

  it("falls back honestly to the source base outside a deployment", () => {
    const provenance = getBuildProvenance({}, new Date("2026-07-16T12:00:00Z"));
    expect(provenance.commitSha).toBe(FAIRX_SOURCE_BASE_COMMIT);
    expect(provenance.commitLabel).toBe("Source base commit");
  });

  it("pins the independently read V4 deployment time and slot", () => {
    const provenance = getBuildProvenance({}, new Date(0));
    expect(provenance.deploymentTimestamp).toBe(V4_DEPLOYMENT_TIMESTAMP);
    expect(provenance.deploymentSlot).toBe(V4_DEPLOYMENT_SLOT);
  });
});
