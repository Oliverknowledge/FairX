import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as anchor from "@anchor-lang/core";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey } from "@solana/web3.js";
import txoracleIdl from "../lib/txline/official/txoracle.devnet.json";
import { canonicalize } from "../lib/receipts/create";
import { hashRawEvent } from "../lib/proof/eventHash";
import type { TxlineValidationRecord } from "../lib/txline/validation";

const CAPTURE_PATH = resolve(process.env.TXLINE_CAPTURE_PATH ?? "fixtures/txline/canonical.json");
const OUTPUT_PATH = resolve(process.env.TXLINE_VALIDATION_PATH ?? "fixtures/txline/canonical.validation.json");
const ORIGIN = process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com";
const RPC = process.env.TXLINE_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function proofNodes(value: unknown): Array<{ hash: number[]; isRightSibling: boolean }> {
  if (!Array.isArray(value)) throw new Error("TxLINE proof nodes were malformed");
  return value.map((node) => {
    if (typeof node !== "object" || node === null) throw new Error("TxLINE proof node was malformed");
    const record = node as { hash?: unknown; isRightSibling?: unknown };
    if (!Array.isArray(record.hash) || record.hash.length !== 32 || typeof record.isRightSibling !== "boolean") {
      throw new Error("TxLINE proof node was malformed");
    }
    return { hash: record.hash.map(Number), isRightSibling: record.isRightSibling };
  });
}

async function main() {
  const capture = JSON.parse(await readFile(CAPTURE_PATH, "utf8"));
  if (capture.network !== "devnet" || capture.programId !== PROGRAM_ID) {
    throw new Error("Canonical capture is not aligned with the official TxLINE devnet program");
  }
  const fixtureId = String(capture.fixtureId);
  const seq = Number(capture.normalizedEvent?.seq);
  if (!Number.isSafeInteger(seq) || seq < 1) throw new Error("Canonical capture has no genuine positive TxLINE sequence");
  const statKeys = [1, 2];
  const query = new URLSearchParams({ fixtureId, seq: String(seq), statKeys: statKeys.join(",") });
  const response = await fetch(`${ORIGIN}/api/scores/stat-validation?${query}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${required("TXLINE_JWT")}`,
      "X-Api-Token": required("TXLINE_API_TOKEN"),
    },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`TxLINE stat-validation failed with HTTP ${response.status}`);
  const validation = JSON.parse(body);
  const fetchedAt = new Date().toISOString();
  if (String(validation.summary?.fixtureId) !== fixtureId) throw new Error("Validation fixture ID mismatch");
  if (!Array.isArray(validation.statsToProve) || validation.statsToProve.length !== statKeys.length) {
    throw new Error("Validation response did not cover both requested stats");
  }

  const secret = JSON.parse(required("LINEGUARD_OPERATOR_KEYPAIR"));
  const operator = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(operator), { commitment: "confirmed" });
  const program = new anchor.Program(txoracleIdl as anchor.Idl, provider);
  if (program.programId.toBase58() !== PROGRAM_ID) throw new Error("Official devnet IDL program ID mismatch");

  const targetTs = Number(validation.summary.updateStats.minTimestamp);
  const epochDay = Math.floor(targetTs / 86_400_000);
  if (!Number.isSafeInteger(epochDay) || epochDay < 0 || epochDay > 0xffff) throw new Error("Invalid proof epoch day");
  const [dailyScoresRootPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new anchor.BN(epochDay).toArrayLike(Buffer, "le", 2)],
    program.programId,
  );
  const rootAccount = await connection.getAccountInfo(dailyScoresRootPda, "confirmed");
  if (!rootAccount || !rootAccount.owner.equals(program.programId)) throw new Error("TxLINE daily scores root PDA is unavailable or has the wrong owner");

  const payload = {
    ts: new anchor.BN(targetTs),
    fixtureSummary: {
      fixtureId: new anchor.BN(validation.summary.fixtureId),
      updateStats: {
        updateCount: validation.summary.updateStats.updateCount,
        minTimestamp: new anchor.BN(validation.summary.updateStats.minTimestamp),
        maxTimestamp: new anchor.BN(validation.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: Array.from(validation.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: proofNodes(validation.subTreeProof),
    mainTreeProof: proofNodes(validation.mainTreeProof),
    eventStatRoot: Array.from(validation.eventStatRoot),
    stats: validation.statsToProve.map((stat: unknown, index: number) => ({
      stat,
      statProof: proofNodes(validation.statProofs[index]),
    })),
  };
  const strategy = {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: validation.statsToProve.map((stat: { value: number }, index: number) => ({
      single: { index, predicate: { threshold: stat.value, comparison: { equalTo: {} } } },
    })),
  };
  const computeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  const simulationPassed = await program.methods
    .validateStatV2(payload, strategy)
    .accounts({ dailyScoresMerkleRoots: dailyScoresRootPda })
    .preInstructions([computeBudget])
    .view();
  if (simulationPassed !== true) throw new Error("TxLINE validateStatV2 returned false");

  const record: TxlineValidationRecord = {
    version: 1,
    source: "txline",
    network: "devnet",
    programId: PROGRAM_ID,
    method: "validateStatV2",
    endpoint: "/api/scores/stat-validation",
    fixtureId,
    seq,
    statKeys,
    fetchedAt,
    validationPayload: validation,
    validationPayloadHash: hashRawEvent(validation),
    dailyScoresRootPda: dailyScoresRootPda.toBase58(),
    dailyScoresRootAccountHash: createHash("sha256").update(rootAccount.data).digest("hex"),
    rootEpochDay: epochDay,
    simulationPassed: true,
    validatedAt: new Date().toISOString(),
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${canonicalize(record)}\n`, { encoding: "utf8", mode: 0o644 });
  console.log(JSON.stringify({
    validationPassed: true,
    method: record.method,
    fixtureId,
    seq,
    statKeys,
    dailyScoresRootPda: record.dailyScoresRootPda,
    validationPayloadHash: record.validationPayloadHash,
    record: OUTPUT_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(`TxLINE validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
