/**
 * FairX Vault V4 — canonical on-chain lifecycle recorder.
 *
 * This records ONE real devnet lifecycle and writes the evidence fixture that
 * `lib/proof/v4LifecycleVerifier.ts` re-verifies from RPC. It is designed to run ONLY
 * after a signed V4 deployment.
 *
 *   npm run v4:record-lifecycle              # PREFLIGHT ONLY — checks guards, sends nothing
 *   npm run v4:record-lifecycle -- --execute # signs + sends the lifecycle, then writes the fixture
 *
 * The default mode never signs or sends. `--execute` requires every guard to pass and
 * loads external signer keypairs from env-configured paths (never from this repo).
 *
 * Instruction encoding and PDA derivation mirror the signature-verified LiteSVM lifecycle
 * (`scripts/fairx-v4-litesvm-lifecycle.ts`) exactly, via the same generated IDL.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction, type AccountMeta, type VersionedTransactionResponse,
} from "@solana/web3.js";
import { BorshAccountsCoder, BorshInstructionCoder, BN, type Idl } from "@anchor-lang/core";
import fixture from "../fixtures/txline/v4-france-morocco-lifecycle.json";
import pinned from "../fixtures/txline/v4-pinned-artifacts.json";
import manifest from "../fixtures/txline/v4-build-manifest.json";
import idlJson from "../lib/v4/idl.json";
import { V4_BOOTSTRAP_ADMIN, V4_PROGRAM_ID } from "../lib/v4/program";
import {
  deriveAuthorityConfigV4Pda, deriveLiquidityVaultV4Pda, deriveMarketV4Pda,
  deriveQuoteReceiptV4Pda, deriveResolutionProposalV4Pda, deriveResolutionReceiptV4Pda,
} from "../lib/v4/program";
import { V4_CANONICAL, type V4RecordedEvidence } from "../lib/v4/lifecycleEvidence";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const PROGRAM = new PublicKey(V4_PROGRAM_ID);
const idl = idlJson as Idl;
const ixCoder = new BorshInstructionCoder(idl);
const acctCoder = new BorshAccountsCoder(idl);

const bytes32 = (label: string): number[] => [...createHash("sha256").update(label).digest()];
const u64le = (value: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(value); return b; };
const explorerTx = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

type SignerName = "bootstrap" | "operator" | "feed" | "pricing" | "resolutionA" | "resolutionB" | "resolutionC" | "trader0" | "trader1" | "trader2" | "trader3";
const SIGNER_ENV: Record<SignerName, string> = {
  bootstrap: "V4_BOOTSTRAP_KEYPAIR", operator: "V4_OPERATOR_KEYPAIR", feed: "V4_FEED_KEYPAIR", pricing: "V4_PRICING_KEYPAIR",
  resolutionA: "V4_RESOLUTION_A_KEYPAIR", resolutionB: "V4_RESOLUTION_B_KEYPAIR", resolutionC: "V4_RESOLUTION_C_KEYPAIR",
  trader0: "V4_TRADER0_KEYPAIR", trader1: "V4_TRADER1_KEYPAIR", trader2: "V4_TRADER2_KEYPAIR", trader3: "V4_TRADER3_KEYPAIR",
};

async function loadKeypair(path: string): Promise<Keypair> {
  const secret = JSON.parse(await readFile(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function meta(pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

function odds(record: typeof fixture.preGoalOddsValidation) {
  const s = record.odds;
  return { fixture_id: new BN(s.FixtureId), message_id: s.MessageId, ts: new BN(s.Ts), bookmaker: s.Bookmaker, bookmaker_id: s.BookmakerId, super_odds_type: s.SuperOddsType, game_state: s.GameState, in_running: s.InRunning, market_parameters: s.MarketParameters, market_period: s.MarketPeriod, price_names: s.PriceNames, prices: s.Prices };
}
function oddsSummary(record: typeof fixture.preGoalOddsValidation) {
  return { fixture_id: new BN(record.summary.fixtureId), update_stats: { update_count: record.summary.updateStats.updateCount, min_timestamp: new BN(record.summary.updateStats.minTimestamp), max_timestamp: new BN(record.summary.updateStats.maxTimestamp) }, odds_sub_tree_root: record.summary.oddsSubTreeRoot };
}
const proofNodes = (nodes: { hash: number[]; isRightSibling: boolean }[]) => nodes.map((n) => ({ hash: n.hash, is_right_sibling: n.isRightSibling }));
function resolutionPayload() {
  const s = fixture.finalStatValidation;
  return { ts: new BN(s.ts), fixture_summary: { fixture_id: new BN(s.summary.fixtureId), update_stats: { update_count: s.summary.updateStats.updateCount, min_timestamp: new BN(s.summary.updateStats.minTimestamp), max_timestamp: new BN(s.summary.updateStats.maxTimestamp) }, events_sub_tree_root: s.summary.eventStatsSubTreeRoot }, fixture_proof: proofNodes(s.subTreeProof), main_tree_proof: proofNodes(s.mainTreeProof), event_stat_root: s.eventStatRoot, stats: s.statsToProve.map((stat, i) => ({ stat, stat_proof: proofNodes(s.statProofs[i]) })) };
}
const encode = (name: string, args: object) => Buffer.from(ixCoder.encode(name, args));
const ix = (name: string, args: object, keys: AccountMeta[]) => new TransactionInstruction({ programId: PROGRAM, keys, data: encode(name, args) });
const commitArgs = (sequence: number, eventSequence: number, record: typeof fixture.preGoalOddsValidation) => ({ args: { quote_sequence: new BN(sequence), material_event_sequence: new BN(eventSequence), spread_micros: new BN(V4_CANONICAL.spreadMicros), odds: odds(record) } });
const quoteHash = (sequence: number, eventSequence: number, record: typeof fixture.preGoalOddsValidation) => createHash("sha256").update(encode("commit_txline_quote", commitArgs(sequence, eventSequence, record)).subarray(32)).digest();

// ---------------------------------------------------------------------------
// Preflight — all guards must pass before any signature is created.
// ---------------------------------------------------------------------------
async function preflight(connection: Connection, requireSigners: boolean) {
  const failures: string[] = [];
  const ok: string[] = [];

  const genesis = await connection.getGenesisHash().catch(() => "");
  if (genesis === DEVNET_GENESIS) ok.push("cluster is devnet"); else failures.push(`cluster is not devnet (genesis ${genesis || "unreadable"})`);

  const [program, programData] = await connection.getMultipleAccountsInfo([PROGRAM, new PublicKey("9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V")]).catch(() => [null, null]);
  const deployed = Boolean(program?.executable && program.owner.equals(UPGRADEABLE_LOADER));
  if (deployed) ok.push("V4 program is deployed and executable"); else failures.push("V4 program is not deployed / not executable — nothing to record");
  if (deployed && programData) {
    const slice = programData.data.subarray(45, 45 + manifest.sbfSizeBytes);
    const hash = createHash("sha256").update(slice).digest("hex");
    if (hash === manifest.sbfSha256) ok.push("deployed binary identity matches the reproducible SBF hash");
    else failures.push("deployed binary hash does NOT match the build manifest — refusing (wrong/stale program)");
  } else if (deployed) {
    failures.push("ProgramData account is missing — cannot confirm binary identity");
  }

  for (const root of [pinned.oddsRoot, pinned.scoresRoot]) {
    const info = await connection.getAccountInfo(new PublicKey(root.pda)).catch(() => null);
    if (info?.owner.equals(TXLINE_PROGRAM) && createHash("sha256").update(info.data).digest("hex") === root.dataSha256) ok.push(`TxLINE root ${root.pda.slice(0, 8)}… present and pinned-hash-matched`);
    else failures.push(`TxLINE root ${root.pda.slice(0, 8)}… missing, wrong owner, or hash mismatch`);
  }
  if (fixture.fixtureId !== V4_CANONICAL.fixtureId) failures.push("bundled TxLINE fixture id mismatch");
  else ok.push("bundled TxLINE evidence present");

  let signers: Record<SignerName, Keypair> | null = null;
  if (requireSigners) {
    const loaded: Partial<Record<SignerName, Keypair>> = {};
    for (const [name, env] of Object.entries(SIGNER_ENV) as [SignerName, string][]) {
      const path = process.env[env];
      if (!path) { failures.push(`signer ${name}: env ${env} not set`); continue; }
      try { loaded[name] = await loadKeypair(path); ok.push(`signer ${name} loaded`); } catch (e) { failures.push(`signer ${name}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (loaded.bootstrap && !loaded.bootstrap.publicKey.equals(new PublicKey(V4_BOOTSTRAP_ADMIN))) failures.push("bootstrap keypair does not match the compiled bootstrap administrator");
    if (Object.keys(loaded).length === Object.keys(SIGNER_ENV).length && !failures.some((f) => f.startsWith("signer") || f.includes("bootstrap"))) signers = loaded as Record<SignerName, Keypair>;
  }

  // If the market already exists it must match the canonical identity and be unresolved.
  const market = deriveMarketV4Pda(Buffer.from(bytes32(V4_CANONICAL.marketIdSeed)));
  const marketInfo = deployed ? await connection.getAccountInfo(market).catch(() => null) : null;
  if (marketInfo) {
    try {
      const decoded = acctCoder.decode("MarketV4", marketInfo.data) as Record<string, unknown>;
      if (Number((decoded.fixture_id ?? decoded.fixtureId)?.toString?.() ?? NaN) !== V4_CANONICAL.fixtureId) failures.push("existing market has a different fixture id");
      else if (decoded.resolved === true) failures.push("canonical market is already resolved — lifecycle already recorded");
      else ok.push("existing canonical market matches and is unresolved");
    } catch { failures.push("existing market account could not be decoded"); }
  } else if (deployed) {
    ok.push("canonical market absent — a fresh lifecycle can be initialized");
  }

  return { ok, failures, signers, market };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const rpcUrl = process.env.RECORDER_RPC_URL ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const { ok, failures, signers, market } = await preflight(connection, execute);
  console.log(`\nFairX V4 lifecycle recorder — ${execute ? "EXECUTE" : "PREFLIGHT (no send)"} · ${rpcUrl}`);
  for (const line of ok) console.log(`  ✓ ${line}`);
  for (const line of failures) console.log(`  ✗ ${line}`);

  if (failures.length) {
    console.log(`\nRefusing: ${failures.length} guard(s) failed. No signature was created and nothing was sent.`);
    process.exitCode = 1;
    return;
  }
  if (!execute) {
    console.log("\nAll guards pass. Re-run with --execute to sign and record the lifecycle on devnet.");
    return;
  }
  assert(signers, "signers must be loaded in execute mode");

  await recordLifecycle(connection, rpcUrl, signers, market);
}

// ---------------------------------------------------------------------------
// Execute — sends the canonical lifecycle and writes the evidence fixture.
// Reached only with --execute and all guards passing. Validated on live devnet.
// ---------------------------------------------------------------------------
async function recordLifecycle(connection: Connection, rpcUrl: string, s: Record<SignerName, Keypair>, market: PublicKey) {
  const admin = new PublicKey(V4_BOOTSTRAP_ADMIN);
  const authorityConfig = deriveAuthorityConfigV4Pda();
  const vault = deriveLiquidityVaultV4Pda(market);
  const quotePre = deriveQuoteReceiptV4Pda(market, BigInt(V4_CANONICAL.preGoal.quoteSequence));
  const quotePost = deriveQuoteReceiptV4Pda(market, BigInt(V4_CANONICAL.postGoal.quoteSequence));
  const resolutionReceipt = deriveResolutionReceiptV4Pda(market);
  const resolutionProposal = deriveResolutionProposalV4Pda(market);
  const resolution = [s.resolutionA, s.resolutionB, s.resolutionC].map((k) => k.publicKey);
  const positionIds = ["pre-yes", "pre-no", "stale-bot", "post-yes"].map((l) => Buffer.from(bytes32(l)));
  const traders = [s.trader0, s.trader1, s.trader2, s.trader3];
  const positions = traders.map((t, i) => deriveFixedPosition(market, t.publicKey, positionIds[i], BigInt(i)));
  const sys = meta(SystemProgram.programId, false, false);
  const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  const transactions: V4RecordedEvidence["transactions"] = [];
  const balanceOf = async (k: PublicKey) => connection.getBalance(k, "confirmed");
  const before = new Map<string, number>();
  for (const k of [s.operator.publicKey, ...traders.map((t) => t.publicKey)]) before.set(k.toBase58(), await balanceOf(k));

  const send = async (label: string, instruction: string, instructions: TransactionInstruction[], payer: Keypair, extra: Keypair[] = []) => {
    const tx = new Transaction().add(...instructions);
    const signature = await sendAndConfirmTransaction(connection, tx, [payer, ...extra], { commitment: "finalized", maxRetries: 3 });
    const detail = await connection.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
    transactions.push({ label, instruction, discriminatorHex: (manifest.instructionDiscriminatorsHex as Record<string, string>)[instruction], signature, slot: detail?.slot ?? 0, blockTime: detail?.blockTime ?? null, explorerUrl: explorerTx(signature), finalized: true });
  };

  const initArgs = { args: { market_id: bytes32(V4_CANONICAL.marketIdSeed), fixture_id: new BN(V4_CANONICAL.fixtureId), fixture_hash: bytes32(String(V4_CANONICAL.fixtureId)), home_team_hash: bytes32("France"), away_team_hash: bytes32("Morocco"), home_participant_id: new BN(1999), away_participant_id: new BN(2530), home_participant_is_home: true, regulation_template_hash: bytes32("txline:1X2_PARTICIPANT_RESULT:part1-home-france-1999:draw:part2-away-morocco-2530:period-100:keys-1001,1002,3001,3002"), initial_material_event_sequence: new BN(V4_CANONICAL.preGoal.materialEventSequence), operator: s.operator.publicKey, feed_authority: s.feed.publicKey, pricing_authority: s.pricing.publicKey, resolution_authorities: resolution, resolution_threshold: V4_CANONICAL.threshold } };
  await send("initializeMarket", "initialize_market_v4", [ix("initialize_market_v4", initArgs, [meta(admin, true, true), meta(authorityConfig, false, true), meta(market, false, true), sys])], s.bootstrap);
  await send("initializeVault", "initialize_liquidity_vault", [ix("initialize_liquidity_vault", { min_stake_lamports: new BN(V4_CANONICAL.minStakeLamports), max_stake_lamports: new BN(V4_CANONICAL.maxStakeLamports) }, [meta(s.operator.publicKey, true, true), meta(authorityConfig, false, false), meta(market, false, false), meta(vault, false, true), sys])], s.operator);
  await send("depositLiquidity", "deposit_liquidity", [ix("deposit_liquidity", { amount: new BN(V4_CANONICAL.operatorDepositLamports) }, [meta(s.operator.publicKey, true, true), meta(authorityConfig, false, false), meta(market, false, false), meta(vault, false, true), sys])], s.operator);

  const commitVerify = async (label: string, seq: number, ev: number, rec: typeof fixture.preGoalOddsValidation, receipt: PublicKey) => {
    await send(`commit${label}Quote`, "commit_txline_quote", [ix("commit_txline_quote", commitArgs(seq, ev, rec), [meta(s.pricing.publicKey, true, false), meta(authorityConfig, false, false), meta(market, false, true)])], s.pricing);
    await send(`verify${label}Quote`, "verify_txline_quote", [cu, ix("verify_txline_quote", { args: { quote_sequence: new BN(seq), odds: odds(rec), summary: oddsSummary(rec), sub_tree_proof: proofNodes(rec.subTreeProof), main_tree_proof: proofNodes(rec.mainTreeProof) } }, [meta(s.operator.publicKey, true, true), meta(market, false, true), meta(new PublicKey(fixture.oddsRootPda), false, false), meta(TXLINE_PROGRAM, false, false), meta(receipt, false, true), sys])], s.operator);
  };
  await commitVerify("Pre", V4_CANONICAL.preGoal.quoteSequence, V4_CANONICAL.preGoal.materialEventSequence, fixture.preGoalOddsValidation, quotePre);

  const preHash = [...quoteHash(V4_CANONICAL.preGoal.quoteSequence, V4_CANONICAL.preGoal.materialEventSequence, fixture.preGoalOddsValidation)];
  const place = (i: number, side: number, seq: number, ev: number, price: number, hash: number[], expirySlot: number) => ix("place_fixed_payout_order", { args: { client_order_id: [...positionIds[i]], order_nonce: new BN(i), side, stake_lamports: new BN(V4_CANONICAL.stakeLamports), expected_quote_sequence: new BN(seq), expected_quote_payload_hash: hash, expected_execution_price_micros: new BN(price), expected_material_event_sequence: new BN(ev), expiry_slot: new BN(expirySlot) } }, [meta(traders[i].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[i], false, true), sys]);
  const withExpiry = async (label: string, i: number, side: number, seq: number, ev: number, price: number, hash: number[]) => {
    const expirySlot = (await connection.getSlot("finalized")) + 10_000;
    await send(label, "place_fixed_payout_order", [place(i, side, seq, ev, price, hash, expirySlot)], traders[i]);
  };
  await withExpiry("acceptHonestYes", 0, 0, V4_CANONICAL.preGoal.quoteSequence, V4_CANONICAL.preGoal.materialEventSequence, V4_CANONICAL.preGoal.yesPriceMicros, preHash);
  await withExpiry("acceptHonestNo", 1, 1, V4_CANONICAL.preGoal.quoteSequence, V4_CANONICAL.preGoal.materialEventSequence, V4_CANONICAL.preGoal.noPriceMicros, preHash);
  await send("ingestGoal", "ingest_material_event_v4", [ix("ingest_material_event_v4", { sequence: new BN(V4_CANONICAL.goalSequence), source_ts: new BN(fixture.goal.ts), payload_hash: [...Buffer.from(fixture.goal.sourcePayloadSha256, "hex")] }, [meta(s.feed.publicKey, true, false), meta(authorityConfig, false, false), meta(market, false, true)])], s.feed);
  await withExpiry("refundStaleBot", 2, 0, V4_CANONICAL.preGoal.quoteSequence, V4_CANONICAL.preGoal.materialEventSequence, V4_CANONICAL.preGoal.yesPriceMicros, preHash);
  await commitVerify("Post", V4_CANONICAL.postGoal.quoteSequence, V4_CANONICAL.postGoal.materialEventSequence, fixture.postGoalOddsValidation, quotePost);
  await send("closeStaleRefund", "close_fixed_payout_position", [ix("close_fixed_payout_position", {}, [meta(traders[2].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[2], false, true)])], traders[2]);
  const postHash = [...quoteHash(V4_CANONICAL.postGoal.quoteSequence, V4_CANONICAL.postGoal.materialEventSequence, fixture.postGoalOddsValidation)];
  await withExpiry("acceptSynchronizedYes", 3, 0, V4_CANONICAL.postGoal.quoteSequence, V4_CANONICAL.postGoal.materialEventSequence, V4_CANONICAL.postGoal.yesPriceMicros, postHash);

  const resAccounts = [meta(resolution[0], true, true), meta(authorityConfig, false, false), meta(market, false, true), meta(new PublicKey(fixture.scoresRootPda), false, false), meta(TXLINE_PROGRAM, false, false), meta(resolutionReceipt, false, true), meta(resolutionProposal, false, true), sys];
  await send("proveResolution", "prove_resolution_with_txline_v4", [cu, ix("prove_resolution_with_txline_v4", { args: { final_sequence: new BN(V4_CANONICAL.finalSequence), payload: resolutionPayload() } }, resAccounts)], s.resolutionA);
  await send("approveResolution", "approve_resolution_v4", [ix("approve_resolution_v4", {}, [meta(resolution[1], true, false), meta(authorityConfig, false, false), meta(market, false, false), meta(resolutionProposal, false, true)])], s.resolutionB);
  await send("executeResolution", "execute_resolution_v4", [ix("execute_resolution_v4", {}, [meta(authorityConfig, false, false), meta(market, false, true), meta(resolutionReceipt, false, false), meta(resolutionProposal, false, true)])], s.operator);
  await send("reconcileLosingNo", "reconcile_position", [ix("reconcile_position", {}, [meta(market, false, false), meta(vault, false, true), meta(positions[1], false, true)])], s.operator);
  await send("claimHonestYes", "claim_fixed_payout", [ix("claim_fixed_payout", {}, [meta(traders[0].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[0], false, true)])], traders[0]);
  await send("claimSynchronizedYes", "claim_fixed_payout", [ix("claim_fixed_payout", {}, [meta(traders[3].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[3], false, true)])], traders[3]);
  await send("reconcileVault", "reconcile_vault_surplus", [ix("reconcile_vault_surplus", {}, [meta(market, false, false), meta(vault, false, true)])], s.operator);

  const decode = async (address: PublicKey, name: string) => {
    const info = await connection.getAccountInfo(address, "finalized");
    assert(info?.owner.equals(PROGRAM), `${name} account is missing or has the wrong owner`);
    return acctCoder.decode(name, info.data) as Record<string, unknown>;
  };
  const n = (state: Record<string, unknown>, snake: string, camel: string) => Number(((state[snake] ?? state[camel]) as { toString?: () => string })?.toString?.() ?? 0);
  const positionState = await Promise.all([decode(positions[0], "FixedPayoutPositionV4"), decode(positions[1], "FixedPayoutPositionV4"), decode(positions[3], "FixedPayoutPositionV4")]);
  const vaultBeforeWithdrawal = await decode(vault, "LiquidityVaultV4");
  const withdrawalAmount = n(vaultBeforeWithdrawal, "free_collateral", "freeCollateral");

  await send("closeHonestYes", "close_fixed_payout_position", [ix("close_fixed_payout_position", {}, [meta(traders[0].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[0], false, true)])], traders[0]);
  await send("closeLosingNo", "close_fixed_payout_position", [ix("close_fixed_payout_position", {}, [meta(traders[1].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[1], false, true)])], traders[1]);
  await send("closeSynchronizedYes", "close_fixed_payout_position", [ix("close_fixed_payout_position", {}, [meta(traders[3].publicKey, true, true), meta(market, false, false), meta(vault, false, true), meta(positions[3], false, true)])], traders[3]);
  await send("withdrawFreeLiquidity", "withdraw_free_liquidity", [ix("withdraw_free_liquidity", { amount: new BN(withdrawalAmount) }, [meta(s.operator.publicKey, true, true), meta(authorityConfig, false, false), meta(market, false, false), meta(vault, false, true)])], s.operator);

  const finalVault = await decode(vault, "LiquidityVaultV4");
  const resolutionState = await decode(resolutionReceipt, "TxlineResolutionReceiptV4");
  const status = (code: number) => code === 1 ? "REFUNDED" as const : code === 2 ? "CLAIMED" as const : code === 3 ? "LOST" as const : "ACCEPTED" as const;
  const positionRecord = (id: "pre-yes" | "pre-no" | "post-yes", index: 0 | 1 | 3, state: Record<string, unknown>): V4RecordedEvidence["positions"][number] => ({
    id, pda: positions[index].toBase58(), owner: traders[index].publicKey.toBase58(), side: n(state, "side", "side") === 0 ? "YES" : "NO",
    stakeLamports: n(state, "stake_lamports", "stakeLamports"), executionPriceMicros: n(state, "execution_price_micros", "executionPriceMicros"),
    grossPayoutLamports: n(state, "gross_payout_lamports", "grossPayoutLamports"), quoteSequence: n(state, "quote_sequence", "quoteSequence"),
    materialEventSequence: n(state, "material_event_sequence", "materialEventSequence"), status: status(n(state, "status", "status")), claimedLamports: n(state, "claimed_lamports", "claimedLamports"),
  });
  const recordedPositions: V4RecordedEvidence["positions"] = [
    positionRecord("pre-yes", 0, positionState[0]),
    positionRecord("pre-no", 1, positionState[1]),
    { id: "stale-bot", pda: positions[2].toBase58(), owner: traders[2].publicKey.toBase58(), side: "YES", stakeLamports: V4_CANONICAL.stakeLamports, executionPriceMicros: V4_CANONICAL.preGoal.yesPriceMicros, grossPayoutLamports: 0, quoteSequence: V4_CANONICAL.preGoal.quoteSequence, materialEventSequence: V4_CANONICAL.preGoal.materialEventSequence, status: "REFUNDED", claimedLamports: 0 },
    positionRecord("post-yes", 3, positionState[2]),
  ];
  const refundSignature = transactions.find((tx) => tx.label === "refundStaleBot")?.signature;
  assert(refundSignature, "refund transaction is missing");
  const refundTx = await connection.getTransaction(refundSignature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
  assert(refundTx, "refund transaction is unavailable");
  const accountDelta = (tx: VersionedTransactionResponse, address: string) => {
    const message = tx.transaction.message as unknown as { staticAccountKeys?: PublicKey[]; accountKeys?: PublicKey[] };
    const keys = (message.staticAccountKeys ?? message.accountKeys ?? []).map((key) => key.toBase58());
    const index = keys.indexOf(address);
    return index < 0 || !tx.meta ? 0 : tx.meta.postBalances[index] - tx.meta.preBalances[index];
  };
  const walletRoles = [["operator", s.operator.publicKey], ["traderPreYes", traders[0].publicKey], ["traderPreNo", traders[1].publicKey], ["traderStaleBot", traders[2].publicKey], ["traderPostYes", traders[3].publicKey]] as const;
  const wallets: V4RecordedEvidence["wallets"] = [];
  for (const [role, address] of walletRoles) {
    const after = await balanceOf(address);
    const initial = before.get(address.toBase58()) ?? after;
    wallets.push({ role, address: address.toBase58(), balanceBeforeLamports: initial, balanceAfterLamports: after, netAfterFundingLamports: after - initial });
  }
  const snapshot = (label: string, state: Record<string, unknown>) => ({ label, freeCollateral: n(state, "free_collateral", "freeCollateral"), reservedLiability: n(state, "reserved_liability", "reservedLiability"), acceptedStakePrincipal: n(state, "accepted_stake_principal", "acceptedStakePrincipal"), pendingRefundableStake: n(state, "pending_refundable_stake", "pendingRefundableStake") });

  const evidence: V4RecordedEvidence = {
    version: 1, state: "recorded", recordedAt: new Date().toISOString(), cluster: "devnet", rpcUrl,
    program: { programId: V4_PROGRAM_ID, programDataAddress: "9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V", deploymentSlot: 476_416_258, sbfSha256: manifest.sbfSha256 },
    txline: { programId: TXLINE_PROGRAM.toBase58(), oddsRootPda: fixture.oddsRootPda, scoresRootPda: fixture.scoresRootPda, fixtureId: V4_CANONICAL.fixtureId, goalSequence: V4_CANONICAL.goalSequence, finalSequence: V4_CANONICAL.finalSequence, homeScore: V4_CANONICAL.homeScore, awayScore: V4_CANONICAL.awayScore, preQuotePayloadHashHex: Buffer.from(preHash).toString("hex"), postQuotePayloadHashHex: Buffer.from(postHash).toString("hex"), resolutionPayloadHashHex: Buffer.from((resolutionState.validation_payload_hash ?? resolutionState.validationPayloadHash) as number[]).toString("hex") },
    accounts: { authorityConfig: authorityConfig.toBase58(), market: market.toBase58(), vault: vault.toBase58(), quoteReceiptPre: quotePre.toBase58(), quoteReceiptPost: quotePost.toBase58(), resolutionReceipt: resolutionReceipt.toBase58(), resolutionProposal: resolutionProposal.toBase58() },
    authorities: { operator: s.operator.publicKey.toBase58(), feed: s.feed.publicKey.toBase58(), pricing: s.pricing.publicKey.toBase58(), resolution: [resolution[0].toBase58(), resolution[1].toBase58(), resolution[2].toBase58()], threshold: V4_CANONICAL.threshold, approvalsMask: 3 },
    marketState: { resolved: true, resolution: V4_CANONICAL.resolutionYes, tradingClosed: true, finalSequence: V4_CANONICAL.finalSequence },
    positions: recordedPositions,
    staleOrder: { positionId: "stale-bot", verdict: "REFUNDED", refundedStakeLamports: V4_CANONICAL.stakeLamports, walletNetLamports: accountDelta(refundTx, traders[2].publicKey.toBase58()) },
    vault: { finalFreeCollateral: n(finalVault, "free_collateral", "freeCollateral"), finalReservedLiability: n(finalVault, "reserved_liability", "reservedLiability"), finalAcceptedStakePrincipal: n(finalVault, "accepted_stake_principal", "acceptedStakePrincipal"), finalPendingRefundableStake: n(finalVault, "pending_refundable_stake", "pendingRefundableStake"), lifetimeOperatorDeposits: n(finalVault, "lifetime_operator_deposits", "lifetimeOperatorDeposits"), lifetimeUserStakes: n(finalVault, "lifetime_user_stakes", "lifetimeUserStakes"), lifetimeRefunds: n(finalVault, "lifetime_refunds", "lifetimeRefunds"), lifetimePayouts: n(finalVault, "lifetime_payouts", "lifetimePayouts"), lifetimeLosingStakes: n(finalVault, "lifetime_losing_stakes", "lifetimeLosingStakes"), lifetimeOperatorWithdrawals: n(finalVault, "lifetime_operator_withdrawals", "lifetimeOperatorWithdrawals") },
    solvencySnapshots: [snapshot("afterSettlementBeforeWithdrawal", vaultBeforeWithdrawal), snapshot("afterWithdrawal", finalVault)], wallets, transactions, closures: Object.fromEntries(positions.map((position) => [position.toBase58(), true])),
  };
  const out = resolve(process.cwd(), "fixtures/lineguard/v4-france-morocco-lifecycle.json");
  await writeFile(out, JSON.stringify(evidence, null, 2));
  console.log(`\nRecorded ${transactions.length} finalized transactions → ${out}`);
  console.log("Now run: npm run v4:verify-lifecycle");
}

function deriveFixedPosition(market: PublicKey, trader: PublicKey, clientOrderId: Buffer, nonce: bigint): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("position-v4"), market.toBuffer(), trader.toBuffer(), clientOrderId, u64le(nonce)], PROGRAM)[0];
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
