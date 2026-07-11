import { describe, expect, it } from "vitest";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import { hashNormalizedTxLineEvent, hashRawEvent } from "@/lib/proof/eventHash";
import { validateTxlineCapture } from "@/lib/txline/captureFormat";
import { normalizeTxLineEvent, TXLINE_NORMALIZER_VERSION } from "@/lib/txline/normalize";
import { normalizeStablePriceSelection } from "@/lib/txline/pricing";

describe("genuine TxLINE capture", () => {
  it("passes the versioned capture schema and contains no credential metadata", () => {
    expect(validateTxlineCapture(canonicalCapture)).toEqual([]);
    expect(JSON.stringify(canonicalCapture)).not.toMatch(/authorization|api[_-]?token|jwt|keypair|private[_-]?key/i);
  });

  it("hashes raw and normalized payloads deterministically", () => {
    expect(hashRawEvent(canonicalCapture.rawPayload)).toBe(canonicalCapture.rawPayloadHash);
    expect(hashRawEvent(canonicalCapture.rawPayload)).toBe(hashRawEvent(structuredClone(canonicalCapture.rawPayload)));
  });

  it("replays the genuine payload through the production normalizer without losing fixture or sequence", () => {
    const event = normalizeTxLineEvent(canonicalCapture.rawPayload, {
      source: "historical",
      fallbackFixtureId: "must-not-be-used",
      fallbackSeq: -1,
      participantNames: { 1: "France", 2: "Morocco" },
    });
    expect(event.fixtureId).toBe(canonicalCapture.fixtureId);
    expect(event.seq).toBe(canonicalCapture.normalizedEvent.seq);
    expect(event.trace.fixtureIdField).toBe("FixtureId");
    expect(hashNormalizedTxLineEvent(event)).toBe(canonicalCapture.normalizedEventHash);
    expect(canonicalCapture.normalizerVersion).toBe(TXLINE_NORMALIZER_VERSION);
  });

  it("converts genuine StablePrice percentage to the documented fair probability", () => {
    const input = normalizeStablePriceSelection(canonicalCapture.odds.rawPayload, "part1");
    expect(input.impliedProbability).toBe(0.86505);
    expect(input.fairPriceMicros).toBe(865_050);
    expect(input.derivation).toBe("txline-demargined-pct-v1");
  });

  it("rejects altered raw payloads and secret metadata", () => {
    const tampered = structuredClone(canonicalCapture) as any;
    tampered.rawPayload.Seq += 1;
    expect(validateTxlineCapture(tampered)).toContain("raw payload hash mismatch");
    const secret = structuredClone(canonicalCapture) as any;
    secret.authorization = "redacted-test-value";
    expect(validateTxlineCapture(secret)).toContain("capture contains secret metadata");
  });
});
