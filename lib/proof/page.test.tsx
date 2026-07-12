import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import { proofData } from "@/lib/proof/staticProofData";
import { verifyReceipt } from "@/lib/receipts/verify";

describe("proof page", () => {
  it("renders the ten canonical TxLINE and settlement proof stages", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    for (const title of [
      "TxLINE subscription active", "Genuine fixture loaded", "TxLINE score proof validated", "MarketConfig committed",
      "Source event hash committed", "YES stake escrowed", "YES refunded", "NO stake escrowed",
      "NO finalized to ProtocolVault", "Receipt integrity verified",
    ]) expect(html).toContain(title);
    expect(html).toContain("settlement-v3 · 475735558");
    expect(html).toContain(proofData.txline.programId);
    expect(html).toContain(proofData.txline.rootPda);
    expect(html).toContain(proofData.receipt.noReceipt.receiptHash);
    expect((html.match(/<a /g) ?? []).length).toBeGreaterThanOrEqual(18);
  });

  it("renders the on-chain settlement (resolution + parimutuel payout) evidence", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain("parimutuel payout");
    expect(proofData.settlement.resolution).toBe("YES_WON");
    expect(proofData.settlement.winnerOrderStatus).toBe("Settled");
    expect(proofData.settlement.loserOrderStatus).toBe("Filled");
    // Parimutuel invariant: winner payout = stake * total_pool / winning_pool.
    const expectedPayout = Math.floor((proofData.settlement.winnerStakeLamports * proofData.settlement.totalPoolLamports) / proofData.settlement.winningPoolLamports);
    expect(proofData.settlement.winnerPayoutLamports).toBe(expectedPayout);
    // Every settlement transaction signature is surfaced as evidence.
    for (const tx of proofData.settlement.txs) expect(html).toContain(tx.signature);
  });

  it("publishes stable valid routes for both canonical receipts", () => {
    expect(proofData.receipt.verifierHref).toBe(`/verify/${proofData.receipt.receipt.receiptId}`);
    expect(proofData.receipt.noVerifierHref).toBe(`/verify/${proofData.receipt.noReceipt.receiptId}`);
    expect(verifyReceipt(proofData.receipt.receipt, 0).valid).toBe(true);
    expect(verifyReceipt(proofData.receipt.noReceipt, 0).valid).toBe(true);
  });
});
