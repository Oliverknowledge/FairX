import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { PolymarketClient } from "../lib/polymarket/client";
import { fetchReferenceQuoteForMapping } from "../lib/polymarket/discovery";
import { buildReferenceCapture, serializeReferenceCapture } from "../lib/polymarket/capture";
import { verifyReferenceCapture } from "../lib/polymarket/verify";
import { getApprovedMapping } from "../lib/polymarket/mapping";
import { getTxLineServerConfig, txLineAuthHeaders, txLineUrl, hasTxLineCredentials } from "../lib/txline/config";
import { getSupportedMarketByLabel, FRANCE_SPAIN_MARKET } from "../lib/markets/supportedMarkets";
import { deriveMarketV2Pda, deriveMarketVaultPda, LINEGUARD_V2_PROGRAM_ID } from "../lib/solana/lineguardV2";
import { verifyDeployedSchema } from "../lib/solana/schemaVerify";
import { buildInitializeMarketV2Instruction, deriveAuthorityConfigPda } from "../lib/solana/initializeMarketV2";
import { LIVE_MARKET, deriveInitParamsFromCapture } from "../lib/solana/liveMarketInit";

/**
 * npm run fairx:prepare-live-market -- --mapping <mappingId>
 *
 * READ-ONLY deployment-readiness preparation for a France–Spain-style live
 * market. It composes existing FairX libraries to: resolve the real TxLINE
 * fixture, revalidate the Polymarket market identity, recompute a fresh quote,
 * verify a durable capture, confirm the deployed program schema, confirm the
 * proposed PDAs do not exist, estimate rent/fees, and CONSTRUCT (never sign or
 * send) the exact `initialize_market_v2` instruction plus an unsigned preview.
 *
 * It NEVER signs, sends, simulates, funds, airdrops, or mutates any account.
 * It emits usable transaction material ONLY when every gate passes.
 */

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const MAX_QUOTE_AGE_MS = 60_000;

function abort(step: string, reason: string): never {
  console.error(`\n🔴 BLOCKED at "${step}": ${reason}`);
  console.error("No transaction material was produced. No transaction was sent.\n");
  process.exit(1);
}

interface TxLineFixture {
  FixtureId: number;
  Competition: string;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  StartTime: number; // ms
  GameState?: number;
}

async function resolveTxlineFixture(fixtureId: number, homeTeam: string, awayTeam: string): Promise<TxLineFixture> {
  const cfg = getTxLineServerConfig();
  if (!hasTxLineCredentials(cfg)) abort("txline-fixture", "TxLINE credentials are not configured.");
  const res = await fetch(txLineUrl(cfg, cfg.fixturesSnapshotPath), { headers: txLineAuthHeaders(cfg) });
  if (!res.ok) abort("txline-fixture", `TxLINE fixtures snapshot returned HTTP ${res.status}.`);
  const fixtures = (await res.json()) as TxLineFixture[];
  const fx = fixtures.find((f) => f.FixtureId === fixtureId);
  if (!fx) abort("txline-fixture", `fixture ${fixtureId} not present in the live TxLINE fixtures snapshot.`);
  if (fx.Participant1 !== homeTeam || fx.Participant2 !== awayTeam || fx.Participant1IsHome !== true) {
    abort("txline-fixture", `fixture ${fixtureId} orientation mismatch: ${fx.Participant1} vs ${fx.Participant2} (home=${fx.Participant1IsHome}); expected ${homeTeam} (home) vs ${awayTeam}.`);
  }
  return fx;
}

async function main() {
  const args = process.argv.slice(2);
  const mappingId = args[args.indexOf("--mapping") + 1] ?? "fifwc-fra-esp-2026-07-14-france-win";
  const market = getSupportedMarketByLabel(FRANCE_SPAIN_MARKET.label);
  if (!market || market.mappingId !== mappingId) abort("registry", `no supported market maps to mappingId ${mappingId}`);

  // 1. Approved mapping (allowlist).
  const mapping = getApprovedMapping(mappingId);
  if (!mapping) abort("mapping", `${mappingId} is not in the approved registry`);
  if (mapping.txlineFixtureId.startsWith("TXLINE-PENDING")) abort("mapping", "mapping still carries a TXLINE-PENDING placeholder fixture id");
  const fixtureIdNum = Number(mapping.txlineFixtureId);
  if (!(fixtureIdNum > 0)) abort("mapping", `mapping txlineFixtureId ${mapping.txlineFixtureId} is not a positive numeric id`);

  // 2–3. Resolve the real TxLINE fixture + orientation + kickoff.
  const fixture = await resolveTxlineFixture(fixtureIdNum, mapping.txlineHomeTeam, mapping.txlineAwayTeam);
  const kickoffMs = fixture.StartTime;
  const closeTimeSec = Math.floor(kickoffMs / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!(closeTimeSec > nowSec)) abort("txline-fixture", `fixture kickoff ${new Date(kickoffMs).toISOString()} is not in the future`);
  // Cross-check the live fixture against the reviewed constants the initializer will use.
  if (fixtureIdNum !== LIVE_MARKET.fixtureId) abort("txline-fixture", `fixture id ${fixtureIdNum} != reviewed ${LIVE_MARKET.fixtureId}`);
  if (kickoffMs !== LIVE_MARKET.settlementMinTimestampMs || closeTimeSec !== LIVE_MARKET.closeTime) {
    abort("txline-fixture", `live kickoff ${new Date(kickoffMs).toISOString()} differs from reviewed close_time/settlement constants`);
  }

  // 4–5. Gamma market metadata + exact identity.
  const client = new PolymarketClient();
  const { descriptor, book, quote } = await fetchReferenceQuoteForMapping(mapping, { client });
  if (descriptor.conditionId !== mapping.polymarketConditionId) abort("gamma", "conditionId differs from mapping");
  if (descriptor.yesTokenId !== mapping.polymarketYesTokenId) abort("gamma", "YES token id differs from mapping");
  if (descriptor.noTokenId !== mapping.polymarketNoTokenId) abort("gamma", "NO token id differs from mapping");
  if (descriptor.marketId !== mapping.polymarketMarketId) abort("gamma", "marketId differs from mapping");
  if (descriptor.closed || !descriptor.active || !descriptor.enableOrderBook) abort("gamma", "market is closed / inactive / order book disabled");

  // 6. Fetch BOTH CLOB books; sanity-check the NO book too.
  const noBook = await client.getBook(mapping.polymarketNoTokenId);
  if (noBook.bids.length === 0 || noBook.asks.length === 0) abort("clob", "NO order book is one-sided");

  // 7–10. Recomputed quote + policy gates (spread/depth/age/crossed handled by buildReferenceQuote).
  if (!quote.quoteValid) abort("quote", `reference quote invalid: ${quote.rejectionReasons.join(", ")}`);
  if (quote.quoteAgeMs > MAX_QUOTE_AGE_MS) abort("quote", `quote age ${quote.quoteAgeMs}ms exceeds ${MAX_QUOTE_AGE_MS}ms`);
  if (quote.bestBidMicros >= quote.bestAskMicros) abort("quote", "book is crossed");

  // 11–12. Durable capture + independent verification. Written to a SEPARATE path
  // so the historical .capture.json (auditable prior evidence) is never clobbered.
  const capture = buildReferenceCapture({ mapping, descriptor, book, quote, mode: "LIVE" });
  const verification = verifyReferenceCapture(capture);
  if (!verification.valid) abort("capture", `capture failed self-verification: ${verification.errors.join("; ")}`);
  const outPath = resolve(process.env.FAIRX_LIVE_CAPTURE_PATH ?? `fixtures/polymarket/${mappingId}.live-capture.json`);
  await mkdir(dirname(outPath), { recursive: true });
  const tmp = `${outPath}.tmp`;
  await writeFile(tmp, serializeReferenceCapture(capture), "utf8");
  await rename(tmp, outPath);

  // 13. Deployed schema + authority-config + PDA non-existence.
  const connection = new Connection(RPC_URL, "confirmed");
  const marketPda = deriveMarketV2Pda(market.label);
  const vaultPda = deriveMarketVaultPda(marketPda);
  const authorityConfigPda = deriveAuthorityConfigPda();
  const schema = await verifyDeployedSchema(connection, {
    marketV2Sample: deriveMarketV2Pda("fairx-france-morocco-v2"),
    marketVaultSample: deriveMarketVaultPda(deriveMarketV2Pda("fairx-france-morocco-v2")),
    authorityConfig: authorityConfigPda,
  });
  if (!schema.ok) abort("schema", `deployed schema verification failed: ${schema.checks.filter((c) => !c.ok).map((c) => c.name).join(", ")}`);

  // 14. Proposed market + vault must NOT already exist.
  const [marketInfo, vaultInfo] = await connection.getMultipleAccountsInfo([marketPda, vaultPda], "confirmed");
  if (marketInfo) abort("pda", `proposed market ${marketPda.toBase58()} already exists on-chain`);
  if (vaultInfo) abort("pda", `proposed vault ${vaultPda.toBase58()} already exists on-chain`);

  // 15. Rent + fee estimates (read-only RPC).
  const [rentMarket, rentVault] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(509),
    connection.getMinimumBalanceForRentExemption(89),
  ]);
  const feeLamports = 10_000; // 2 signatures @ 5000

  // 16. Construct — DO NOT SIGN — the exact initialize_market_v2 instruction,
  // via the SAME shared derivation the operator initializer uses (placeholders
  // for admin/payer, which are supplied by the operator at deploy time).
  const built = buildInitializeMarketV2Instruction(
    deriveInitParamsFromCapture(capture, { admin: PublicKey.default, payer: PublicKey.default, nowSeconds: nowSec }),
  );
  const displayedPriceMicros = capture.derived.midpointMicros;

  // 17. Serialize a signature-free preview (size only — never signed, never sent).
  const messageSize = built.instruction.data.length + built.instruction.keys.length * 34 + 64;

  const preview = {
    NO_TRANSACTIONS_SENT: true,
    mappingId,
    quote: { midpointMicros: quote.midpointMicros, spreadMicros: quote.spreadMicros, ageMs: quote.quoteAgeMs, valid: quote.quoteValid },
    fixture: { fixtureId: fixtureIdNum, competition: fixture.Competition, home: fixture.Participant1, away: fixture.Participant2, kickoff: new Date(kickoffMs).toISOString(), gameState: fixture.GameState },
    schema: { ok: schema.ok, onChainIdl: schema.onChainIdl.status, initDiscriminator: schema.initializeDiscriminatorHex },
    pdas: { market: marketPda.toBase58(), vault: vaultPda.toBase58(), authorityConfig: authorityConfigPda.toBase58() },
    costs: { rentMarketLamports: rentMarket, rentVaultLamports: rentVault, feeLamports, operatorTotalLamports: rentMarket + rentVault + feeLamports },
    instruction: {
      programId: LINEGUARD_V2_PROGRAM_ID.toBase58(),
      discriminator: schema.initializeDiscriminatorHex,
      dataBytes: built.instruction.data.length,
      accounts: built.instruction.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), signer: k.isSigner, writable: k.isWritable })),
      closeTime: LIVE_MARKET.closeTime,
      claimDeadline: 0,
      evidenceMode: LIVE_MARKET.evidenceMode,
      settlementMinTimestampMs: LIVE_MARKET.settlementMinTimestampMs,
      displayedPriceMicros,
      fairPriceMicros: displayedPriceMicros,
      toleranceMicros: LIVE_MARKET.toleranceMicros,
    },
    approxUnsignedMessageBytes: messageSize,
    captureWritten: outPath,
  };
  console.log(JSON.stringify(preview, null, 2));
  console.error("\nℹ️  Preview only — NO TRANSACTIONS SENT. Supply the operator admin/payer keys and re-run under approval to obtain the final signed transaction.");
}

main().catch((err) => {
  console.error(`\n🔴 prepare-live-market failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
