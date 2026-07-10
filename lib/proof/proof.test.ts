import { describe, expect, it } from "vitest";
import { eventHashPair, hashNormalizedEvent, hashRawEvent } from "@/lib/proof/eventHash";
import { buildFreshDevnetReceipt, buildOnChainOrderReceipt } from "@/lib/proof/onchainReceipt";
import { buildProofSummary } from "@/lib/proof/proofSummary";
import { verifyReceipt } from "@/lib/receipts/verify";
import type { OnChainProof } from "@/lib/receipts/types";

const HEX64 = /^[0-9a-f]{64}$/;

function proofFor(side: "YES" | "NO"): OnChainProof {
  const yes = side === "YES";
  return {
    cluster: "devnet",
    programId: "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe",
    marketPda: "GSVsEECW7EuXQbS8ztskoYDE18GhRvY8wFNbxHwrezZs",
    orderEscrowPda: "8khPDtj1S1yQA67898yRXKyUdgV45cMUiBainz1JCxo2",
    txSignatures: ["a", "b", "c", "d"],
    explorerUrls: ["https://e/1", "https://e/2", "https://e/3", "https://e/4"],
    materialSeq: 2,
    pricedAtSeq: 1,
    observedPriceMicros: yes ? 400_000 : 600_000,
    fairSidePriceMicros: yes ? 630_000 : 370_000,
    toleranceMicros: 20_000,
    edgeMicros: yes ? 230_000 : -230_000,
    verdictCode: yes ? 2 : 1,
    statusCode: yes ? 4 : 3,
    sourceEventHash: hashNormalizedEvent({ source: "demo", fixtureId: "ENG-FRA-2026-QF", seq: 2, ts: 1, eventType: "GOAL" }),
    settlementDestination: yes ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT",
    vaultPda: "Vau1t11111111111111111111111111111111111111",
  };
}

describe("event hashing", () => {
  it("produces deterministic 64-hex hashes", () => {
    const raw = { type: "GOAL", team: "England", seq: 2 };
    expect(hashRawEvent(raw)).to.match(HEX64);
    expect(hashRawEvent(raw)).toBe(hashRawEvent({ seq: 2, team: "England", type: "GOAL" })); // key order independent
    const norm = { source: "demo", fixtureId: "F", seq: 2, ts: 1, eventType: "GOAL" };
    expect(hashNormalizedEvent(norm)).toMatch(HEX64);
    expect(hashNormalizedEvent(norm)).toBe(hashNormalizedEvent(norm));
  });

  it("changes when the event changes", () => {
    expect(hashRawEvent({ seq: 2 })).not.toBe(hashRawEvent({ seq: 3 }));
    const pair = eventHashPair({ a: 1 }, { source: "demo", fixtureId: "F", seq: 2, ts: 1, eventType: "GOAL" });
    expect(pair.rawEventHash).toMatch(HEX64);
    expect(pair.normalizedEventHash).toMatch(HEX64);
  });
});

describe("on-chain receipt includes event hash and vault destination", () => {
  it("YES fresh receipt: refunded to trader, event hash reproduced, tamper-evident", () => {
    const proof = proofFor("YES");
    const receipt = buildFreshDevnetReceipt("YES", proof);
    expect(receipt.verdict).toBe("VOIDED_REFUNDED");
    expect(receipt.settlementDestination).toBe("REFUNDED_TO_TRADER");
    expect(receipt.onChain?.sourceEventHash).toBe(proof.sourceEventHash);
    expect(verifyReceipt(receipt, 0).valid).toBe(true);
    // Tampering with the on-chain event hash changes the sealed receipt hash.
    const tampered = { ...receipt, onChain: { ...receipt.onChain!, sourceEventHash: "0".repeat(64) } };
    expect(verifyReceipt(tampered, 0).valid).toBe(false);
  });

  it("NO custom receipt: finalized to vault, normalized hash equals on-chain hash", () => {
    const proof = proofFor("NO");
    const receipt = buildOnChainOrderReceipt({
      marketId: "fxm-test",
      marketTitle: "Test market",
      fixtureId: "custom:fxm-test",
      side: "NO",
      proof,
    });
    expect(receipt.verdict).toBe("STALE_ALLOWED_NO_EDGE");
    expect(receipt.settlementDestination).toBe("FINALIZED_TO_VAULT");
    expect(receipt.normalizedEventHash).toBe(proof.sourceEventHash);
    expect(verifyReceipt(receipt, 0).valid).toBe(true);
    const tampered = { ...receipt, settlementDestination: "REFUNDED_TO_TRADER" as const };
    expect(verifyReceipt(tampered, 0).valid).toBe(false);
  });
});

describe("proof summary", () => {
  it("summarizes verdicts, destinations, event hashes and stays honest", () => {
    const programId = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
    const yes = buildFreshDevnetReceipt("YES", proofFor("YES"));
    const no = buildFreshDevnetReceipt("NO", proofFor("NO"));
    const summary = buildProofSummary([yes, no], programId);
    expect(summary).toContain(programId);
    expect(summary).toContain("VOIDED_REFUNDED");
    expect(summary).toContain("REFUNDED_TO_TRADER");
    expect(summary).toContain("FINALIZED_TO_VAULT");
    expect(summary).toContain("event hash");
    expect(summary.toLowerCase()).toContain("not a real-money");
  });
});
