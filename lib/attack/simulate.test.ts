import { describe, expect, it } from "vitest";
import { simulateAttackWave } from "@/lib/attack/simulate";

describe("Attack Lab simulation", () => {
  it("runs the requested number of bots through the real guard", () => {
    const result = simulateAttackWave(100, 7);
    expect(result.totalBots).toBe(100);
    expect(result.scenarios).toHaveLength(100);
    expect(result.staleAttacks + result.safeTrades).toBe(100);
  });

  it("refunds every stale YES attacker and allows every safe NO trade", () => {
    const result = simulateAttackWave(200, 11);
    for (const scenario of result.scenarios) {
      if (scenario.side === "YES") {
        expect(scenario.verdict).toBe("VOIDED_REFUNDED");
        expect(scenario.blocked).toBe(true);
        expect(scenario.stealDenied).toBeGreaterThan(0);
      } else {
        expect(scenario.blocked).toBe(false);
        expect(scenario.verdict).not.toBe("VOIDED_REFUNDED");
      }
    }
    expect(result.attacksRefunded).toBe(result.staleAttacks);
    expect(result.safeTradesAllowed).toBe(result.safeTrades);
  });

  it("aggregates denied stale profit and protected volume", () => {
    const result = simulateAttackWave(150, 3);
    expect(result.staleProfitDenied).toBeGreaterThan(0);
    expect(result.protectedVolume).toBeGreaterThan(0);
    expect(result.avgStaleWindow).toBeGreaterThanOrEqual(1);
    expect(result.avgStaleWindow).toBeLessThanOrEqual(3);
  });

  it("is deterministic for a given seed", () => {
    const a = simulateAttackWave(120, 42);
    const b = simulateAttackWave(120, 42);
    expect(a.staleProfitDenied).toBe(b.staleProfitDenied);
    expect(a.protectedVolume).toBe(b.protectedVolume);
    expect(a.attacksRefunded).toBe(b.attacksRefunded);
  });
});
