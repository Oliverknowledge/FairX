import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, Transaction, type TransactionSignature } from "@solana/web3.js";
import bs58 from "bs58";
import canonicalCapture from "../fixtures/txline/canonical.json" with { type: "json" };
import { canonicalize } from "../lib/receipts/create";
import { hashRawEvent } from "../lib/proof/eventHash";
import { TXLINE_PRICING_MODEL_V1 } from "../lib/txline/pricing";

const SEND = process.argv.includes("--send");
const MARKET_LABEL = process.env.NEXT_PUBLIC_LINEGUARD_V2_MARKET_ID ?? "fairx-france-morocco-v2";

function key(name: string): PublicKey {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required; runtime roles must not silently default to the operator/upgrade key.`);
  return new PublicKey(value);
}

function hash32(value: string): number[] {
  return Array.from(createHash("sha256").update(value).digest());
}

function operatorKeypair(): Keypair {
  const raw = process.env.LINEGUARD_OPERATOR_KEYPAIR ?? process.env.SOLANA_OPERATOR_KEYPAIR;
  if (!raw) throw new Error("LINEGUARD_OPERATOR_KEYPAIR is required.");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
  } catch {
    // Try base58 next.
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new Error("LINEGUARD_OPERATOR_KEYPAIR is invalid.");
  }
}

async function main() {
  if (process.env.NEXT_PUBLIC_SOLANA_CLUSTER !== "devnet") throw new Error("NEXT_PUBLIC_SOLANA_CLUSTER must be devnet.");
  const payer = operatorKeypair();
  const programId = new PublicKey(process.env.NEXT_PUBLIC_LINEGUARD_PROGRAM_ID ?? "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const feed = key("LINEGUARD_FEED_AUTHORITY");
  const pricing = key("LINEGUARD_PRICING_AUTHORITY");
  const emergency = key("LINEGUARD_EMERGENCY_AUTHORITY");
  const resolution = [key("LINEGUARD_RESOLUTION_AUTHORITY_A"), key("LINEGUARD_RESOLUTION_AUTHORITY_B"), key("LINEGUARD_RESOLUTION_AUTHORITY_C")] as const;
  const allRuntimeKeys = [feed, pricing, emergency, ...resolution].map((value) => value.toBase58());
  if (new Set(allRuntimeKeys).size !== allRuntimeKeys.length) throw new Error("Feed, pricing, emergency, and resolution keys must all be distinct.");
  if (allRuntimeKeys.includes(payer.publicKey.toBase58())) throw new Error("The operator/upgrade key must not be reused as a v2 runtime authority.");

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
  const idl = JSON.parse(readFileSync(new URL("../target/idl/lineguard.json", import.meta.url), "utf8"));
  const program = new Program(idl, provider);
  const marketId = hash32(MARKET_LABEL);
  const [authorityConfig] = PublicKey.findProgramAddressSync([Buffer.from("authorities-v2")], programId);
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market-v2"), Buffer.from(marketId)], programId);
  const [marketVault] = PublicKey.findProgramAddressSync([Buffer.from("market-vault"), market.toBuffer()], programId);
  const existing = await connection.getMultipleAccountsInfo([authorityConfig, market], "confirmed");
  if (existing.some(Boolean)) throw new Error("V2 authority or canonical market account already exists; initialization is one-time and will not overwrite it.");

  const pricingModelHash = hash32(canonicalize(TXLINE_PRICING_MODEL_V1));
  const now = Math.floor(Date.now() / 1000);
  const authorityIx = await program.methods.initializeAuthorities(feed, pricing, resolution, emergency, 2)
    .accountsPartial({ admin: payer.publicKey, authorityConfig }).instruction();
  const marketIx = await program.methods.initializeMarketV2({
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
    oddsPayloadHash: Array.from(Buffer.from(hashRawEvent(canonicalCapture.odds.rawPayload), "hex")),
    oddsSequence: new BN(canonicalCapture.odds.normalizedPricingInput.timestamp),
    materialSeq: new BN(canonicalCapture.normalizedEvent.seq),
    pricedAtSeq: new BN(canonicalCapture.normalizedEvent.seq - 1),
    displayedPriceMicros: new BN(canonicalCapture.odds.displayedPricingInput.fairPriceMicros),
    fairPriceMicros: new BN(canonicalCapture.odds.normalizedPricingInput.fairPriceMicros),
    toleranceMicros: new BN(20_000),
    closeTime: new BN(now + 7 * 24 * 60 * 60),
    claimDeadline: new BN(now + 365 * 24 * 60 * 60),
  }).accountsPartial({ admin: payer.publicKey, payer: payer.publicKey, authorityConfig, market, marketVault }).instruction();

  const transaction = new Transaction().add(authorityIx, marketIx);
  const latest = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) throw new Error(`Initialization simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join("\n") ?? ""}`);

  const preview = {
    cluster: "devnet",
    programId: programId.toBase58(),
    feePayer: payer.publicKey.toBase58(),
    marketLabel: MARKET_LABEL,
    market: market.toBase58(),
    marketVault: marketVault.toBase58(),
    authorityConfig: authorityConfig.toBase58(),
    fixtureId: canonicalCapture.fixtureId,
    template: "MATCH_WINNER_HOME_V1",
    displayedPriceMicros: canonicalCapture.odds.displayedPricingInput.fairPriceMicros,
    fairPriceMicros: canonicalCapture.odds.normalizedPricingInput.fairPriceMicros,
    state: `${canonicalCapture.normalizedEvent.seq}/${canonicalCapture.normalizedEvent.seq - 1} stale canonical window`,
    threshold: "2-of-3",
    simulation: "passed",
    sendRequested: SEND,
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!SEND) {
    console.log("Dry run only. Re-run with --send only after reviewing this preview and explicitly approving the devnet transaction.");
    return;
  }
  transaction.partialSign(payer);
  const signature: TransactionSignature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
  const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (confirmation.value.err) throw new Error(`Initialization failed: ${JSON.stringify(confirmation.value.err)}`);
  console.log(`Initialized: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
