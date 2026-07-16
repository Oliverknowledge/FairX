import { describe, expect, it } from "vitest";
import { VerificationResultCache, type CacheableVerification, type VerificationRun } from "@/lib/proof/verificationCache";

type Result = CacheableVerification & { value: string };
const result = (status: Result["status"], checkedAt: string, value: string = status): Result => ({ status, checkedAt, value });
const run = (value: Result, overrides: Partial<VerificationRun<Result>> = {}): VerificationRun<Result> => ({
  status: value.status,
  checkedAt: value.checkedAt,
  result: value,
  durationMs: 5,
  rpcRequestCount: 6,
  ...overrides,
});

describe("VerificationResultCache", () => {
  it("caches VERIFIED only after a complete VERIFIED run", async () => {
    const cache = new VerificationResultCache<Result>();
    await cache.refresh("key", async () => run(result("VERIFIED", "2026-07-15T16:00:00.000Z")));
    expect(cache.state("key", Date.parse("2026-07-15T16:01:00.000Z")).lastVerified?.status).toBe("VERIFIED");
  });

  it("never promotes UNKNOWN to VERIFIED", async () => {
    const cache = new VerificationResultCache<Result>();
    await cache.refresh("key", async () => run(result("UNKNOWN", "2026-07-15T16:00:00.000Z")));
    const state = cache.state("key", Date.parse("2026-07-15T16:00:01.000Z"));
    expect(state.lastVerified).toBeNull();
    expect(state.lastAttempt?.status).toBe("UNKNOWN");
  });

  it("treats a bounded-timeout outcome as UNKNOWN, never VERIFIED", async () => {
    const cache = new VerificationResultCache<Result>();
    await cache.refresh("key", async () => ({
      status: "UNKNOWN",
      checkedAt: "2026-07-15T16:00:00.000Z",
      durationMs: 45_000,
      rpcRequestCount: 2,
      message: "Verification timed out after 45000ms",
    }));
    const state = cache.state("key", Date.parse("2026-07-15T16:00:01.000Z"));
    expect(state.lastVerified).toBeNull();
    expect(state.lastAttempt?.message).toContain("timed out");
  });

  it("FAILED cannot overwrite a valid cached VERIFIED result", async () => {
    const cache = new VerificationResultCache<Result>();
    const verified = result("VERIFIED", "2026-07-15T16:00:00.000Z", "good");
    cache.seedVerified("key", verified);
    await cache.refresh("key", async () => run(result("FAILED", "2026-07-15T16:01:00.000Z", "bad")));
    const state = cache.state("key", Date.parse("2026-07-15T16:01:01.000Z"));
    expect(state.lastVerified?.value).toBe("good");
    expect(state.lastAttempt?.status).toBe("FAILED");
  });

  it("expires status-specific attempts and marks old VERIFIED data stale", async () => {
    const cache = new VerificationResultCache<Result>({ verifiedMs: 1_000, failedMs: 500, unknownMs: 100 });
    cache.seedVerified("key", result("VERIFIED", "2026-07-15T16:00:00.000Z"));
    await cache.refresh("key", async () => run(result("UNKNOWN", "2026-07-15T16:00:00.000Z")), () => Date.parse("2026-07-15T16:00:00.000Z"));
    expect(cache.state("key", Date.parse("2026-07-15T16:00:00.050Z")).lastAttempt?.status).toBe("UNKNOWN");
    const expired = cache.state("key", Date.parse("2026-07-15T16:00:02.000Z"));
    expect(expired.lastAttempt).toBeNull();
    expect(expired.stale).toBe(true);
  });

  it("forced refresh bypasses a normal verified cache and simultaneous callers run once", async () => {
    const cache = new VerificationResultCache<Result>();
    cache.seedVerified("key", result("VERIFIED", "2026-07-15T16:00:00.000Z", "old"));
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const runner = async () => {
      calls += 1;
      await gate;
      return run(result("VERIFIED", "2026-07-15T16:01:00.000Z", "new"));
    };
    const first = cache.refresh("key", runner);
    const second = cache.refresh("key", runner);
    release();
    expect(await first).toEqual(await second);
    expect(calls).toBe(1);
    expect(cache.state("key", Date.parse("2026-07-15T16:01:01.000Z")).lastVerified?.value).toBe("new");
  });

  it("clears a failed in-flight promise so a later request can retry", async () => {
    const cache = new VerificationResultCache<Result>();
    await expect(cache.refresh("key", async () => { throw new Error("transport failed"); })).rejects.toThrow("transport failed");
    expect(cache.hasInFlight("key")).toBe(false);
    await cache.refresh("key", async () => run(result("VERIFIED", "2026-07-15T16:00:00.000Z")));
    expect(cache.state("key").lastVerified?.status).toBe("VERIFIED");
  });
});
