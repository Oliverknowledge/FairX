import { computeReceiptHash } from "@/lib/receipts/create";
import type { LineGuardReceipt, ReceiptVerification } from "@/lib/receipts/types";

/**
 * Receipt verification = recompute the canonical hash from the fields and
 * compare. Any tampered field (verdict, edge, sequences, …) changes the
 * recomputed hash and fails verification.
 */
export function verifyReceipt(receipt: LineGuardReceipt, checkedAt: number): ReceiptVerification {
  const { receiptHash, ...fields } = receipt;
  const recomputedHash = computeReceiptHash(fields);
  return {
    valid: recomputedHash === receiptHash,
    expectedHash: receiptHash,
    recomputedHash,
    checkedAt,
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
