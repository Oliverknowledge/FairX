import { describe, expect, it } from "vitest";
import { verifyV3Lifecycle } from "@/lib/proof/v3LifecycleVerifier";

describe("v3 lifecycle proof gate", () => {
  it("returns UNKNOWN when the canonical record is missing", async () => {
    const result = await verifyV3Lifecycle(null, "http://127.0.0.1:1");
    expect(result.status).toBe("UNKNOWN");
    expect(result.checks).toEqual([
      expect.objectContaining({ id: "record", status: "UNKNOWN" }),
    ]);
  });

  it("does not promote an older record into v3 evidence", async () => {
    const result = await verifyV3Lifecycle({ version: 2 }, "http://127.0.0.1:1");
    expect(result.status).toBe("UNKNOWN");
    expect(result.summary).toEqual({ verified: 0, failed: 0, unknown: 1 });
  });
});
