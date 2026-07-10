import { describe, expect, it } from "vitest";
import { evaluateLineGuard, type EvaluateLineGuardInput } from "@/lib/lineguard/evaluate";

const base: EvaluateLineGuardInput = {
  side: "YES",
  observedPrice: 0.4,
  fairYes: 0.63,
  materialSeq: 2,
  pricedAtSeq: 1,
  tolerance: 0.02,
  orderId: "order-test",
  marketId: "eng-win",
  actor: "bot",
  timestamp: 1_700_000_000_000,
};

describe("evaluateLineGuard", () => {
  it("allows a trade when the market is in sync", () => {
    const r = evaluateLineGuard({ ...base, materialSeq: 1, pricedAtSeq: 1 });
    expect(r.verdict).toBe("ALLOWED");
    expect(r.checks.registersInSync).toBe(true);
    expect(r.checks.staleWindowOpen).toBe(false);
  });

  it("voids/refunds a stale beneficial YES trade", () => {
    const r = evaluateLineGuard(base); // buy YES @ 40¢, fair 63¢, stale
    expect(r.verdict).toBe("VOIDED_REFUNDED");
    expect(r.edge).toBeCloseTo(0.23, 5);
    expect(r.checks.edgeAboveTolerance).toBe(true);
    expect(r.staleness).toBe(1);
  });

  it("voids/refunds a stale beneficial OVER trade", () => {
    const r = evaluateLineGuard({ ...base, side: "OVER", observedPrice: 0.5, fairYes: 0.7 });
    expect(r.verdict).toBe("VOIDED_REFUNDED");
    expect(r.fairSidePrice).toBeCloseTo(0.7, 5);
  });

  it("allows a stale losing NO trade with no edge", () => {
    // Fair YES 0.63 → fair NO 0.37; buying NO at displayed 0.60 has negative edge.
    const r = evaluateLineGuard({ ...base, side: "NO", observedPrice: 0.6, fairYes: 0.63 });
    expect(r.verdict).toBe("STALE_ALLOWED_NO_EDGE");
    expect(r.edge).toBeLessThanOrEqual(0);
    expect(r.checks.staleWindowOpen).toBe(true);
    expect(r.checks.sideBenefits).toBe(false);
  });

  it("allows a stale UNDER trade that trades against the event", () => {
    const r = evaluateLineGuard({ ...base, side: "UNDER", observedPrice: 0.5, fairYes: 0.7 });
    // fair UNDER = 0.30, observed 0.50 → edge negative
    expect(r.verdict).toBe("STALE_ALLOWED_NO_EDGE");
  });

  it("allows a stale trade whose edge is below tolerance", () => {
    const r = evaluateLineGuard({ ...base, observedPrice: 0.62, fairYes: 0.63 }); // +1¢ edge, tol 2¢
    expect(r.verdict).toBe("STALE_ALLOWED_NO_EDGE");
    expect(r.checks.sideBenefits).toBe(true);
    expect(r.checks.edgeAboveTolerance).toBe(false);
  });

  it("is deterministic — same inputs, same verdict", () => {
    expect(evaluateLineGuard(base)).toEqual(evaluateLineGuard(base));
  });
});
