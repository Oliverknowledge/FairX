/**
 * Finalize an already-recorded FairX Vault V4 lifecycle.
 *
 * The original recorder finalized the 20 economic transactions but stopped before
 * closing three terminal position accounts and withdrawing the remaining free
 * collateral. This guarded continuation performs only those four deterministic
 * cleanup transactions and repairs the evidence fixture from finalized RPC data.
 *
 *   npm run v4:finalize-lifecycle              # preflight + simulation, sends nothing
 *   npm run v4:finalize-lifecycle -- --execute # sign, send, and rewrite evidence
 *
 * Signer files are read only from explicit environment paths. Their contents are
 * never printed, copied, or written to the repository.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type AccountMeta,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import { BorshAccountsCoder, BorshInstructionCoder, BN, type Idl } from "@anchor-lang/core";
import idlJson from "../lib/v4/idl.json";
import manifest from "../fixtures/txline/v4-build-manifest.json";
import {
  V4_CANONICAL,
  V4_LIFECYCLE_STEPS,
  type V4PositionRecord,
  type V4RecordedEvidence,
  type V4TxRecord,
} from "../lib/v4/lifecycleEvidence";
import {
  V4_PROGRAM_ID,
  deriveAuthorityConfigV4Pda,
  deriveLiquidityVaultV4Pda,
  deriveMarketV4Pda,
} from "../lib/v4/program";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PROGRAM = new PublicKey(V4_PROGRAM_ID);
const EVIDENCE_PATH = resolve(process.cwd(), "fixtures/lineguard/v4-france-morocco-lifecycle.json");
const DEPLOYMENT_SLOT = 476_416_258;
const idl = idlJson as Idl;
const ixCoder = new BorshInstructionCoder(idl);
const accountCoder = new BorshAccountsCoder(idl);

const EXPECTED = {
  operator: "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq",
  trader0: "GdQ1oKpJ5ZzorVTrfNJVCdKRr28Z97NFwvh6hR83MkY4",
  trader1: "9XkYT2RTDYfvsQSNtSTRLo444WtmPG3LhywtgwadD5ky",
  trader2: "ByaHJutjb76esDNbyhXaeMqMr9nsQB53QzxFakb2ViSc",
  trader3: "8GEhW9qEJEFPQ6sA34H9fMUk937LPCVvKcVwWbhka4vx",
} as const;

const SIGNER_ENV = {
  operator: "V4_OPERATOR_KEYPAIR",
  trader0: "V4_TRADER0_KEYPAIR",
  trader1: "V4_TRADER1_KEYPAIR",
  trader3: "V4_TRADER3_KEYPAIR",
} as const;

type SignerName = keyof typeof SIGNER_ENV;
type Decoded = Record<string, unknown>;

const bytes32 = (label: string) => createHash("sha256").update(label).digest();
const u64le = (value: bigint) => { const out = Buffer.alloc(8); out.writeBigUInt64LE(value); return out; };
const explorerTx = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta => ({ pubkey, isSigner, isWritable });
const field = (value: Decoded, snake: string, camel: string): unknown => value[snake] ?? value[camel];
const numberField = (value: Decoded, snake: string, camel: string): number => Number((field(value, snake, camel) as { toString?: () => string })?.toString?.() ?? NaN);

async function loadSigner(name: SignerName): Promise<Keypair> {
  const path = process.env[SIGNER_ENV[name]];
  assert(path, `${SIGNER_ENV[name]} is required`);
  const bytes = JSON.parse(await readFile(path, "utf8")) as number[];
  const signer = Keypair.fromSecretKey(Uint8Array.from(bytes));
  assert.equal(signer.publicKey.toBase58(), EXPECTED[name], `${name} signer public key differs from the approved role`);
  return signer;
}

function derivePosition(market: PublicKey, trader: PublicKey, id: string, nonce: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position-v4"), market.toBuffer(), trader.toBuffer(), bytes32(id), u64le(nonce)],
    PROGRAM,
  )[0];
}

function instruction(name: string, keys: AccountMeta[], args: object = {}): TransactionInstruction {
  return new TransactionInstruction({ programId: PROGRAM, keys, data: Buffer.from(ixCoder.encode(name, args)) });
}

async function decodeAccount(connection: Connection, address: PublicKey, name: string): Promise<Decoded> {
  const info = await connection.getAccountInfo(address, "finalized");
  assert(info, `${name} account ${address.toBase58()} is missing`);
  assert(info.owner.equals(PROGRAM), `${name} account has the wrong owner`);
  return accountCoder.decode(name, info.data) as Decoded;
}

function statusName(code: number): V4PositionRecord["status"] {
  if (code === 1) return "REFUNDED";
  if (code === 2) return "CLAIMED";
  if (code === 3) return "LOST";
  if (code === 0) return "ACCEPTED";
  return "CLOSED";
}

function positionRecord(id: V4PositionRecord["id"], pda: PublicKey, decoded: Decoded): V4PositionRecord {
  return {
    id,
    pda: pda.toBase58(),
    owner: String(field(decoded, "owner", "owner")),
    side: numberField(decoded, "side", "side") === 0 ? "YES" : "NO",
    stakeLamports: numberField(decoded, "stake_lamports", "stakeLamports"),
    executionPriceMicros: numberField(decoded, "execution_price_micros", "executionPriceMicros"),
    grossPayoutLamports: numberField(decoded, "gross_payout_lamports", "grossPayoutLamports"),
    quoteSequence: numberField(decoded, "quote_sequence", "quoteSequence"),
    materialEventSequence: numberField(decoded, "material_event_sequence", "materialEventSequence"),
    status: statusName(numberField(decoded, "status", "status")),
    claimedLamports: numberField(decoded, "claimed_lamports", "claimedLamports"),
  };
}

function keysFor(transaction: VersionedTransactionResponse): string[] {
  const message = transaction.transaction.message as unknown as { staticAccountKeys?: PublicKey[]; accountKeys?: PublicKey[] };
  const base = message.staticAccountKeys ?? message.accountKeys ?? [];
  const loaded = transaction.meta?.loadedAddresses;
  return [...base, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])].map((key) => key.toBase58());
}

function accountDelta(transaction: VersionedTransactionResponse, address: string): number {
  const index = keysFor(transaction).indexOf(address);
  if (index < 0 || !transaction.meta) return 0;
  return transaction.meta.postBalances[index] - transaction.meta.preBalances[index];
}

async function fetchTransaction(connection: Connection, signature: string): Promise<VersionedTransactionResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await connection.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
      assert(result, `finalized transaction ${signature} is unavailable`);
      return result;
    } catch (error) {
      lastError = error;
      await new Promise((done) => setTimeout(done, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function vaultSnapshot(label: string, vault: Decoded) {
  return {
    label,
    freeCollateral: numberField(vault, "free_collateral", "freeCollateral"),
    reservedLiability: numberField(vault, "reserved_liability", "reservedLiability"),
    acceptedStakePrincipal: numberField(vault, "accepted_stake_principal", "acceptedStakePrincipal"),
    pendingRefundableStake: numberField(vault, "pending_refundable_stake", "pendingRefundableStake"),
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const rpcUrl = process.env.RECORDER_RPC_URL ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const signers = {
    operator: await loadSigner("operator"),
    trader0: await loadSigner("trader0"),
    trader1: await loadSigner("trader1"),
    trader3: await loadSigner("trader3"),
  };
  const evidence = JSON.parse(await readFile(EVIDENCE_PATH, "utf8")) as V4RecordedEvidence;

  assert.equal(await connection.getGenesisHash(), DEVNET_GENESIS, "RPC target is not Solana devnet");
  assert.equal(evidence.state, "recorded", "the canonical recorded evidence is missing");
  assert.equal(evidence.program.programId, V4_PROGRAM_ID, "evidence targets another program");
  assert(!evidence.transactions.some((tx) => tx.label === "withdrawFreeLiquidity"), "cleanup is already recorded");
  for (const step of V4_LIFECYCLE_STEPS.slice(0, 20)) assert(evidence.transactions.some((tx) => tx.label === step), `missing base lifecycle transaction ${step}`);

  const market = new PublicKey(evidence.accounts.market);
  const expectedMarket = deriveMarketV4Pda(bytes32(V4_CANONICAL.marketIdSeed));
  assert(market.equals(expectedMarket), "market PDA differs from the canonical market");
  const vault = deriveLiquidityVaultV4Pda(market);
  const authorityConfig = deriveAuthorityConfigV4Pda();
  assert.equal(vault.toBase58(), evidence.accounts.vault, "vault PDA differs from the evidence");

  const programInfo = await connection.getAccountInfo(PROGRAM, "finalized");
  assert(programInfo?.executable, "approved V4 program is not executable");

  const traderKeys = [signers.trader0.publicKey, signers.trader1.publicKey, new PublicKey(EXPECTED.trader2), signers.trader3.publicKey];
  const positions = traderKeys.map((trader, index) => derivePosition(market, trader, ["pre-yes", "pre-no", "stale-bot", "post-yes"][index], BigInt(index)));
  const [marketState, vaultBefore, preYesState, preNoState, postYesState, receiptState, proposalState] = await Promise.all([
    decodeAccount(connection, market, "MarketV4"),
    decodeAccount(connection, vault, "LiquidityVaultV4"),
    decodeAccount(connection, positions[0], "FixedPayoutPositionV4"),
    decodeAccount(connection, positions[1], "FixedPayoutPositionV4"),
    decodeAccount(connection, positions[3], "FixedPayoutPositionV4"),
    decodeAccount(connection, new PublicKey(evidence.accounts.resolutionReceipt), "TxlineResolutionReceiptV4"),
    decodeAccount(connection, new PublicKey(evidence.accounts.resolutionProposal), "ResolutionProposalV4"),
  ]);
  assert.equal(await connection.getAccountInfo(positions[2], "finalized"), null, "stale-refund position unexpectedly exists");
  assert.equal(field(marketState, "resolved", "resolved"), true, "market is not resolved");
  assert.equal(numberField(marketState, "resolution", "resolution"), V4_CANONICAL.resolutionYes, "market outcome is not YES");
  assert.equal(numberField(preYesState, "status", "status"), 2, "pre-goal YES position is not claimed");
  assert.equal(numberField(preNoState, "status", "status"), 3, "pre-goal NO position is not reconciled lost");
  assert.equal(numberField(postYesState, "status", "status"), 2, "post-goal YES position is not claimed");
  assert.equal(numberField(vaultBefore, "reserved_liability", "reservedLiability"), 0, "vault still has reserved liability");
  assert.equal(numberField(vaultBefore, "accepted_stake_principal", "acceptedStakePrincipal"), 0, "vault still has accepted stake principal");
  assert.equal(numberField(vaultBefore, "pending_refundable_stake", "pendingRefundableStake"), 0, "vault still has pending refunds");
  assert.equal(numberField(vaultBefore, "position_count", "positionCount"), 3, "vault position count is not exactly three");
  const withdrawalAmount = numberField(vaultBefore, "free_collateral", "freeCollateral");
  assert(withdrawalAmount > 0, "vault has no free collateral to withdraw");

  const positionRecords: V4PositionRecord[] = [
    positionRecord("pre-yes", positions[0], preYesState),
    positionRecord("pre-no", positions[1], preNoState),
    {
      id: "stale-bot", pda: positions[2].toBase58(), owner: EXPECTED.trader2, side: "YES",
      stakeLamports: V4_CANONICAL.stakeLamports, executionPriceMicros: V4_CANONICAL.preGoal.yesPriceMicros,
      grossPayoutLamports: 0, quoteSequence: V4_CANONICAL.preGoal.quoteSequence,
      materialEventSequence: V4_CANONICAL.preGoal.materialEventSequence, status: "REFUNDED", claimedLamports: 0,
    },
    positionRecord("post-yes", positions[3], postYesState),
  ];

  const plans: Array<{ label: string; name: string; signer: Keypair; instruction: TransactionInstruction }> = [
    { label: "closeHonestYes", name: "close_fixed_payout_position", signer: signers.trader0, instruction: instruction("close_fixed_payout_position", [meta(signers.trader0.publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[0], false, true)]) },
    { label: "closeLosingNo", name: "close_fixed_payout_position", signer: signers.trader1, instruction: instruction("close_fixed_payout_position", [meta(signers.trader1.publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[1], false, true)]) },
    { label: "closeSynchronizedYes", name: "close_fixed_payout_position", signer: signers.trader3, instruction: instruction("close_fixed_payout_position", [meta(signers.trader3.publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[3], false, true)]) },
    { label: "withdrawFreeLiquidity", name: "withdraw_free_liquidity", signer: signers.operator, instruction: instruction("withdraw_free_liquidity", [meta(signers.operator.publicKey, true, true), meta(authorityConfig, false, false), meta(market, false, false), meta(vault, false, true)], { amount: new BN(withdrawalAmount) }) },
  ];

  console.log(`\nFairX V4 lifecycle cleanup — ${execute ? "EXECUTE" : "PREFLIGHT + SIMULATION"}`);
  console.log(`  cluster: devnet`);
  console.log(`  program: ${PROGRAM.toBase58()}`);
  console.log(`  market: ${market.toBase58()}`);
  console.log(`  vault: ${vault.toBase58()}`);
  console.log(`  terminal positions to close: 3`);
  console.log(`  exact free collateral to withdraw: ${withdrawalAmount} lamports`);

  for (const plan of plans) {
    const tx = new Transaction().add(plan.instruction);
    tx.feePayer = plan.signer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
    const simulation = await connection.simulateTransaction(tx);
    assert.equal(simulation.value.err, null, `${plan.label} simulation failed: ${JSON.stringify(simulation.value.err)}\n${(simulation.value.logs ?? []).join("\n")}`);
    console.log(`  ✓ simulated ${plan.label}`);
  }

  if (!execute) {
    console.log("\nAll guards and simulations passed. No transaction was signed or sent.");
    return;
  }

  const appended: V4TxRecord[] = [];
  for (const plan of plans) {
    const signature = await sendAndConfirmTransaction(connection, new Transaction().add(plan.instruction), [plan.signer], { commitment: "finalized", maxRetries: 3 });
    const tx = await fetchTransaction(connection, signature);
    assert.equal(tx.meta?.err, null, `${plan.label} finalized with an error`);
    appended.push({
      label: plan.label,
      instruction: plan.name,
      discriminatorHex: (manifest.instructionDiscriminatorsHex as Record<string, string>)[plan.name],
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
      explorerUrl: explorerTx(signature),
      finalized: true,
    });
    console.log(`  ✓ finalized ${plan.label}: ${signature}`);
  }

  const [vaultAfter, ...closedInfos] = await Promise.all([
    decodeAccount(connection, vault, "LiquidityVaultV4"),
    ...positions.map((position) => connection.getAccountInfo(position, "finalized")),
  ]);
  assert(closedInfos.every((info) => info === null), "one or more disposable position accounts remain open");
  assert.equal(numberField(vaultAfter, "position_count", "positionCount"), 0, "final vault position count is not zero");
  assert.equal(numberField(vaultAfter, "free_collateral", "freeCollateral"), 0, "final vault free collateral is not zero");

  const transactions = [...evidence.transactions, ...appended];
  const finalizedTransactions: VersionedTransactionResponse[] = [];
  for (const tx of transactions) {
    finalizedTransactions.push(await fetchTransaction(connection, tx.signature));
    await new Promise((done) => setTimeout(done, 250));
  }

  const walletRoles = [
    ["operator", EXPECTED.operator],
    ["traderPreYes", EXPECTED.trader0],
    ["traderPreNo", EXPECTED.trader1],
    ["traderStaleBot", EXPECTED.trader2],
    ["traderPostYes", EXPECTED.trader3],
    ["feed", evidence.authorities.feed],
    ["pricing", evidence.authorities.pricing],
    ["resA", evidence.authorities.resolution[0]],
    ["resB", evidence.authorities.resolution[1]],
    ["resC", evidence.authorities.resolution[2]],
  ] as const;
  const wallets = [] as V4RecordedEvidence["wallets"];
  for (const [role, address] of walletRoles) {
    const net = finalizedTransactions.reduce((sum, tx) => sum + accountDelta(tx, address), 0);
    const after = await connection.getBalance(new PublicKey(address), "finalized");
    wallets.push({ role, address, balanceBeforeLamports: after - net, balanceAfterLamports: after, netAfterFundingLamports: net });
  }

  const refundIndex = transactions.findIndex((tx) => tx.label === "refundStaleBot");
  assert(refundIndex >= 0, "stale refund transaction is missing");
  const staleWalletNet = accountDelta(finalizedTransactions[refundIndex], EXPECTED.trader2);
  const finalSnapshot = vaultSnapshot("afterWithdrawal", vaultAfter);
  const resolutionPayloadHashHex = Buffer.from(field(receiptState, "validation_payload_hash", "validationPayloadHash") as number[]).toString("hex");
  const approvalsMask = numberField(proposalState, "approvals_mask", "approvalsMask");

  const finalEvidence: V4RecordedEvidence = {
    ...evidence,
    recordedAt: new Date().toISOString(),
    program: { ...evidence.program, deploymentSlot: DEPLOYMENT_SLOT },
    txline: { ...evidence.txline, resolutionPayloadHashHex },
    authorities: { ...evidence.authorities, approvalsMask },
    positions: positionRecords,
    staleOrder: { positionId: "stale-bot", verdict: "REFUNDED", refundedStakeLamports: V4_CANONICAL.stakeLamports, walletNetLamports: staleWalletNet },
    vault: {
      finalFreeCollateral: finalSnapshot.freeCollateral,
      finalReservedLiability: finalSnapshot.reservedLiability,
      finalAcceptedStakePrincipal: finalSnapshot.acceptedStakePrincipal,
      finalPendingRefundableStake: finalSnapshot.pendingRefundableStake,
      lifetimeOperatorDeposits: numberField(vaultAfter, "lifetime_operator_deposits", "lifetimeOperatorDeposits"),
      lifetimeUserStakes: numberField(vaultAfter, "lifetime_user_stakes", "lifetimeUserStakes"),
      lifetimeRefunds: numberField(vaultAfter, "lifetime_refunds", "lifetimeRefunds"),
      lifetimePayouts: numberField(vaultAfter, "lifetime_payouts", "lifetimePayouts"),
      lifetimeLosingStakes: numberField(vaultAfter, "lifetime_losing_stakes", "lifetimeLosingStakes"),
      lifetimeOperatorWithdrawals: numberField(vaultAfter, "lifetime_operator_withdrawals", "lifetimeOperatorWithdrawals"),
    },
    solvencySnapshots: [vaultSnapshot("afterSettlementBeforeWithdrawal", vaultBefore), finalSnapshot],
    wallets,
    transactions,
    closures: Object.fromEntries(positions.map((position) => [position.toBase58(), true])),
  };

  await writeFile(EVIDENCE_PATH, `${JSON.stringify(finalEvidence, null, 2)}\n`);
  console.log(`\nRecorded ${transactions.length} finalized lifecycle transactions and all four account closures.`);
  console.log(`Final free collateral: ${finalEvidence.vault.finalFreeCollateral} lamports`);
  console.log(`Lifetime operator withdrawals: ${finalEvidence.vault.lifetimeOperatorWithdrawals} lamports`);
  console.log(`Evidence: ${EVIDENCE_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
