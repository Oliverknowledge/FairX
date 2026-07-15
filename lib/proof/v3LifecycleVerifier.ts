import { createHash } from "node:crypto";
import { Connection, PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import { hashRawEvent } from "@/lib/proof/eventHash";
import { recomputeBorshPayloadHash } from "@/lib/proof/v2Lifecycle";
import { parseMarketV2, parseMarketVault } from "@/lib/solana/lineguardV2";

export type VerificationStatus = "VERIFIED" | "FAILED" | "UNKNOWN";

export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationStatus;
  detail: string;
  evidence?: string;
}

export interface V3LifecycleVerification {
  status: VerificationStatus;
  checkedAt: string;
  rpcUrl: string;
  checks: VerificationCheck[];
  summary: { verified: number; failed: number; unknown: number };
}

type RecordShape = {
  version: number;
  truth: { classification: string; network: string; evidenceMode: string };
  program: { programId: string; programDataAddress: string; programDataAccountSha256: string; deploymentSlot: number; upgradeAuthority: string | null };
  market: { marketPda: string; marketVaultPda: string; resolution: string; displayedPriceMicrosBeforeEvent: number; displayedPriceMicrosAfterReprice: number; yesShares: string; noShares: string; settlementMinTimestampMs: string };
  txline: { programId: string; rootPda: string; fixtureId: string; sequence: number; captureHash: string; borshPayloadHash: string; proofTimestampMs: string; maxUpdateTimestampMs: string; directCpiVerified: boolean; homeScore: number; awayScore: number };
  authorities: { threshold: number; approvalMask: number; proposalExecuted: boolean };
  wallets: Record<"A" | "B" | "C", { address: string; role: string; stakeLamports: number; payoutLamports?: number; refundLamports?: number; balanceBeforeLamports: number; balanceAfterLamports: number; netAfterFundingLamports: number }>;
  accounts: Record<string, string>;
  closure: Record<string, boolean>;
  vault: { totalDepositedLamports: number; totalRefundedLamports: number; totalAcceptedLamports: number; totalPaidLamports: number; totalClaimableLamports: number; roundingDustLamports: number };
  transactions: Record<string, { signature: string; explorerUrl: string; slot: number; blockTime: string | null; finalized: boolean }>;
};

const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const explorerTx = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

function status(checks: VerificationCheck[]): VerificationStatus {
  if (checks.some((check) => check.status === "FAILED")) return "FAILED";
  if (checks.some((check) => check.status === "UNKNOWN")) return "UNKNOWN";
  return "VERIFIED";
}

function keysFor(transaction: VersionedTransactionResponse): string[] {
  const message = transaction.transaction.message as any;
  const base: PublicKey[] = message.staticAccountKeys ?? message.accountKeys ?? [];
  const loaded = transaction.meta?.loadedAddresses;
  return [...base, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])].map((key) => key.toBase58());
}

function accountDelta(transaction: VersionedTransactionResponse, address: string): number {
  const index = keysFor(transaction).indexOf(address);
  if (index < 0 || !transaction.meta) return 0;
  return transaction.meta.postBalances[index] - transaction.meta.preBalances[index];
}

function accountPostBalance(transaction: VersionedTransactionResponse, address: string): number | null {
  const index = keysFor(transaction).indexOf(address);
  if (index < 0 || !transaction.meta) return null;
  return transaction.meta.postBalances[index];
}

function rpcUnavailable(error: unknown): boolean {
  return /429|too many requests|fetch failed|network|econn|etimedout|socket|rpc unavailable/i.test(error instanceof Error ? error.message : String(error));
}

async function getFinalizedTransaction(connection: Connection, signature: string): Promise<VersionedTransactionResponse | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await connection.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
    } catch (error) {
      lastError = error;
      if (!rpcUnavailable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

function parseReceipt(raw: Buffer) {
  if (raw.length < 176) throw new Error("validation receipt is shorter than the v3 schema");
  return {
    market: new PublicKey(raw.subarray(8, 40)).toBase58(),
    fixtureId: Number(raw.readBigUInt64LE(40)),
    sequence: Number(raw.readBigUInt64LE(48)),
    rootPda: new PublicKey(raw.subarray(56, 88)).toBase58(),
    payloadHash: raw.subarray(88, 120).toString("hex"),
    homeScore: raw.readUInt16LE(152),
    awayScore: raw.readUInt16LE(154),
    outcome: raw[156],
    directCpiVerified: raw[157] === 1,
    proofTimestampMs: Number(raw.readBigInt64LE(158)),
    maxUpdateTimestampMs: Number(raw.readBigInt64LE(166)),
    evidenceMode: raw[174],
  };
}

function parseProposal(raw: Buffer) {
  if (raw.length < 116) throw new Error("resolution proposal is shorter than the v3 schema");
  return {
    market: new PublicKey(raw.subarray(8, 40)).toBase58(),
    payloadHash: raw.subarray(72, 104).toString("hex"),
    outcome: raw[104],
    approvalMask: raw[105],
    executed: raw[106] === 1,
  };
}

export async function verifyV3Lifecycle(record: unknown, rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com"): Promise<V3LifecycleVerification> {
  const checks: VerificationCheck[] = [];
  const checkedAt = new Date().toISOString();
  if (!record || typeof record !== "object" || (record as any).version !== 3) {
    checks.push({ id: "record", label: "Lifecycle record", status: "UNKNOWN", detail: "No v3 lifecycle record exists yet. Nothing is inferred from the older v2 fixture." });
    return { status: "UNKNOWN", checkedAt, rpcUrl, checks, summary: { verified: 0, failed: 0, unknown: 1 } };
  }
  const proof = record as RecordShape;
  const add = (id: string, label: string, valid: boolean, detail: string, evidence?: string) => checks.push({ id, label, status: valid ? "VERIFIED" : "FAILED", detail, evidence });
  add("truth", "Product-truth classification", proof.truth.classification === "REAL" && proof.truth.network === "devnet" && proof.truth.evidenceMode === "HISTORICAL_REENACTMENT", "Execution is real devnet; match evidence is explicitly historical, not live.");
  add("capture-hash", "TxLINE capture hash", proof.txline.captureHash === hashRawEvent(canonicalCapture.rawPayload) && proof.txline.captureHash === canonicalCapture.rawPayloadHash, "Recomputed from canonical JSON.");
  add("borsh-hash", "TxLINE CPI payload hash", proof.txline.borshPayloadHash === recomputeBorshPayloadHash(), "Recomputed from the exact Borsh payload domain.");
  add("economic-record", "Recorded three-wallet accounting", proof.wallets.A.payoutLamports === 20_000_000 && proof.wallets.B.payoutLamports === 0 && proof.wallets.C.refundLamports === 10_000_000 && proof.vault.totalDepositedLamports === 30_000_000 && proof.vault.totalAcceptedLamports === 20_000_000 && proof.vault.totalRefundedLamports === 10_000_000 && proof.vault.totalPaidLamports === 20_000_000 && proof.vault.totalClaimableLamports === 0 && proof.vault.roundingDustLamports === 0, "A receives A+B accepted collateral; C alone is refunded; no claimable collateral or dust remains.");

  let connection: Connection;
  try {
    connection = new Connection(rpcUrl, "confirmed");
    await connection.getSlot("confirmed");
  } catch (error) {
    checks.push({ id: "rpc", label: "Solana RPC", status: "UNKNOWN", detail: `RPC unavailable: ${error instanceof Error ? error.message : String(error)}` });
    const summary = { verified: checks.filter((item) => item.status === "VERIFIED").length, failed: checks.filter((item) => item.status === "FAILED").length, unknown: checks.filter((item) => item.status === "UNKNOWN").length };
    return { status: status(checks), checkedAt, rpcUrl, checks, summary };
  }

  try {
    const programId = new PublicKey(proof.program.programId);
    const programDataAddress = new PublicKey(proof.program.programDataAddress);
    const [program, programData] = await connection.getMultipleAccountsInfo([programId, programDataAddress], "finalized");
    add("program", "Executable LineGuard program", Boolean(program?.executable && program.owner.equals(UPGRADEABLE_LOADER) && program.data.length >= 36 && new PublicKey(program.data.subarray(4, 36)).equals(programDataAddress) && programData?.owner.equals(UPGRADEABLE_LOADER)), "Program points to the recorded ProgramData account and both are owned by Solana's upgradeable loader.", `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`);
    add("program-data", "Deployed program-data hash", Boolean(programData && createHash("sha256").update(programData.data).digest("hex") === proof.program.programDataAccountSha256 && Number(programData.data.readBigUInt64LE(4)) === proof.program.deploymentSlot), "Hash and deployment slot were recomputed from the current ProgramData account.", `https://explorer.solana.com/address/${programDataAddress.toBase58()}?cluster=devnet`);

    const marketAddress = new PublicKey(proof.market.marketPda);
    const vaultAddress = new PublicKey(proof.market.marketVaultPda);
    const receiptAddress = new PublicKey(proof.accounts.validationReceipt);
    const proposalAddress = new PublicKey(proof.accounts.resolutionProposal);
    const [marketInfo, vaultInfo, receiptInfo, proposalInfo, ...closed] = await connection.getMultipleAccountsInfo([
      marketAddress,
      vaultAddress,
      receiptAddress,
      proposalAddress,
      new PublicKey(proof.accounts.orderA),
      new PublicKey(proof.accounts.orderB),
      new PublicKey(proof.accounts.orderC),
      new PublicKey(proof.accounts.positionA),
      new PublicKey(proof.accounts.positionB),
      new PublicKey(proof.accounts.positionC),
    ], "finalized");
    if (!marketInfo || !vaultInfo || !receiptInfo || !proposalInfo) throw new Error("One or more durable proof accounts are missing.");
    const [txlineProgram, txlineRoot] = await connection.getMultipleAccountsInfo([new PublicKey(proof.txline.programId), new PublicKey(proof.txline.rootPda)], "finalized");
    add("txline-identity", "Genuine TxLINE program and root", Boolean(txlineProgram?.executable && txlineRoot?.owner.equals(new PublicKey(proof.txline.programId))), "The fixed TxLINE program is executable and owns the recorded daily-scores root.", `https://explorer.solana.com/address/${proof.txline.rootPda}?cluster=devnet`);
    add("ownership", "Program account ownership", [marketInfo, vaultInfo, receiptInfo, proposalInfo].every((info) => info.owner.equals(programId)), "Market, vault, validation receipt, and proposal are owned by LineGuard.");
    const market = parseMarketV2(marketAddress, Buffer.from(marketInfo.data));
    const vault = parseMarketVault(vaultAddress, vaultInfo.lamports, Buffer.from(vaultInfo.data));
    const receipt = parseReceipt(Buffer.from(receiptInfo.data));
    const proposal = parseProposal(Buffer.from(proposalInfo.data));
    add("market", "Resolved market state", market.resolved && market.tradingClosed && market.resolution === 1 && market.evidenceMode === "HISTORICAL" && market.displayedPriceMicros === proof.market.displayedPriceMicrosAfterReprice && market.yesShares.toString() === proof.market.yesShares && market.noShares.toString() === proof.market.noShares, "Market resolved YES with the committed historical-evidence mode and recorded price-weighted shares.");
    add("vault", "Vault conservation", vault.market === market.address && vault.totalDeposited === vault.totalRefunded + vault.totalPaid + vault.totalClaimable + vault.roundingDust && vault.totalAccepted === proof.vault.totalAcceptedLamports && vault.totalClaimable === 0 && vault.roundingDust === 0, "Recomputed from current on-chain MarketVault fields.", `https://explorer.solana.com/address/${vault.address}?cluster=devnet`);
    add("txline-receipt", "TxLINE CPI receipt", receipt.market === market.address && receipt.fixtureId.toString() === proof.txline.fixtureId && receipt.rootPda === proof.txline.rootPda && receipt.payloadHash === proof.txline.borshPayloadHash && receipt.sequence === proof.txline.sequence && receipt.homeScore === 1 && receipt.awayScore === 0 && receipt.outcome === 1 && receipt.directCpiVerified && receipt.evidenceMode === 1 && receipt.proofTimestampMs >= (market.settlementMinTimestampMs ?? Number.MAX_SAFE_INTEGER) && receipt.maxUpdateTimestampMs >= receipt.proofTimestampMs, "Receipt independently binds fixture, root, Borsh payload, score, outcome, timestamp, and evidence mode.", `https://explorer.solana.com/address/${receiptAddress.toBase58()}?cluster=devnet`);
    const approvalCount = proposal.approvalMask.toString(2).split("").filter((bit) => bit === "1").length;
    add("resolution", "Threshold resolution", proposal.market === market.address && proposal.payloadHash === receipt.payloadHash && proposal.outcome === 1 && proposal.executed && proposal.approvalMask === proof.authorities.approvalMask && approvalCount >= proof.authorities.threshold, "The proposal matches the receipt and has at least two distinct authority approvals.", `https://explorer.solana.com/address/${proposalAddress.toBase58()}?cluster=devnet`);
    add("closures", "Order and position rent recovery", closed.every((info) => info === null) && Object.values(proof.closure).every(Boolean), "All three ephemeral orders and all three user positions are closed; their rent has returned to the respective wallets.");

    const expectedLabels = [
      "fundWallets",
      "initialize",
      "walletAHonestYes",
      "walletBHonestNo",
      "materialEventAndOdds",
      "walletCStaleExploitRefund",
      "reprice",
      "close",
      "txlineCpiProof",
      "secondApproval",
      "resolution",
      "walletAClaim",
      "walletBCloseLoss",
      "walletCCloseRefunded",
    ];
    const entries = Object.entries(proof.transactions);
    const labels = entries.map(([label]) => label);
    const signatures = entries.map(([, transaction]) => transaction.signature);
    add(
      "transaction-manifest",
      "Exact lifecycle transaction manifest",
      expectedLabels.length === labels.length
        && expectedLabels.every((label) => labels.includes(label))
        && new Set(signatures).size === signatures.length
        && entries.every(([, transaction]) => transaction.finalized),
      "The record contains exactly the 14 required, uniquely signed, finalized lifecycle steps.",
    );
    const fetched: Array<VersionedTransactionResponse | null> = [];
    const transactionPaceMs = Math.max(0, Number(process.env.V3_RPC_TX_PACE_MS ?? 400));
    for (const [, transaction] of entries) {
      fetched.push(await getFinalizedTransaction(connection, transaction.signature));
      if (transactionPaceMs > 0) await new Promise((resolve) => setTimeout(resolve, transactionPaceMs));
    }
    const missing = fetched.filter((tx) => tx === null).length;
    if (missing) {
      checks.push({ id: "transactions", label: "Finalized lifecycle transactions", status: "UNKNOWN", detail: `${missing} recorded transaction(s) were unavailable from this RPC; absence is not treated as verification.` });
    } else {
      const complete = fetched as VersionedTransactionResponse[];
      const walletForStep: Record<string, string[]> = {
        fundWallets: [proof.wallets.A.address, proof.wallets.B.address, proof.wallets.C.address],
        walletAHonestYes: [proof.wallets.A.address],
        walletBHonestNo: [proof.wallets.B.address],
        walletCStaleExploitRefund: [proof.wallets.C.address],
        walletAClaim: [proof.wallets.A.address],
        walletBCloseLoss: [proof.wallets.B.address],
        walletCCloseRefunded: [proof.wallets.C.address],
      };
      add("transactions", "Finalized lifecycle transactions", complete.every((tx, index) => {
        const [label, recorded] = entries[index];
        const keys = keysFor(tx);
        return tx.meta?.err === null
          && tx.slot === recorded.slot
          && tx.transaction.signatures[0] === recorded.signature
          && recorded.explorerUrl === explorerTx(recorded.signature)
          && (walletForStep[label] ?? []).every((wallet) => keys.includes(wallet))
          && (label === "fundWallets" || (keys.includes(proof.program.programId) && keys.includes(proof.market.marketPda)));
      }), `Fetched ${complete.length} finalized successful transactions and checked signatures, slots, explorer links, wallets, market, and LineGuard keys.`);
      const walletDeltas = { A: 0, B: 0, C: 0 };
      for (const tx of complete) {
        walletDeltas.A += accountDelta(tx, proof.wallets.A.address);
        walletDeltas.B += accountDelta(tx, proof.wallets.B.address);
        walletDeltas.C += accountDelta(tx, proof.wallets.C.address);
      }
      add("balance-deltas", "Wallet balance changes", (Object.keys(walletDeltas) as Array<keyof typeof walletDeltas>).every((key) => walletDeltas[key] === proof.wallets[key].balanceAfterLamports - proof.wallets[key].balanceBeforeLamports), `Transaction metadata recomputes A ${walletDeltas.A}, B ${walletDeltas.B}, C ${walletDeltas.C} lamports.`);
      const fundingIndex = entries.findIndex(([label]) => label === "fundWallets");
      const funding = fundingIndex >= 0 ? complete[fundingIndex] : null;
      const fundingDeltas = funding ? {
        A: accountDelta(funding, proof.wallets.A.address),
        B: accountDelta(funding, proof.wallets.B.address),
        C: accountDelta(funding, proof.wallets.C.address),
      } : null;
      const lifecycleDeltas = fundingDeltas ? {
        A: walletDeltas.A - fundingDeltas.A,
        B: walletDeltas.B - fundingDeltas.B,
        C: walletDeltas.C - fundingDeltas.C,
      } : null;
      add(
        "economic-wallet-deltas",
        "Counterparty payout and isolated refund",
        Boolean(
          fundingDeltas
          && lifecycleDeltas
          && fundingDeltas.A === 50_000_000
          && fundingDeltas.B === 50_000_000
          && fundingDeltas.C === 50_000_000
          && lifecycleDeltas.A === 10_000_000
          && lifecycleDeltas.B === -10_000_000
          && lifecycleDeltas.C === 0
          && proof.wallets.A.netAfterFundingLamports === 10_000_000
          && proof.wallets.B.netAfterFundingLamports === -10_000_000
          && proof.wallets.C.netAfterFundingLamports === 0
        ),
        lifecycleDeltas
          ? `Excluding equal setup funding: A ${lifecycleDeltas.A}, B ${lifecycleDeltas.B}, C ${lifecycleDeltas.C} lamports. Operator pays transaction fees; all user-account rent must net to zero.`
          : "The dedicated-wallet funding transaction was missing.",
      );
      const recordedFinalBalances = (Object.keys(walletDeltas) as Array<keyof typeof walletDeltas>).map((key) => {
        const address = proof.wallets[key].address;
        for (let index = complete.length - 1; index >= 0; index -= 1) {
          const balance = accountPostBalance(complete[index], address);
          if (balance !== null) return [key, balance] as const;
        }
        return [key, null] as const;
      });
      add(
        "final-balances",
        "Recorded lifecycle final balances",
        recordedFinalBalances.every(([key, balance]) => balance === proof.wallets[key].balanceAfterLamports),
        "Each wallet's post-balance in its final recorded V3 transaction matches the lifecycle record; later wallet reuse cannot invalidate historical evidence.",
      );
    }
  } catch (error) {
    checks.push({ id: "onchain", label: "On-chain proof accounts", status: rpcUnavailable(error) ? "UNKNOWN" : "FAILED", detail: error instanceof Error ? error.message : String(error) });
  }
  const summary = { verified: checks.filter((item) => item.status === "VERIFIED").length, failed: checks.filter((item) => item.status === "FAILED").length, unknown: checks.filter((item) => item.status === "UNKNOWN").length };
  return { status: status(checks), checkedAt, rpcUrl, checks, summary };
}

export function transactionExplorer(signature: string): string {
  return explorerTx(signature);
}
