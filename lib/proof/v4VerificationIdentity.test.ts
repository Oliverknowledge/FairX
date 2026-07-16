import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evidenceIdentityFor } from "@/lib/proof/v4VerificationIdentity";
import { V4_EVIDENCE_IDENTITY, initialV4VerificationResponse, V4_LAST_VERIFIED_SNAPSHOT } from "@/lib/proof/v4VerificationSnapshot";
import type { V4RecordedEvidence } from "@/lib/v4/lifecycleEvidence";

describe("V4 verification identity and public snapshot", () => {
  it("keys the cache by cluster, program, fixture/evidence, deployment slot and binary hash", () => {
    const raw = readFileSync("fixtures/lineguard/v4-france-morocco-lifecycle.json", "utf8");
    const record = JSON.parse(raw) as V4RecordedEvidence;
    expect(evidenceIdentityFor(raw, record)).toEqual(V4_EVIDENCE_IDENTITY);
  });

  it("contains only a complete 20/20 VERIFIED snapshot", () => {
    expect(V4_LAST_VERIFIED_SNAPSHOT.status).toBe("VERIFIED");
    expect(V4_LAST_VERIFIED_SNAPSHOT.summary).toEqual({ verified: 20, failed: 0, unknown: 0 });
    expect(V4_LAST_VERIFIED_SNAPSHOT.checks).toHaveLength(20);
  });

  it("never serializes an RPC URL or credential into the initial client payload", () => {
    const serialized = JSON.stringify(initialV4VerificationResponse(true));
    expect(serialized).not.toContain("SOLANA_RPC_URL");
    expect(serialized).not.toMatch(/https:\/\/[^\"]*(api-key|token|rpc)/i);
    expect(serialized).toContain('"privateConfigured":true');
  });
});
