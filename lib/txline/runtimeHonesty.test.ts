import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState, activeDataSource, DATA_SOURCE_LABEL } from "@/lib/terminal/state";
import { getTxLineHealth } from "@/lib/txline/config";
import { normalizeTxLineEvent } from "@/lib/txline/normalize";

afterEach(() => vi.unstubAllEnvs());

describe("TxLINE runtime honesty and credential redaction", () => {
  it("reports credential presence without returning either server secret", () => {
    vi.stubEnv("TXLINE_JWT", "jwt-secret-that-must-not-leak");
    vi.stubEnv("TXLINE_API_TOKEN", "api-token-that-must-not-leak");
    const health = getTxLineHealth();
    const serialized = JSON.stringify(health);

    expect(health.liveCapable).toBe(true);
    expect(health.hasJwt).toBe(true);
    expect(health.hasApiToken).toBe(true);
    expect(serialized).not.toContain("jwt-secret-that-must-not-leak");
    expect(serialized).not.toContain("api-token-that-must-not-leak");
  });

  it("disables live capability when either required credential is missing", () => {
    vi.stubEnv("TXLINE_JWT", "");
    vi.stubEnv("TXLINE_API_TOKEN", "");
    expect(getTxLineHealth().liveCapable).toBe(false);
  });

  it("labels the default fallback as guided and a historical record as historical, never live", () => {
    const state = createInitialState("demo");
    expect(activeDataSource(state)).toBe("demo");
    expect(DATA_SOURCE_LABEL[activeDataSource(state)]).toBe("Guided scenario");

    state.mode = "live";
    expect(activeDataSource(state)).toBe("demo");
    expect(DATA_SOURCE_LABEL[activeDataSource(state)]).toBe("Guided scenario");

    state.txline.lastEvent = normalizeTxLineEvent(
      { FixtureId: 18209181, Seq: 739, Ts: 1_783_632_332_422, Action: "goal", Stats: { 1: 1, 2: 0 } },
      { source: "historical", fallbackFixtureId: "unused", fallbackSeq: -1, participantNames: { 1: "France", 2: "Morocco" } },
    );
    expect(activeDataSource(state)).toBe("historical");
    expect(DATA_SOURCE_LABEL[activeDataSource(state)]).toBe("TxLINE historical");
  });
});
