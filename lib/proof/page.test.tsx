import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import { proofData } from "@/lib/proof/staticProofData";
import { verifyReceipt } from "@/lib/receipts/verify";

describe("proof page", () => {
  it("renders the honest settlement limitation and committed YES meaning", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("Scores are operator-submitted; the TxLINE Merkle proof is not re-verified inside LineGuard.");
    expect(html).toContain("France/home team wins");
    expect(html).toContain("TxLINE proof validated separately");
  });
  it("renders the ten canonical TxLINE and settlement proof stages", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    for (const title of [
      "TxLINE subscription active", "Genuine fixture loaded", "TxLINE score proof validated", "MarketConfig committed",
      "Source event hash committed", "YES stake escrowed", "YES refunded", "NO stake escrowed",
      "NO finalized to ProtocolVault", "Receipt integrity verified",
    ]) expect(html).toContain(title);
    expect(html).toContain("settlement-v4 · 475793035");
    expect(html).toContain(proofData.txline.programId);
    expect(html).toContain(proofData.txline.rootPda);
    expect(html).toContain(proofData.receipt.noReceipt.receiptHash);
    expect((html.match(/<a /g) ?? []).length).toBeGreaterThanOrEqual(18);
  });

  it("renders the unified lifecycle (protection + TxLINE resolution + payout) evidence", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("root-bound resolution");
    const s = proofData.settlement;
    expect(s.resolution).toBe("YES_WON");
    expect(s.winnerOrderStatus).toBe("Settled");
    expect(s.loserOrderStatus).toBe("Filled");
    // Protection and settlement happened on the SAME market (one unified lifecycle).
    expect(s.protectionRefunded).toBe(true);
    expect(s.protectionVerdict).toBe("VOIDED_REFUNDED");
    expect(s.txs.length).toBe(13);
    // The committed rule maps the submitted 1-0 score to YES.
    expect(s.derivedOutcome).toBe(s.homeScore > s.awayScore ? 1 : 2);
    expect(s.derivedOutcome).toBe(1);
    // The genuine on-chain TxLINE daily-scores root is bound.
    expect(s.validationRootPda).toBe("EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr");
    // Parimutuel invariant + solvency invariant.
    const expectedPayout = Math.floor((s.winnerStakeLamports * s.totalPoolLamports) / s.winningPoolLamports);
    expect(s.winnerPayoutLamports).toBe(expectedPayout);
    expect(s.marketTotalPaidLamports + s.marketTotalRefundedLamports).toBeLessThanOrEqual(s.marketTotalInLamports);
    // Every lifecycle transaction signature is surfaced as evidence.
    for (const tx of s.txs) expect(html).toContain(tx.signature);
  });

  it("publishes stable valid routes for both canonical receipts", () => {
    expect(proofData.receipt.verifierHref).toBe(`/verify/${proofData.receipt.receipt.receiptId}`);
    expect(proofData.receipt.noVerifierHref).toBe(`/verify/${proofData.receipt.noReceipt.receiptId}`);
    expect(verifyReceipt(proofData.receipt.receipt, 0).valid).toBe(true);
    expect(verifyReceipt(proofData.receipt.noReceipt, 0).valid).toBe(true);
  });
});
