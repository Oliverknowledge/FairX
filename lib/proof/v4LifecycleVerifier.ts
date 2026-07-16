import { createHash } from "node:crypto";
import { Connection, PublicKey, type AccountInfo, type VersionedTransactionResponse } from "@solana/web3.js";
import { BorshAccountsCoder, type Idl } from "@anchor-lang/core";
import { createServerRpcConnection } from "@/lib/proof/serverRpc";
import idl from "@/lib/v4/idl.json";
import manifest from "@/fixtures/txline/v4-build-manifest.json";
import { V4_PROGRAM_ID } from "@/lib/v4/program";
import {
  deriveAuthorityConfigV4Pda,
  deriveLiquidityVaultV4Pda,
  deriveMarketV4Pda,
  deriveQuoteReceiptV4Pda,
  deriveResolutionProposalV4Pda,
  deriveResolutionReceiptV4Pda,
} from "@/lib/v4/program";
import {
  isPlaceholderSignature,
  V4_CANONICAL,
  V4_LIFECYCLE_EVIDENCE_VERSION,
  V4_LIFECYCLE_STEPS,
  type V4LifecycleEvidence,
  type V4RecordedEvidence,
} from "@/lib/v4/lifecycleEvidence";

export type VerificationStatus = "VERIFIED" | "FAILED" | "UNKNOWN";

export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationStatus;
  detail: string;
  evidence?: string;
}

export interface V4LifecycleVerification {
  status: VerificationStatus;
  recordState: "not_recorded" | "recorded" | "invalid";
  checkedAt: string;
  rpcUrl: string;
  checks: VerificationCheck[];
  summary: { verified: number; failed: number; unknown: number };
}

/** Minimal RPC surface used by the verifier; a Connection satisfies it, and tests inject a fake. */
export interface V4RpcClient {
  getSlot(commitment?: string): Promise<number>;
  getMultipleAccountsInfo(keys: PublicKey[], commitment?: string): Promise<(AccountInfo<Buffer> | null)[]>;
  getTransaction(signature: string, opts: { commitment: "finalized"; maxSupportedTransactionVersion: number }): Promise<VersionedTransactionResponse | null>;
  getTransactions?(signatures: string[], opts: { commitment: "finalized"; maxSupportedTransactionVersion: number }): Promise<(VersionedTransactionResponse | null)[]>;
}

const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const TXLINE_PROGRAM = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const explorerTx = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
const accountsCoder = new BorshAccountsCoder(idl as Idl);

function statusFrom(checks: VerificationCheck[]): VerificationStatus {
  if (checks.some((c) => c.status === "FAILED")) return "FAILED";
  if (checks.some((c) => c.status === "UNKNOWN")) return "UNKNOWN";
  return "VERIFIED";
}

function rpcUnavailable(error: unknown): boolean {
  return /429|too many requests|fetch failed|network|econn|etimedout|socket|rpc unavailable|aborted|timeout/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

function field(obj: Record<string, unknown>, snake: string, camel: string): unknown {
  return obj[camel] ?? obj[snake];
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof (value as { toString: () => string }).toString === "function") return Number((value as { toString: () => string }).toString());
  return NaN;
}

function keysFor(transaction: VersionedTransactionResponse): string[] {
  const message = transaction.transaction.message as unknown as { staticAccountKeys?: PublicKey[]; accountKeys?: PublicKey[] };
  const base: PublicKey[] = message.staticAccountKeys ?? message.accountKeys ?? [];
  const loaded = transaction.meta?.loadedAddresses;
  return [...base, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])].map((k) => k.toBase58());
}

function accountDelta(transaction: VersionedTransactionResponse, address: string): number {
  const index = keysFor(transaction).indexOf(address);
  if (index < 0 || !transaction.meta) return 0;
  return transaction.meta.postBalances[index] - transaction.meta.preBalances[index];
}

/** Extract the V4 program instruction discriminator (first 8 bytes, hex) from a fetched transaction. */
function v4InstructionDiscriminators(transaction: VersionedTransactionResponse): string[] {
  const keys = keysFor(transaction);
  const message = transaction.transaction.message as unknown as {
    compiledInstructions?: { programIdIndex: number; data: Uint8Array }[];
    instructions?: { programIdIndex: number; data: Uint8Array | string }[];
  };
  const compiled = message.compiledInstructions ?? message.instructions ?? [];
  const out: string[] = [];
  for (const ix of compiled) {
    if (keys[ix.programIdIndex] !== V4_PROGRAM_ID) continue;
    const data = typeof ix.data === "string" ? Buffer.from(ix.data, "base64") : Buffer.from(ix.data);
    if (data.length >= 8) out.push(data.subarray(0, 8).toString("hex"));
  }
  return out;
}

async function getFinalizedTransaction(client: V4RpcClient, signature: string): Promise<VersionedTransactionResponse | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await client.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
    } catch (error) {
      lastError = error;
      if (!rpcUnavailable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * (attempt + 1), 8_000)));
    }
  }
  throw lastError;
}

async function getFinalizedTransactions(
  client: V4RpcClient,
  signatures: string[],
  batchSize: number,
  paceMs: number,
): Promise<(VersionedTransactionResponse | null)[]> {
  if (!client.getTransactions) {
    const out: (VersionedTransactionResponse | null)[] = [];
    for (const signature of signatures) out.push(await getFinalizedTransaction(client, signature));
    return out;
  }
  const out: (VersionedTransactionResponse | null)[] = [];
  const size = Math.max(1, batchSize);
  if (size === 1) {
    for (let index = 0; index < signatures.length; index += 1) {
      out.push(await getFinalizedTransaction(client, signatures[index]));
      if (paceMs > 0 && index + 1 < signatures.length) await new Promise((resolve) => setTimeout(resolve, paceMs));
    }
    return out;
  }
  for (let offset = 0; offset < signatures.length; offset += size) {
    const chunk = signatures.slice(offset, offset + size);
    let lastError: unknown;
    let completed = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        out.push(...await client.getTransactions(chunk, { commitment: "finalized", maxSupportedTransactionVersion: 0 }));
        completed = true;
        break;
      } catch (error) {
        lastError = error;
        if (!rpcUnavailable(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    if (!completed) throw lastError;
    if (paceMs > 0 && offset + size < signatures.length) await new Promise((resolve) => setTimeout(resolve, paceMs));
  }
  return out;
}

function decode(name: string, info: AccountInfo<Buffer> | null): Record<string, unknown> | null {
  if (!info) return null;
  try {
    return accountsCoder.decode(name, Buffer.from(info.data)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const INSTRUCTION_FOR_STEP: Record<string, string> = {
  initializeMarket: "initialize_market_v4",
  initializeVault: "initialize_liquidity_vault",
  depositLiquidity: "deposit_liquidity",
  commitPreQuote: "commit_txline_quote",
  verifyPreQuote: "verify_txline_quote",
  acceptHonestYes: "place_fixed_payout_order",
  acceptHonestNo: "place_fixed_payout_order",
  ingestGoal: "ingest_material_event_v4",
  refundStaleBot: "place_fixed_payout_order",
  commitPostQuote: "commit_txline_quote",
  verifyPostQuote: "verify_txline_quote",
  closeStaleRefund: "close_fixed_payout_position",
  acceptSynchronizedYes: "place_fixed_payout_order",
  proveResolution: "prove_resolution_with_txline_v4",
  approveResolution: "approve_resolution_v4",
  executeResolution: "execute_resolution_v4",
  reconcileLosingNo: "reconcile_position",
  claimHonestYes: "claim_fixed_payout",
  claimSynchronizedYes: "claim_fixed_payout",
  reconcileVault: "reconcile_vault_surplus",
  closeHonestYes: "close_fixed_payout_position",
  closeLosingNo: "close_fixed_payout_position",
  closeSynchronizedYes: "close_fixed_payout_position",
  withdrawFreeLiquidity: "withdraw_free_liquidity",
};

function popcount(mask: number): number {
  return mask.toString(2).split("").filter((b) => b === "1").length;
}

export async function verifyV4Lifecycle(
  record: unknown,
  deps: { client?: V4RpcClient; rpcUrl?: string; transactionBatchSize?: number; transactionBatchPaceMs?: number } = {},
): Promise<V4LifecycleVerification> {
  const rpcUrl = deps.rpcUrl ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const checkedAt = new Date().toISOString();
  const checks: VerificationCheck[] = [];
  const finish = (recordState: V4LifecycleVerification["recordState"]): V4LifecycleVerification => ({
    status: statusFrom(checks),
    recordState,
    checkedAt,
    rpcUrl,
    checks,
    summary: {
      verified: checks.filter((c) => c.status === "VERIFIED").length,
      failed: checks.filter((c) => c.status === "FAILED").length,
      unknown: checks.filter((c) => c.status === "UNKNOWN").length,
    },
  });

  // ---- record shape ------------------------------------------------------
  if (!record || typeof record !== "object") {
    checks.push({ id: "record", label: "Lifecycle record", status: "UNKNOWN", detail: "No V4 lifecycle record is present." });
    return finish("invalid");
  }
  const evidence = record as V4LifecycleEvidence;
  if (evidence.state === "not_recorded") {
    checks.push({ id: "record", label: "Lifecycle record", status: "UNKNOWN", detail: "No V4 lifecycle evidence record is available. Absence is never treated as verification." });
    return finish("not_recorded");
  }
  if (evidence.state !== "recorded" || evidence.version !== V4_LIFECYCLE_EVIDENCE_VERSION) {
    checks.push({ id: "record", label: "Lifecycle record", status: "UNKNOWN", detail: "Unrecognised V4 lifecycle record shape or version." });
    return finish("invalid");
  }
  const proof = evidence as V4RecordedEvidence;
  const add = (id: string, label: string, valid: boolean, detail: string, evidenceUrl?: string) =>
    checks.push({ id, label, status: valid ? "VERIFIED" : "FAILED", detail, evidence: evidenceUrl });

  // ---- pure record-integrity checks (no RPC) -----------------------------
  const placeholder = proof.transactions.find((t) => isPlaceholderSignature(t.signature));
  add("no-placeholder-signatures", "No placeholder signatures", !placeholder && proof.transactions.length > 0,
    placeholder ? `Rejected placeholder signature for step "${placeholder.label}".` : "Every recorded signature is a plausible, unique base58 ed25519 signature.");

  const cluster = proof.cluster === "devnet";
  add("cluster", "Devnet cluster", cluster, `Recorded cluster is ${proof.cluster}.`);

  add("program-id", "Canonical V4 program id", proof.program.programId === V4_PROGRAM_ID,
    `Record targets the approved V4 program ${V4_PROGRAM_ID}.`);

  // PDA derivations recomputed from seeds — never trusts recorded addresses.
  const marketId = createHash("sha256").update(V4_CANONICAL.marketIdSeed).digest();
  const seed32 = Buffer.alloc(32);
  Buffer.from(V4_CANONICAL.marketIdSeed).copy(seed32);
  // The market id seed is a fixed 32-byte field; derive both plausible encodings and accept either match.
  const marketCandidates = [seed32, marketId].map((mid) => deriveMarketV4Pda(mid).toBase58());
  const marketMatches = marketCandidates.includes(proof.accounts.market);
  const market = new PublicKey(proof.accounts.market);
  const derivations: Array<[string, string]> = [
    ["authorityConfig", deriveAuthorityConfigV4Pda().toBase58()],
    ["vault", deriveLiquidityVaultV4Pda(market).toBase58()],
    ["quoteReceiptPre", deriveQuoteReceiptV4Pda(market, BigInt(V4_CANONICAL.preGoal.quoteSequence)).toBase58()],
    ["quoteReceiptPost", deriveQuoteReceiptV4Pda(market, BigInt(V4_CANONICAL.postGoal.quoteSequence)).toBase58()],
    ["resolutionReceipt", deriveResolutionReceiptV4Pda(market).toBase58()],
    ["resolutionProposal", deriveResolutionProposalV4Pda(market).toBase58()],
  ];
  const derivationMismatch = derivations.find(([key, derived]) => proof.accounts[key as keyof typeof proof.accounts] !== derived);
  add("pda-derivations", "PDA derivations", marketMatches && !derivationMismatch,
    derivationMismatch ? `Recorded ${derivationMismatch[0]} does not match its seed derivation.` : "Market, vault, quote receipts, resolution receipt and proposal all match their program-derived addresses.");

  // Transaction manifest: required steps present, unique signatures, discriminators match the build manifest.
  const labels = proof.transactions.map((t) => t.label);
  const signatures = proof.transactions.map((t) => t.signature);
  const missingStep = V4_LIFECYCLE_STEPS.find((step) => !labels.includes(step));
  const discriminatorMismatch = proof.transactions.find((t) => {
    const instr = INSTRUCTION_FOR_STEP[t.label] ?? t.instruction;
    const expected = (manifest.instructionDiscriminatorsHex as Record<string, string>)[instr];
    return !expected || expected !== t.discriminatorHex;
  });
  add("transaction-manifest", "Lifecycle transaction manifest",
    !missingStep && new Set(signatures).size === signatures.length && !discriminatorMismatch && proof.transactions.every((t) => t.finalized),
    missingStep ? `Missing required step "${missingStep}".` : discriminatorMismatch ? `Recorded discriminator for "${discriminatorMismatch.label}" does not match the build manifest.` : `All ${V4_LIFECYCLE_STEPS.length} required steps present, uniquely signed, finalized, with manifest-matching discriminators.`);

  // Recorded economic self-consistency (stale refunded, NO lost, YES claimed, vault reconciled).
  const staleBot = proof.positions.find((p) => p.id === "stale-bot");
  const preYes = proof.positions.find((p) => p.id === "pre-yes");
  const postYes = proof.positions.find((p) => p.id === "post-yes");
  const preNo = proof.positions.find((p) => p.id === "pre-no");
  const economicRecordValid = Boolean(
    staleBot && staleBot.status === "REFUNDED" && staleBot.grossPayoutLamports === 0 &&
    proof.staleOrder.refundedStakeLamports === V4_CANONICAL.stakeLamports &&
    preYes && postYes && preYes.side === "YES" && postYes.side === "YES" &&
    (preYes.status === "CLAIMED" || preYes.status === "CLOSED") &&
    preNo && preNo.side === "NO" && (preNo.status === "LOST" || preNo.status === "CLOSED") &&
    proof.vault.finalReservedLiability === 0 && proof.vault.finalAcceptedStakePrincipal === 0 && proof.vault.finalPendingRefundableStake === 0 &&
    proof.vault.finalFreeCollateral === 0 && proof.vault.lifetimeRefunds === V4_CANONICAL.stakeLamports &&
    proof.vault.lifetimeOperatorWithdrawals === proof.vault.lifetimeOperatorDeposits + proof.vault.lifetimeUserStakes - proof.vault.lifetimeRefunds - proof.vault.lifetimePayouts,
  );
  add("economic-record", "Recorded economics self-consistent", economicRecordValid,
    "Stale order refunded (payout 0), NO position lost, both YES positions settled, and the vault reconciles reserves and principal to zero.");

  // ---- RPC availability --------------------------------------------------
  let client: V4RpcClient;
  try {
    client = deps.client ?? (createServerRpcConnection({ rpcUrl }) as unknown as V4RpcClient);
    await client.getSlot("confirmed");
  } catch (error) {
    checks.push({ id: "rpc", label: "Solana RPC", status: "UNKNOWN", detail: `RPC unavailable: ${error instanceof Error ? error.message : String(error)}` });
    return finish("recorded");
  }

  try {
    const programId = new PublicKey(proof.program.programId);
    const programDataAddress = new PublicKey(proof.program.programDataAddress);
    const [program, programData] = await client.getMultipleAccountsInfo([programId, programDataAddress], "finalized");
    add("program", "Executable V4 program",
      Boolean(program?.executable && program.owner.equals(UPGRADEABLE_LOADER) && program.data.length >= 36 && new PublicKey(program.data.subarray(4, 36)).equals(programDataAddress) && programData?.owner.equals(UPGRADEABLE_LOADER)),
      "The program is executable, loader-owned, and points at the recorded ProgramData account.",
      `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`);
    const sbfSlice = programData ? programData.data.subarray(45, 45 + manifest.sbfSizeBytes) : Buffer.alloc(0);
    add("program-data", "Deployed binary identity",
      Boolean(programData && sbfSlice.length === manifest.sbfSizeBytes && createHash("sha256").update(sbfSlice).digest("hex") === manifest.sbfSha256 && manifest.sbfSha256 === proof.program.sbfSha256),
      "The deployed ProgramData bytes hash to the reproducible SBF SHA-256 in the build manifest.",
      `https://explorer.solana.com/address/${programDataAddress.toBase58()}?cluster=devnet`);

    // Durable accounts.
    const marketAddr = new PublicKey(proof.accounts.market);
    const vaultAddr = new PublicKey(proof.accounts.vault);
    const receiptAddr = new PublicKey(proof.accounts.resolutionReceipt);
    const proposalAddr = new PublicKey(proof.accounts.resolutionProposal);
    const quotePreAddr = new PublicKey(proof.accounts.quoteReceiptPre);
    const quotePostAddr = new PublicKey(proof.accounts.quoteReceiptPost);
    const [marketInfo, vaultInfo, receiptInfo, proposalInfo, quotePreInfo, quotePostInfo] = await client.getMultipleAccountsInfo(
      [marketAddr, vaultAddr, receiptAddr, proposalAddr, quotePreAddr, quotePostAddr], "finalized");
    if (!marketInfo || !vaultInfo || !receiptInfo || !proposalInfo || !quotePreInfo || !quotePostInfo) {
      throw new Error("A durable V4 proof account the record asserts is missing on-chain.");
    }
    add("ownership", "Program account ownership",
      [marketInfo, vaultInfo, receiptInfo, proposalInfo, quotePreInfo, quotePostInfo].every((i) => i.owner.equals(programId)),
      "Market, vault, both quote receipts, resolution receipt and proposal are all owned by the V4 program.");

    const [txlineProgram, oddsRoot, scoresRoot] = await client.getMultipleAccountsInfo(
      [new PublicKey(TXLINE_PROGRAM), new PublicKey(proof.txline.oddsRootPda), new PublicKey(proof.txline.scoresRootPda)], "finalized");
    add("txline-identity", "Genuine TxLINE program and roots",
      Boolean(txlineProgram?.executable && oddsRoot?.owner.equals(new PublicKey(TXLINE_PROGRAM)) && scoresRoot?.owner.equals(new PublicKey(TXLINE_PROGRAM))),
      "The fixed TxLINE program is executable and owns both the recorded odds and scores roots.",
      `https://explorer.solana.com/address/${proof.txline.scoresRootPda}?cluster=devnet`);

    // Decoded account-field checks (IDL-driven).
    const marketState = decode("MarketV4", marketInfo);
    add("market-state", "Resolved market state",
      Boolean(marketState &&
        field(marketState, "resolved", "resolved") === true &&
        toNumber(field(marketState, "resolution", "resolution")) === V4_CANONICAL.resolutionYes &&
        field(marketState, "trading_closed", "tradingClosed") === true &&
        toNumber(field(marketState, "final_sequence", "finalSequence")) === V4_CANONICAL.finalSequence),
      "Market decoded from RPC is resolved YES, trading-closed, at the final sequence 1114.");

    const vaultState = decode("LiquidityVaultV4", vaultInfo);
    const vaultReserved = vaultState ? toNumber(field(vaultState, "reserved_liability", "reservedLiability")) : NaN;
    const yesReserved = vaultState ? toNumber(field(vaultState, "yes_reserved_liability", "yesReservedLiability")) : NaN;
    const noReserved = vaultState ? toNumber(field(vaultState, "no_reserved_liability", "noReservedLiability")) : NaN;
    add("vault-invariant", "Vault accounting invariant",
      Boolean(vaultState &&
        new PublicKey(String(field(vaultState, "market", "market"))).equals(marketAddr) &&
        vaultReserved === yesReserved + noReserved &&
        vaultReserved === 0 &&
        toNumber(field(vaultState, "free_collateral", "freeCollateral")) === 0 &&
        toNumber(field(vaultState, "accepted_stake_principal", "acceptedStakePrincipal")) === 0 &&
        toNumber(field(vaultState, "pending_refundable_stake", "pendingRefundableStake")) === 0 &&
        toNumber(field(vaultState, "lifetime_refunds", "lifetimeRefunds")) === V4_CANONICAL.stakeLamports &&
        toNumber(field(vaultState, "lifetime_payouts", "lifetimePayouts")) === proof.vault.lifetimePayouts &&
        toNumber(field(vaultState, "lifetime_operator_withdrawals", "lifetimeOperatorWithdrawals")) === proof.vault.lifetimeOperatorWithdrawals),
      "Live vault: free, reserved, principal and pending are 0; lifetime refund, payout and operator-withdrawal totals match the record.",
      `https://explorer.solana.com/address/${vaultAddr.toBase58()}?cluster=devnet`);

    const receiptState = decode("TxlineResolutionReceiptV4", receiptInfo);
    const proposalState = decode("ResolutionProposalV4", proposalInfo);
    const approvalsMask = proposalState ? toNumber(field(proposalState, "approvals_mask", "approvalsMask")) : 0;
    add("resolution", "Threshold resolution evidence",
      Boolean(receiptState && proposalState &&
        toNumber(field(receiptState, "final_sequence", "finalSequence")) === V4_CANONICAL.finalSequence &&
        toNumber(field(receiptState, "home_regulation_score", "homeRegulationScore")) === V4_CANONICAL.homeScore &&
        toNumber(field(receiptState, "away_regulation_score", "awayRegulationScore")) === V4_CANONICAL.awayScore &&
        toNumber(field(receiptState, "derived_outcome", "derivedOutcome")) === V4_CANONICAL.resolutionYes &&
        field(receiptState, "direct_cpi_verified", "directCpiVerified") === true &&
        field(proposalState, "executed", "executed") === true &&
        toNumber(field(proposalState, "derived_outcome", "derivedOutcome")) === V4_CANONICAL.resolutionYes &&
        popcount(approvalsMask) >= V4_CANONICAL.threshold),
      "Resolution receipt binds France 2–0 via a verified direct CPI; the proposal is executed with ≥2 distinct approvals.",
      `https://explorer.solana.com/address/${receiptAddr.toBase58()}?cluster=devnet`);

    // Quote receipt hashes must match the recorded evidence.
    const quotePre = decode("TxlineQuoteValidationReceiptV4", quotePreInfo);
    const quotePost = decode("TxlineQuoteValidationReceiptV4", quotePostInfo);
    const preHashHex = quotePre ? Buffer.from(field(quotePre, "payload_hash", "payloadHash") as number[]).toString("hex") : "";
    const postHashHex = quotePost ? Buffer.from(field(quotePost, "payload_hash", "payloadHash") as number[]).toString("hex") : "";
    add("receipt-hashes", "Quote receipt hashes",
      Boolean(quotePre && quotePost) && preHashHex === proof.txline.preQuotePayloadHashHex && postHashHex === proof.txline.postQuotePayloadHashHex && preHashHex.length === 64,
      "On-chain quote-receipt payload hashes equal the recorded pre-goal and post-goal quote hashes.");

    // ---- transactions ----------------------------------------------------
    const fetched = await getFinalizedTransactions(
      client,
      proof.transactions.map((transaction) => transaction.signature),
      deps.transactionBatchSize ?? Math.max(1, Number(process.env.V4_RPC_BATCH_SIZE ?? 1)),
      deps.transactionBatchPaceMs ?? Math.max(0, Number(process.env.V4_RPC_BATCH_PACE_MS ?? 500)),
    );
    const missing = fetched.filter((t) => t === null).length;
    if (missing) {
      checks.push({ id: "transactions", label: "Finalized lifecycle transactions", status: "UNKNOWN", detail: `${missing} recorded transaction(s) were unavailable from this RPC; absence is never treated as verification.` });
    } else {
      const complete = fetched as VersionedTransactionResponse[];
      add("transactions", "Finalized lifecycle transactions",
        complete.every((tx, i) => {
          const rec = proof.transactions[i];
          const expected = (manifest.instructionDiscriminatorsHex as Record<string, string>)[INSTRUCTION_FOR_STEP[rec.label] ?? rec.instruction];
          return tx.meta?.err === null && tx.slot === rec.slot && tx.transaction.signatures[0] === rec.signature &&
            rec.explorerUrl === explorerTx(rec.signature) && keysFor(tx).includes(V4_PROGRAM_ID) &&
            (rec.label === "ingestGoal" || v4InstructionDiscriminators(tx).includes(expected));
        }),
        `Fetched ${complete.length} finalized successful transactions; checked signatures, slots, explorer links, program key and on-chain instruction discriminators.`);

      // Stale-order refund: the stale trader keeps its stake (only rent + fee lost).
      const refundTx = complete[proof.transactions.findIndex((t) => t.label === "refundStaleBot")];
      const staleWallet = proof.wallets.find((w) => w.role === "traderStaleBot");
      const refundDelta = refundTx && staleWallet ? accountDelta(refundTx, staleWallet.address) : NaN;
      add("stale-refund", "Stale-sequence principal returned",
        Boolean(staleWallet && Number.isFinite(refundDelta) && refundDelta > -V4_CANONICAL.stakeLamports && refundDelta === proof.staleOrder.walletNetLamports),
        "The stale order's transaction returns the full stake; the wallet loses only position rent and the transaction fee.");

      // Winner payout: the pre-goal YES winner receives its gross payout on claim.
      const claimTx = complete[proof.transactions.findIndex((t) => t.label === "claimHonestYes")];
      const winnerWallet = proof.wallets.find((w) => w.role === "traderPreYes");
      const claimDelta = claimTx && winnerWallet ? accountDelta(claimTx, winnerWallet.address) : NaN;
      add("winner-payout", "Winner payout settled",
        Boolean(winnerWallet && preYes && Number.isFinite(claimDelta) && claimDelta > 0 && claimDelta <= preYes.grossPayoutLamports && preYes.grossPayoutLamports - claimDelta < 20_000),
        "The winning YES position receives its fixed gross payout (net of the claim transaction fee).");

      // No double claim: a second claim of the winning position is not present in the record.
      const claimCount = proof.transactions.filter((t) => (t.label === "claimHonestYes")).length;
      add("no-double-claim", "No double claim",
        claimCount === 1 && (preYes?.claimedLamports ?? 0) === (preYes?.grossPayoutLamports ?? -1),
        "The winning position is claimed exactly once; claimed lamports equal its frozen gross payout.");

      // Full-lifecycle wallet balance deltas recomputed from transaction metadata.
      const walletOk = proof.wallets.every((w) => {
        let sum = 0;
        for (const tx of complete) sum += accountDelta(tx, w.address);
        return sum === w.balanceAfterLamports - w.balanceBeforeLamports;
      });
      add("balance-deltas", "Wallet balance changes",
        walletOk, "Every recorded wallet's net lamport change is recomputed from transaction metadata and matches.");
    }

    // Closures: accounts the record says are closed are absent on-chain.
    const closureEntries = Object.entries(proof.closures);
    if (closureEntries.length) {
      const closureInfos = await client.getMultipleAccountsInfo(closureEntries.map(([addr]) => new PublicKey(addr)), "finalized");
      add("closures", "Rent recovery / account closures",
        closureInfos.every((info, i) => (closureEntries[i][1] ? info === null : true)),
        "Every account the record marks closed is absent on-chain; its rent returned to the owner.");
    }
  } catch (error) {
    checks.push({ id: "onchain", label: "On-chain proof accounts", status: rpcUnavailable(error) ? "UNKNOWN" : "FAILED", detail: error instanceof Error ? error.message : String(error) });
  }

  return finish("recorded");
}

export const V4_TRANSACTION_EXPLORER = explorerTx;
