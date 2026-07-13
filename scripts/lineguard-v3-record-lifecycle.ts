import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import canonicalCapture from "../fixtures/txline/canonical.json" with { type: "json" };
import canonicalValidation from "../fixtures/txline/canonical.validation.json" with { type: "json" };
import { canonicalize } from "../lib/receipts/create";
import { hashRawEvent } from "../lib/proof/eventHash";
import { TXLINE_PRICING_MODEL_V1 } from "../lib/txline/pricing";

const SEND = process.argv.includes("--send");
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LINEGUARD_PROGRAM_ID ?? "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");
const TXLINE_PROGRAM_ID = new PublicKey(canonicalValidation.programId);
const MARKET_LABEL = process.env.LINEGUARD_V3_MARKET_LABEL ?? "fairx-france-morocco-v3-three-wallet";
const OUTPUT = new URL("../fixtures/lineguard/v3-france-morocco-three-wallet.json", import.meta.url);
const STAKE = 10_000_000;
const WALLET_FUNDING = 50_000_000;
const EXPECTED_RENT_LAMPORTS = { market: 6_062_160, vault: 1_510_320, order: 2_860_560, position: 1_642_560, receipt: 2_115_840, proposal: 1_698_240 } as const;
const ACCOUNT_SIZES = { market: 743, vault: 89, order: 283, position: 108, receipt: 176, proposal: 116 } as const;
const BASE_FEE_PER_SIGNATURE = 5_000;
const APPROVED_STARTING_BALANCES = { operator: 8_690_159_511, resolutionA: 46_359_920, walletA: 0, walletB: 0, walletC: 0 } as const;
const OLD_YES_PRICE = canonicalCapture.odds.displayedPricingInput.fairPriceMicros;
const NEW_YES_PRICE = canonicalCapture.odds.normalizedPricingInput.fairPriceMicros;

function hash32(value: string): number[] {
  return Array.from(createHash("sha256").update(value).digest());
}

function loadKeypair(name: string, fallbacks: string[] = []): Keypair {
  for (const candidate of [name, ...fallbacks]) {
    const path = process.env[`${candidate}_FILE`]?.trim();
    if (!path) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!Array.isArray(parsed)) throw new Error("keypair file is not a JSON byte array");
      return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
    } catch {
      throw new Error(`${candidate}_FILE does not contain a valid Solana keypair.`);
    }
  }
  const raw = [name, ...fallbacks].map((candidate) => process.env[candidate]?.trim()).find(Boolean);
  if (!raw) throw new Error(`${name} is required.`);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
  } catch {
    // Base58 is accepted below.
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new Error(`${name} is invalid.`);
  }
}

function explorer(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function proofPayload() {
  const source = canonicalValidation.validationPayload;
  const proofNode = (node: { hash: number[]; isRightSibling: boolean }) => ({ hash: node.hash, isRightSibling: node.isRightSibling });
  return {
    ts: new BN(source.ts),
    fixtureSummary: {
      fixtureId: new BN(source.summary.fixtureId),
      updateStats: {
        updateCount: source.summary.updateStats.updateCount,
        minTimestamp: new BN(source.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(source.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: source.summary.eventStatsSubTreeRoot,
    },
    fixtureProof: source.subTreeProof.map(proofNode),
    mainTreeProof: source.mainTreeProof.map(proofNode),
    eventStatRoot: source.eventStatRoot,
    stats: source.statsToProve.map((stat: { key: number; value: number; period: number }, index: number) => ({
      stat: { key: stat.key, value: stat.value, period: stat.period },
      statProof: source.statProofs[index].map(proofNode),
    })),
  };
}

async function main() {
  if (process.env.NEXT_PUBLIC_SOLANA_CLUSTER !== "devnet") throw new Error("NEXT_PUBLIC_SOLANA_CLUSTER must be devnet.");
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const previewSlot = await connection.getSlot("finalized");
  const orderExpirySlot = Number(process.env.LINEGUARD_V3_ORDER_EXPIRY_SLOT ?? previewSlot + 100_000);
  const closeTime = Number(process.env.LINEGUARD_V3_CLOSE_TIME ?? Math.floor(Date.now() / 1_000) + 86_400);
  if (!Number.isSafeInteger(orderExpirySlot) || orderExpirySlot <= previewSlot) throw new Error("LINEGUARD_V3_ORDER_EXPIRY_SLOT must be a future safe integer slot.");
  if (!Number.isSafeInteger(closeTime) || closeTime <= Math.floor(Date.now() / 1_000)) throw new Error("LINEGUARD_V3_CLOSE_TIME must be a future Unix timestamp.");
  const payer = loadKeypair("LINEGUARD_OPERATOR_KEYPAIR", ["SOLANA_OPERATOR_KEYPAIR"]);
  const feed = loadKeypair("LINEGUARD_FEED_KEYPAIR");
  const pricing = loadKeypair("LINEGUARD_PRICING_KEYPAIR");
  const resolutionA = loadKeypair("LINEGUARD_RESOLUTION_A_KEYPAIR");
  const resolutionB = loadKeypair("LINEGUARD_RESOLUTION_B_KEYPAIR");
  const walletA = loadKeypair("FAIRX_WALLET_A_KEYPAIR");
  const walletB = loadKeypair("FAIRX_WALLET_B_KEYPAIR");
  const walletC = loadKeypair("FAIRX_WALLET_C_KEYPAIR");
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed", preflightCommitment: "confirmed" });
  const idl = JSON.parse(readFileSync(new URL("../target/idl/lineguard.json", import.meta.url), "utf8"));
  const program = new Program(idl, provider) as Program<any>;
  const marketId = hash32(MARKET_LABEL);
  const [authorityConfig] = PublicKey.findProgramAddressSync([Buffer.from("authorities-v2")], PROGRAM_ID);
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market-v2"), Buffer.from(marketId)], PROGRAM_ID);
  const [marketVault] = PublicKey.findProgramAddressSync([Buffer.from("market-vault"), market.toBuffer()], PROGRAM_ID);
  const [validationReceipt] = PublicKey.findProgramAddressSync([Buffer.from("txval-v2"), market.toBuffer()], PROGRAM_ID);
  const [resolutionProposal] = PublicKey.findProgramAddressSync([Buffer.from("resolution-v2"), market.toBuffer()], PROGRAM_ID);
  const txlineRoot = new PublicKey(canonicalValidation.dailyScoresRootPda);
  const order = (owner: PublicKey, label: string) => PublicKey.findProgramAddressSync(
    [Buffer.from("order-v2"), market.toBuffer(), owner.toBuffer(), Buffer.from(hash32(label))],
    PROGRAM_ID
  )[0];
  const position = (owner: PublicKey, side: 0 | 1) => PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), owner.toBuffer(), Buffer.from([side])],
    PROGRAM_ID
  )[0];
  const addresses = {
    authorityConfig,
    market,
    marketVault,
    validationReceipt,
    resolutionProposal,
    orderA: order(walletA.publicKey, "wallet-a-honest-yes"),
    orderB: order(walletB.publicKey, "wallet-b-honest-no"),
    orderC: order(walletC.publicKey, "wallet-c-stale-exploit"),
    positionA: position(walletA.publicKey, 0),
    positionB: position(walletB.publicKey, 1),
    positionC: position(walletC.publicKey, 0),
  };

  const authority = await program.account.authorityConfig.fetch(authorityConfig);
  const requiredRoles = [
    ["admin", payer.publicKey, authority.admin],
    ["feed", feed.publicKey, authority.feedAuthority],
    ["pricing", pricing.publicKey, authority.pricingAuthority],
    ["resolution A", resolutionA.publicKey, authority.resolutionAuthorities[0]],
    ["resolution B", resolutionB.publicKey, authority.resolutionAuthorities[1]],
  ] as const;
  for (const [label, actual, expected] of requiredRoles) {
    if (!actual.equals(expected)) throw new Error(`${label} keypair does not match the deployed AuthorityConfig.`);
  }
  if (authority.threshold !== 2) throw new Error("The deployed resolution threshold is not 2-of-3.");
  if (await connection.getAccountInfo(market, "confirmed")) throw new Error(`Market already exists: ${market.toBase58()}`);
  const rentEntries = await Promise.all(Object.entries(ACCOUNT_SIZES).map(async ([name, size]) => [name, await connection.getMinimumBalanceForRentExemption(size, "finalized")] as const));
  const rentLamports = Object.fromEntries(rentEntries) as Record<keyof typeof ACCOUNT_SIZES, number>;
  for (const [name, expected] of Object.entries(EXPECTED_RENT_LAMPORTS)) {
    if (rentLamports[name as keyof typeof rentLamports] !== expected) throw new Error(`Rent quote changed for ${name}; generate a new approval preview.`);
  }
  const startingBalanceEntries = await Promise.all([
    ["operator", payer.publicKey],
    ["resolutionA", resolutionA.publicKey],
    ["walletA", walletA.publicKey],
    ["walletB", walletB.publicKey],
    ["walletC", walletC.publicKey],
  ].map(async ([name, address]) => [name, await connection.getBalance(address as PublicKey, "finalized")] as const));
  const startingBalances = Object.fromEntries(startingBalanceEntries) as Record<keyof typeof APPROVED_STARTING_BALANCES, number>;
  for (const [name, expected] of Object.entries(APPROVED_STARTING_BALANCES)) {
    if (startingBalances[name as keyof typeof startingBalances] !== expected) throw new Error(`Starting balance changed for ${name}; generate a new approval preview.`);
  }

  const plan = {
    action: SEND ? "SEND" : "DRY_RUN",
    cluster: "devnet",
    programId: PROGRAM_ID.toBase58(),
    marketLabel: MARKET_LABEL,
    market: market.toBase58(),
    marketVault: marketVault.toBase58(),
    evidenceMode: "HISTORICAL_REENACTMENT",
    fixtureId: canonicalCapture.fixtureId,
    wallets: {
      A: { address: walletA.publicKey.toBase58(), action: `honest YES at ${OLD_YES_PRICE} micros`, stakeLamports: STAKE },
      B: { address: walletB.publicKey.toBase58(), action: `honest NO at ${1_000_000 - OLD_YES_PRICE} micros`, stakeLamports: STAKE },
      C: { address: walletC.publicKey.toBase58(), action: `stale YES exploit at ${OLD_YES_PRICE} micros; exact stake refund`, stakeLamports: STAKE },
    },
    funding: { payer: payer.publicKey.toBase58(), eachWalletLamports: WALLET_FUNDING, totalLamports: WALLET_FUNDING * 3 },
    signedConstraints: {
      maximumAcceptedEdgeMicros: 20_000,
      maximumSlippageMicros: 0,
      pricedAtSequence: canonicalCapture.normalizedEvent.seq - 1,
      oldOddsSequence: canonicalCapture.odds.displayedPricingInput.timestamp,
      newOddsSequence: canonicalCapture.odds.normalizedPricingInput.timestamp,
      orderExpirySlot,
      closeTime,
    },
    costs: {
      baseFeePerSignatureLamports: BASE_FEE_PER_SIGNATURE,
      totalExpectedTransactionFeeLamports: 130_000,
      rentLamports,
      durableRentLamports: rentLamports.market + rentLamports.vault + rentLamports.receipt + rentLamports.proposal,
      reclaimableUserRentPerWalletLamports: rentLamports.order + rentLamports.position,
      startingBalances,
    },
    expectedSettlement: { AReceivesLamports: STAKE * 2, BPositionClosesWithPayoutLamports: 0, CRefundLamports: STAKE },
    accounts: Object.fromEntries(Object.entries(addresses).map(([key, value]) => [key, value.toBase58()])),
    transactionCount: 14,
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!SEND) {
    console.log("Dry run only. No transaction was signed or sent. Use --send only after this exact plan is approved.");
    return;
  }

  const records: Record<string, { signature: string; explorerUrl: string; slot: number; blockTime: string | null; finalized: true }> = {};
  async function sendStep(label: string, instructions: TransactionInstruction[], signers: Keypair[] = []) {
    const latest = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: payer.publicKey, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }).add(...instructions);
    const unique = [payer, ...signers].filter((candidate, index, all) => all.findIndex((item) => item.publicKey.equals(candidate.publicKey)) === index);
    const feeQuote = await connection.getFeeForMessage(tx.compileMessage(), "confirmed");
    const expectedFee = unique.length * BASE_FEE_PER_SIGNATURE;
    if (feeQuote.value !== expectedFee) throw new Error(`${label} fee quote changed from the approved ${expectedFee} lamports; generate a new preview.`);
    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) throw new Error(`${label} simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join("\n") ?? ""}`);
    tx.partialSign(...unique);
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
    const confirmation = await connection.confirmTransaction({ signature, ...latest }, "finalized");
    if (confirmation.value.err) throw new Error(`${label} failed: ${JSON.stringify(confirmation.value.err)}`);
    const parsed = await connection.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
    records[label] = {
      signature,
      explorerUrl: explorer(signature),
      slot: parsed?.slot ?? 0,
      blockTime: parsed?.blockTime ? new Date(parsed.blockTime * 1_000).toISOString() : null,
      finalized: true,
    };
  }

  const balanceBefore = await Promise.all([walletA, walletB, walletC].map((item) => connection.getBalance(item.publicKey, "confirmed")));
  await sendStep("fundWallets", [walletA, walletB, walletC].map((item) => SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: item.publicKey, lamports: WALLET_FUNDING })));
  const pricingModelHash = hash32(canonicalize(TXLINE_PRICING_MODEL_V1));
  const initIx = await program.methods.initializeMarketV2({
    marketId,
    fixtureId: new BN(Number(canonicalCapture.fixtureId)),
    templateId: 1,
    fixtureIdHash: hash32(canonicalCapture.fixtureId),
    homeTeamHash: hash32("France"),
    awayTeamHash: hash32("Morocco"),
    homeStatKey: 1,
    awayStatKey: 2,
    resolutionRule: 0,
    materialityConfigHash: hash32(canonicalize({ goals: true, redCards: true, penalties: true, oddsUpdates: true })),
    pricingConfigHash: hash32(canonicalize({ model: TXLINE_PRICING_MODEL_V1.id, selection: "part1", source: "Pct" })),
    pricingModelHash,
    pricingModelVersion: 1,
    oddsPayloadHash: Array.from(Buffer.from(hashRawEvent(canonicalCapture.odds.previousRawPayload), "hex")),
    oddsSequence: new BN(canonicalCapture.odds.displayedPricingInput.timestamp),
    materialSeq: new BN(canonicalCapture.normalizedEvent.seq - 1),
    pricedAtSeq: new BN(canonicalCapture.normalizedEvent.seq - 1),
    displayedPriceMicros: new BN(OLD_YES_PRICE),
    fairPriceMicros: new BN(OLD_YES_PRICE),
    toleranceMicros: new BN(20_000),
    closeTime: new BN(closeTime),
    claimDeadline: new BN(0),
    evidenceMode: 1,
    settlementMinTimestamp: new BN(canonicalValidation.validationPayload.ts),
  }).accountsPartial({ admin: payer.publicKey, payer: payer.publicKey, authorityConfig, market, marketVault }).instruction();
  await sendStep("initialize", [initIx]);

  async function orderInstructions(owner: Keypair, label: string, side: 0 | 1, expectedPrice: number) {
    const orderId = hash32(label);
    const orderPda = order(owner.publicKey, label);
    const positionPda = position(owner.publicKey, side);
    const stored = await program.account.marketV2.fetch(market);
    const slot = await connection.getSlot("confirmed");
    if (slot > orderExpirySlot) throw new Error(`Approved order expiry slot ${orderExpirySlot} has passed; generate a new preview.`);
    const place = await program.methods.placeOrderV2(
      orderId,
      side,
      new BN(STAKE),
      new BN(20_000),
      new BN(expectedPrice),
      new BN(0),
      stored.pricedAtSeq,
      stored.oddsSequence,
      new BN(orderExpirySlot)
    ).accountsPartial({ trader: owner.publicKey, market, marketVault, order: orderPda, position: positionPda }).instruction();
    const evaluate = await program.methods.evaluateOrderV2().accountsPartial({ market, marketVault, order: orderPda, trader: owner.publicKey, position: positionPda }).instruction();
    return [place, evaluate];
  }
  await sendStep("walletAHonestYes", await orderInstructions(walletA, "wallet-a-honest-yes", 0, OLD_YES_PRICE), [walletA]);
  await sendStep("walletBHonestNo", await orderInstructions(walletB, "wallet-b-honest-no", 1, 1_000_000 - OLD_YES_PRICE), [walletB]);

  const ingest = await program.methods.ingestMaterialEventV2(new BN(canonicalCapture.normalizedEvent.seq), Array.from(Buffer.from(canonicalCapture.normalizedEventHash, "hex")))
    .accountsPartial({ feedAuthority: feed.publicKey, authorityConfig, market }).instruction();
  const odds = await program.methods.commitTxlineOddsV2(
    new BN(canonicalCapture.odds.normalizedPricingInput.timestamp),
    new BN(NEW_YES_PRICE),
    Array.from(Buffer.from(hashRawEvent(canonicalCapture.odds.rawPayload), "hex")),
    1,
    pricingModelHash
  ).accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).instruction();
  await sendStep("materialEventAndOdds", [ingest, odds], [feed, pricing]);
  await sendStep("walletCStaleExploitRefund", await orderInstructions(walletC, "wallet-c-stale-exploit", 0, OLD_YES_PRICE), [walletC]);
  await sendStep("reprice", [await program.methods.repriceMarketV2().accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).instruction()], [pricing]);
  await sendStep("close", [await program.methods.closeMarketV2().accountsPartial({ closer: feed.publicKey, authorityConfig, market }).instruction()], [feed]);

  const payload = proofPayload();
  const payloadHash = Array.from(createHash("sha256").update(program.coder.types.encode("statValidationInput", payload)).digest());
  const prove = await program.methods.proveResolutionWithTxlineV2(payloadHash, payload).accountsPartial({
    proposer: resolutionA.publicKey,
    authorityConfig,
    market,
    txlineRoot,
    txlineProgram: TXLINE_PROGRAM_ID,
    validationReceipt,
    resolutionProposal,
  }).instruction();
  await sendStep("txlineCpiProof", [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), prove], [resolutionA]);
  await sendStep("secondApproval", [await program.methods.approveResolutionV2().accountsPartial({ approver: resolutionB.publicKey, authorityConfig, market, resolutionProposal }).instruction()], [resolutionB]);
  await sendStep("resolution", [await program.methods.executeResolutionV2().accountsPartial({ authorityConfig, market, validationReceipt, resolutionProposal }).instruction()]);
  await sendStep("walletAClaim", [await program.methods.claimPositionV2().accountsPartial({ trader: walletA.publicKey, market, marketVault, position: addresses.positionA }).instruction()], [walletA]);
  await sendStep("walletBCloseLoss", [await program.methods.closeLosingPositionV2().accountsPartial({ trader: walletB.publicKey, market, position: addresses.positionB }).instruction()], [walletB]);
  await sendStep("walletCCloseRefunded", [await program.methods.closeEmptyPositionV2().accountsPartial({ trader: walletC.publicKey, market, position: addresses.positionC }).instruction()], [walletC]);

  const [storedMarket, storedVault, receipt, proposal, ...closedAccounts] = await Promise.all([
    program.account.marketV2.fetch(market),
    program.account.marketVault.fetch(marketVault),
    program.account.txlineValidationReceiptV2.fetch(validationReceipt),
    program.account.resolutionProposal.fetch(resolutionProposal),
    ...[addresses.orderA, addresses.orderB, addresses.orderC, addresses.positionA, addresses.positionB, addresses.positionC].map((address) => connection.getAccountInfo(address, "finalized")),
  ]);
  const balanceAfter = await Promise.all([walletA, walletB, walletC].map((item) => connection.getBalance(item.publicKey, "finalized")));
  const programAccount = await connection.getAccountInfo(PROGRAM_ID, "finalized");
  if (!programAccount?.executable || programAccount.data.length < 36) throw new Error("Program account is not executable.");
  const programDataAddress = new PublicKey(programAccount.data.subarray(4, 36));
  const programDataAccount = await connection.getAccountInfo(programDataAddress, "finalized");
  if (!programDataAccount || programDataAccount.data.length < 45) throw new Error("ProgramData account is unavailable.");
  if (closedAccounts.some(Boolean)) throw new Error("An order or position account remained open after lifecycle completion.");
  if (!storedMarket.resolved || storedMarket.resolution !== 1) throw new Error("Market did not resolve YES.");
  if (storedVault.totalAccepted.toNumber() !== STAKE * 2 || storedVault.totalRefunded.toNumber() !== STAKE || storedVault.totalPaid.toNumber() !== STAKE * 2 || !storedVault.totalClaimable.isZero()) {
    throw new Error("Final vault accounting does not match the expected three-wallet lifecycle.");
  }

  const record = {
    version: 3,
    truth: { classification: "REAL", network: "devnet", evidenceMode: "HISTORICAL_REENACTMENT", generatedAt: new Date().toISOString() },
    program: {
      programId: PROGRAM_ID.toBase58(),
      programDataAddress: programDataAddress.toBase58(),
      programDataAccountSha256: createHash("sha256").update(programDataAccount.data).digest("hex"),
      deploymentSlot: Number(programDataAccount.data.readBigUInt64LE(4)),
      upgradeAuthority: programDataAccount.data.readUInt8(12) === 1 ? new PublicKey(programDataAccount.data.subarray(13, 45)).toBase58() : null,
    },
    market: {
      label: MARKET_LABEL,
      marketPda: market.toBase58(),
      marketVaultPda: marketVault.toBase58(),
      resolution: "YES",
      displayedPriceMicrosBeforeEvent: OLD_YES_PRICE,
      displayedPriceMicrosAfterReprice: NEW_YES_PRICE,
      yesShares: storedMarket.yesShares.toString(),
      noShares: storedMarket.noShares.toString(),
      settlementMinTimestampMs: storedMarket.settlementMinTimestamp.toString(),
    },
    txline: {
      programId: TXLINE_PROGRAM_ID.toBase58(),
      rootPda: txlineRoot.toBase58(),
      fixtureId: canonicalCapture.fixtureId,
      sequence: canonicalCapture.normalizedEvent.seq,
      captureHash: canonicalCapture.rawPayloadHash,
      borshPayloadHash: Buffer.from(payloadHash).toString("hex"),
      proofTimestampMs: receipt.proofTimestamp.toString(),
      maxUpdateTimestampMs: receipt.maxUpdateTimestamp.toString(),
      directCpiVerified: receipt.directCpiVerified,
      homeScore: receipt.homeScore,
      awayScore: receipt.awayScore,
    },
    authorities: { threshold: authority.threshold, approvalMask: proposal.approvalsMask, proposalExecuted: proposal.executed },
    wallets: {
      A: { address: walletA.publicKey.toBase58(), role: "HONEST_YES_WINNER", stakeLamports: STAKE, payoutLamports: STAKE * 2, balanceBeforeLamports: balanceBefore[0], balanceAfterLamports: balanceAfter[0], netAfterFundingLamports: balanceAfter[0] - balanceBefore[0] - WALLET_FUNDING },
      B: { address: walletB.publicKey.toBase58(), role: "HONEST_NO_LOSER", stakeLamports: STAKE, payoutLamports: 0, balanceBeforeLamports: balanceBefore[1], balanceAfterLamports: balanceAfter[1], netAfterFundingLamports: balanceAfter[1] - balanceBefore[1] - WALLET_FUNDING },
      C: { address: walletC.publicKey.toBase58(), role: "STALE_YES_EXPLOIT_REFUNDED", stakeLamports: STAKE, refundLamports: STAKE, balanceBeforeLamports: balanceBefore[2], balanceAfterLamports: balanceAfter[2], netAfterFundingLamports: balanceAfter[2] - balanceBefore[2] - WALLET_FUNDING },
    },
    accounts: Object.fromEntries(Object.entries(addresses).map(([key, value]) => [key, value.toBase58()])),
    closure: { orderA: true, orderB: true, orderC: true, positionA: true, positionB: true, positionC: true },
    vault: {
      totalDepositedLamports: storedVault.totalDeposited.toNumber(),
      totalRefundedLamports: storedVault.totalRefunded.toNumber(),
      totalAcceptedLamports: storedVault.totalAccepted.toNumber(),
      totalPaidLamports: storedVault.totalPaid.toNumber(),
      totalClaimableLamports: storedVault.totalClaimable.toNumber(),
      roundingDustLamports: storedVault.roundingDust.toNumber(),
    },
    transactions: records,
  };
  writeFileSync(OUTPUT, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Verified lifecycle written to ${OUTPUT.pathname}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
