import { describe, expect, it } from "vitest";
import { buildMarketConfigCommitment, hashMaterialityConfig, hashSettlementConfig } from "@/lib/markets/marketConfig";

const rules = { goals: true, redCards: false, penalties: true, oddsUpdates: true };

describe("market config commitments", () => {
  it("materiality config hash is stable and canonical", () => {
    const first = hashMaterialityConfig({ materialityRules: rules, backedTeam: "  England  " });
    const second = hashMaterialityConfig({ materialityRules: { ...rules }, backedTeam: "England" });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("settlement config commits tolerance, precision, vault rules, and sides", () => {
    expect(hashSettlementConfig(20_000)).toBe(hashSettlementConfig(20_000));
    expect(hashSettlementConfig(20_000)).not.toBe(hashSettlementConfig(30_000));
  });

  it("builds the four on-chain hashes and market type code", () => {
    const config = buildMarketConfigCommitment({
      marketType: "MATCH_WINNER",
      fixtureId: "ENG-FRA-2026-QF",
      marketTitle: "England wins",
      materialityRules: rules,
      backedTeam: "England",
      awayTeam: "France",
      toleranceMicros: 20_000,
    });
    expect(config.marketTypeCode).toBe(0);
    expect(config.fixtureIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(config.marketTitleHash).toMatch(/^[0-9a-f]{64}$/);
    expect(config.materialityConfigHash).toMatch(/^[0-9a-f]{64}$/);
    expect(config.settlementConfigHash).toMatch(/^[0-9a-f]{64}$/);
    expect(config.resolutionRule).toBe("HOME_TEAM_WINS");
    expect(config.homeStatKey).toBe(1);
    expect(config.awayStatKey).toBe(2);
    expect(config.homeTeamHash).not.toBe(config.awayTeamHash);
  });
});
