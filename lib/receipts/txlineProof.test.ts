import { describe, expect, it } from "vitest";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import { computeReceiptHash } from "@/lib/receipts/create";
import { buildFreshDevnetReceipt } from "@/lib/proof/onchainReceipt";
import { hashMarketText } from "@/lib/markets/marketConfig";
import { verifyReceipt } from "@/lib/receipts/verify";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";

const sourceHash = canonicalCapture.normalizedEventHash;
const proof: OnChainProof = {
  cluster: "devnet",
  programId: "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe",
  marketPda: "market",
  marketConfigPda: "config",
  orderEscrowPda: "order",
  txSignatures: ["one", "two", "three", "four"],
  explorerUrls: [],
  materialSeq: canonicalCapture.normalizedEvent.seq,
  pricedAtSeq: canonicalCapture.normalizedEvent.seq - 1,
  observedPriceMicros: canonicalCapture.odds.displayedPricingInput.fairPriceMicros,
  fairSidePriceMicros: canonicalCapture.odds.normalizedPricingInput.fairPriceMicros,
  toleranceMicros: 20_000,
  edgeMicros: canonicalCapture.odds.normalizedPricingInput.fairPriceMicros - canonicalCapture.odds.displayedPricingInput.fairPriceMicros,
  verdictCode: 2,
  statusCode: 4,
  sourceEventHash: sourceHash,
  orderSourceEventHash: sourceHash,
  orderMaterialityConfigHash: "3".repeat(64),
  marketType: "MATCH_WINNER",
  fixtureIdHash: hashMarketText(canonicalCapture.fixtureId),
  marketTitleHash: "2".repeat(64),
  materialityConfigHash: "3".repeat(64),
  settlementConfigHash: "4".repeat(64),
  settlementDestination: "REFUNDED_TO_TRADER",
};

function reseal(receipt: LineGuardReceipt): LineGuardReceipt {
  const { receiptHash: _old, ...fields } = receipt;
  return { ...fields, receiptHash: computeReceiptHash(fields) };
}

describe("receipt TxLINE provenance verification", () => {
  it("verifies genuine raw, normalized, on-chain and fixture evidence", () => {
    const result = verifyReceipt(buildFreshDevnetReceipt("YES", proof, 1), 2);
    expect(result.valid).toBe(true);
    expect(result.payloadIntegrityVerified).toBe(true);
    expect(result.normalizedEventVerified).toBe(true);
    expect(result.onChainSourceEventHashMatches).toBe(true);
    expect(result.fixtureCommitmentMatches).toBe(true);
    expect(result.pricingVerified).toBe(true);
  });

  it.each(["endpoint", "fixtureId", "seq"] as const)("rejects a resealed tampered %s", (field) => {
    const receipt = buildFreshDevnetReceipt("YES", proof, 1);
    const txlineProof = structuredClone(receipt.txlineProof!);
    if (field === "endpoint") txlineProof.endpoint = "/api/scores/historical/999";
    if (field === "fixtureId") txlineProof.fixtureId = "999";
    if (field === "seq") txlineProof.seq = (txlineProof.seq ?? 0) + 1;
    expect(verifyReceipt(reseal({ ...receipt, txlineProof }), 2).valid).toBe(false);
  });

  it("rejects a resealed altered raw payload", () => {
    const receipt = buildFreshDevnetReceipt("YES", proof, 1);
    const txlineProof = structuredClone(receipt.txlineProof!);
    (txlineProof.rawPayload as any).Seq += 1;
    expect(verifyReceipt(reseal({ ...receipt, txlineProof }), 2).errors).toContain("raw payload hash mismatch");
  });

  it("rejects an incorrect on-chain source event hash", () => {
    const receipt = buildFreshDevnetReceipt("YES", proof, 1);
    const onChain = { ...receipt.onChain!, sourceEventHash: "0".repeat(64) };
    expect(verifyReceipt(reseal({ ...receipt, onChain }), 2).errors).toContain("on-chain source event hash mismatch");
  });

  it("rejects resealed odds or fair-price tampering by recomputing the pricing pipeline", () => {
    const receipt = buildFreshDevnetReceipt("YES", proof, 1);
    const pricingProof = structuredClone(receipt.pricingProof!);
    (pricingProof.fairRawPayload as any).Pct[0] = "50.000";
    expect(verifyReceipt(reseal({ ...receipt, pricingProof }), 2).errors).toContain("TxLINE pricing derivation mismatch");

    const changedFair = reseal({ ...receipt, fairYes: 0.5, fairSidePrice: 0.5, edge: -0.02274 });
    expect(verifyReceipt(changedFair, 2).errors).toContain("TxLINE pricing derivation mismatch");
  });
});
