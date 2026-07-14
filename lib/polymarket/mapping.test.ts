import { describe, expect, it } from "vitest";
import {
  FRANCE_SPAIN_MAPPING,
  finalizeMapping,
  getApprovedMapping,
  isApprovedMappingId,
  verifyMapping,
  type MappingIdentity,
} from "@/lib/polymarket/mapping";

describe("approved mapping registry", () => {
  it("the France–Spain mapping verifies", () => {
    expect(verifyMapping(FRANCE_SPAIN_MAPPING)).toEqual([]);
    expect(FRANCE_SPAIN_MAPPING.mappingHash).toMatch(/^[0-9a-f]{64}$/);
    expect(FRANCE_SPAIN_MAPPING.fairxYesMeaning).toBe("HOME_TEAM_WINS");
  });

  it("only allowlists known mapping ids", () => {
    expect(isApprovedMappingId("fifwc-fra-esp-2026-07-14-france-win")).toBe(true);
    expect(isApprovedMappingId("../secret")).toBe(false);
    expect(getApprovedMapping("nope")).toBeNull();
  });

  it("mapping hash is deterministic for identical identity", () => {
    const identity: MappingIdentity = { ...FRANCE_SPAIN_MAPPING };
    expect(finalizeMapping(identity).mappingHash).toBe(FRANCE_SPAIN_MAPPING.mappingHash);
  });

  it("detects a swapped home/away orientation", () => {
    const tampered = { ...FRANCE_SPAIN_MAPPING, txlineHomeTeam: "Spain" };
    expect(verifyMapping(tampered)).toContain("home team hash mismatch");
  });

  it("detects a resolution-rule edit", () => {
    const tampered = { ...FRANCE_SPAIN_MAPPING, polymarketResolutionRules: "France always wins" };
    expect(verifyMapping(tampered)).toContain("resolution rule hash mismatch");
  });

  it("detects a mapping-hash forgery", () => {
    const tampered = { ...FRANCE_SPAIN_MAPPING, mappingHash: "0".repeat(64) };
    expect(verifyMapping(tampered)).toContain("mapping hash mismatch");
  });

  it("refuses a mapping whose semantics were not confirmed to match", () => {
    const identity: MappingIdentity = {
      ...FRANCE_SPAIN_MAPPING,
      resolutionSemantics: { ...FRANCE_SPAIN_MAPPING.resolutionSemantics, semanticsMatch: false },
    };
    expect(verifyMapping(finalizeMapping(identity))).toContain("resolution semantics were not confirmed to match");
  });
});
