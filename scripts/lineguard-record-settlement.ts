import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalize } from "../lib/receipts/create";
import type { OnChainSettlementProof } from "../lib/receipts/types";

const RPC_URL = process.env.LINEGUARD_RPC_URL ?? "https://api.devnet.solana.com";
const RESPONSE_PATH = resolve(process.env.LINEGUARD_SETTLEMENT_RESPONSE_PATH ?? "/tmp/fairx_settlement_response.json");
const OUTPUT_PATH = resolve(process.env.LINEGUARD_SETTLEMENT_PROOF_PATH ?? "fixtures/lineguard/settlement-proof.json");
const EXPECTED_PROGRAM = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
const EXPECTED_VAULT = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";
const EXPECTED_OPERATOR = "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq";

const TX_LABELS = [
  "Initialize in-sync market + config",
  "Place YES order into escrow",
  "Evaluate YES → filled into yes_pool",
  "Place NO order into escrow",
  "Evaluate NO → filled into no_pool",
  "Resolve market (YES won) from final result",
  "Settle YES → parimutuel payout from vault",
];

interface SettlementResponse {
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
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (payload.error) throw new Error(`${method} failed: ${payload.error.message ?? "unknown RPC error"}`);
  return payload.result;
}

async function transactions(proof: OnChainSettlementProof): Promise<TransactionRecord[]> {
  const statuses = (await rpc("getSignatureStatuses", [proof.txSignatures, { searchTransactionHistory: true }])) as {
    value: Array<{ confirmationStatus?: string; err: unknown } | null>;
  };
  return Promise.all(
    proof.txSignatures.map(async (signature, index) => {
      const status = statuses.value[index];
      if (!status || status.confirmationStatus !== "finalized" || status.err !== null) {
        throw new Error(`Transaction ${signature} is not finalized without error`);
      }
      const tx = (await rpc("getTransaction", [signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 }])) as {
        slot: number;
        blockTime: number | null;
        meta: { err: unknown } | null;
      } | null;
      if (!tx || tx.meta?.err !== null || tx.blockTime === null) throw new Error(`Finalized transaction ${signature} could not be read back`);
      return {
        label: TX_LABELS[index] ?? `Transaction ${index + 1}`,
        signature,
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        slot: tx.slot,
        blockTime: new Date(tx.blockTime * 1000).toISOString(),
        finalized: true as const,
        error: null,
      };
    })
  );
}

function assertProof(proof: OnChainSettlementProof) {
  if (proof.programId !== EXPECTED_PROGRAM || proof.cluster !== "devnet") throw new Error("program/network mismatch");
  if (proof.vaultPda !== EXPECTED_VAULT) throw new Error("vault PDA mismatch");
  if (proof.resolution !== "YES_WON") throw new Error("expected YES_WON resolution");
  if (proof.winnerSide !== "YES") throw new Error("expected YES winner");
  if (proof.winnerOrderStatus !== "Settled") throw new Error("winning order was not settled");
  if (proof.loserOrderStatus !== "Filled") throw new Error("losing order should remain filled (forfeited)");
  if (proof.txSignatures.length !== TX_LABELS.length) throw new Error(`expected ${TX_LABELS.length} transactions`);
  const total = proof.yesPoolLamports + proof.noPoolLamports;
  if (proof.totalPoolLamports !== total) throw new Error("total pool mismatch");
  const expectedPayout = proof.winningPoolLamports > 0 ? Math.floor((proof.winnerStakeLamports * total) / proof.winningPoolLamports) : 0;
  if (proof.winnerPayoutLamports !== expectedPayout) throw new Error(`payout mismatch: got ${proof.winnerPayoutLamports}, expected ${expectedPayout}`);
}

async function main() {
  const response = JSON.parse(await readFile(RESPONSE_PATH, "utf8")) as SettlementResponse;
  if (!response.ok || !response.proof) throw new Error(`settlement response not ok: ${response.reason ?? "unknown"}`);
  const proof = response.proof;
  assertProof(proof);
  const txs = await transactions(proof);

  const record = {
    version: 1,
    network: "devnet" as const,
    programId: EXPECTED_PROGRAM,
    operator: EXPECTED_OPERATOR,
    fixtureId: "18209181",
    recordedAt: txs.at(-1)!.blockTime,
    resolution: proof.resolution,
    resolutionEventHash: proof.resolutionEventHash,
    marketPda: proof.marketPda,
    marketConfigPda: proof.marketConfigPda,
    vaultPda: proof.vaultPda,
    yesOrderPda: proof.yesOrderPda,
    noOrderPda: proof.noOrderPda,
    winnerOrderPda: proof.winnerOrderPda,
    winnerSide: proof.winnerSide,
    winnerStakeLamports: proof.winnerStakeLamports,
    winnerPayoutLamports: proof.winnerPayoutLamports,
    yesPoolLamports: proof.yesPoolLamports,
    noPoolLamports: proof.noPoolLamports,
    totalPoolLamports: proof.totalPoolLamports,
    winningPoolLamports: proof.winningPoolLamports,
    winnerOrderStatus: proof.winnerOrderStatus,
    loserOrderStatus: proof.loserOrderStatus,
    vaultBalanceBeforeLamports: proof.vaultBalanceBeforeLamports,
    vaultBalanceAfterLamports: proof.vaultBalanceAfterLamports,
    transactions: txs,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${canonicalize(record)}\n`, { encoding: "utf8", mode: 0o644 });
  console.log(JSON.stringify({ output: OUTPUT_PATH, winnerPayoutLamports: record.winnerPayoutLamports, resolution: record.resolution, transactions: txs.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
