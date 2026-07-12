import { describe, expect, it } from "vitest";
import settlementFixture from "@/fixtures/lineguard/settlement-proof.json";
import { deriveOutcome, verifySettlementProof, type SettlementProofRecordShape } from "@/lib/proof/settlementProof";

const base = settlementFixture as unknown as SettlementProofRecordShape;

function tampered(overrides: Partial<SettlementProofRecordShape>): SettlementProofRecordShape {
  return { ...base, ...overrides };
}

describe("settlement proof verifier", () => {
  it("accepts the genuine recorded unified-lifecycle proof", () => {
    const result = verifySettlementProof(base);
    expect(result.errors).to.deep.equal([]);
    expect(result.valid).to.equal(true);
  });

  it("derives the outcome from the committed rule and submitted scores", () => {
    expect(deriveOutcome(1, 0)).to.equal(1); // home win => YES
    expect(deriveOutcome(0, 2)).to.equal(2); // away win => NO
    expect(deriveOutcome(1, 1)).to.equal(3); // draw => void
  });

  it("detects tampering with the validated result / winning side", () => {
    expect(verifySettlementProof(tampered({ resolution: "NO_WON" })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ winnerSide: "NO" })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ derivedOutcome: 2 })).valid).to.equal(false);
    // Flipping the submitted score without flipping the outcome is rejected.
    expect(verifySettlementProof(tampered({ homeScore: 0, awayScore: 3 })).valid).to.equal(false);
  });

  it("detects tampering with rules, stat keys, scores, and derived outcome", () => {
    expect(verifySettlementProof(tampered({ resolutionRuleCode: 7 })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ homeStatKey: 2, awayStatKey: 1 })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ homeScore: 4 })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ derivedOutcome: 2 })).valid).to.equal(false);
  });

  it("detects tampering with the payout amount", () => {
    expect(verifySettlementProof(tampered({ winnerPayoutLamports: base.winnerPayoutLamports + 1 })).valid).to.equal(false);
  });

  it("detects tampering with fixture, sequence, or root", () => {
    expect(verifySettlementProof(tampered({ validationRootPda: "11111111111111111111111111111111" })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ programId: "11111111111111111111111111111111" })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ vaultPda: "11111111111111111111111111111111" })).valid).to.equal(false);
  });

  it("detects tampering with pool totals or the solvency invariant", () => {
    expect(verifySettlementProof(tampered({ totalPoolLamports: base.totalPoolLamports + 1 })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ marketTotalPaidLamports: base.marketTotalInLamports + 1 })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ yesPoolLamports: base.yesPoolLamports + 1 })).valid).to.equal(false);
  });

  it("detects a missing protection leg", () => {
    expect(verifySettlementProof(tampered({ protectionRefunded: false })).valid).to.equal(false);
    expect(verifySettlementProof(tampered({ protectionVerdict: "ALLOWED" })).valid).to.equal(false);
  });
});
