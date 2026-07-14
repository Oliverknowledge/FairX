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
  createTransactionMessage,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM, TransactionMetadata } from "litesvm";
import fixture from "../fixtures/txline/v4-france-morocco-lifecycle.json";
import pinned from "../fixtures/txline/v4-pinned-artifacts.json";

const V4_PROGRAM = new PublicKey("79fk2aNCbnGD9WSbMRfHK5KNqRKFwULeiyAPYcV17zyG");
const TXLINE_PROGRAM = new PublicKey(pinned.txlineProgramId);
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
const COMPUTE_BUDGET_PROGRAM = address("ComputeBudget111111111111111111111111111111");
const STAKE = 10_000_000n;
type ProofNode = { hash: number[]; isRightSibling: boolean };
type NamedAccounts = Array<[PublicKey, AccountRole]>;
const roles = {
  readonly: AccountRole.READONLY,
  writable: AccountRole.WRITABLE,
  signer: AccountRole.READONLY_SIGNER,
  writableSigner: AccountRole.WRITABLE_SIGNER,
} as const;
const bytes32 = (label: string): number[] => [...createHash("sha256").update(label).digest()];
const u64le = (value: bigint) => { const buffer = Buffer.alloc(8); buffer.writeBigUInt64LE(value); return buffer; };
const kitAddress = (key: PublicKey): Address => address(key.toBase58());
const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, V4_PROGRAM)[0];
const proofNodes = (nodes: ProofNode[]) => nodes.map((node) => ({ hash: node.hash, is_right_sibling: node.isRightSibling }));
const testSigner = (byte: number) => createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(32).fill(byte), true);
const field = <T>(record: Record<string, unknown>, snake: string, camel: string): T => {
  const value = record[snake] ?? record[camel];
  if (value === undefined) throw new Error(`missing ${snake}`);
  return value as T;
};
const asBigInt = (value: unknown) => BigInt((value as { toString(): string }).toString());

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
    fixture_proof: proofNodes(source.subTreeProof), main_tree_proof: proofNodes(source.mainTreeProof),
    event_stat_root: source.eventStatRoot,
    stats: source.statsToProve.map((stat, index) => ({ stat, stat_proof: proofNodes(source.statProofs[index]) })),
  };
}

async function main() {
  const idl = JSON.parse(await readFile("target/idl/fairx_vault_v4.json", "utf8")) as Idl;
  const instructionCoder = new BorshInstructionCoder(idl);
  const accountCoder = new BorshAccountsCoder(idl);
  const svm = new LiteSVM().withSigverify(true).withTransactionHistory(0n);
  svm.addProgramFromFile(kitAddress(V4_PROGRAM), "target/deploy/fairx_vault_v4.so");
  const txlineBytes = await readFile(pinned.txlineProgram.path);
  assert.equal(createHash("sha256").update(txlineBytes).digest("hex"), pinned.txlineProgram.sha256);
  svm.addProgramFromFile(kitAddress(TXLINE_PROGRAM), pinned.txlineProgram.path);
  for (const root of [pinned.oddsRoot, pinned.scoresRoot]) {
    const raw = await readFile(root.path);
    assert.equal(createHash("sha256").update(raw).digest("hex"), root.fileSha256);
    const captured = JSON.parse(raw.toString("utf8")) as { pubkey: string; account: { data: [string, string]; executable: boolean; lamports: number; owner: string; space: number } };
    const data = Buffer.from(captured.account.data[0], "base64");
    assert.equal(captured.pubkey, root.pda);
    assert.equal(captured.account.owner, root.owner);
    assert.equal(createHash("sha256").update(data).digest("hex"), root.dataSha256);
    svm.setAccount({ address: address(root.pda), data, executable: captured.account.executable, lamports: lamports(BigInt(captured.account.lamports)), programAddress: address(root.owner), space: BigInt(captured.account.space) });
  }

  const signerList: KeyPairSigner[] = [];
  for (let byte = 7; byte <= 15; byte += 1) signerList.push(await testSigner(byte));
  const [adminSigner, operatorSigner, feedSigner, pricingSigner, resolutionASigner, resolutionBSigner, resolutionCSigner, traderASigner, traderBSigner] = signerList;
  const admin = new PublicKey(adminSigner.address);
  const operator = new PublicKey(operatorSigner.address);
  const feed = new PublicKey(feedSigner.address);
  const pricing = new PublicKey(pricingSigner.address);
  const resolution = [resolutionASigner, resolutionBSigner, resolutionCSigner].map((signer) => new PublicKey(signer.address));
  const traders = [new PublicKey(traderASigner.address), new PublicKey(traderBSigner.address)];
  const signerByAddress = new Map(signerList.map((signer) => [signer.address, signer]));
  for (const signer of signerList) svm.airdrop(signer.address, lamports(2_000_000_000n));

  const marketId = Buffer.from(bytes32("fairx-v4-france-morocco"));
  const authorityConfig = pda(Buffer.from("authority-config-v4"));
  const market = pda(Buffer.from("market-v4"), marketId);
  const vault = pda(Buffer.from("liquidity-vault-v4"), market.toBuffer());
  const quoteReceipt = pda(Buffer.from("quote-proof-v4"), market.toBuffer(), u64le(1n));
  const positionIds = [Buffer.from(bytes32("void-yes")), Buffer.from(bytes32("void-no"))];
  const positions = traders.map((trader, index) => pda(Buffer.from("position-v4"), market.toBuffer(), trader.toBuffer(), positionIds[index], u64le(BigInt(index))));
  const resolutionReceipt = pda(Buffer.from("resolution-proof-v4"), market.toBuffer());
  const resolutionProposal = pda(Buffer.from("resolution-proposal-v4"), market.toBuffer());
  const system = [SYSTEM_PROGRAM, roles.readonly] as [PublicKey, AccountRole];
  const computeIx: Instruction = { programAddress: COMPUTE_BUDGET_PROGRAM, data: Uint8Array.of(2, 0xc0, 0x5c, 0x15, 0) };
  const makeIx = (name: string, args: object, accounts: NamedAccounts): Instruction => ({
    programAddress: kitAddress(V4_PROGRAM), accounts: accounts.map(([key, role]) => ({ address: kitAddress(key), role })),
    data: new Uint8Array(instructionCoder.encode(name, args)),
  });
  const send = async (label: string, payer: PublicKey, instructions: Instruction[], expectFailure = false) => {
    const payerSigner = signerByAddress.get(kitAddress(payer));
    assert(payerSigner);
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payerSigner, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: svm.latestBlockhash(), lastValidBlockHeight: 999_999n }, tx),
      (tx) => appendTransactionMessageInstructions(instructions.map((ix) => addSignersToInstruction(signerList, ix)), tx),
    );
    const result = svm.sendTransaction(await signTransactionMessageWithSigners(message));
    if (expectFailure) {
      assert(result instanceof FailedTransactionMetadata, `${label} unexpectedly succeeded`);
      return;
    }
    if (result instanceof FailedTransactionMetadata) throw new Error(`${label}: ${result.err()}\n${result.meta().prettyLogs()}`);
    assert(result instanceof TransactionMetadata);
  };

  const initArgs = {
    market_id: [...marketId], fixture_id: new BN(fixture.fixtureId), fixture_hash: bytes32(String(fixture.fixtureId)),
    home_team_hash: bytes32("France"), away_team_hash: bytes32("Morocco"), home_participant_id: new BN(1999),
    away_participant_id: new BN(2530), home_participant_is_home: true,
    regulation_template_hash: bytes32("txline:1X2_PARTICIPANT_RESULT:part1-home-france-1999:draw:part2-away-morocco-2530:period-100:keys-1001,1002,3001,3002"),
    initial_material_event_sequence: new BN(738), operator, feed_authority: feed, pricing_authority: pricing,
    resolution_authorities: resolution, resolution_threshold: 2,
  };
  await send("initialize", admin, [makeIx("initialize_market_v4", { args: initArgs }, [[admin, roles.writableSigner], [authorityConfig, roles.writable], [market, roles.writable], system])]);
  await send("initialize vault", operator, [makeIx("initialize_liquidity_vault", { min_stake_lamports: new BN(1_000_000), max_stake_lamports: new BN(100_000_000) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable], system])]);
  await send("deposit", operator, [makeIx("deposit_liquidity", { amount: new BN(200_000_000) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable], system])]);
  const quote = { args: { quote_sequence: new BN(1), material_event_sequence: new BN(738), spread_micros: new BN(10_000), odds: odds(fixture.preGoalOddsValidation) } };
  await send("commit quote", pricing, [makeIx("commit_txline_quote", quote, [[pricing, roles.signer], [authorityConfig, roles.readonly], [market, roles.writable]])]);
  const verify = { args: { quote_sequence: new BN(1), odds: odds(fixture.preGoalOddsValidation), summary: oddsSummary(fixture.preGoalOddsValidation), sub_tree_proof: proofNodes(fixture.preGoalOddsValidation.subTreeProof), main_tree_proof: proofNodes(fixture.preGoalOddsValidation.mainTreeProof) } };
  await send("verify quote", admin, [computeIx, makeIx("verify_txline_quote", verify, [[admin, roles.writableSigner], [market, roles.writable], [new PublicKey(pinned.oddsRoot.pda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [quoteReceipt, roles.writable], system])]);
  const encodedQuote = instructionCoder.encode("commit_txline_quote", quote);
  const quoteHash = [...createHash("sha256").update(encodedQuote.subarray(32)).digest()];
  for (const [index, side, price] of [[0, 0, 532_785], [1, 1, 487_215]] as const) {
    await send(`accept ${index}`, traders[index], [makeIx("place_fixed_payout_order", { args: {
      client_order_id: [...positionIds[index]], order_nonce: new BN(index), side, stake_lamports: new BN(STAKE.toString()),
      expected_quote_sequence: new BN(1), expected_quote_payload_hash: quoteHash, expected_execution_price_micros: new BN(price),
      expected_material_event_sequence: new BN(738), expiry_slot: new BN((svm.getClock().slot + 10_000n).toString()),
    } }, [[traders[index], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[index], roles.writable], system])]);
  }

  const voidAccounts: NamedAccounts = [[resolution[0], roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.writable], [resolutionReceipt, roles.readonly], [resolutionProposal, roles.writable], system];
  await send("premature void rejected", resolution[0], [makeIx("propose_void_v4", { reason_code: 1 }, voidAccounts)], true);
  const afterGrace = svm.getClock();
  afterGrace.unixTimestamp = 1_783_638_389n;
  svm.setClock(afterGrace);
  await send("unknown reason rejected", resolution[0], [makeIx("propose_void_v4", { reason_code: 2 }, voidAccounts)], true);
  await send("propose void", resolution[0], [makeIx("propose_void_v4", { reason_code: 1 }, voidAccounts)]);
  const executeAccounts: NamedAccounts = [[authorityConfig, roles.readonly], [market, roles.writable], [resolutionProposal, roles.writable]];
  await send("one authority cannot execute void", admin, [makeIx("execute_void_v4", {}, executeAccounts)], true);
  await send("duplicate void approval rejected", resolution[0], [makeIx("approve_resolution_v4", {}, [[resolution[0], roles.signer], [authorityConfig, roles.readonly], [market, roles.readonly], [resolutionProposal, roles.writable]])], true);
  await send("second void approval", resolution[1], [makeIx("approve_resolution_v4", {}, [[resolution[1], roles.signer], [authorityConfig, roles.readonly], [market, roles.readonly], [resolutionProposal, roles.writable]])]);
  await send("execute void", admin, [makeIx("execute_void_v4", {}, executeAccounts)]);
  await send("result after void prohibited", resolution[0], [makeIx("prove_resolution_with_txline_v4", { args: { final_sequence: new BN(1114), payload: resolutionPayload() } }, [[resolution[0], roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.writable], [new PublicKey(pinned.scoresRoot.pda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [resolutionReceipt, roles.writable], [resolutionProposal, roles.writable], system])], true);

  const decodeVault = () => {
    const account = svm.getAccount(kitAddress(vault));
    assert(account);
    return accountCoder.decode("LiquidityVaultV4", Buffer.from(account.data)) as Record<string, unknown>;
  };
  const beforeRefunds = decodeVault();
  const freeBeforeRefunds = asBigInt(field(beforeRefunds, "free_collateral", "freeCollateral"));
  await send("operator cannot cross void obligations", operator, [makeIx("withdraw_free_liquidity", { amount: new BN((freeBeforeRefunds + 1n).toString()) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable]])], true);
  const refundAccounts = (index: number): NamedAccounts => [[traders[index], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[index], roles.writable]];
  const traderABefore = svm.getBalance(kitAddress(traders[0]))!;
  await send("refund first principal", traders[0], [makeIx("claim_void_refund", {}, refundAccounts(0))]);
  assert.equal(svm.getBalance(kitAddress(traders[0]))! - traderABefore, STAKE - 5_000n);
  await send("double void refund rejected", traders[0], [makeIx("claim_void_refund", {}, refundAccounts(0))], true);
  const afterFirst = decodeVault();
  const withdrawable = asBigInt(field(afterFirst, "free_collateral", "freeCollateral"));
  await send("withdraw only free collateral before remaining refund", operator, [makeIx("withdraw_free_liquidity", { amount: new BN(withdrawable.toString()) }, [[operator, roles.writableSigner], [authorityConfig, roles.readonly], [market, roles.readonly], [vault, roles.writable]])]);
  await send("refund second principal", traders[1], [makeIx("claim_void_refund", {}, refundAccounts(1))]);
  for (const index of [0, 1]) {
    await send(`close void position ${index}`, traders[index], [makeIx("close_fixed_payout_position", {}, [[traders[index], roles.writableSigner], [market, roles.readonly], [vault, roles.writable], [positions[index], roles.writable]])]);
  }
  const final = decodeVault();
  assert.equal(asBigInt(field(final, "reserved_liability", "reservedLiability")), 0n);
  assert.equal(asBigInt(field(final, "accepted_stake_principal", "acceptedStakePrincipal")), 0n);
  assert.equal(asBigInt(field(final, "pending_refundable_stake", "pendingRefundableStake")), 0n);
  assert.equal(asBigInt(field(final, "lifetime_refunds", "lifetimeRefunds")), 20_000_000n);
  assert.equal(asBigInt(field(final, "position_count", "positionCount")), 0n);

  const staleSvm = new LiteSVM().withSigverify(true).withTransactionHistory(0n);
  staleSvm.addProgramFromFile(kitAddress(V4_PROGRAM), "target/deploy/fairx_vault_v4.so");
  staleSvm.addProgramFromFile(kitAddress(TXLINE_PROGRAM), pinned.txlineProgram.path);
  for (const root of [pinned.oddsRoot, pinned.scoresRoot]) {
    const account = svm.getAccount(address(root.pda));
    assert(account);
    staleSvm.setAccount(account);
  }
  for (const signer of signerList) staleSvm.airdrop(signer.address, lamports(2_000_000_000n));
  const staleSend = async (label: string, payer: PublicKey, instructions: Instruction[], expectFailure = false) => {
    const payerSigner = signerByAddress.get(kitAddress(payer));
    assert(payerSigner);
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payerSigner, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: staleSvm.latestBlockhash(), lastValidBlockHeight: 999_999n }, tx),
      (tx) => appendTransactionMessageInstructions(instructions.map((ix) => addSignersToInstruction(signerList, ix)), tx),
    );
    const result = staleSvm.sendTransaction(await signTransactionMessageWithSigners(message));
    if (expectFailure) {
      assert(result instanceof FailedTransactionMetadata, `${label} unexpectedly succeeded`);
      return;
    }
    if (result instanceof FailedTransactionMetadata) throw new Error(`${label}: ${result.err()}\n${result.meta().prettyLogs()}`);
  };
  await staleSend("stale scenario initialize", admin, [makeIx("initialize_market_v4", { args: initArgs }, [[admin, roles.writableSigner], [authorityConfig, roles.writable], [market, roles.writable], system])]);
  await staleSend("stale scenario commit pre-event quote", pricing, [makeIx("commit_txline_quote", quote, [[pricing, roles.signer], [authorityConfig, roles.readonly], [market, roles.writable]])]);
  const eventIx = makeIx("ingest_material_event_v4", { sequence: new BN(739), source_ts: new BN(fixture.goal.ts), payload_hash: [...Buffer.from(fixture.goal.sourcePayloadSha256, "hex")] }, [[feed, roles.signer], [authorityConfig, roles.readonly], [market, roles.writable]]);
  await staleSend("event wins race", feed, [eventIx]);
  await staleSend("duplicate event rejected", feed, [eventIx], true);
  await staleSend("historical old quote proof remains valid", admin, [computeIx, makeIx("verify_txline_quote", verify, [[admin, roles.writableSigner], [market, roles.writable], [new PublicKey(pinned.oddsRoot.pda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [quoteReceipt, roles.writable], system])]);
  const staleMarketAccount = staleSvm.getAccount(kitAddress(market));
  const staleReceiptAccount = staleSvm.getAccount(kitAddress(quoteReceipt));
  assert(staleMarketAccount && staleReceiptAccount);
  const staleMarket = accountCoder.decode("MarketV4", Buffer.from(staleMarketAccount.data)) as Record<string, unknown>;
  const staleReceipt = accountCoder.decode("TxlineQuoteValidationReceiptV4", Buffer.from(staleReceiptAccount.data)) as Record<string, unknown>;
  assert.equal(field(staleMarket, "quote_verified", "quoteVerified"), false);
  assert.equal(field(staleReceipt, "direct_cpi_verified", "directCpiVerified"), true);
  assert.equal(field(staleReceipt, "currently_executable", "currentlyExecutable"), false);
  await staleSend("duplicate quote verification rejected", admin, [computeIx, makeIx("verify_txline_quote", verify, [[admin, roles.writableSigner], [market, roles.writable], [new PublicKey(pinned.oddsRoot.pda), roles.readonly], [TXLINE_PROGRAM, roles.readonly], [quoteReceipt, roles.writable], system])], true);

  console.log(JSON.stringify({
    mode: "signed LiteSVM VOID lifecycle",
    externalTransactionsSent: false,
    checks: {
      prematureVoidRejected: true, deterministicReasonEnforced: true, oneAuthorityRejected: true,
      duplicateApprovalRejected: true, twoOfThreeVoidExecuted: true, resultAfterVoidRejected: true,
      principalRefunded: "20000000", doubleRefundRejected: true, principalProtectedDuringWithdrawal: true,
      terminalPositionsClosed: true, staleHistoricalProofNotExecutable: true,
      duplicateQuoteVerificationRejected: true, duplicateEventRejected: true,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
