import { computeReceiptHash } from "@/lib/receipts/create";
import { hashMarketText } from "@/lib/markets/marketConfig";
import { hashNormalizedEvent, hashRawEvent } from "@/lib/proof/eventHash";
import { captureNormalizedHashInput } from "@/lib/txline/captureFormat";
import type { LineGuardReceipt, ReceiptVerification } from "@/lib/receipts/types";
import { deriveMatchWinnerHomePrice, TXLINE_PRICING_MODEL_V1 } from "@/lib/txline/pricing";
import { sha256 } from "js-sha256";
import { canonicalize } from "@/lib/receipts/create";

/**
 * Receipt verification = recompute the canonical hash from the fields and
 * compare. Any tampered field (verdict, edge, sequences, …) changes the
 * recomputed hash and fails verification.
 */
export function verifyReceipt(receipt: LineGuardReceipt, checkedAt: number): ReceiptVerification {
  const { receiptHash, ...fields } = receipt;
  const recomputedHash = computeReceiptHash(fields);
  const receiptSealVerified = recomputedHash === receiptHash;
  const errors: string[] = [];
  let payloadIntegrityVerified: boolean | null = null;
  let normalizedEventVerified: boolean | null = null;
  let onChainSourceEventHashMatches: boolean | null = null;
  let fixtureCommitmentMatches: boolean | null = null;
  let pricingVerified: boolean | null = null;

  if (receipt.txlineProof) {
    const proof = receipt.txlineProof;
    payloadIntegrityVerified = hashRawEvent(proof.rawPayload) === proof.rawPayloadHash;
    normalizedEventVerified = hashNormalizedEvent(captureNormalizedHashInput(proof.normalizedEvent)) === proof.normalizedEventHash;
    onChainSourceEventHashMatches = Boolean(
      receipt.onChain?.sourceEventHash === proof.normalizedEventHash
      && receipt.onChain?.orderSourceEventHash === proof.normalizedEventHash
    );
    fixtureCommitmentMatches = Boolean(
      proof.fixtureId === receipt.fixtureId
      && proof.normalizedEvent.fixtureId === receipt.fixtureId
      && receipt.marketConfigProof?.fixtureIdHash === hashMarketText(receipt.fixtureId)
      && receipt.onChain?.fixtureIdHash === receipt.marketConfigProof?.fixtureIdHash
    );
    if (proof.source !== "txline") errors.push("provenance source is not TxLINE");
    if (proof.endpoint !== receipt.sourceEndpoint) errors.push("provenance endpoint mismatch");
    if (proof.seq !== receipt.txlineEventSeq || proof.seq !== proof.normalizedEvent.seq) errors.push("provenance sequence mismatch");
    if (proof.rawPayloadHash !== receipt.rawEventHash) errors.push("raw payload hash is not linked to receipt");
    if (proof.normalizedEventHash !== receipt.normalizedEventHash) errors.push("normalized event hash is not linked to receipt");
    if (!payloadIntegrityVerified) errors.push("raw payload hash mismatch");
    if (!normalizedEventVerified) errors.push("normalized event hash mismatch");
    if (!onChainSourceEventHashMatches) errors.push("on-chain source event hash mismatch");
    if (!fixtureCommitmentMatches) errors.push("fixture commitment mismatch");
    if (proof.validation && !proof.validation.passed) errors.push("TxLINE validation did not pass");
  }
  if (receipt.pricingProof) {
    const pricing = receipt.pricingProof;
    try {
      const displayed = deriveMatchWinnerHomePrice(pricing.displayedRawPayload, receipt.fixtureId);
      const fair = deriveMatchWinnerHomePrice(pricing.fairRawPayload, receipt.fixtureId);
      const expectedModelHash = sha256(canonicalize(TXLINE_PRICING_MODEL_V1));
      const observedSide = receipt.side === "YES" ? displayed.impliedProbability : 1 - displayed.impliedProbability;
      const fairSide = receipt.side === "YES" ? fair.impliedProbability : 1 - fair.impliedProbability;
      const recomputedEdge = Math.round((fairSide - observedSide) * 1_000_000) / 1_000_000;
      pricingVerified = Boolean(
        pricing.source === "txline"
        && pricing.fixtureId === receipt.fixtureId
        && pricing.homeSelection === "part1"
        && pricing.pricingModelVersion === 1
        && pricing.pricingModelHash === expectedModelHash
        && hashRawEvent(pricing.displayedRawPayload) === pricing.displayedPayloadHash
        && hashRawEvent(pricing.fairRawPayload) === pricing.fairPayloadHash
        && displayed.fairPriceMicros === Math.round((receipt.side === "YES" ? receipt.observedPrice : 1 - receipt.observedPrice) * 1_000_000)
        && fair.fairPriceMicros === Math.round(receipt.fairYes * 1_000_000)
        && recomputedEdge === Math.round(receipt.edge * 1_000_000) / 1_000_000
      );
    } catch {
      pricingVerified = false;
    }
    if (!pricingVerified) errors.push("TxLINE pricing derivation mismatch");
  }
  if (!receiptSealVerified) errors.push("receipt seal mismatch");
  return {
    valid: errors.length === 0,
    expectedHash: receiptHash,
    recomputedHash,
    checkedAt,
    receiptSealVerified,
    payloadIntegrityVerified,
    normalizedEventVerified,
    onChainSourceEventHashMatches,
    fixtureCommitmentMatches,
    pricingVerified,
    errors,
  };
}

/** Plain-English explanation of what the receipt proves, for the verifier page. */
export function explainReceipt(receipt: LineGuardReceipt): string {
  const seqClause = `TxLINE sequence ${receipt.materialSeq} was ahead of market reprice sequence ${receipt.pricedAtSeq}`;
  const edgeCents = Math.round(receipt.edge * 100);
  switch (receipt.verdict) {
    case "VOIDED_REFUNDED":
      return `This order was voided and refunded because ${seqClause} and the ${receipt.side} order had +${edgeCents}¢ of positive stale edge — above the ${Math.round(receipt.tolerance * 100)}¢ tolerance.`;
    case "STALE_ALLOWED_NO_EDGE":
      return `This order was allowed even though ${seqClause}: the ${receipt.side} side captured no positive edge (${edgeCents}¢) from the un-repriced event, so it was not exploitation.`;
    case "ALLOWED":
      return `This order was allowed because the market was in sync (materialSeq ${receipt.materialSeq} ≤ pricedAtSeq ${receipt.pricedAtSeq}) — the quote already reflected every known event.`;
    default:
      return `Verdict: ${receipt.verdict}.`;
  }
}
