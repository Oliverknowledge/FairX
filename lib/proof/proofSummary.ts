import type { LineGuardReceipt } from "@/lib/receipts/types";

/**
 * Deterministic, copy-pasteable proof summary. Pure so it can be tested and
 * generated identically in the browser or a test runner.
 */
export function buildProofSummary(receipts: readonly LineGuardReceipt[], programId: string): string {
  const lines: string[] = [
    "FairX / LineGuard — devnet proof summary",
    `Program: ${programId} (Solana devnet)`,
  ];

  for (const receipt of receipts) {
    const onChain = receipt.onChain;
    const destination = receipt.settlementDestination ?? "—";
    const tx = onChain?.txSignatures?.at(-1);
    lines.push(
      `${receipt.side} ${receipt.verdict}: edge ${signedCents(receipt.edge)}, ${destination}${onChain ? ` (devnet)` : " (local sim)"}${tx ? `, tx ${tx}` : ""}`
    );
    if (receipt.normalizedEventHash) {
      lines.push(`  event hash (on-chain-bound): ${receipt.normalizedEventHash}`);
    }
    lines.push(`  receipt hash: ${receipt.receiptHash}`);
  }

  lines.push("Scope: devnet-backed prototype. Not a real-money betting product; not mainnet.");
  return lines.join("\n");
}

function signedCents(value: number): string {
  const cents = Math.round(value * 100);
  return `${cents > 0 ? "+" : ""}${cents}¢`;
}
