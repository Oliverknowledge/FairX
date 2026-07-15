import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BorshAccountsCoder, BorshInstructionCoder, BN, type Idl } from "@anchor-lang/core";
import {
  AccountRole,
  addSignersToInstruction,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromPrivateKeyBytes,
  createNoopSigner,
  createTransactionMessage,
  lamports,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type TransactionSigner,
} from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM, TransactionMetadata } from "litesvm";
import fixture from "../fixtures/txline/v4-france-morocco-lifecycle.json";
import pinned from "../fixtures/txline/v4-pinned-artifacts.json";
import { deriveV4Pda, V4_BOOTSTRAP_ADMIN_PUBLIC_KEY, V4_PROGRAM_PUBLIC_KEY } from "../lib/v4/program";

const V4_PROGRAM = V4_PROGRAM_PUBLIC_KEY;
const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
const COMPUTE_BUDGET_PROGRAM = address("ComputeBudget111111111111111111111111111111");
const STAKE = 10_000_000n;
const FEE = 5_000n;

type ProofNode = { hash: number[]; isRightSibling: boolean };
type NamedAccounts = Array<[PublicKey, AccountRole]>;

const bytes32 = (label: string): number[] => [...createHash("sha256").update(label).digest()];
const testSigner = (byte: number) => createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(32).fill(byte), true);
const u64le = (value: bigint) => { const buffer = Buffer.alloc(8); buffer.writeBigUInt64LE(value); return buffer; };
const kitAddress = (key: PublicKey): Address => address(key.toBase58());
const pda = deriveV4Pda;
const proofNodes = (nodes: ProofNode[]) => nodes.map((node) => ({ hash: node.hash, is_right_sibling: node.isRightSibling }));

const roles = {
  readonly: AccountRole.READONLY,
  writable: AccountRole.WRITABLE,
  signer: AccountRole.READONLY_SIGNER,
  writableSigner: AccountRole.WRITABLE_SIGNER,
} as const;

function odds(record: typeof fixture.preGoalOddsValidation) {
  const source = record.odds;
  return {
    fixture_id: new BN(source.FixtureId), message_id: source.MessageId, ts: new BN(source.Ts),
    bookmaker: source.Bookmaker, bookmaker_id: source.BookmakerId, super_odds_type: source.SuperOddsType,
    game_state: source.GameState, in_running: source.InRunning, market_parameters: source.MarketParameters,
    market_period: source.MarketPeriod, price_names: source.PriceNames, prices: source.Prices,
  };
}

function oddsSummary(record: typeof fixture.preGoalOddsValidation) {
  return {
    fixture_id: new BN(record.summary.fixtureId),
    update_stats: {
      update_count: record.summary.updateStats.updateCount,
      min_timestamp: new BN(record.summary.updateStats.minTimestamp),
      max_timestamp: new BN(record.summary.updateStats.maxTimestamp),
    },
    odds_sub_tree_root: record.summary.oddsSubTreeRoot,
  };
}

function resolutionPayload() {
  const source = fixture.finalStatValidation;
  return {
    ts: new BN(source.ts),
    fixture_summary: {
      fixture_id: new BN(source.summary.fixtureId),
      update_stats: {
        update_count: source.summary.updateStats.updateCount,
        min_timestamp: new BN(source.summary.updateStats.minTimestamp),
        max_timestamp: new BN(source.summary.updateStats.maxTimestamp),
      },
      events_sub_tree_root: source.summary.eventStatsSubTreeRoot,
    },
    fixture_proof: proofNodes(source.subTreeProof),
    main_tree_proof: proofNodes(source.mainTreeProof),
    event_stat_root: source.eventStatRoot,
    stats: source.statsToProve.map((stat, index) => ({ stat, stat_proof: proofNodes(source.statProofs[index]) })),
  };
}

function field<T>(record: Record<string, unknown>, snake: string, camel: string): T {
  const value = record[snake] ?? record[camel];
  if (value === undefined) throw new Error(`Missing decoded field ${snake}`);
  return value as T;
}

function bnToBigInt(value: unknown): bigint {
  return BigInt((value as { toString(): string }).toString());
}

async function main() {
  const idl = JSON.parse(await readFile("target/idl/fairx_vault_v4.json", "utf8")) as Idl;
  const instructionCoder = new BorshInstructionCoder(idl);
  const accountCoder = new BorshAccountsCoder(idl);
  const svm = new LiteSVM().withSigverify(true).withTransactionHistory(0n);
  svm.addProgramFromFile(kitAddress(V4_PROGRAM), "target/deploy/fairx_vault_v4.so");
  const txlineBytes = await readFile(pinned.txlineProgram.path);
  assert.equal(createHash("sha256").update(txlineBytes).digest("hex"), pinned.txlineProgram.sha256, "TxLINE executable hash mismatch");
  svm.addProgramFromFile(kitAddress(TXLINE_PROGRAM), pinned.txlineProgram.path);

  for (const root of [pinned.oddsRoot, pinned.scoresRoot]) {
    const raw = await readFile(root.path);
    assert.equal(createHash("sha256").update(raw).digest("hex"), root.fileSha256, `${root.pda} fixture file hash mismatch`);
    const captured = JSON.parse(raw.toString("utf8")) as { pubkey: string; account: { data: [string, string]; executable: boolean; lamports: number; owner: string; space: number } };
    assert.equal(captured.pubkey, root.pda);
    assert.equal(captured.account.owner, root.owner);
    const data = Buffer.from(captured.account.data[0], "base64");
    assert.equal(createHash("sha256").update(data).digest("hex"), root.dataSha256, `${root.pda} account data hash mismatch`);
    const [expectedPda] = PublicKey.findProgramAddressSync([Buffer.from(root.seed), u64le(BigInt(root.epochDay)).subarray(0, 2)], TXLINE_PROGRAM);
    assert.equal(expectedPda.toBase58(), root.pda, `${root.pda} PDA derivation mismatch`);
    svm.setAccount({
      address: address(root.pda), data: new Uint8Array(data), executable: captured.account.executable,
      lamports: lamports(BigInt(captured.account.lamports)), programAddress: address(captured.account.owner), space: BigInt(captured.account.space),
    });
  }

  const signerList: KeyPairSigner[] = [];
  for (let byte = 8; byte <= 19; byte += 1) signerList.push(await testSigner(byte));
  const [operatorSigner, feedSigner, pricingSigner, resolutionASigner, resolutionBSigner, resolutionCSigner, ...traderSigners] = signerList;
  const bootstrapSigner = createNoopSigner(address(V4_BOOTSTRAP_ADMIN_PUBLIC_KEY.toBase58()));
  const allSigners: TransactionSigner[] = [bootstrapSigner, ...signerList];
  const admin = V4_BOOTSTRAP_ADMIN_PUBLIC_KEY;
  const operator = new PublicKey(operatorSigner.address);
  const feed = new PublicKey(feedSigner.address);
  const pricing = new PublicKey(pricingSigner.address);
  const resolution = [resolutionASigner, resolutionBSigner, resolutionCSigner].map((signer) => new PublicKey(signer.address));
  const traders = traderSigners.slice(0, 4).map((signer) => new PublicKey(signer.address));
  const signerByAddress = new Map(allSigners.map((signer) => [signer.address, signer]));
  for (const key of [admin, operator, feed, pricing, ...resolution, ...traders]) svm.airdrop(kitAddress(key), lamports(2_000_000_000n));

  const marketId = Buffer.from(bytes32("fairx-v4-france-morocco"));
  const authorityConfig = pda(Buffer.from("authority-config-v4"));
  const market = pda(Buffer.from("market-v4"), marketId);
  const vault = pda(Buffer.from("liquidity-vault-v4"), market.toBuffer());
  const quoteReceipts = [1n, 2n].map((sequence) => pda(Buffer.from("quote-proof-v4"), market.toBuffer(), u64le(sequence)));
  const positionIds = ["pre-yes", "pre-no", "stale-bot", "post-yes"].map((label) => Buffer.from(bytes32(label)));
  const positions = traders.map((trader, index) => pda(Buffer.from("position-v4"), market.toBuffer(), trader.toBuffer(), positionIds[index], u64le(BigInt(index))));
  const resolutionReceipt = pda(Buffer.from("resolution-proof-v4"), market.toBuffer());
  const resolutionProposal = pda(Buffer.from("resolution-proposal-v4"), market.toBuffer());

  const computeIx: Instruction = { programAddress: COMPUTE_BUDGET_PROGRAM, data: Uint8Array.of(2, 0xc0, 0x5c, 0x15, 0) };
  const makeIx = (name: string, args: object, accounts: NamedAccounts): Instruction => ({
    programAddress: kitAddress(V4_PROGRAM),
    accounts: accounts.map(([key, role]) => ({ address: kitAddress(key), role })),
    data: new Uint8Array(instructionCoder.encode(name, args)),
  });
  const transferLamportsIx = (from: PublicKey, to: PublicKey, amount: bigint): Instruction => {
    const data = Buffer.alloc(12);
    data.writeUInt32LE(2, 0);
    data.writeBigUInt64LE(amount, 4);
    return {
      programAddress: kitAddress(SYSTEM_PROGRAM),
      accounts: [
        { address: kitAddress(from), role: roles.writableSigner },
        { address: kitAddress(to), role: roles.writable },
      ],
      data,
    };
  };
  const send = async (label: string, feePayer: PublicKey, instructions: Instruction[], expectFailure = false) => {
    const feePayerSigner = feePayer.equals(admin) ? operatorSigner : signerByAddress.get(kitAddress(feePayer));
    assert(feePayerSigner, `missing local test signer for ${feePayer}`);
    const signedInstructions = instructions.map((instruction) => addSignersToInstruction(allSigners, instruction));
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (value) => setTransactionMessageFeePayerSigner(feePayerSigner, value),
      (value) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: svm.latestBlockhash(), lastValidBlockHeight: 999_999n }, value),
      (value) => appendTransactionMessageInstructions(signedInstructions, value),
    );
    const partial = await partiallySignTransactionMessageWithSigners(message);
    const transaction = {
      ...partial,
      signatures: Object.fromEntries(Object.entries(partial.signatures).map(([key, signature]) => [key, signature ?? new Uint8Array(64)])),
    };
    const result = svm.sendTransaction(transaction);
    if (expectFailure) {
      assert(result instanceof FailedTransactionMetadata, `${label} unexpectedly succeeded`);
      return result;
    }
    if (result instanceof FailedTransactionMetadata) throw new Error(`${label}: ${result.err()}\n${result.meta().prettyLogs()}`);
    assert(result instanceof TransactionMetadata);
    return result;
  };

  const decodeVault = () => {
    const account = svm.getAccount(kitAddress(vault));
    assert(account, "vault account missing");
    return accountCoder.decode("LiquidityVaultV4", Buffer.from(account.data)) as Record<string, unknown>;
  };
  const reconcileSurplusAccounts: NamedAccounts = [[market, roles.readonly], [vault, roles.writable]];

  const system = [SYSTEM_PROGRAM, roles.readonly] as [PublicKey, AccountRole];
  const initArgs = {
    market_id: [...marketId], fixture_id: new BN(fixture.fixtureId), fixture_hash: bytes32(String(fixture.fixtureId)),
    home_team_hash: bytes32("France"), away_team_hash: bytes32("Morocco"),
    home_participant_id: new BN(1999), away_participant_id: new BN(2530), home_participant_is_home: true,
    regulation_template_hash: bytes32("txline:1X2_PARTICIPANT_RESULT:part1-home-france-1999:draw:part2-away-morocco-2530:period-100:keys-1001,1002,3001,3002"),
    initial_material_event_sequence: new BN(738),
    operator, feed_authority: feed, pricing_authority: pricing, resolution_authorities: resolution, resolution_threshold: 2,
  };
  const initAccounts = (payer: PublicKey, config = authorityConfig, marketAccount = market): NamedAccounts => [[payer, roles.writableSigner], [config, roles.writable], [marketAccount, roles.writable], system];
  // The real bootstrap private key remains external. Signature verification is disabled only for
  // initialization transactions that carry its public no-op signer; all later transactions are
  // signed by deterministic local-only signers and verified by LiteSVM.
  svm.withSigverify(false);
  await send("attacker cannot initialize first", resolution[0], [makeIx("initialize_market_v4", { args: initArgs }, initAccounts(resolution[0]))], true);
  await send("wrong bootstrap admin rejected", operator, [makeIx("initialize_market_v4", { args: initArgs }, initAccounts(operator))], true);
  const substitutedConfig = pda(Buffer.from("authority-config-v4-substituted"));
  await send("substituted authority config rejected", admin, [makeIx("initialize_market_v4", { args: initArgs }, initAccounts(admin, substitutedConfig))], true);
  await send("duplicate roles rejected", admin, [makeIx("initialize_market_v4", { args: { ...initArgs, feed_authority: operator } }, initAccounts(admin))], true);
  const mutatedIdentityCases: Array<[string, typeof initArgs, PublicKey?]> = [
    ["market id", { ...initArgs, market_id: bytes32("wrong-market") }, pda(Buffer.from("market-v4"), Buffer.from(bytes32("wrong-market")))],
    ["fixture id", { ...initArgs, fixture_id: new BN(18209182) }],
    ["fixture hash", { ...initArgs, fixture_hash: bytes32("wrong-fixture") }],
    ["home team", { ...initArgs, home_team_hash: bytes32("Spain") }],
    ["away team", { ...initArgs, away_team_hash: bytes32("Spain") }],
    ["home participant", { ...initArgs, home_participant_id: new BN(2000) }],
    ["away participant", { ...initArgs, away_participant_id: new BN(2531) }],
    ["home orientation", { ...initArgs, home_participant_is_home: false }],
    ["regulation template", { ...initArgs, regulation_template_hash: bytes32("wrong-template") }],
  ];
  for (const [label, args, marketAccount] of mutatedIdentityCases) {
    await send(`canonical ${label} substitution rejected`, admin, [makeIx("initialize_market_v4", { args }, initAccounts(admin, authorityConfig, marketAccount ?? market))], true);
  }
  await send("initialize market", admin, [makeIx("initialize_market_v4", { args: initArgs }, initAccounts(admin))]);
  await send("second initialization rejected", admin, [makeIx("initialize_market_v4", { args: initArgs }, initAccounts(admin))], true);
  svm.withSigverify(true);
  await send("initialize vault", operator, [makeIx("initialize_liquidity_vault", { min_stake_lamports: new BN(1_000_000), max_stake_lamports: new BN(100_000_000) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable], system])]);
  await send("deposit liquidity", operator, [makeIx("deposit_liquidity", { amount: new BN(200_000_000) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable], system])]);
  await send("u64-max direct transfer fails atomically", traders[0], [transferLamportsIx(traders[0], vault, 18_446_744_073_709_551_615n)], true);
  await send("one lamport donation", traders[0], [transferLamportsIx(traders[0], vault, 1n)]);
  await send("reconcile one lamport", traders[0], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)]);
  await send("first repeated donation", traders[0], [transferLamportsIx(traders[0], vault, 2n)]);
  await send("second repeated donation", traders[0], [transferLamportsIx(traders[0], vault, 3n)]);
  await send("reconcile repeated donations", traders[0], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)]);
  const afterDonations = decodeVault();
  assert.equal(bnToBigInt(field(afterDonations, "free_collateral", "freeCollateral")), 200_000_006n);
  const sequenceBeforeZero = bnToBigInt(field(afterDonations, "accounting_sequence", "accountingSequence"));
  await send("zero surplus reconciliation is idempotent", traders[0], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)]);
  const afterZero = decodeVault();
  assert.equal(bnToBigInt(field(afterZero, "free_collateral", "freeCollateral")), 200_000_006n);
  assert.equal(bnToBigInt(field(afterZero, "accounting_sequence", "accountingSequence")), sequenceBeforeZero + 1n);

  const commitArgs = (sequence: number, eventSequence: number, record: typeof fixture.preGoalOddsValidation) => ({ args: {
    quote_sequence: new BN(sequence), material_event_sequence: new BN(eventSequence), spread_micros: new BN(10_000), odds: odds(record),
  } });
  const verifyArgs = (sequence: number, record: typeof fixture.preGoalOddsValidation) => ({ args: {
    quote_sequence: new BN(sequence), odds: odds(record), summary: oddsSummary(record),
    sub_tree_proof: proofNodes(record.subTreeProof), main_tree_proof: proofNodes(record.mainTreeProof),
  } });
  const quoteHash = (sequence: number, eventSequence: number, record: typeof fixture.preGoalOddsValidation) => {
    const encoded = instructionCoder.encode("commit_txline_quote", commitArgs(sequence, eventSequence, record));
    return [...createHash("sha256").update(encoded.subarray(32)).digest()];
  };

  await send("commit pre-goal quote", pricing, [makeIx("commit_txline_quote", commitArgs(1, 738, fixture.preGoalOddsValidation), [[pricing, roles.signer], [authorityConfig, roles.readonly], [market, roles.writable]])]);
  await send("verify pre-goal quote", operator, [computeIx, makeIx("verify_txline_quote", verifyArgs(1, fixture.preGoalOddsValidation), [[operator, roles.writableSigner], [market, roles.writable], [new PublicKey(fixture.oddsRootPda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [quoteReceipts[0], roles.writable], system])]);
  await send("donation before trade", traders[0], [transferLamportsIx(traders[0], vault, 7n)]);

  const placeArgs = (index: number, side: number, quoteSequence: number, eventSequence: number, price: number, hash: number[]) => ({ args: {
    client_order_id: [...positionIds[index]], order_nonce: new BN(index), side, stake_lamports: new BN(STAKE.toString()), expected_quote_sequence: new BN(quoteSequence),
    expected_quote_payload_hash: hash, expected_execution_price_micros: new BN(price), expected_material_event_sequence: new BN(eventSequence), expiry_slot: new BN((svm.getClock().slot + 10_000n).toString()),
  } });
  const placeAccounts = (index: number): NamedAccounts => [[traders[index], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[index], roles.writable], system];
  const preHash = quoteHash(1, 738, fixture.preGoalOddsValidation);
  await send("accept honest YES", traders[0], [makeIx("place_fixed_payout_order", placeArgs(0, 0, 1, 738, 532_785, preHash), placeAccounts(0))]);
  await send("trade remains live with unreconciled surplus", traders[0], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)]);
  await send("accept honest NO", traders[1], [makeIx("place_fixed_payout_order", placeArgs(1, 1, 1, 738, 487_215, preHash), placeAccounts(1))]);
  await send("donation after trade", traders[1], [transferLamportsIx(traders[1], vault, 11n)]);
  await send("reject unsafe withdrawal", operator, [makeIx("withdraw_free_liquidity", { amount: new BN(180_705_898) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable]])], true);

  await send("ingest goal 739", feed, [makeIx("ingest_material_event_v4", { sequence: new BN(739), source_ts: new BN(fixture.goal.ts), payload_hash: [...Buffer.from(fixture.goal.sourcePayloadSha256, "hex")] }, [[feed, roles.signer], [authorityConfig, roles.readonly], [market, roles.writable]])]);
  const botBefore = svm.getBalance(kitAddress(traders[2]))!;
  await send("atomically refund stale bot", traders[2], [makeIx("place_fixed_payout_order", placeArgs(2, 0, 1, 738, 532_785, preHash), placeAccounts(2))]);
  const botAfter = svm.getBalance(kitAddress(traders[2]))!;
  const botPosition = svm.getAccount(kitAddress(positions[2]));
  assert(botPosition, "refunded receipt must be durable before close");
  assert.equal(botBefore - botAfter, botPosition.lamports + FEE, "bot loses only position rent and transaction fee; stake is returned");
  await send("reconcile donation after stale refund", traders[2], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)]);

  await send("commit post-goal quote", pricing, [makeIx("commit_txline_quote", commitArgs(2, 739, fixture.postGoalOddsValidation), [[pricing, roles.signer], [authorityConfig, roles.readonly], [market, roles.writable]])]);
  await send("verify post-goal quote", operator, [computeIx, makeIx("verify_txline_quote", verifyArgs(2, fixture.postGoalOddsValidation), [[operator, roles.writableSigner], [market, roles.writable], [new PublicKey(fixture.oddsRootPda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [quoteReceipts[1], roles.writable], system])]);
  const postHash = quoteHash(2, 739, fixture.postGoalOddsValidation);
  const rentReturns: Array<{ position: string; lamports: string }> = [];
  const staleRentBefore = svm.getBalance(kitAddress(traders[2]))!;
  await send("close stale refund receipt", traders[2], [makeIx("close_fixed_payout_position", {}, [[traders[2], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[2], roles.writable]])]);
  const staleRentAfter = svm.getBalance(kitAddress(traders[2]))!;
  assert.equal(staleRentAfter - staleRentBefore, botPosition.lamports - FEE);
  rentReturns.push({ position: positions[2].toBase58(), lamports: botPosition.lamports.toString() });
  await send("closed order id cannot be silently reused", traders[2], [makeIx("place_fixed_payout_order", placeArgs(2, 0, 2, 739, 874_793, postHash), placeAccounts(2))], true);
  await send("accept synchronized post-goal YES", traders[3], [makeIx("place_fixed_payout_order", placeArgs(3, 0, 2, 739, 874_793, postHash), placeAccounts(3))]);

  await send("wrong final sequence rejected", resolution[0], [computeIx, makeIx("prove_resolution_with_txline_v4", { args: { final_sequence: new BN(1113), payload: resolutionPayload() } }, [[resolution[0], roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.writable], [new PublicKey(fixture.scoresRootPda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [resolutionReceipt, roles.writable], [resolutionProposal, roles.writable], system])], true);
  const wrongTimestampPayload = resolutionPayload();
  wrongTimestampPayload.ts = new BN(fixture.finalStatValidation.ts - 1);
  await send("wrong final timestamp rejected", resolution[0], [computeIx, makeIx("prove_resolution_with_txline_v4", { args: { final_sequence: new BN(1114), payload: wrongTimestampPayload } }, [[resolution[0], roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.writable], [new PublicKey(fixture.scoresRootPda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [resolutionReceipt, roles.writable], [resolutionProposal, roles.writable], system])], true);
  await send("prove final regulation score", resolution[0], [computeIx, makeIx("prove_resolution_with_txline_v4", { args: { final_sequence: new BN(1114), payload: resolutionPayload() } }, [[resolution[0], roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.writable], [new PublicKey(fixture.scoresRootPda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [resolutionReceipt, roles.writable], [resolutionProposal, roles.writable], system])]);
  const afterGrace = svm.getClock();
  afterGrace.unixTimestamp = 1_783_638_389n;
  svm.setClock(afterGrace);
  await send("void after valid final receipt prohibited", resolution[1], [makeIx("propose_void_v4", { reason_code: 1 }, [[resolution[1], roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.writable], [resolutionReceipt, roles.readonly], [resolutionProposal, roles.writable], system])], true);
  await send("second resolution approval", resolution[1], [makeIx("approve_resolution_v4", {}, [[resolution[1], roles.signer], [authorityConfig, roles.readonly], [market, roles.readonly], [resolutionProposal, roles.writable]])]);
  await send("execute 2-of-3 resolution", admin, [makeIx("execute_resolution_v4", {}, [[authorityConfig, roles.readonly], [market, roles.writable], [resolutionReceipt, roles.readonly], [resolutionProposal, roles.writable]])]);
  await send("donation after resolution before claim", traders[0], [transferLamportsIx(traders[0], vault, 13n)]);

  const claimAccounts = (index: number): NamedAccounts => [[traders[index], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[index], roles.writable]];
  await send("account substitution at claim rejected", traders[0], [makeIx("claim_fixed_payout", {}, [[traders[0], roles.writableSigner], [market, roles.readonly], [authorityConfig, roles.writable], [positions[0], roles.writable]])], true);
  await send("reconcile losing NO before winning claims", admin, [makeIx("reconcile_position", {}, [[market, roles.readonly], [vault, roles.writable], [positions[1], roles.writable]])]);
  await send("claim honest YES", traders[0], [makeIx("claim_fixed_payout", {}, claimAccounts(0))]);
  await send("claim succeeds before surplus reconciliation", traders[0], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)]);
  await send("block double claim", traders[0], [makeIx("claim_fixed_payout", {}, claimAccounts(0))], true);
  await send("claim synchronized YES", traders[3], [makeIx("claim_fixed_payout", {}, claimAccounts(3))]);
  await send("refunded position unclaimable", traders[2], [makeIx("claim_fixed_payout", {}, claimAccounts(2))], true);

  const reconciled = decodeVault();
  assert.equal(bnToBigInt(field(reconciled, "free_collateral", "freeCollateral")), 199_799_465n);
  assert.equal(bnToBigInt(field(reconciled, "reserved_liability", "reservedLiability")), 0n);
  assert.equal(bnToBigInt(field(reconciled, "accepted_stake_principal", "acceptedStakePrincipal")), 0n);
  assert.equal(bnToBigInt(field(reconciled, "lifetime_payouts", "lifetimePayouts")), 30_200_572n);
  assert.equal(bnToBigInt(field(reconciled, "lifetime_refunds", "lifetimeRefunds")), 10_000_000n);
  assert.equal(bnToBigInt(field(reconciled, "lifetime_losing_stakes", "lifetimeLosingStakes")), 10_000_000n);

  for (const index of [0, 1, 3]) {
    const account = svm.getAccount(kitAddress(positions[index]));
    assert(account, `position ${index} missing before close`);
    const before = svm.getBalance(kitAddress(traders[index]))!;
    await send(`close position ${index}`, traders[index], [makeIx("close_fixed_payout_position", {}, [[traders[index], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[index], roles.writable]])]);
    const after = svm.getBalance(kitAddress(traders[index]))!;
    assert.equal(after - before, account.lamports - FEE, `position ${index} rent did not return exactly`);
    assert.equal(svm.getAccount(kitAddress(positions[index]))?.exists, false, `position ${index} still exists`);
    rentReturns.push({ position: positions[index].toBase58(), lamports: account.lamports.toString() });
  }

  const beforeDeficit = svm.getAccount(kitAddress(vault));
  assert(beforeDeficit, "vault missing before deficit simulation");
  svm.setAccount({ ...beforeDeficit, lamports: lamports(beforeDeficit.lamports - 1n) });
  await send("one lamport deficit fails closed", traders[0], [makeIx("reconcile_vault_surplus", {}, reconcileSurplusAccounts)], true);
  svm.setAccount(beforeDeficit);

  const beforeWithdrawal = decodeVault();
  const free = bnToBigInt(field(beforeWithdrawal, "free_collateral", "freeCollateral"));
  await send("withdraw all free collateral", operator, [makeIx("withdraw_free_liquidity", { amount: new BN(free.toString()) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable]])]);
  const finalVault = decodeVault();
  assert.equal(bnToBigInt(field(finalVault, "free_collateral", "freeCollateral")), 0n);
  assert.equal(bnToBigInt(field(finalVault, "position_count", "positionCount")), 0n);
  const vaultAccount = svm.getAccount(kitAddress(vault))!;
  assert.equal(vaultAccount.lamports, svm.minimumBalanceForRentExemption(vaultAccount.space), "vault retains exactly rent and no user funds");

  console.log(JSON.stringify({
    mode: "LiteSVM exact-binary lifecycle; public no-op bootstrap signer only during initialization, signature verification enabled thereafter",
    cryptographicLocalTestSignaturesCreated: true,
    externalTransactionsSent: false,
    programId: V4_PROGRAM.toBase58(), fixtureId: fixture.fixtureId,
    checks: {
      funded: true, preGoalQuoteCpiVerified: true, honestYesAccepted: true, honestNoAccepted: true,
      goal739Ingested: true, staleBotAtomicallyRefunded: true, postGoalQuoteCpiVerified: true,
      synchronizedTradeAccepted: true, final1114CpiVerified: true, twoOfThreeApproved: true,
      fixedPayoutsClaimed: "30200572", losingStakeReconciled: "10000000", refundedPositionUnclaimable: true,
      doubleClaimBlocked: true, unsafeWithdrawalBlocked: true, donationSurplusReconciled: "37",
      deficitFailedClosed: true, bootstrapTakeoverBlocked: true, canonicalIdentityBound: true,
      u64MaxDirectTransferFailedAtomically: true,
      finalSequenceAndTimestampBound: true, orderIdReuseBlockedByPersistentNonce: true,
      allPositionsClosed: true,
      operatorFreeCollateralBeforeWithdrawal: free.toString(), vaultSpendableAfterWithdrawal: "0",
    },
    rentReturns,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
