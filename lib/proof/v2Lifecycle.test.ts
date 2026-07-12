import { describe, expect, it } from "vitest";
import { canonicalV2Lifecycle, cloneV2Lifecycle, reconstructTxlineCpiPayload, verifyV2Lifecycle } from "./v2Lifecycle";

describe("canonical FairX v2 lifecycle", () => {
  it("has the durable v2 schema and verifies both hash domains independently", () => {
    const result = verifyV2Lifecycle();
    expect(canonicalV2Lifecycle.version).toBe(2);
    expect(canonicalV2Lifecycle.receiptId).toBe("v2-france-morocco");
    expect(result.valid).toBe(true);
    expect(result.checks.captureHash).toBe(true);
    expect(result.checks.borshPayloadHash).toBe(true);
    expect(result.recomputedCaptureHash).toBe("e4701bab0a8d2b8576eef7d2050ad032d3e090315129f51a732c8c6e5f2db598");
    expect(result.recomputedBorshPayloadHash).toBe("1b1c31c9ffee2aec676fa9d9585e677c0c5ee42d38ec137f222fc87ea8501c98");
    expect(result.recomputedCaptureHash).not.toBe(result.recomputedBorshPayloadHash);
    expect(reconstructTxlineCpiPayload()).toHaveLength(606);
  });

  it.each([
    ["fixture", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.txline.fixtureId = "999"; }, "fixtureAndSequence"],
    ["sequence", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.txline.sequence = 740; }, "fixtureAndSequence"],
    ["Borsh payload", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.txline.borshPayloadHash = "00".repeat(32); }, "borshPayloadHash"],
    ["score", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.txline.homeScore = 2; }, "fixtureAndSequence"],
    ["outcome", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.txline.derivedOutcome = "NO"; }, "marketConfiguration"],
    ["approval mask", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.authorities.approvalMask = "001"; }, "thresholdResolution"],
    ["refund", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.lifecycle.refundedStakeLamports = 9_000_000; }, "protectionVerdict"],
    ["payout", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.lifecycle.claimedPayoutLamports = 9_000_000; }, "payout"],
    ["claim transaction", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.transactions.claim.signature = "tampered"; }, "claimTransaction"],
    ["vault totals", (p: ReturnType<typeof cloneV2Lifecycle>) => { p.vault.totalPaidLamports = 9_000_000; }, "vaultConservation"],
  ] as const)("rejects tampered %s", (_name, mutate, failedCheck) => {
    const proof = cloneV2Lifecycle();
    mutate(proof);
    const result = verifyV2Lifecycle(proof);
    expect(result.valid).toBe(false);
    expect(result.checks[failedCheck]).toBe(false);
  });

  it("does not compare JSON and Borsh hashes as though they should match", () => {
    const proof = cloneV2Lifecycle();
    proof.txline.captureHash = proof.txline.borshPayloadHash;
    const result = verifyV2Lifecycle(proof);
    expect(result.checks.captureHash).toBe(false);
    expect(result.checks.borshPayloadHash).toBe(true);
  });
});
