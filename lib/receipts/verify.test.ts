import { describe, expect, it } from "vitest";
import { createReceipt, decodeReceiptFromUrl, encodeReceiptForUrl, type ReceiptDraft } from "@/lib/receipts/create";
import { verifyReceipt } from "@/lib/receipts/verify";

const draft: ReceiptDraft = {
  marketId: "eng-win",
  marketTitle: "England wins",
  fixtureId: "ENG-FRA-2026-QF",
  orderId: "order-1",
  actor: "bot",
  side: "YES",
  stake: 500,
  observedPrice: 0.4,
  fairSidePrice: 0.63,
  fairYes: 0.63,
  materialSeq: 2,
  pricedAtSeq: 1,
  staleness: 1,
  edge: 0.23,
  tolerance: 0.02,
  verdict: "VOIDED_REFUNDED",
  reason: "Stale beneficial trade.",
  txlineEventSeq: 2,
  txlineEventType: "GOAL",
  txlineTimestamp: 1_700_000_000_000,
  proofStatus: "simulated",
  createdAt: 1_700_000_000_000,
};

describe("receipt verification", () => {
  it("passes for an unchanged receipt", () => {
    const receipt = createReceipt(draft);
    const v = verifyReceipt(receipt, Date.now());
    expect(v.valid).toBe(true);
    expect(v.recomputedHash).toBe(v.expectedHash);
  });

  it("fails after tampering with the verdict", () => {
    const receipt = createReceipt(draft);
    const tampered = { ...receipt, verdict: "ALLOWED" }; // flip the outcome, keep old hash
    const v = verifyReceipt(tampered, Date.now());
    expect(v.valid).toBe(false);
    expect(v.recomputedHash).not.toBe(v.expectedHash);
  });

  it("fails after tampering with a numeric field", () => {
    const receipt = createReceipt(draft);
    const tampered = { ...receipt, edge: 0.01 };
    expect(verifyReceipt(tampered, Date.now()).valid).toBe(false);
  });

  it("fails after tampering with an on-chain proof field", () => {
    const receipt = createReceipt({
      ...draft,
      onChain: {
        cluster: "devnet",
        programId: "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe",
        marketPda: "market-pda",
        orderEscrowPda: "order-pda",
        txSignatures: ["sig-1", "sig-2", "sig-3", "sig-4"],
        explorerUrls: ["https://explorer.solana.com/tx/sig-1?cluster=devnet"],
        materialSeq: 2,
        pricedAtSeq: 1,
        observedPriceMicros: 400_000,
        fairSidePriceMicros: 630_000,
        toleranceMicros: 20_000,
        edgeMicros: 230_000,
        verdictCode: 2,
        statusCode: 4,
      },
    });
    const tampered = {
      ...receipt,
      onChain: receipt.onChain ? { ...receipt.onChain, verdictCode: 1 } : undefined,
    };
    expect(verifyReceipt(tampered, Date.now()).valid).toBe(false);
  });

  it("includes market config proof and fails if its hash is tampered", () => {
    const receipt = createReceipt({
      ...draft,
      marketConfigProof: {
        marketType: "MATCH_WINNER",
        fixtureIdHash: "1".repeat(64),
        marketTitleHash: "2".repeat(64),
        materialityConfigHash: "3".repeat(64),
        settlementConfigHash: "4".repeat(64),
        onChainMarketPda: "market-pda",
      },
    });
    expect(receipt.marketConfigProof?.materialityConfigHash).toBe("3".repeat(64));
    expect(verifyReceipt(receipt, Date.now()).valid).toBe(true);
    const tampered = {
      ...receipt,
      marketConfigProof: { ...receipt.marketConfigProof!, materialityConfigHash: "9".repeat(64) },
    };
    expect(verifyReceipt(tampered, Date.now()).valid).toBe(false);
  });

  it("survives a url encode/decode round-trip and still verifies", () => {
    const receipt = createReceipt(draft);
    const decoded = decodeReceiptFromUrl(encodeReceiptForUrl(receipt));
    expect(decoded).not.toBeNull();
    expect(verifyReceipt(decoded!, Date.now()).valid).toBe(true);
  });

  it("produces a stable hash for identical drafts", () => {
    expect(createReceipt(draft).receiptHash).toBe(createReceipt(draft).receiptHash);
  });
});
