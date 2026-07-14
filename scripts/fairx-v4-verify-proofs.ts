import { BorshInstructionCoder, BN, type Idl } from "@anchor-lang/core";
import { ComputeBudgetProgram, Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import fixture from "../fixtures/txline/v4-france-morocco-lifecycle.json";
import txlineIdl from "../lib/txline/official/txoracle.devnet.json";

const RPC = process.env.TXLINE_RPC_URL ?? "https://api.devnet.solana.com";
const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
// This public key is used only as the unsigned simulation fee-payer account.
const SIMULATION_PAYER = new PublicKey("ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq");

type ProofNode = { hash: number[]; isRightSibling: boolean };

const snakeProof = (nodes: ProofNode[]) => nodes.map((node) => ({
  hash: node.hash,
  is_right_sibling: node.isRightSibling,
}));

function oddsArgs(record: typeof fixture.preGoalOddsValidation) {
  const source = record.odds;
  return {
    ts: new BN(source.Ts),
    odds_snapshot: {
      fixture_id: new BN(source.FixtureId),
      message_id: source.MessageId,
      ts: new BN(source.Ts),
      bookmaker: source.Bookmaker,
      bookmaker_id: source.BookmakerId,
      super_odds_type: source.SuperOddsType,
      game_state: source.GameState,
      in_running: source.InRunning,
      market_parameters: source.MarketParameters,
      market_period: source.MarketPeriod,
      price_names: source.PriceNames,
      prices: source.Prices,
    },
    summary: {
      fixture_id: new BN(record.summary.fixtureId),
      update_stats: {
        update_count: record.summary.updateStats.updateCount,
        min_timestamp: new BN(record.summary.updateStats.minTimestamp),
        max_timestamp: new BN(record.summary.updateStats.maxTimestamp),
      },
      odds_sub_tree_root: record.summary.oddsSubTreeRoot,
    },
    sub_tree_proof: snakeProof(record.subTreeProof),
    main_tree_proof: snakeProof(record.mainTreeProof),
  };
}

function resolutionArgs() {
  const source = fixture.finalStatValidation;
  const payload = {
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
    fixture_proof: snakeProof(source.subTreeProof),
    main_tree_proof: snakeProof(source.mainTreeProof),
    event_stat_root: source.eventStatRoot,
    stats: source.statsToProve.map((stat, index) => ({
      stat,
      stat_proof: snakeProof(source.statProofs[index]),
    })),
  };
  const strategy = {
    geometric_targets: [],
    distance_predicate: null,
    discrete_predicates: source.statsToProve.map((stat, index) => ({
      Single: {
        index,
        predicate: { threshold: stat.value, comparison: { EqualTo: {} } },
      },
    })),
  };
  return { payload, strategy };
}

async function simulateView(
  connection: Connection,
  coder: BorshInstructionCoder,
  method: "validate_odds" | "validate_stat_v2",
  root: PublicKey,
  args: object,
) {
  const rootAccount = await connection.getAccountInfo(root, "confirmed");
  if (!rootAccount || !rootAccount.owner.equals(TXLINE_PROGRAM)) {
    throw new Error(`${method}: canonical TxLINE root is missing or has the wrong owner`);
  }
  const data = coder.encode(method, args);
  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    new TransactionInstruction({
      programId: TXLINE_PROGRAM,
      keys: [{ pubkey: root, isSigner: false, isWritable: false }],
      data,
    }),
  );
  transaction.feePayer = SIMULATION_PAYER;
  transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  const wire = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: method,
      method: "simulateTransaction",
      params: [wire.toString("base64"), { encoding: "base64", commitment: "confirmed", sigVerify: false }],
    }),
  });
  const json = await response.json() as {
    error?: { message: string };
    result?: { value?: { err: unknown; logs?: string[]; returnData?: { programId: string; data: [string, string] } } };
  };
  if (json.error) throw new Error(`${method}: RPC ${json.error.message}`);
  const value = json.result?.value;
  if (!value || value.err) throw new Error(`${method}: simulation failed: ${JSON.stringify(value?.err)}`);
  const returned = value.returnData;
  if (!returned || returned.programId !== TXLINE_PROGRAM.toBase58() || Buffer.from(returned.data[0], "base64").toString("hex") !== "01") {
    throw new Error(`${method}: TxLINE did not return true`);
  }
  return { method, root: root.toBase58(), computeLog: value.logs?.find((line) => line.includes("consumed")) ?? null, returnedTrue: true };
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const coder = new BorshInstructionCoder(txlineIdl as Idl);
  const oddsRoot = new PublicKey(fixture.oddsRootPda);
  const scoresRoot = new PublicKey(fixture.scoresRootPda);
  const [preGoalOdds, postGoalOdds, finalResult] = await Promise.all([
    simulateView(connection, coder, "validate_odds", oddsRoot, oddsArgs(fixture.preGoalOddsValidation)),
    simulateView(connection, coder, "validate_odds", oddsRoot, oddsArgs(fixture.postGoalOddsValidation)),
    simulateView(connection, coder, "validate_stat_v2", scoresRoot, resolutionArgs()),
  ]);
  console.log(JSON.stringify({
    mode: "unsigned read-only RPC simulation",
    sentTransaction: false,
    signedTransaction: false,
    fixtureId: fixture.fixtureId,
    preGoalOdds,
    postGoalOdds,
    finalResult: { ...finalResult, sequence: fixture.finalSequence, score: fixture.finalResult },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
