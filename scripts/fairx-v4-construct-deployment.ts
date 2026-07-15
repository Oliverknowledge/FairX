import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { address, lamports } from "@solana/kit";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  type AccountMeta,
} from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM, TransactionMetadata } from "litesvm";
import { V4_BOOTSTRAP_ADMIN, V4_PROGRAM_ID } from "../lib/v4/program";

const RPC_URL = "https://api.devnet.solana.com";
const BUFFER_PUBLIC_KEY = "BGB1ncPYwkJBjC1jSFo1tJ68wnaB6H9t3QfwfHhUteLM";
const EXPECTED_SBF_SHA256 = "7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0";
const SBF_PATH = "target/deploy/fairx_vault_v4.so";
const LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const RENT_SYSVAR_ID = new PublicKey("SysvarRent111111111111111111111111111111111");
const CLOCK_SYSVAR_ID = new PublicKey("SysvarC1ock11111111111111111111111111111111");
const PACKET_DATA_SIZE = 1_232;
const PROGRAM_ACCOUNT_SIZE = 36;
const PROGRAMDATA_METADATA_SIZE = 45;
const BUFFER_METADATA_SIZE = 37;
const EXPECTED_BINARY_SIZE = 422_040;
const EXPECTED_CHUNK_SIZE = 1_012;
const EXPECTED_WRITE_COUNT = 418;
const EXPECTED_TRANSACTION_COUNT = 420;
const EXPECTED_INSTRUCTION_COUNT = 422;
const RESUME_EXISTING_BUFFER = process.argv.includes("--resume");

type ConstructedTransaction = {
  className: "buffer-create" | "loader-write" | "program-deploy";
  index: number;
  instructions: TransactionInstruction[];
  messageBytes: Uint8Array;
  requiredSigners: string[];
  wireSize: number;
  messageSha256: string;
  offset?: number;
  dataLength?: number;
};

const program = new PublicKey(V4_PROGRAM_ID);
const payer = new PublicKey(V4_BOOTSTRAP_ADMIN);
const buffer = new PublicKey(BUFFER_PUBLIC_KEY);
const programData = PublicKey.findProgramAddressSync([program.toBuffer()], LOADER_ID)[0];

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function loaderData(variant: number, trailingBytes = Buffer.alloc(0)): Buffer {
  const data = Buffer.alloc(4 + trailingBytes.length);
  data.writeUInt32LE(variant, 0);
  trailingBytes.copy(data, 4);
  return data;
}

function initializeBufferInstruction(): TransactionInstruction {
  return new TransactionInstruction({
    programId: LOADER_ID,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: false, isWritable: false },
    ],
    data: loaderData(0),
  });
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
      { pubkey: payer, isSigner: true, isWritable: false },
    ],
    data: loaderData(1, args),
  });
}

function deployInstruction(): TransactionInstruction {
  const maxDataLen = Buffer.alloc(8);
  maxDataLen.writeBigUInt64LE(BigInt(EXPECTED_BINARY_SIZE));
  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: programData, isSigner: false, isWritable: true },
    { pubkey: program, isSigner: false, isWritable: true },
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_SYSVAR_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({ programId: LOADER_ID, keys, data: loaderData(2, maxDataLen) });
}

function constructTransaction(
  className: ConstructedTransaction["className"],
  index: number,
  instructions: TransactionInstruction[],
  recentBlockhash: string,
  detail: { offset?: number; dataLength?: number } = {},
): ConstructedTransaction {
  const transaction = new Transaction({ feePayer: payer, recentBlockhash }).add(...instructions);
  const messageBytes = new Uint8Array(transaction.serializeMessage());
  const message = transaction.compileMessage();
  const requiredSigners = message.accountKeys
    .slice(0, message.header.numRequiredSignatures)
    .map((key) => key.toBase58());
  const wireSize = 1 + requiredSigners.length * 64 + messageBytes.length;
  assert(wireSize <= PACKET_DATA_SIZE, `${className} ${index} exceeds packet size: ${wireSize}`);
  return {
    className,
    index,
    instructions,
    messageBytes,
    requiredSigners,
    wireSize,
    messageSha256: sha256(messageBytes),
    ...detail,
  };
}

function unsignedTransaction(transaction: ConstructedTransaction) {
  return {
    messageBytes: transaction.messageBytes,
    signatures: Object.fromEntries(transaction.requiredSigners.map((signer) => [signer, new Uint8Array(64)])),
  };
}

function unsignedWireBytes(transaction: ConstructedTransaction): Buffer {
  return Buffer.concat([
    Buffer.from([transaction.requiredSigners.length]),
    ...transaction.requiredSigners.map(() => Buffer.alloc(64)),
    Buffer.from(transaction.messageBytes),
  ]);
}

async function simulateOnDevnet(transaction: ConstructedTransaction) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "simulateTransaction",
      params: [unsignedWireBytes(transaction).toString("base64"), {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: false,
        commitment: "confirmed",
      }],
    }),
  });
  assert(response.ok, `devnet simulation HTTP ${response.status}`);
  const payload = await response.json() as {
    error?: { code?: number; message?: string };
    result?: { context?: { slot?: number }; value?: { err: unknown; unitsConsumed?: number } };
  };
  assert(!payload.error, `devnet simulation RPC error ${payload.error?.code ?? "unknown"}`);
  assert(payload.result?.value, "devnet simulation returned no value");
  assert.equal(payload.result.value.err, null, `devnet ${transaction.className} simulation failed`);
  return { slot: payload.result.context?.slot ?? null, unitsConsumed: payload.result.value.unitsConsumed ?? null };
}

function assertMeta(
  instruction: TransactionInstruction,
  expectedProgram: PublicKey,
  expectedKeys: Array<[PublicKey, boolean, boolean]>,
) {
  assert(instruction.programId.equals(expectedProgram));
  assert.equal(instruction.keys.length, expectedKeys.length);
  instruction.keys.forEach((meta, index) => {
    const [key, signer, writable] = expectedKeys[index];
    assert(meta.pubkey.equals(key));
    assert.equal(meta.isSigner, signer);
    assert.equal(meta.isWritable, writable);
  });
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const binary = new Uint8Array(await readFile(SBF_PATH));
  assert.equal(binary.length, EXPECTED_BINARY_SIZE);
  assert.equal(sha256(binary), EXPECTED_SBF_SHA256);

  const [programInfo, bufferInfo, payerBalance, programRent, programDataRent, bufferRent, latest, slot] = await Promise.all([
    connection.getAccountInfo(program, "confirmed"),
    connection.getAccountInfo(buffer, "confirmed"),
    connection.getBalance(payer, "confirmed"),
    connection.getMinimumBalanceForRentExemption(PROGRAM_ACCOUNT_SIZE, "confirmed"),
    connection.getMinimumBalanceForRentExemption(PROGRAMDATA_METADATA_SIZE + binary.length, "confirmed"),
    connection.getMinimumBalanceForRentExemption(BUFFER_METADATA_SIZE + binary.length, "confirmed"),
    connection.getLatestBlockhash("confirmed"),
    connection.getSlot("confirmed"),
  ]);
  assert.equal(programInfo, null, "approved Program ID already exists on devnet");
  if (RESUME_EXISTING_BUFFER) {
    assert(bufferInfo, "approved Buffer account does not exist on devnet");
    assert(bufferInfo.owner.equals(LOADER_ID), "approved Buffer has the wrong owner");
    assert.equal(bufferInfo.executable, false, "approved Buffer is unexpectedly executable");
    assert.equal(bufferInfo.data.length, BUFFER_METADATA_SIZE + binary.length, "approved Buffer has the wrong size");
    assert.equal(bufferInfo.data.readUInt32LE(0), 1, "approved account is not a loader Buffer");
    assert.equal(bufferInfo.data[4], 1, "approved Buffer has no authority");
    assert(bufferInfo.data.subarray(5, BUFFER_METADATA_SIZE).equals(payer.toBuffer()), "approved Buffer authority changed");
    assert(bufferInfo.lamports >= programDataRent, "approved Buffer is underfunded");
  } else {
    assert.equal(bufferInfo, null, "approved Buffer account already exists on devnet");
  }

  const oneSignatureMessage = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latest.blockhash,
    instructions: [],
  }).compileToLegacyMessage();
  const twoSignatureMessage = new TransactionMessage({
    payerKey: buffer,
    recentBlockhash: latest.blockhash,
    instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: program, lamports: 1 })],
  }).compileToLegacyMessage();
  const [oneSignatureFee, twoSignatureFee] = await Promise.all([
    connection.getFeeForMessage(oneSignatureMessage, "confirmed"),
    connection.getFeeForMessage(twoSignatureMessage, "confirmed"),
  ]);
  assert.equal(oneSignatureFee.value, 5_000);
  assert.equal(twoSignatureFee.value, 10_000);

  const baselineWrite = constructTransaction("loader-write", 0, [writeInstruction(0, new Uint8Array())], latest.blockhash);
  const chunkSize = PACKET_DATA_SIZE - baselineWrite.wireSize - 1;
  assert.equal(chunkSize, EXPECTED_CHUNK_SIZE);

  const initialInstructions = [
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: buffer,
      lamports: programDataRent,
      space: BUFFER_METADATA_SIZE + binary.length,
      programId: LOADER_ID,
    }),
    initializeBufferInstruction(),
  ];
  const initial = constructTransaction("buffer-create", 0, initialInstructions, latest.blockhash);
  assert.deepEqual(initial.requiredSigners, [payer.toBase58(), buffer.toBase58()]);
  assertMeta(initialInstructions[1], LOADER_ID, [[buffer, false, true], [payer, false, false]]);

  const writes: ConstructedTransaction[] = [];
  for (let offset = 0, index = 0; offset < binary.length; offset += chunkSize, index += 1) {
    const bytes = binary.slice(offset, Math.min(offset + chunkSize, binary.length));
    const instruction = writeInstruction(offset, bytes);
    assertMeta(instruction, LOADER_ID, [[buffer, false, true], [payer, true, false]]);
    writes.push(constructTransaction("loader-write", index, [instruction], latest.blockhash, {
      offset,
      dataLength: bytes.length,
    }));
  }
  assert.equal(writes.length, EXPECTED_WRITE_COUNT);
  assert(writes.every((write) => write.requiredSigners.length === 1 && write.requiredSigners[0] === payer.toBase58()));

  const finalInstructions = [
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: program,
      lamports: programRent,
      space: PROGRAM_ACCOUNT_SIZE,
      programId: LOADER_ID,
    }),
    deployInstruction(),
  ];
  const final = constructTransaction("program-deploy", 0, finalInstructions, latest.blockhash);
  assert.deepEqual(final.requiredSigners, [payer.toBase58(), program.toBase58()]);
  assertMeta(finalInstructions[1], LOADER_ID, [
    [payer, true, true], [programData, false, true], [program, false, true], [buffer, false, true],
    [RENT_SYSVAR_ID, false, false], [CLOCK_SYSVAR_ID, false, false], [SystemProgram.programId, false, false],
    [payer, true, false],
  ]);

  const transactions = RESUME_EXISTING_BUFFER ? [...writes, final] : [initial, ...writes, final];
  const expectedTransactionCount = RESUME_EXISTING_BUFFER ? EXPECTED_TRANSACTION_COUNT - 1 : EXPECTED_TRANSACTION_COUNT;
  const expectedInstructionCount = RESUME_EXISTING_BUFFER ? EXPECTED_INSTRUCTION_COUNT - 2 : EXPECTED_INSTRUCTION_COUNT;
  const expectedSignatureCount = RESUME_EXISTING_BUFFER ? 420 : 422;
  assert.equal(transactions.length, expectedTransactionCount);
  assert.equal(transactions.reduce((sum, transaction) => sum + transaction.instructions.length, 0), expectedInstructionCount);
  const signatureCount = transactions.reduce((sum, transaction) => sum + transaction.requiredSigners.length, 0);
  assert.equal(signatureCount, expectedSignatureCount);
  const instructionPlanSha256 = sha256(Buffer.from(JSON.stringify(transactions.map((transaction) => ({
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
  const feeBudget = signatureCount * oneSignatureFee.value!;
  const maximumLamportBudget = programRent + (RESUME_EXISTING_BUFFER ? 0 : programDataRent) + feeBudget;
  assert(payerBalance >= maximumLamportBudget * 2, "fee payer is not comfortably above the maximum budget");

  const devnetRepresentativeSimulation = await simulateOnDevnet(RESUME_EXISTING_BUFFER ? writes[0] : initial);

  const svm = new LiteSVM().withSigverify(false).withBlockhashCheck(false).withTransactionHistory(0n);
  svm.airdrop(address(payer.toBase58()), lamports(BigInt(payerBalance)));
  if (RESUME_EXISTING_BUFFER) {
    assert(bufferInfo);
    svm.setAccount({
      address: address(buffer.toBase58()),
      data: new Uint8Array(bufferInfo.data),
      executable: bufferInfo.executable,
      lamports: lamports(BigInt(bufferInfo.lamports)),
      programAddress: address(bufferInfo.owner.toBase58()),
      space: BigInt(bufferInfo.data.length),
    });
  }
  const computeUnits = { initial: null as bigint | null, writeMin: null as bigint | null, writeMax: 0n, final: 0n };
  for (const transaction of transactions) {
    const result = svm.sendTransaction(unsignedTransaction(transaction));
    if (result instanceof FailedTransactionMetadata) {
      throw new Error(`simulation failed for ${transaction.className} ${transaction.index}: ${String(result.err())}`);
    }
    assert(result instanceof TransactionMetadata);
    const units = result.computeUnitsConsumed();
    if (transaction.className === "buffer-create") computeUnits.initial = units;
    if (transaction.className === "loader-write") {
      computeUnits.writeMin = computeUnits.writeMin === null || units < computeUnits.writeMin ? units : computeUnits.writeMin;
      computeUnits.writeMax = units > computeUnits.writeMax ? units : computeUnits.writeMax;
    }
    if (transaction.className === "program-deploy") computeUnits.final = units;
  }

  const finalProgram = svm.getAccount(address(program.toBase58()));
  const finalProgramData = svm.getAccount(address(programData.toBase58()));
  const finalBuffer = svm.getAccount(address(buffer.toBase58()));
  assert(finalProgram.exists && finalProgramData.exists, "simulation did not create Program and ProgramData accounts");
  assert.equal(finalProgram.programAddress, LOADER_ID.toBase58());
  assert.equal(finalProgram.executable, true);
  assert.equal(finalProgram.data.length, PROGRAM_ACCOUNT_SIZE);
  assert.equal(Buffer.from(finalProgram.data).readUInt32LE(0), 2);
  assert(Buffer.from(finalProgram.data).subarray(4, 36).equals(programData.toBuffer()));
  assert.equal(finalProgramData.programAddress, LOADER_ID.toBase58());
  assert.equal(finalProgramData.executable, false);
  assert.equal(finalProgramData.data.length, PROGRAMDATA_METADATA_SIZE + binary.length);
  const programDataBytes = Buffer.from(finalProgramData.data);
  assert.equal(programDataBytes.readUInt32LE(0), 3);
  assert.equal(programDataBytes[12], 1);
  assert(programDataBytes.subarray(13, 45).equals(payer.toBuffer()));
  assert.equal(sha256(programDataBytes.subarray(PROGRAMDATA_METADATA_SIZE)), EXPECTED_SBF_SHA256);
  assert(!finalBuffer.exists, "Buffer was not drained and purged by deployment");

  const simulatedPayerBalance = svm.getBalance(address(payer.toBase58()));
  const expectedRemainingBalance = BigInt(payerBalance) - BigInt(maximumLamportBudget);
  assert.equal(simulatedPayerBalance, expectedRemainingBalance);

  const report = {
    mode: RESUME_EXISTING_BUFFER
      ? "unsigned resumable-buffer construction plus ordered LiteSVM simulation; no signer file read; no signature created; no transaction sent"
      : "unsigned construction plus ordered LiteSVM simulation; no signer file read; no signature created; no transaction sent",
    cluster: "devnet",
    rpcUrl: RPC_URL,
    observedSlot: slot,
    identities: {
      feePayer: payer.toBase58(),
      bufferAuthority: payer.toBase58(),
      upgradeAuthority: payer.toBase58(),
      programId: program.toBase58(),
      buffer: buffer.toBase58(),
      programData: programData.toBase58(),
    },
    preflight: {
      programExists: false,
      bufferExists: bufferInfo !== null,
      bufferOwner: bufferInfo?.owner.toBase58() ?? null,
      bufferLamports: bufferInfo?.lamports ?? null,
      binarySize: binary.length,
      binarySha256: sha256(binary),
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      feePayerBalanceLamports: payerBalance,
    },
    budget: {
      programRentLamports: programRent,
      programDataRentLamports: programDataRent,
      bufferRentMinimumLamports: bufferRent,
      bufferFundingLamports: RESUME_EXISTING_BUFFER ? 0 : programDataRent,
      baseFeePerSignatureLamports: oneSignatureFee.value,
      signatureCount,
      feeBudgetLamports: feeBudget,
      maximumLamportBudget,
      remainingMarginLamports: Number(expectedRemainingBalance),
    },
    construction: {
      chunkSize,
      writeCount: writes.length,
      transactionCount: transactions.length,
      instructionCount: expectedInstructionCount,
      instructionPlanSha256,
      wireSizes: {
        initial: initial.wireSize,
        fullWrite: writes[0].wireSize,
        finalWrite: writes.at(-1)!.wireSize,
        deploy: final.wireSize,
      },
      messageHashes: {
        initial: initial.messageSha256,
        writesAggregate: sha256(Buffer.concat(writes.map((write) => Buffer.from(write.messageBytes)))),
        firstWrite: writes[0].messageSha256,
        lastWrite: writes.at(-1)!.messageSha256,
        deploy: final.messageSha256,
      },
      requiredSigners: {
        bufferCreate: initial.requiredSigners,
        loaderWrite: writes[0].requiredSigners,
        programDeploy: final.requiredSigners,
      },
    },
    simulation: {
      devnetRpcRepresentative: {
        className: RESUME_EXISTING_BUFFER ? "loader-write" : "buffer-create",
        passed: true,
        ...devnetRepresentativeSimulation,
      },
      orderedLocal: {
        bufferCreatePassed: RESUME_EXISTING_BUFFER ? null : true,
        existingBufferLoaded: RESUME_EXISTING_BUFFER,
        loaderWritesPassed: writes.length,
        programDeployPassed: true,
        failedTransactions: 0,
        computeUnits: {
          initial: computeUnits.initial?.toString() ?? null,
          writeMin: computeUnits.writeMin?.toString() ?? null,
          writeMax: computeUnits.writeMax.toString(),
          final: computeUnits.final.toString(),
        },
      },
    },
    expectedPostState: {
      programOwner: finalProgram.programAddress,
      programExecutable: finalProgram.executable,
      programDataOwner: finalProgramData.programAddress,
      upgradeAuthority: payer.toBase58(),
      binaryCapacityBytes: finalProgramData.data.length - PROGRAMDATA_METADATA_SIZE,
      deployedBinarySha256: sha256(programDataBytes.subarray(PROGRAMDATA_METADATA_SIZE)),
      bufferDrained: true,
      feePayerRemainingLamports: simulatedPayerBalance.toString(),
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "deployment construction failed");
  process.exitCode = 1;
});
