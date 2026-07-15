import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";

const RPC_URL = "https://api.devnet.solana.com";
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PROGRAM_ID = "2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p";
const PROGRAMDATA_ID = "9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V";
const BUFFER_ID = "BGB1ncPYwkJBjC1jSFo1tJ68wnaB6H9t3QfwfHhUteLM";
const AUTHORITY_ID = "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq";
const LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const RENT_SYSVAR_ID = new PublicKey("SysvarRent111111111111111111111111111111111");
const CLOCK_SYSVAR_ID = new PublicKey("SysvarC1ock11111111111111111111111111111111");
const BINARY_PATH = "target/deploy/fairx_vault_v4.so";
const BINARY_SHA256 = "7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0";
const PLAN_SHA256 = "4b21a9330dad47203433778b02fdd926a3a681e65b161f855917f95dcee61639";
const BINARY_SIZE = 422_040;
const BUFFER_METADATA_SIZE = 37;
const PROGRAM_ACCOUNT_SIZE = 36;
const CHUNK_SIZE = 1_012;
const MAXIMUM_ADDITIONAL_DEBIT = 3_241_440n;
const WRITE_PACING_MS = 1_500;

const program = new PublicKey(PROGRAM_ID);
const programData = new PublicKey(PROGRAMDATA_ID);
const buffer = new PublicKey(BUFFER_ID);
const authority = new PublicKey(AUTHORITY_ID);

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function loaderData(variant: number, trailingBytes = Buffer.alloc(0)): Buffer {
  const data = Buffer.alloc(4 + trailingBytes.length);
  data.writeUInt32LE(variant, 0);
  trailingBytes.copy(data, 4);
  return data;
}

function writeInstruction(offset: number, bytes: Uint8Array): TransactionInstruction {
  const args = Buffer.alloc(12 + bytes.length);
  args.writeUInt32LE(offset, 0);
  args.writeBigUInt64LE(BigInt(bytes.length), 4);
  Buffer.from(bytes).copy(args, 12);
  return new TransactionInstruction({
    programId: LOADER_ID,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: loaderData(1, args),
  });
}

function deployInstruction(): TransactionInstruction {
  const maxDataLen = Buffer.alloc(8);
  maxDataLen.writeBigUInt64LE(BigInt(BINARY_SIZE));
  const keys: AccountMeta[] = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: programData, isSigner: false, isWritable: true },
    { pubkey: program, isSigner: false, isWritable: true },
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_SYSVAR_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({ programId: LOADER_ID, keys, data: loaderData(2, maxDataLen) });
}

async function signerFromConfiguredPath(envName: string, expected: PublicKey): Promise<Keypair> {
  const signerPath = process.env[envName];
  assert(signerPath, `${envName} is not configured`);
  const encoded = JSON.parse(await readFile(signerPath, "utf8")) as number[];
  assert(Array.isArray(encoded) && encoded.length === 64, `${envName} is not a Solana keypair file`);
  const signer = Keypair.fromSecretKey(Uint8Array.from(encoded));
  assert(signer.publicKey.equals(expected), `${envName} public key differs from the approved identity`);
  return signer;
}

async function validateLiveState(connection: Connection, binary: Uint8Array, expectedBufferLamports: number) {
  const [programInfo, programDataInfo, bufferInfo] = await Promise.all([
    connection.getAccountInfo(program, "confirmed"),
    connection.getAccountInfo(programData, "confirmed"),
    connection.getAccountInfo(buffer, "confirmed"),
  ]);
  assert.equal(programInfo, null, "Program account unexpectedly exists");
  assert.equal(programDataInfo, null, "ProgramData account unexpectedly exists");
  assert(bufferInfo, "approved Buffer disappeared");
  assert(bufferInfo.owner.equals(LOADER_ID), "Buffer owner changed");
  assert.equal(bufferInfo.executable, false, "Buffer became executable");
  assert.equal(bufferInfo.lamports, expectedBufferLamports, "Buffer funding changed");
  assert.equal(bufferInfo.data.length, BUFFER_METADATA_SIZE + binary.length, "Buffer capacity changed");
  assert.equal(bufferInfo.data.readUInt32LE(0), 1, "account is no longer a loader Buffer");
  assert.equal(bufferInfo.data[4], 1, "Buffer authority was cleared");
  assert(bufferInfo.data.subarray(5, BUFFER_METADATA_SIZE).equals(authority.toBuffer()), "Buffer authority changed");
}

function instructionPlanHash(writes: TransactionInstruction[], finalInstructions: TransactionInstruction[]): string {
  const transactions = [
    ...writes.map((instruction, index) => ({
      className: "loader-write",
      index,
      requiredSigners: [AUTHORITY_ID],
      instructions: [instruction],
    })),
    { className: "program-deploy", index: 0, requiredSigners: [AUTHORITY_ID, PROGRAM_ID], instructions: finalInstructions },
  ];
  return hash(Buffer.from(JSON.stringify(transactions.map((transaction) => ({
    className: transaction.className,
    index: transaction.index,
    requiredSigners: transaction.requiredSigners,
    instructions: transaction.instructions.map((instruction) => ({
      programId: instruction.programId.toBase58(),
      keys: instruction.keys.map((meta) => ({
        pubkey: meta.pubkey.toBase58(),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      })),
      dataHex: Buffer.from(instruction.data).toString("hex"),
    })),
  })))));
}

async function sendAndConfirmOnce(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  className: "loader-write" | "program-deploy",
  index: number,
) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({ feePayer: signers[0].publicKey, recentBlockhash: latest.blockhash }).add(...instructions);
  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    maxRetries: 0,
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });
  const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  assert.equal(confirmation.value.err, null, `${className} ${index} failed: ${JSON.stringify(confirmation.value.err)}`);
  console.log(JSON.stringify({ className, index, signature, confirmed: true, confirmationContextSlot: confirmation.context.slot }));
  return { signature, slot: confirmation.context.slot };
}

async function main() {
  assert(process.argv.includes("--execute"), "refusing to sign without --execute");
  assert.equal(process.env.FAIRX_V4_APPROVED_PLAN_HASH, PLAN_SHA256, "approved plan hash environment guard differs");
  const connection = new Connection(RPC_URL, "confirmed");
  assert.equal(await connection.getGenesisHash(), DEVNET_GENESIS_HASH, "RPC is not Solana devnet");

  const binary = new Uint8Array(await readFile(BINARY_PATH));
  assert.equal(binary.length, BINARY_SIZE, "binary size changed");
  assert.equal(hash(binary), BINARY_SHA256, "binary hash changed");

  const payerSigner = await signerFromConfiguredPath("FAIRX_V4_AUTHORITY_SIGNER", authority);
  const programSigner = await signerFromConfiguredPath("FAIRX_V4_PROGRAM_SIGNER", program);
  const bufferRent = await connection.getMinimumBalanceForRentExemption(BUFFER_METADATA_SIZE + binary.length, "confirmed");
  const expectedBufferLamports = 2_938_602_480;
  assert(expectedBufferLamports >= bufferRent, "approved Buffer funding is no longer rent exempt");
  await validateLiveState(connection, binary, expectedBufferLamports);

  const writes: TransactionInstruction[] = [];
  for (let offset = 0; offset < binary.length; offset += CHUNK_SIZE) {
    writes.push(writeInstruction(offset, binary.slice(offset, Math.min(offset + CHUNK_SIZE, binary.length))));
  }
  assert.equal(writes.length, 418);
  const programRent = await connection.getMinimumBalanceForRentExemption(PROGRAM_ACCOUNT_SIZE, "confirmed");
  const finalInstructions = [
    SystemProgram.createAccount({
      fromPubkey: authority,
      newAccountPubkey: program,
      lamports: programRent,
      space: PROGRAM_ACCOUNT_SIZE,
      programId: LOADER_ID,
    }),
    deployInstruction(),
  ];
  assert.equal(instructionPlanHash(writes, finalInstructions), PLAN_SHA256, "instruction plan hash changed");

  const latest = await connection.getLatestBlockhash("confirmed");
  const representativeWrite = new Transaction({ feePayer: authority, recentBlockhash: latest.blockhash }).add(writes[0]);
  const representativeFinal = new Transaction({ feePayer: authority, recentBlockhash: latest.blockhash }).add(...finalInstructions);
  const [writeFeeResult, finalFeeResult, startingBalance] = await Promise.all([
    connection.getFeeForMessage(representativeWrite.compileMessage(), "confirmed"),
    connection.getFeeForMessage(representativeFinal.compileMessage(), "confirmed"),
    connection.getBalance(authority, "confirmed"),
  ]);
  assert.equal(writeFeeResult.value, 5_000, "write fee changed");
  assert.equal(finalFeeResult.value, 10_000, "final fee changed");
  const maximumDebit = BigInt(programRent) + BigInt(writes.length * writeFeeResult.value + finalFeeResult.value);
  assert.equal(maximumDebit, MAXIMUM_ADDITIONAL_DEBIT, "maximum additional debit changed");
  assert(BigInt(startingBalance) >= maximumDebit, "fee payer balance is insufficient");

  console.log(JSON.stringify({
    event: "preflight-passed",
    cluster: "devnet",
    programId: PROGRAM_ID,
    programData: PROGRAMDATA_ID,
    buffer: BUFFER_ID,
    authority: AUTHORITY_ID,
    binarySha256: BINARY_SHA256,
    instructionPlanSha256: PLAN_SHA256,
    transactions: writes.length + 1,
    maximumAdditionalDebitLamports: maximumDebit.toString(),
    startingBalanceLamports: startingBalance,
    priorityFeeLamports: 0,
  }));

  let lastWrite: { signature: string; slot: number } | null = null;
  for (let index = 0; index < writes.length; index += 1) {
    if (index > 0 && index % 25 === 0) {
      await validateLiveState(connection, binary, expectedBufferLamports);
      const balance = await connection.getBalance(authority, "confirmed");
      assert(BigInt(startingBalance - balance) <= maximumDebit, "approved debit ceiling exceeded during writes");
    }
    lastWrite = await sendAndConfirmOnce(connection, [writes[index]], [payerSigner], "loader-write", index);
    if (index + 1 < writes.length) await new Promise((resolve) => setTimeout(resolve, WRITE_PACING_MS));
  }

  await validateLiveState(connection, binary, expectedBufferLamports);
  const beforeFinalBalance = await connection.getBalance(authority, "confirmed");
  assert(BigInt(startingBalance - beforeFinalBalance) + BigInt(programRent + finalFeeResult.value) <= maximumDebit,
    "approved debit ceiling would be exceeded by final deployment");
  const deployment = await sendAndConfirmOnce(connection, finalInstructions, [payerSigner, programSigner], "program-deploy", 0);
  const finalBalance = await connection.getBalance(authority, "confirmed");
  assert(BigInt(startingBalance - finalBalance) <= maximumDebit, "approved debit ceiling exceeded");
  console.log(JSON.stringify({ event: "continuation-complete", lastWrite, deployment, finalBalanceLamports: finalBalance }));
}

main().catch((error) => {
  console.error(`STOPPED: ${error instanceof Error ? error.message : "unknown continuation failure"}`);
  process.exitCode = 1;
});
