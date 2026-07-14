import { beforeEach, describe, expect, it } from "vitest";
import { clientKeyFromRequest, rateLimit, resetRateLimits } from "@/lib/polymarket/rateLimit";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then blocks within the window", () => {
    const t0 = 1_000_000;
    expect(rateLimit("k", 2, 1_000, t0).allowed).toBe(true);
    expect(rateLimit("k", 2, 1_000, t0).allowed).toBe(true);
    const blocked = rateLimit("k", 2, 1_000, t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const t0 = 1_000_000;
    rateLimit("k", 1, 1_000, t0);
    expect(rateLimit("k", 1, 1_000, t0).allowed).toBe(false);
    expect(rateLimit("k", 1, 1_000, t0 + 1_001).allowed).toBe(true);
  });

  it("keys are independent", () => {
    const t0 = 1_000_000;
    rateLimit("a", 1, 1_000, t0);
    expect(rateLimit("b", 1, 1_000, t0).allowed).toBe(true);
  });

  it("derives a client key from x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKeyFromRequest(req)).toBe("1.2.3.4");
    expect(clientKeyFromRequest(new Request("http://x"))).toBe("anonymous");
  });
});
