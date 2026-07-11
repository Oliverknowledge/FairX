import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildFreshDevnetReceipt } from "../lib/proof/onchainReceipt";
import { canonicalize } from "../lib/receipts/create";
import type { OnChainProof } from "../lib/receipts/types";
import { verifyReceipt } from "../lib/receipts/verify";

const RPC_URL = process.env.LINEGUARD_RPC_URL ?? "https://api.devnet.solana.com";
const YES_RESPONSE_PATH = resolve(process.env.LINEGUARD_YES_RESPONSE_PATH ?? "/tmp/fairx_yes_response.json");
const NO_RESPONSE_PATH = resolve(process.env.LINEGUARD_NO_RESPONSE_PATH ?? "/tmp/fairx_no_response.json");
const OUTPUT_PATH = resolve(process.env.LINEGUARD_CANONICAL_PROOF_PATH ?? "fixtures/lineguard/canonical-proof.json");
const EXPECTED_PROGRAM = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
const EXPECTED_HASH = "ebd02daad8b04845804c46ebeae892026adf4b37f2b4909952cd9fe80f4b16d5";
const EXPECTED_FIXTURE_HASH = "f90186a5dde4dbdad1486870c7b3839282d1e7132cbd7955fe86b40caf9ac7d0";
const EXPECTED_VAULT = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";

interface FlowResponse {
  proof: OnChainProof;
  demo: {
    side: "YES" | "NO";
    balanceBeforePlace: number;
    balanceAfterPlace: number;
    balanceAfterEvaluate: number;
    vaultBalanceBeforeLamports: number;
    vaultBalanceLamports: number;
    vaultDeltaLamports: number;
  };
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

async function readFlow(path: string): Promise<FlowResponse> {
  return JSON.parse(await readFile(path, "utf8")) as FlowResponse;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} failed with HTTP ${response.status}`);
  const payload = await response.json() as { result?: unknown; error?: { message?: string } };
  if (payload.error) throw new Error(`${method} failed: ${payload.error.message ?? "unknown RPC error"}`);
  return payload.result;
}

async function transactions(proof: OnChainProof): Promise<TransactionRecord[]> {
  const labels = ["Initialize market + config", "Ingest material event", "Place order into escrow", "Evaluate order"];
  const statuses = await rpc("getSignatureStatuses", [proof.txSignatures, { searchTransactionHistory: true }]) as {
    value: Array<{ confirmationStatus?: string; err: unknown } | null>;
  };
  return Promise.all(proof.txSignatures.map(async (signature, index) => {
    const status = statuses.value[index];
    if (!status || status.confirmationStatus !== "finalized" || status.err !== null) {
      throw new Error(`Transaction ${signature} is not finalized without error`);
    }
    const tx = await rpc("getTransaction", [signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 }]) as {
      slot: number;
      blockTime: number | null;
      meta: { err: unknown } | null;
    } | null;
    if (!tx || tx.meta?.err !== null || tx.blockTime === null) throw new Error(`Finalized transaction ${signature} could not be read back`);
    return {
      label: labels[index],
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      slot: tx.slot,
      blockTime: new Date(tx.blockTime * 1000).toISOString(),
      finalized: true as const,
      error: null,
    };
  }));
}

function assertFlow(flow: FlowResponse, side: "YES" | "NO") {
  const proof = flow.proof;
  if (flow.demo.side !== side) throw new Error(`${side} response side mismatch`);
  if (proof.programId !== EXPECTED_PROGRAM || proof.cluster !== "devnet") throw new Error(`${side} program/network mismatch`);
  if (proof.sourceEventHash !== EXPECTED_HASH || proof.orderSourceEventHash !== EXPECTED_HASH) throw new Error(`${side} source-event hash mismatch`);
  if (proof.fixtureIdHash !== EXPECTED_FIXTURE_HASH) throw new Error(`${side} fixture commitment mismatch`);
  if (proof.materialSeq !== 739 || proof.pricedAtSeq !== 738) throw new Error(`${side} sequence mismatch`);
  if (proof.vaultPda !== EXPECTED_VAULT || proof.txSignatures.length !== 4) throw new Error(`${side} vault or transaction-count mismatch`);
  if (side === "YES" && (proof.edgeMicros !== 342_310 || proof.verdictCode !== 2 || proof.statusCode !== 4 || flow.demo.vaultDeltaLamports !== 0)) {
    throw new Error("YES result differs from the approved outcome");
  }
  if (side === "NO" && (proof.edgeMicros !== -342_310 || proof.verdictCode !== 1 || proof.statusCode !== 3 || flow.demo.vaultDeltaLamports !== 20_000_000)) {
    throw new Error("NO result differs from the approved outcome");
  }
}

async function main() {
  const yes = await readFlow(YES_RESPONSE_PATH);
  const no = await readFlow(NO_RESPONSE_PATH);
  assertFlow(yes, "YES");
  assertFlow(no, "NO");

  const [yesTxs, noTxs] = await Promise.all([transactions(yes.proof), transactions(no.proof)]);
  const yesReceipt = buildFreshDevnetReceipt("YES", yes.proof, Date.parse(yesTxs.at(-1)!.blockTime));
  const noReceipt = buildFreshDevnetReceipt("NO", no.proof, Date.parse(noTxs.at(-1)!.blockTime));
  const verifiedAt = Date.now();
  const yesVerification = verifyReceipt(yesReceipt, verifiedAt);
  const noVerification = verifyReceipt(noReceipt, verifiedAt);
  if (!yesVerification.valid || !noVerification.valid) {
    throw new Error(`Receipt verification failed: ${[...yesVerification.errors, ...noVerification.errors].join("; ")}`);
  }

  const record = {
    version: 1,
    network: "devnet",
    programId: EXPECTED_PROGRAM,
    operator: "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq",
    fixtureId: "18209181",
    txlineSeq: 739,
    sourceEventHash: EXPECTED_HASH,
    protocolVaultPda: EXPECTED_VAULT,
    vaultBalanceBeforeLamports: no.demo.vaultBalanceBeforeLamports,
    vaultBalanceAfterLamports: no.demo.vaultBalanceLamports,
    vaultDeltaLamports: no.demo.vaultDeltaLamports,
    flows: {
      yes: { proof: yes.proof, transactions: yesTxs, balances: yes.demo, receipt: yesReceipt, verification: yesVerification },
      no: { proof: no.proof, transactions: noTxs, balances: no.demo, receipt: noReceipt, verification: noVerification },
    },
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${canonicalize(record)}\n`, { encoding: "utf8", mode: 0o644 });
  console.log(JSON.stringify({
    output: OUTPUT_PATH,
    yesReceiptHash: yesReceipt.receiptHash,
    noReceiptHash: noReceipt.receiptHash,
    yesVerified: yesVerification.valid,
    noVerified: noVerification.valid,
    vaultDeltaLamports: record.vaultDeltaLamports,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
