import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { verifyReferenceCapture } from "../lib/polymarket/verify";
import type { PolymarketReferenceCapture } from "../lib/polymarket/types";
import { LINEGUARD_V2_PROGRAM_ID, deriveMarketV2Pda, deriveMarketVaultPda } from "../lib/solana/lineguardV2";
import { buildInitializeMarketV2Instruction, deriveAuthorityConfigPda } from "../lib/solana/initializeMarketV2";
import { LIVE_MARKET, MAX_CAPTURE_AGE_MS, captureAgeMs, deriveInitParamsFromCapture, readAuthorityConfigAdmin } from "../lib/solana/liveMarketInit";

/**
 * npm run fairx:initialize-live-market -- --dry-run
 * npm run fairx:initialize-live-market -- --send --confirm-market fairx-france-spain-v2
 *
 * Initialize the France–Spain live market by consuming the VERIFIED capture
 * emitted by `fairx:prepare-live-market`. Every price and hash comes from that
 * capture; the fixture id, close time, settlement timestamp, stat keys and
 * tolerance are the reviewed constants (lib/solana/liveMarketInit.ts).
 *
 * --dry-run (default): build + print every argument/account/signer, no sign/send.
 * --send: requires --confirm-market fairx-france-spain-v2, then signs with the
 *         operator keypair and broadcasts ONE transaction.
 *
 * Fail-closed guards: fresh capture (<60s), PDAs absent, admin == authority_config.admin,
 * sufficient payer balance. Never logs private-key material (public keys only).
 */

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const FEE_LAMPORTS = 10_000;
const BALANCE_MARGIN_LAMPORTS = 5_000_000; // headroom above rent + fee

function fail(reason: string): never {
  console.error(`\n🔴 initialize-live-market aborted: ${reason}`);
  console.error("No transaction was sent.\n");
  process.exit(1);
}

/** Load the operator keypair from env (file path, JSON array, or base58). Never logged. */
function loadOperatorKeypair(): Keypair {
  const raw = process.env.LINEGUARD_OPERATOR_KEYPAIR ?? process.env.SOLANA_OPERATOR_KEYPAIR;
  if (!raw) fail("LINEGUARD_OPERATOR_KEYPAIR is required (file path, JSON array, or base58).");
  const value = raw.trim();
  try {
    if (existsSync(value)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(value, "utf8"))));
  } catch { /* fall through */ }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
  } catch { /* fall through */ }
  try {
    return Keypair.fromSecretKey(bs58.decode(value));
  } catch {
    fail("LINEGUARD_OPERATOR_KEYPAIR could not be parsed. (Value is never printed.)");
  }
}

function loadCapture(path: string): PolymarketReferenceCapture {
  if (!existsSync(path)) fail(`capture not found at ${path}. Run: npm run fairx:prepare-live-market -- --mapping ${LIVE_MARKET.mappingId}`);
  let capture: PolymarketReferenceCapture;
  try {
    capture = JSON.parse(readFileSync(path, "utf8")) as PolymarketReferenceCapture;
  } catch (err) {
    fail(`capture at ${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const verification = verifyReferenceCapture(capture);
  if (!verification.valid) fail(`capture failed self-verification: ${verification.errors.join("; ")}`);
  return capture;
}

async function main() {
  const argv = process.argv.slice(2);
  const SEND = argv.includes("--send");
  const DRY_RUN = argv.includes("--dry-run") || !SEND; // dry-run is the default
  const confirmMarket = argv[argv.indexOf("--confirm-market") + 1];
  const capturePath = resolve(
    argv.includes("--capture") ? argv[argv.indexOf("--capture") + 1] : `fixtures/polymarket/${LIVE_MARKET.mappingId}.live-capture.json`,
  );

  if (process.env.NEXT_PUBLIC_SOLANA_CLUSTER && process.env.NEXT_PUBLIC_SOLANA_CLUSTER !== "devnet") {
    fail("NEXT_PUBLIC_SOLANA_CLUSTER must be devnet.");
  }

  // 1. Verified, FRESH capture.
  const capture = loadCapture(capturePath);
  const ageMs = captureAgeMs(capture);
  if (ageMs > MAX_CAPTURE_AGE_MS) fail(`capture is ${(ageMs / 1000).toFixed(1)}s old (max ${MAX_CAPTURE_AGE_MS / 1000}s). Re-run fairx:prepare-live-market immediately before initializing.`);
  if (capture.mapping.mappingId !== LIVE_MARKET.mappingId) fail(`capture mapping ${capture.mapping.mappingId} != ${LIVE_MARKET.mappingId}`);

  // 2. Operator keypair (admin == payer). Secret never leaves memory / never printed.
  const operator = loadOperatorKeypair();
  const admin = operator.publicKey;
  const payer = operator.publicKey;

  // 3. Derive PDAs.
  const marketPda = deriveMarketV2Pda(LIVE_MARKET.label);
  const vaultPda = deriveMarketVaultPda(marketPda);
  const authorityConfigPda = deriveAuthorityConfigPda();

  const connection = new Connection(RPC_URL, "confirmed");
  const [marketInfo, vaultInfo, authInfo, balance] = await Promise.all([
    connection.getAccountInfo(marketPda, "confirmed"),
    connection.getAccountInfo(vaultPda, "confirmed"),
    connection.getAccountInfo(authorityConfigPda, "confirmed"),
    connection.getBalance(payer, "confirmed"),
  ]);

  // 4. PDAs must not already exist.
  if (marketInfo) fail(`market ${marketPda.toBase58()} already exists — initialization is one-time.`);
  if (vaultInfo) fail(`vault ${vaultPda.toBase58()} already exists — initialization is one-time.`);

  // 5. admin must equal authority_config.admin.
  if (!authInfo) fail("authority-config (authorities-v2) account not found; run authority initialization first.");
  const onchainAdmin = readAuthorityConfigAdmin(Uint8Array.from(authInfo.data));
  if (!onchainAdmin.equals(admin)) {
    fail(`connected admin ${admin.toBase58()} != authority_config.admin ${onchainAdmin.toBase58()}.`);
  }

  // 6. Rent + fee + balance sufficiency.
  const [rentMarket, rentVault] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(509),
    connection.getMinimumBalanceForRentExemption(89),
  ]);
  const required = rentMarket + rentVault + FEE_LAMPORTS;
  const requiredWithMargin = required + BALANCE_MARGIN_LAMPORTS;
  const balanceOk = balance >= requiredWithMargin;

  // 7. Build the instruction from the verified capture (same derivation as the preview).
  const params = deriveInitParamsFromCapture(capture, { admin, payer });
  const built = buildInitializeMarketV2Instruction(params);

  const preview = {
    mode: SEND ? "SEND" : "DRY_RUN",
    cluster: "devnet",
    programId: LINEGUARD_V2_PROGRAM_ID.toBase58(),
    marketLabel: LIVE_MARKET.label,
    captureAgeSeconds: Number((ageMs / 1000).toFixed(1)),
    operatorAdminPublicKey: admin.toBase58(),
    payerPublicKey: payer.toBase58(),
    authorityConfigAdminMatches: true,
    pdas: { market: marketPda.toBase58(), vault: vaultPda.toBase58(), authorityConfig: authorityConfigPda.toBase58() },
    args: {
      fixtureId: params.fixtureId,
      homeStatKey: params.homeStatKey,
      awayStatKey: params.awayStatKey,
      claimDeadline: params.claimDeadline,
      evidenceMode: params.evidenceMode,
      closeTime: params.closeTime,
      settlementMinTimestampMs: params.settlementMinTimestampMs,
      displayedPriceMicros: params.displayedPriceMicros,
      fairPriceMicros: params.fairPriceMicros,
      toleranceMicros: params.toleranceMicros,
      oddsPayloadHash: params.oddsPayloadHash,
      pricingModelHash: params.pricingModelHash,
      fixtureIdHash: params.fixtureIdHash,
    },
    accounts: built.instruction.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), signer: k.isSigner, writable: k.isWritable })),
    instructionDataBytes: built.instruction.data.length,
    costs: {
      rentMarketLamports: rentMarket,
      rentVaultLamports: rentVault,
      feeLamports: FEE_LAMPORTS,
      requiredLamports: required,
      payerBalanceLamports: balance,
      balanceSufficient: balanceOk,
    },
  };
  console.log(JSON.stringify(preview, null, 2));

  if (DRY_RUN) {
    console.error("\nℹ️  DRY RUN — nothing signed or sent. To broadcast: --send --confirm-market " + LIVE_MARKET.label);
    return;
  }

  // --send path.
  if (confirmMarket !== LIVE_MARKET.label) fail(`--send requires --confirm-market ${LIVE_MARKET.label}`);
  if (!balanceOk) fail(`payer balance ${balance} lamports is below required ${requiredWithMargin} (rent + fee + margin).`);

  const transaction = new Transaction().add(built.instruction);
  const latest = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = payer;
  transaction.recentBlockhash = latest.blockhash;
  transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
  transaction.partialSign(operator);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
  const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (confirmation.value.err) fail(`initialization failed: ${JSON.stringify(confirmation.value.err)}`);
  console.log(`\n✅ Initialized: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log(`market ${marketPda.toBase58()} · vault ${vaultPda.toBase58()}`);
}

main().catch((err) => {
  console.error(`\n🔴 initialize-live-market failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
