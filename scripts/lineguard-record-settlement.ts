import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalize } from "../lib/receipts/create";
import type { OnChainSettlementProof } from "../lib/receipts/types";

const RPC_URL = process.env.LINEGUARD_RPC_URL ?? "https://api.devnet.solana.com";
const RESPONSE_PATH = resolve(process.env.LINEGUARD_LIFECYCLE_RESPONSE_PATH ?? "/tmp/fairx_lifecycle_response.json");
const OUTPUT_PATH = resolve(process.env.LINEGUARD_SETTLEMENT_PROOF_PATH ?? "fixtures/lineguard/settlement-proof.json");
const EXPECTED_PROGRAM = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
const EXPECTED_VAULT = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";
const EXPECTED_OPERATOR = "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq";
const EXPECTED_ROOT = "EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr";

// The unified lifecycle: one market shows LineGuard protection AND TxLINE-backed settlement.
const TX_LABELS = [
  "Initialize market + config (bound to fixture 18209181)",
  "Ingest genuine TxLINE material event (stale window opens)",
  "Place stale YES exploit into escrow",
  "Evaluate exploit → VOIDED_REFUNDED (LineGuard protection)",
  "Reprice market to fair value (back in sync)",
  "Place valid post-reprice YES order",
  "Evaluate YES → filled into yes_pool",
  "Place valid post-reprice NO order",
  "Evaluate NO → filled into no_pool",
  "Close trading",
  "Submit TxLINE validation (binds genuine on-chain root)",
  "Resolve from TxLINE (outcome derived from proven score)",
  "Settle YES → parimutuel payout from vault",
];

interface LifecycleResponse {
  ok: boolean;
  reason?: string;
  proof?: OnChainSettlementProof;
}
interface TransactionRecord {
  label: string;
  signature: string;
  explorerUrl: string;
  slot: number;
  blockTime: string;
  finalized: true;
  error: null;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!response.ok) throw new Error(`${method} failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (payload.error) throw new Error(`${method} failed: ${payload.error.message ?? "unknown RPC error"}`);
  return payload.result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpcWithRetry(method: string, params: unknown[], attempts = 6): Promise<unknown> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await rpc(method, params);
    } catch (e) {
      if (i === attempts - 1 || !String(e).includes("429")) throw e;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

async function transactions(proof: OnChainSettlementProof): Promise<TransactionRecord[]> {
  const statuses = (await rpcWithRetry("getSignatureStatuses", [proof.txSignatures, { searchTransactionHistory: true }])) as { value: Array<{ confirmationStatus?: string; err: unknown } | null> };
  const out: TransactionRecord[] = [];
  for (let index = 0; index < proof.txSignatures.length; index += 1) {
    const signature = proof.txSignatures[index];
    const status = statuses.value[index];
    if (!status || status.confirmationStatus !== "finalized" || status.err !== null) throw new Error(`Transaction ${signature} is not finalized without error`);
    const tx = (await rpcWithRetry("getTransaction", [signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 }])) as { slot: number; blockTime: number | null; meta: { err: unknown } | null } | null;
    if (!tx || tx.meta?.err !== null || tx.blockTime === null) throw new Error(`Finalized transaction ${signature} could not be read back`);
    out.push({ label: TX_LABELS[index] ?? `Transaction ${index + 1}`, signature, explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`, slot: tx.slot, blockTime: new Date(tx.blockTime * 1000).toISOString(), finalized: true as const, error: null });
    await sleep(300);
  }
  return out;
}

function assertProof(p: OnChainSettlementProof) {
  if (p.programId !== EXPECTED_PROGRAM || p.cluster !== "devnet") throw new Error("program/network mismatch");
  if (p.vaultPda !== EXPECTED_VAULT) throw new Error("vault PDA mismatch");
  if (p.validationRootPda !== EXPECTED_ROOT) throw new Error("validation root PDA mismatch (must be the genuine TxLINE root)");
  if (p.resolution !== "YES_WON") throw new Error("expected YES_WON resolution");
  if (p.derivedOutcome !== 1) throw new Error("expected derived outcome YES (1)");
  if (p.protectionRefunded !== true) throw new Error("protection leg must refund the stale exploit");
  if (p.protectionVerdict !== "VOIDED_REFUNDED") throw new Error("protection verdict must be VOIDED_REFUNDED");
  if (p.winnerOrderStatus !== "Settled") throw new Error("winning order was not settled");
  if (p.txSignatures.length !== TX_LABELS.length) throw new Error(`expected ${TX_LABELS.length} transactions, got ${p.txSignatures.length}`);
  const total = p.yesPoolLamports + p.noPoolLamports;
  if (p.totalPoolLamports !== total) throw new Error("total pool mismatch");
  const expectedPayout = p.winningPoolLamports > 0 ? Math.floor((p.winnerStakeLamports * total) / p.winningPoolLamports) : 0;
  if (p.winnerPayoutLamports !== expectedPayout) throw new Error(`payout mismatch: got ${p.winnerPayoutLamports}, expected ${expectedPayout}`);
  // Per-market solvency invariant.
  const paid = p.marketTotalPaidLamports ?? 0;
  const refunded = p.marketTotalRefundedLamports ?? 0;
  const totalIn = p.marketTotalInLamports ?? 0;
  if (paid + refunded > totalIn) throw new Error("accounting invariant violated: paid + refunded > total_in");
}

async function main() {
  const response = JSON.parse(await readFile(RESPONSE_PATH, "utf8")) as LifecycleResponse;
  if (!response.ok || !response.proof) throw new Error(`lifecycle response not ok: ${response.reason ?? "unknown"}`);
  const p = response.proof;
  assertProof(p);
  const txs = await transactions(p);

  const record = {
    version: 2,
    network: "devnet" as const,
    kind: "unified-lifecycle",
    programId: EXPECTED_PROGRAM,
    operator: EXPECTED_OPERATOR,
    fixtureId: p.fixtureId ?? 18209181,
    sequence: p.sequence ?? 739,
    recordedAt: txs.at(-1)!.blockTime,
    resolution: p.resolution,
    resolutionEventHash: p.resolutionEventHash,
    marketPda: p.marketPda,
    marketConfigPda: p.marketConfigPda,
    vaultPda: p.vaultPda,
    // Protection leg (same market).
    protectionOrderPda: p.protectionOrderPda,
    protectionVerdict: p.protectionVerdict,
    protectionRefunded: p.protectionRefunded,
    protectionEdgeMicros: p.protectionEdgeMicros,
    protectionEventHash: p.protectionEventHash,
    // TxLINE resolution binding.
    validationRootPda: p.validationRootPda,
    validationPayloadHash: p.validationPayloadHash,
    eventStatRoot: p.eventStatRoot,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    derivedOutcome: p.derivedOutcome,
    // Settlement + accounting.
    yesOrderPda: p.yesOrderPda,
    noOrderPda: p.noOrderPda,
    winnerOrderPda: p.winnerOrderPda,
    winnerSide: p.winnerSide,
    winnerStakeLamports: p.winnerStakeLamports,
    winnerPayoutLamports: p.winnerPayoutLamports,
    yesPoolLamports: p.yesPoolLamports,
    noPoolLamports: p.noPoolLamports,
    totalPoolLamports: p.totalPoolLamports,
    winningPoolLamports: p.winningPoolLamports,
    winnerOrderStatus: p.winnerOrderStatus,
    loserOrderStatus: p.loserOrderStatus,
    marketTotalInLamports: p.marketTotalInLamports,
    marketTotalPaidLamports: p.marketTotalPaidLamports,
    marketTotalRefundedLamports: p.marketTotalRefundedLamports,
    vaultBalanceBeforeLamports: p.vaultBalanceBeforeLamports,
    vaultBalanceAfterLamports: p.vaultBalanceAfterLamports,
    transactions: txs,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${canonicalize(record)}\n`, { encoding: "utf8", mode: 0o644 });
  console.log(JSON.stringify({ output: OUTPUT_PATH, resolution: record.resolution, protectionRefunded: record.protectionRefunded, winnerPayoutLamports: record.winnerPayoutLamports, transactions: txs.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
