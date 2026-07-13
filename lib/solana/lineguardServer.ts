import "server-only";

import crypto from "crypto";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { OnChainProof } from "@/lib/receipts/types";
import type { FairXMarketType, MaterialityRules } from "@/lib/markets/fairx";
import { buildMarketConfigCommitment, type MarketConfigCommitment } from "@/lib/markets/marketConfig";
import {
  explorerUrl,
  programExplorerUrl,
  type OnChainActionResponse,
  type OnChainApiState,
  type OnChainMode,
  type OnChainSettlementResult,
  type ParsedOnChainMarket,
  type ParsedOnChainMarketConfig,
  type ParsedOnChainOrder,
  type ParsedOnChainReceipt,
} from "@/lib/solana/lineguardProgram";
import {
  bytes32,
  deriveDefaultPdas,
  deriveLineGuardPdas,
  deriveMarketPda,
  deriveMarketConfigPda,
  deriveOrderPda,
  LINEGUARD_MARKET_LABEL,
  LOCAL_LINEGUARD_PROGRAM_ID,
  orderLabelForSide,
  sideCode,
  type OnChainSide,
} from "@/lib/solana/pdas";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";
import { hashNormalizedEvent } from "@/lib/proof/eventHash";

const CANONICAL_DISPLAYED_PRICE = canonicalCapture.odds.displayedPricingInput.fairPriceMicros;
const CANONICAL_FAIR_PRICE = canonicalCapture.odds.normalizedPricingInput.fairPriceMicros;
const CANONICAL_EVENT_SEQ = canonicalCapture.normalizedEvent.seq;
const CANONICAL_INITIAL_SEQ = CANONICAL_EVENT_SEQ - 1;
// Genuine TxLINE fixture (France vs Morocco, 18209181) used by the canonical root-bound flow.
const CANONICAL_FIXTURE_ID = Number(canonicalCapture.fixtureId);
// Root epoch day + stat keys + genuine validation evidence for the France 1-0 final result.
const CANONICAL_ROOT_EPOCH_DAY = 20_643;
const CANONICAL_STAT_KEY_HOME = 1;
const CANONICAL_STAT_KEY_AWAY = 2;
const CANONICAL_TXLINE_ROOT_PDA = new PublicKey("EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr");
const CANONICAL_VALIDATION_PAYLOAD_HASH = Buffer.from(canonicalValidation.validationPayloadHash, "hex");
const CANONICAL_EVENT_STAT_ROOT = Buffer.from(canonicalValidation.validationPayload.eventStatRoot as number[]);
// France (home stat key 1) 1 - 0 Morocco (away stat key 2) at the proven sequence => YES.
const CANONICAL_HOME_SCORE = Number(
  (canonicalValidation.validationPayload.statsToProve as Array<{ key: number; value: number }>).find((s) => s.key === CANONICAL_STAT_KEY_HOME)?.value ?? 1
);
const CANONICAL_AWAY_SCORE = Number(
  (canonicalValidation.validationPayload.statsToProve as Array<{ key: number; value: number }>).find((s) => s.key === CANONICAL_STAT_KEY_AWAY)?.value ?? 0
);
const TOLERANCE_2C = 20_000;
// On-chain sandbox stake in lamports (0.02 SOL). Kept small because filled orders now
// finalize into the ProtocolVault; the receipt's display stake ($500) is separate.
const STAKE_LAMPORTS = 20_000_000;
// Both sides stake 0.02 SOL in the settlement demo, so the winning side collects the whole
// Legacy operator demo sizes. This route is authenticated and is not canonical proof.
const SETTLEMENT_STAKE_LAMPORTS = 20_000_000;
const CANONICAL_LINEGUARD_PROGRAM_ID = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
const CANONICAL_OPERATOR_PUBLIC_KEY = "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq";

const MARKET_DISCRIMINATOR = accountDiscriminator("MarketState");
const MARKET_CONFIG_DISCRIMINATOR = accountDiscriminator("MarketConfig");
const ORDER_DISCRIMINATOR = accountDiscriminator("OrderEscrow");
const VAULT_DISCRIMINATOR = accountDiscriminator("ProtocolVault");
/** 32-byte normalized-event hash bound on-chain for the canonical proof flow. */
const CANONICAL_SOURCE_EVENT_HASH = Buffer.from(canonicalCapture.normalizedEventHash, "hex");
const CANONICAL_CONFIG_COMMITMENT = buildMarketConfigCommitment({
  marketType: "MATCH_WINNER",
  fixtureId: canonicalCapture.fixtureId,
  marketTitle: "France wins",
  materialityRules: { goals: true, redCards: true, penalties: true, oddsUpdates: true },
  backedTeam: "France",
  awayTeam: "Morocco",
  toleranceMicros: TOLERANCE_2C,
});

interface ServerConfig {
  mode: OnChainMode;
  configured: boolean;
  reason?: string;
  cluster?: "devnet" | "localnet";
  rpcUrl?: string;
  programId: PublicKey;
  payer: Keypair | null;
}

interface PdaLabels {
  marketLabel?: string;
  orderLabel?: string;
}

export function parseSide(value: unknown): OnChainSide {
  return value === "NO" ? "NO" : "YES";
}

export function getLineGuardServerConfig(): ServerConfig {
  const rawCluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  const cluster = rawCluster === "devnet" || rawCluster === "localnet" ? rawCluster : undefined;
  const programIdRaw = process.env.NEXT_PUBLIC_LINEGUARD_PROGRAM_ID || (cluster === "localnet" ? LOCAL_LINEGUARD_PROGRAM_ID : "");
  const programId = new PublicKey(programIdRaw || LOCAL_LINEGUARD_PROGRAM_ID);
  const payer = readOperatorKeypair();

  if (!cluster) {
    return {
      mode: "not_configured",
      configured: false,
      reason: "Set NEXT_PUBLIC_SOLANA_CLUSTER to devnet or localnet to enable on-chain settlement.",
      programId,
      payer,
    };
  }

  if (!programIdRaw) {
    return {
      mode: "not_configured",
      configured: false,
      reason: "NEXT_PUBLIC_LINEGUARD_PROGRAM_ID is missing.",
      cluster,
      programId,
      payer,
    };
  }

  if (!payer) {
    return {
      mode: "not_configured",
      configured: false,
      reason: "LINEGUARD_OPERATOR_KEYPAIR is missing or invalid, so the server cannot send settlement transactions.",
      cluster,
      programId,
      payer,
    };
  }

  return {
    mode: cluster,
    configured: true,
    cluster,
    rpcUrl: process.env.SOLANA_RPC_URL || (cluster === "devnet" ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899"),
    programId,
    payer,
  };
}

export interface SignerInfo {
  configured: boolean;
  cluster?: "devnet" | "localnet";
  programId: string;
  programExplorerUrl?: string;
  /** The operator signer's PUBLIC key. The secret key is never serialised or returned. */
  signerPublicKey?: string;
  signerExplorerUrl?: string;
  balanceLamports?: number;
  balanceSol?: number;
  reason?: string;
}

/** Report the configured signer's public key + devnet balance. Never exposes the secret key. */
export async function getSignerInfo(): Promise<SignerInfo> {
  const cfg = getLineGuardServerConfig();
  const info: SignerInfo = {
    configured: cfg.configured,
    cluster: cfg.cluster,
    programId: cfg.programId.toBase58(),
    programExplorerUrl: cfg.cluster ? programExplorerUrl(cfg.cluster, cfg.programId.toBase58()) : undefined,
    reason: cfg.configured ? undefined : cfg.reason ?? "Devnet signer not configured.",
  };
  if (!cfg.configured || !cfg.payer || !cfg.cluster || !cfg.rpcUrl) return info;

  info.signerPublicKey = cfg.payer.publicKey.toBase58();
  info.signerExplorerUrl = addressExplorerUrl(cfg.cluster, info.signerPublicKey);
  try {
    const connection = new Connection(cfg.rpcUrl, "confirmed");
    const lamports = await connection.getBalance(cfg.payer.publicKey, "confirmed");
    info.balanceLamports = lamports;
    info.balanceSol = lamports / 1_000_000_000;
  } catch {
    // Balance is best-effort; the public key is still reported when RPC is briefly unreachable.
  }
  return info;
}

export interface CustomInitResult {
  ok: boolean;
  configured: boolean;
  cluster?: "devnet" | "localnet";
  programId: string;
  marketId: string;
  marketPda?: string;
  marketConfigPda?: string;
  marketPdaExplorerUrl?: string;
  signature?: string;
  explorerUrl?: string;
  alreadyInitialized?: boolean;
  marketType?: FairXMarketType;
  fixtureIdHash?: string;
  marketTitleHash?: string;
  materialityConfigHash?: string;
  settlementConfigHash?: string;
  oracleAuthority?: string;
  reason?: string;
}

export interface CustomInitInput {
  /** The FairX app-level market id. Hashed to a deterministic 32-byte on-chain market id. */
  marketId: string;
  marketType: FairXMarketType;
  fixtureId: string;
  marketTitle: string;
  materialityRules: MaterialityRules;
  backedTeam?: string;
  awayTeam?: string;
  targetSide?: string;
  displayedPriceMicros: number;
  fairPriceMicros: number;
  toleranceMicros: number;
}

/**
 * Initialize an arbitrary creator market and its config PDA on devnet. This
 * commits fairness rules; it does not itself place or settle an order.
 */
export async function initializeCustomOnChainMarket(input: CustomInitInput): Promise<CustomInitResult> {
  const cfg = getLineGuardServerConfig();
  const programId = cfg.programId.toBase58();
  const base: CustomInitResult = { ok: false, configured: cfg.configured, cluster: cfg.cluster, programId, marketId: input.marketId };
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...base, reason: cfg.reason ?? "Devnet signer not configured." };
  }
  if (input.marketType !== "MATCH_WINNER") {
    return { ...base, reason: `${input.marketType} is UNSUPPORTED_FOR_SETTLEMENT; only MATCH_WINNER_HOME may be initialized on-chain.` };
  }
  if (!input.backedTeam?.trim() || !input.awayTeam?.trim()) {
    return { ...base, reason: "MATCH_WINNER_HOME requires committed home and away teams." };
  }
  const fixtureId = Number(input.fixtureId);
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    return { ...base, reason: "MATCH_WINNER_HOME requires a positive numeric TxLINE fixture ID." };
  }

  const seed = marketIdSeed(input.marketId);
  const marketPda = deriveMarketPda(programId, seed);
  const marketConfigPda = deriveMarketConfigPda(programId, marketPda);
  const marketPdaExplorerUrl = addressExplorerUrl(cfg.cluster, marketPda.toBase58());
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  if (!(await schemaSupportsMarketConfig(connection, cfg.programId))) {
    return { ...base, marketPda: marketPda.toBase58(), marketConfigPda: marketConfigPda.toBase58(), marketPdaExplorerUrl, reason: SCHEMA_MISMATCH_REASON };
  }
  const commitment = configCommitment(input);

  try {
    const existing = await connection.getAccountInfo(marketPda, "confirmed");
    const existingConfig = await fetchMarketConfig(connection, marketConfigPda, cfg.programId);
    if (existing && existingConfig) {
      if (!configMatches(existingConfig, commitment)) {
        return { ...base, marketPda: marketPda.toBase58(), marketConfigPda: marketConfigPda.toBase58(), marketPdaExplorerUrl, reason: "Existing on-chain market config does not match this local market definition." };
      }
      return configResult(base, marketPda, marketConfigPda, marketPdaExplorerUrl, commitment, cfg.payer.publicKey.toBase58(), undefined, true);
    }

    const instruction = existing
      ? new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: marketPda, isSigner: false, isWritable: false },
          { pubkey: marketConfigPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("attach_market_config", [...configIxParts(commitment), ...resolutionIxParts(commitment)]),
      })
      : new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: marketPda, isSigner: false, isWritable: true },
          { pubkey: marketConfigPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("initialize_market_config", [
          Buffer.from(seed),
          u64(1),
          u64(1),
          u64(clampMicros(input.displayedPriceMicros)),
          u64(clampMicros(input.fairPriceMicros)),
          u64(clampMicros(input.toleranceMicros)),
          ...configIxParts(commitment),
          u64(fixtureId),
          i64(0),
          ...resolutionIxParts(commitment),
        ]),
      });
    const signature = await sendInstruction(connection, cfg, instruction);
    return configResult(base, marketPda, marketConfigPda, marketPdaExplorerUrl, commitment, cfg.payer.publicKey.toBase58(), signature, Boolean(existing));
  } catch (err) {
    return { ...base, marketPda: marketPda.toBase58(), marketConfigPda: marketConfigPda.toBase58(), marketPdaExplorerUrl, reason: err instanceof Error ? err.message : String(err) };
  }
}

function configCommitment(input: Pick<CustomInitInput, "marketType" | "fixtureId" | "marketTitle" | "materialityRules" | "backedTeam" | "awayTeam" | "targetSide" | "toleranceMicros">): MarketConfigCommitment {
  return buildMarketConfigCommitment({
    marketType: input.marketType,
    fixtureId: input.fixtureId,
    marketTitle: input.marketTitle,
    materialityRules: input.materialityRules,
    backedTeam: input.backedTeam,
    awayTeam: input.awayTeam,
    targetSide: input.targetSide,
    toleranceMicros: clampMicros(input.toleranceMicros),
  });
}

function resolutionIxParts(commitment: MarketConfigCommitment): Buffer[] {
  return [
    Buffer.from([commitment.resolutionRuleCode]),
    u16(commitment.homeStatKey),
    u16(commitment.awayStatKey),
    Buffer.from(commitment.homeTeamHash, "hex"),
    Buffer.from(commitment.awayTeamHash, "hex"),
  ];
}

function configIxParts(commitment: MarketConfigCommitment): Buffer[] {
  return [
    Buffer.from([commitment.marketTypeCode]),
    Buffer.from(commitment.fixtureIdHash, "hex"),
    Buffer.from(commitment.marketTitleHash, "hex"),
    Buffer.from(commitment.materialityConfigHash, "hex"),
    Buffer.from(commitment.settlementConfigHash, "hex"),
  ];
}

function configResult(
  base: CustomInitResult,
  marketPda: PublicKey,
  marketConfigPda: PublicKey,
  marketPdaExplorerUrl: string | undefined,
  commitment: MarketConfigCommitment,
  oracleAuthority: string,
  signature?: string,
  alreadyInitialized = false
): CustomInitResult {
  return {
    ...base,
    ok: true,
    marketPda: marketPda.toBase58(),
    marketConfigPda: marketConfigPda.toBase58(),
    marketPdaExplorerUrl,
    signature,
    explorerUrl: signature && base.cluster ? explorerUrl(base.cluster, signature) : undefined,
    alreadyInitialized,
    marketType: commitment.marketType,
    fixtureIdHash: commitment.fixtureIdHash,
    marketTitleHash: commitment.marketTitleHash,
    materialityConfigHash: commitment.materialityConfigHash,
    settlementConfigHash: commitment.settlementConfigHash,
    oracleAuthority,
    reason: alreadyInitialized ? "Market config committed on-chain." : "Market and config committed on-chain.",
  };
}

function configMatches(config: ParsedOnChainMarketConfig, commitment: MarketConfigCommitment): boolean {
  return config.marketTypeCode === commitment.marketTypeCode
    && config.fixtureIdHashHex === commitment.fixtureIdHash
    && config.marketTitleHashHex === commitment.marketTitleHash
    && config.materialityConfigHashHex === commitment.materialityConfigHash
    && config.settlementConfigHashHex === commitment.settlementConfigHash
    && config.resolutionRuleCode === commitment.resolutionRuleCode
    && config.homeStatKey === commitment.homeStatKey
    && config.awayStatKey === commitment.awayStatKey
    && config.homeTeamHashHex === commitment.homeTeamHash
    && config.awayTeamHashHex === commitment.awayTeamHash;
}

/** Small sandbox stake (0.01 SOL) for custom devnet orders — filled stakes finalize into the vault. */
const CUSTOM_STAKE_LAMPORTS = 10_000_000;

export interface CustomOrderInput extends Omit<CustomInitInput, "fairPriceMicros" | "toleranceMicros"> {
  marketId: string;
  side: OnChainSide;
  displayedPriceMicros: number;
  fairPriceMicros?: number;
  toleranceMicros?: number;
}

export interface CustomOrderResult {
  ok: boolean;
  configured: boolean;
  cluster?: "devnet" | "localnet";
  programId: string;
  marketId: string;
  marketPda?: string;
  orderPda?: string;
  vaultPda?: string;
  signatures: string[];
  explorerUrls: string[];
  verdict?: ParsedOnChainOrder["verdict"];
  edgeMicros?: number;
  settlementDestination?: "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT";
  sourceEventHash?: string;
  proof?: OnChainProof;
  reason?: string;
}

/**
 * Place + evaluate a REAL devnet order on a custom market. Initializes the market
 * and vault on demand, opens a stale window via an ingest, escrows the stake, then
 * evaluates on-chain: YES stale-edge → refunded to trader; NO/no-edge → finalized to vault.
 */
export async function runCustomOnChainOrder(input: CustomOrderInput): Promise<CustomOrderResult> {
  const cfg = getLineGuardServerConfig();
  const programId = cfg.programId.toBase58();
  const base: CustomOrderResult = {
    ok: false,
    configured: cfg.configured,
    cluster: cfg.cluster,
    programId,
    marketId: input.marketId,
    signatures: [],
    explorerUrls: [],
  };
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...base, reason: cfg.reason ?? "Devnet operator not configured." };
  }
  if (input.marketType !== "MATCH_WINNER") return { ...base, reason: `${input.marketType} is UNSUPPORTED_FOR_SETTLEMENT.` };
  if (!input.backedTeam?.trim() || !input.awayTeam?.trim()) return { ...base, reason: "MATCH_WINNER_HOME requires committed home and away teams." };
  const fixtureId = Number(input.fixtureId);
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) return { ...base, reason: "MATCH_WINNER_HOME requires a positive numeric TxLINE fixture ID." };

  const connection = new Connection(cfg.rpcUrl, "confirmed");
  if (!(await schemaSupportsMarketConfig(connection, cfg.programId))) {
    return { ...base, reason: SCHEMA_MISMATCH_REASON };
  }
  const seed = marketIdSeed(input.marketId);
  const marketPda = deriveMarketPda(programId, seed);
  const marketConfigPda = deriveMarketConfigPda(programId, marketPda);
  const displayed = clampMicros(input.displayedPriceMicros);
  const tolerance = clampMicros(input.toleranceMicros ?? TOLERANCE_2C);
  const commitment = configCommitment({ ...input, toleranceMicros: tolerance });
  const signatures: string[] = [];

  try {
    let market = await fetchMarket(connection, marketPda, cfg.programId);
    let marketConfig = await fetchMarketConfig(connection, marketConfigPda, cfg.programId);
    if (!market) {
      signatures.push(
        await sendInstruction(
          connection,
          cfg,
          new TransactionInstruction({
            programId: cfg.programId,
            keys: [
              { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
              { pubkey: marketPda, isSigner: false, isWritable: true },
              { pubkey: marketConfigPda, isSigner: false, isWritable: true },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: ixData("initialize_market_config", [
              Buffer.from(seed),
              u64(1),
              u64(1),
              u64(displayed),
              u64(clampMicros(input.fairPriceMicros ?? displayed)),
              u64(tolerance),
              ...configIxParts(commitment),
              u64(fixtureId),
              i64(0),
              ...resolutionIxParts(commitment),
            ]),
          })
        )
      );
      market = await fetchMarket(connection, marketPda, cfg.programId);
      marketConfig = await fetchMarketConfig(connection, marketConfigPda, cfg.programId);
    } else if (!marketConfig) {
      signatures.push(
        await sendInstruction(connection, cfg, new TransactionInstruction({
          programId: cfg.programId,
          keys: [
            { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: marketPda, isSigner: false, isWritable: false },
            { pubkey: marketConfigPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: ixData("attach_market_config", [...configIxParts(commitment), ...resolutionIxParts(commitment)]),
        }))
      );
      marketConfig = await fetchMarketConfig(connection, marketConfigPda, cfg.programId);
    }
    if (!marketConfig || !configMatches(marketConfig, commitment)) {
      throw new Error("On-chain market config is missing or does not match the requested market definition.");
    }

    const vaultPda = await ensureVault(connection, cfg);

    // Open (or extend) a stale window: a favourable event moves fair value while the quote is frozen.
    const newSeq = Math.max((market?.materialSeq ?? 1) + 1, 2);
    const newFair = Math.min(990_000, displayed + 230_000);
    // A deterministic, market-specific normalized-event hash bound on-chain for this sandbox market.
    const customEventHash = Buffer.from(
      hashNormalizedEvent({
        source: "sandbox",
        fixtureId: input.marketId,
        seq: newSeq,
        ts: 0,
        eventType: "ODDS_UPDATE",
        proofStatus: "onchain_verified",
      }),
      "hex"
    );
    signatures.push(
      await sendInstruction(
        connection,
        cfg,
        new TransactionInstruction({
          programId: cfg.programId,
          keys: [
            { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: marketPda, isSigner: false, isWritable: true },
          ],
          data: ixData("ingest_material_event", [u64(newSeq), u64(newFair), customEventHash]),
        })
      )
    );

    const orderId = customOrderId(input.marketId, input.side);
    const orderPda = deriveOrderPda(programId, marketPda, orderId);
    signatures.push(
      await sendInstruction(
        connection,
        cfg,
        new TransactionInstruction({
          programId: cfg.programId,
          keys: [
            { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: marketPda, isSigner: false, isWritable: false },
            { pubkey: orderPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: ixData("place_order", [Buffer.from(orderId), Buffer.from([sideCode(input.side)]), u64(CUSTOM_STAKE_LAMPORTS)]),
        })
      )
    );

    signatures.push(await sendInstruction(connection, cfg, evaluateInstruction(cfg, marketPda, marketConfigPda, orderPda, vaultPda)));

    const finalMarket = await fetchMarket(connection, marketPda, cfg.programId);
    const order = await fetchOrder(connection, orderPda, cfg.programId);
    const explorerUrls = compact(signatures.map((signature) => explorerUrl(cfg.cluster!, signature)));
    const result: CustomOrderResult = {
      ...base,
      ok: true,
      marketPda: marketPda.toBase58(),
      orderPda: orderPda.toBase58(),
      vaultPda: vaultPda.toBase58(),
      signatures,
      explorerUrls,
    };
    if (finalMarket && order) {
      result.verdict = order.verdict;
      result.edgeMicros = order.edgeMicros;
      result.settlementDestination = order.verdictCode === 2 ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT";
      result.sourceEventHash = finalMarket.sourceEventHashHex;
      result.proof = toProof(cfg.cluster, programId, marketPda.toBase58(), marketConfigPda.toBase58(), orderPda.toBase58(), signatures, finalMarket, marketConfig, order, vaultPda.toBase58());
    }
    return result;
  } catch (err) {
    return { ...base, signatures, reason: err instanceof Error ? err.message : String(err) };
  }
}

function customOrderId(marketId: string, side: OnChainSide): Uint8Array {
  const digest = crypto
    .createHash("sha256")
    .update(`${marketId}:${side}:${Date.now()}:${Math.random()}`)
    .digest();
  return Uint8Array.from(digest.subarray(0, 32));
}

/** Deterministic 32-byte on-chain market id from an arbitrary app id (avoids label-collision on long ids). */
function marketIdSeed(marketId: string): Uint8Array {
  const digest = crypto.createHash("sha256").update(marketId).digest();
  return Uint8Array.from(digest.subarray(0, 32));
}

function clampMicros(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.round(value)));
}

function addressExplorerUrl(cluster: "devnet" | "localnet", address: string): string | undefined {
  if (cluster !== "devnet") return undefined;
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

export async function getOnChainState(side: OnChainSide, latestSignature?: string, labels: PdaLabels = {}): Promise<OnChainApiState> {
  const cfg = getLineGuardServerConfig();
  const pdas = derivePdasFor(cfg.programId.toBase58(), side, labels);
  const yes = deriveDefaultPdas(cfg.programId.toBase58(), "YES");
  const no = deriveDefaultPdas(cfg.programId.toBase58(), "NO");
  let market: ParsedOnChainMarket | null = null;
  let marketConfig: ParsedOnChainMarketConfig | null = null;
  let order: ParsedOnChainOrder | null = null;

  if (cfg.cluster) {
    try {
      const connection = new Connection(cfg.rpcUrl || defaultRpcUrl(cfg.cluster), "confirmed");
      market = await fetchMarket(connection, pdas.marketPda, cfg.programId);
      marketConfig = await fetchMarketConfig(connection, pdas.marketConfigPda, cfg.programId);
      order = await fetchOrder(connection, pdas.orderEscrowPda, cfg.programId);
    } catch {
      // The state panel should stay usable even when localnet is offline or devnet is unreachable.
    }
  }

  return {
    ok: cfg.configured,
    mode: cfg.mode,
    configured: cfg.configured,
    reason: cfg.reason,
    cluster: cfg.cluster,
    programId: cfg.programId.toBase58(),
    programExplorerUrl: cfg.cluster ? programExplorerUrl(cfg.cluster, cfg.programId.toBase58()) : undefined,
    marketPda: pdas.marketPda.toBase58(),
    marketConfigPda: pdas.marketConfigPda.toBase58(),
    orderEscrowPda: pdas.orderEscrowPda.toBase58(),
    yesOrderEscrowPda: yes.orderEscrowPda.toBase58(),
    noOrderEscrowPda: no.orderEscrowPda.toBase58(),
    selectedSide: side,
    latestSignature,
    explorerUrl: cfg.cluster && latestSignature ? explorerUrl(cfg.cluster, latestSignature) : undefined,
    signatures: latestSignature ? [latestSignature] : undefined,
    explorerUrls: cfg.cluster && latestSignature ? compact([explorerUrl(cfg.cluster, latestSignature)]) : undefined,
    market,
    marketConfig,
    order,
    localTestsAvailable: true,
  };
}

export async function initializeOnChainMarket() {
  const cfg = getLineGuardServerConfig();
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) return { ...(await getOnChainState("YES")), ok: false };
  const pdas = deriveDefaultPdas(cfg.programId.toBase58(), "YES");
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  try {
    const marketExists = Boolean(await connection.getAccountInfo(pdas.marketPda, "confirmed"));
    const configExists = Boolean(await connection.getAccountInfo(pdas.marketConfigPda, "confirmed"));
    if (marketExists && configExists) return { ...(await getOnChainState("YES")), ok: true, alreadyInitialized: true };
    const instruction = marketExists
      ? new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: false },
          { pubkey: pdas.marketConfigPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
          data: ixData("attach_market_config", [...configIxParts(CANONICAL_CONFIG_COMMITMENT), ...resolutionIxParts(CANONICAL_CONFIG_COMMITMENT)]),
      })
      : new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
          { pubkey: pdas.marketConfigPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("initialize_market_config", [
          Buffer.from(bytes32(LINEGUARD_MARKET_LABEL)), u64(CANONICAL_INITIAL_SEQ), u64(CANONICAL_INITIAL_SEQ), u64(CANONICAL_DISPLAYED_PRICE), u64(CANONICAL_DISPLAYED_PRICE), u64(TOLERANCE_2C),
          ...configIxParts(CANONICAL_CONFIG_COMMITMENT),
          u64(CANONICAL_FIXTURE_ID),
          i64(0),
          ...resolutionIxParts(CANONICAL_CONFIG_COMMITMENT),
        ]),
      });
    const signature = await sendInstruction(connection, cfg, instruction);
    return { ...(await getOnChainState("YES", signature)), signature };
  } catch (err) {
    return { ...(await getOnChainState("YES")), ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function ingestOnChainEvent() {
  return sendAndReturnState("YES", (cfg, pdas) =>
    new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
        { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
      ],
      data: ixData("ingest_material_event", [u64(CANONICAL_EVENT_SEQ), u64(CANONICAL_FAIR_PRICE), CANONICAL_SOURCE_EVENT_HASH]),
    })
  );
}

export async function repriceOnChainMarket() {
  return sendAndReturnState("YES", (cfg, pdas) =>
    new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
        { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
      ],
      data: ixData("reprice_market", [u64(CANONICAL_FAIR_PRICE)]),
    })
  );
}

export async function placeOnChainOrder(side: OnChainSide) {
  return sendAndReturnState(side, (cfg, pdas) =>
    new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: true },
        { pubkey: pdas.marketPda, isSigner: false, isWritable: false },
        { pubkey: pdas.orderEscrowPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData("place_order", [Buffer.from(pdas.orderId), Buffer.from([sideCode(side)]), u64(STAKE_LAMPORTS)]),
    })
  );
}

export async function evaluateOnChainOrder(side: OnChainSide) {
  const cfg = getLineGuardServerConfig();
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...(await getOnChainState(side)), ok: false };
  }
  const pdas = derivePdasFor(cfg.programId.toBase58(), side);
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  try {
    const vaultPda = await ensureVault(connection, cfg);
    const signature = await sendInstruction(connection, cfg, evaluateInstruction(cfg, pdas.marketPda, pdas.marketConfigPda, pdas.orderEscrowPda, vaultPda));
    const result: OnChainActionResponse = { ...(await getOnChainState(side, signature)), signature };
    if (result.cluster && result.market && result.marketConfig && result.order) {
      result.proof = toProof(result.cluster, result.programId, result.marketPda!, result.marketConfigPda!, result.orderEscrowPda!, [signature], result.market, result.marketConfig, result.order, vaultPda.toBase58());
    }
    return result;
  } catch (err) {
    return { ...(await getOnChainState(side)), ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Root-bound settlement-v5 program-data account size: 340,376 byte program + 45 byte header.
 * Keeping this above the deployed settlement-v4 size prevents new instructions from being sent
 * to the older incompatible account schema before an explicitly approved upgrade.
 */
const CONFIG_SCHEMA_PROGRAM_DATA_MIN = 340_421;
const SCHEMA_MISMATCH_REASON =
  "The deployed program schema does not match the current settlement schema. Canonical verified proof remains available.";

/** True only when the currently deployed program supports config-bound evaluation and settlement. */
async function schemaSupportsMarketConfig(connection: Connection, programId: PublicKey): Promise<boolean> {
  try {
    const programAccount = await connection.getAccountInfo(programId, "confirmed");
    if (!programAccount || programAccount.data.length !== 36 || Buffer.from(programAccount.data).readUInt32LE(0) !== 2) return false;
    const dataAddress = new PublicKey(programAccount.data.subarray(4, 36));
    const programData = await connection.getAccountInfo(dataAddress, "confirmed");
    return Boolean(programData && programData.data.length >= CONFIG_SCHEMA_PROGRAM_DATA_MIN);
  } catch {
    return false;
  }
}

export async function runFullOnChainDemo(side: OnChainSide): Promise<OnChainActionResponse> {
  const cfg = getLineGuardServerConfig();
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...(await getOnChainState(side)), ok: false, reason: cfg.reason ?? "Devnet not configured." };
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const marketLabel = `lg-${side.toLowerCase()}-${suffix}`;
  const orderLabel = `ord-${side.toLowerCase()}-${suffix}`;
  const labels = { marketLabel, orderLabel };
  const pdas = derivePdasFor(cfg.programId.toBase58(), side, labels);
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  if (cfg.programId.toBase58() !== CANONICAL_LINEGUARD_PROGRAM_ID) throw new Error("Safety stop: configured LineGuard program differs from the approved program.");
  if (cfg.payer.publicKey.toBase58() !== CANONICAL_OPERATOR_PUBLIC_KEY) throw new Error("Safety stop: configured fee payer differs from the approved operator.");
  if (!(await schemaSupportsMarketConfig(connection, cfg.programId))) {
    return { ...(await getOnChainState(side)), ok: false, reason: SCHEMA_MISMATCH_REASON };
  }
  const signatures: string[] = [];

  const initializeInstruction = new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
          { pubkey: pdas.marketConfigPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("initialize_market_config", [
          Buffer.from(pdas.marketId),
          u64(CANONICAL_INITIAL_SEQ),
          u64(CANONICAL_INITIAL_SEQ),
          u64(CANONICAL_DISPLAYED_PRICE),
          u64(CANONICAL_DISPLAYED_PRICE),
          u64(TOLERANCE_2C),
          ...configIxParts(CANONICAL_CONFIG_COMMITMENT),
          u64(CANONICAL_FIXTURE_ID),
          i64(0),
          ...resolutionIxParts(CANONICAL_CONFIG_COMMITMENT),
        ]),
      });
  assertCanonicalInstruction("initialize", side, cfg, pdas, undefined, initializeInstruction);
  signatures.push(await sendInstruction(connection, cfg, initializeInstruction));

  const ingestInstruction = new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
        ],
        data: ixData("ingest_material_event", [u64(CANONICAL_EVENT_SEQ), u64(CANONICAL_FAIR_PRICE), CANONICAL_SOURCE_EVENT_HASH]),
      });
  assertCanonicalInstruction("ingest", side, cfg, pdas, undefined, ingestInstruction);
  signatures.push(await sendInstruction(connection, cfg, ingestInstruction));

  // Canonical execution is exactly four transactions per flow; never add a surprise vault-initialization transaction.
  const vaultPda = deriveVaultPda(cfg.programId);
  const vaultAccount = await connection.getAccountInfo(vaultPda, "finalized");
  if (!vaultAccount || !vaultAccount.owner.equals(cfg.programId)) throw new Error("Safety stop: the approved ProtocolVault does not exist or has the wrong owner.");
  const vaultBalanceBeforeLamports = vaultAccount.lamports;

  const balanceBeforePlace = await connection.getBalance(cfg.payer.publicKey, "confirmed");
  const placeInstruction = new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: false },
          { pubkey: pdas.orderEscrowPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("place_order", [Buffer.from(pdas.orderId), Buffer.from([sideCode(side)]), u64(STAKE_LAMPORTS)]),
      });
  assertCanonicalInstruction("place", side, cfg, pdas, vaultPda, placeInstruction);
  signatures.push(await sendInstruction(connection, cfg, placeInstruction));
  const balanceAfterPlace = await connection.getBalance(cfg.payer.publicKey, "confirmed");

  const evaluationInstruction = evaluateInstruction(cfg, pdas.marketPda, pdas.marketConfigPda, pdas.orderEscrowPda, vaultPda);
  assertCanonicalInstruction("evaluate", side, cfg, pdas, vaultPda, evaluationInstruction);
  signatures.push(await sendInstruction(connection, cfg, evaluationInstruction));
  const balanceAfterEvaluate = await connection.getBalance(cfg.payer.publicKey, "confirmed");

  const latestSignature = signatures.at(-1);
  const state = await getOnChainState(side, latestSignature, labels);
  const orderLamports = await connection.getBalance(pdas.orderEscrowPda, "confirmed");
  const vaultBalanceLamports = await fetchVaultBalance(connection, vaultPda);
  const explorerUrls = compact(signatures.map((signature) => explorerUrl(cfg.cluster!, signature)));
  const response: OnChainActionResponse = {
    ...state,
    ok: true,
    signature: latestSignature,
    signatures,
    explorerUrls,
  };

  if (state.cluster && state.market && state.marketConfig && state.order) {
    response.proof = toProof(
      state.cluster,
      state.programId,
      pdas.marketPda.toBase58(),
      pdas.marketConfigPda.toBase58(),
      pdas.orderEscrowPda.toBase58(),
      signatures,
      state.market,
      state.marketConfig,
      state.order,
      vaultPda.toBase58()
    );
    const refunded = state.order.status === "VoidedRefunded";
    response.demo = {
      side,
      marketPda: pdas.marketPda.toBase58(),
      orderEscrowPda: pdas.orderEscrowPda.toBase58(),
      signatures,
      explorerUrls,
      verdict: state.order.verdict,
      edgeMicros: state.order.edgeMicros,
      refunded,
      filled: state.order.status === "Filled",
      orderLamports,
      balanceBeforePlace,
      balanceAfterPlace,
      balanceAfterEvaluate,
      settlementDestination: refunded ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT",
      vaultPda: vaultPda.toBase58(),
      vaultBalanceBeforeLamports,
      vaultBalanceLamports,
      vaultDeltaLamports: vaultBalanceLamports - vaultBalanceBeforeLamports,
      sourceEventHash: state.market.sourceEventHashHex,
    };
  }

  return response;
}

/**
 * One-call, complete on-chain market lifecycle: initialize an in-sync market, fill YES and NO
 * into their parimutuel pools, derive the outcome from root-bound submitted scores, then
 * pay the winning side out of the ProtocolVault. This closes the settlement loop end-to-end.
 */
export async function runSettlementDemo(): Promise<OnChainSettlementResult> {
  const cfg = getLineGuardServerConfig();
  const programId = cfg.programId.toBase58();
  const base: OnChainSettlementResult = { ok: false, configured: cfg.configured, cluster: cfg.cluster, programId, signatures: [], explorerUrls: [] };
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...base, reason: cfg.reason ?? "Devnet operator not configured." };
  }
  if (cfg.programId.toBase58() !== CANONICAL_LINEGUARD_PROGRAM_ID) return { ...base, reason: "Safety stop: configured LineGuard program differs from the approved program." };
  if (cfg.payer.publicKey.toBase58() !== CANONICAL_OPERATOR_PUBLIC_KEY) return { ...base, reason: "Safety stop: configured fee payer differs from the approved operator." };

  const connection = new Connection(cfg.rpcUrl, "confirmed");
  if (!(await schemaSupportsMarketConfig(connection, cfg.programId))) {
    return { ...base, reason: SCHEMA_MISMATCH_REASON };
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const marketKey = `lifecycle-${suffix}`;
  const seed = marketIdSeed(marketKey);
  const marketPda = deriveMarketPda(programId, seed);
  const marketConfigPda = deriveMarketConfigPda(programId, marketPda);
  const receiptPda = deriveReceiptPda(cfg.programId, marketPda);
  const signatures: string[] = [];

  const ingestInstruction = () => new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
    ],
    data: ixData("ingest_material_event", [u64(CANONICAL_EVENT_SEQ), u64(CANONICAL_FAIR_PRICE), CANONICAL_SOURCE_EVENT_HASH]),
  });
  const repriceInstruction = () => new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
    ],
    data: ixData("reprice_market", [u64(CANONICAL_FAIR_PRICE)]),
  });

  try {
    // 1. Initialize the market in sync at the displayed price, bound to the genuine fixture.
    const commitment = buildMarketConfigCommitment({
      marketType: "MATCH_WINNER",
      fixtureId: canonicalCapture.fixtureId,
      marketTitle: "France beat Morocco — full lifecycle",
      materialityRules: { goals: true, redCards: true, penalties: true, oddsUpdates: true },
      backedTeam: "France",
      awayTeam: "Morocco",
      toleranceMicros: TOLERANCE_2C,
    });
    signatures.push(await sendInstruction(connection, cfg, new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: marketConfigPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData("initialize_market_config", [
        Buffer.from(seed), u64(CANONICAL_INITIAL_SEQ), u64(CANONICAL_INITIAL_SEQ),
        u64(CANONICAL_DISPLAYED_PRICE), u64(CANONICAL_DISPLAYED_PRICE), u64(TOLERANCE_2C),
        ...configIxParts(commitment), u64(CANONICAL_FIXTURE_ID), i64(0), ...resolutionIxParts(commitment),
      ]),
    })));

    const vaultPda = await ensureVault(connection, cfg);
    const vaultBalanceBeforeLamports = await fetchVaultBalance(connection, vaultPda);

    // 2. A genuine TxLINE material event opens a stale window (fair moves, quote lags).
    signatures.push(await sendInstruction(connection, cfg, ingestInstruction()));

    // 3. PROTECTION: a stale positive-edge YES exploit is escrowed and refunded by LineGuard.
    const exploitId = customOrderId(`${marketKey}:exploit`, "YES");
    const exploitPda = deriveOrderPda(programId, marketPda, exploitId);
    signatures.push(await sendInstruction(connection, cfg, placeOrderInstruction(cfg, marketPda, exploitPda, exploitId, "YES", SETTLEMENT_STAKE_LAMPORTS)));
    signatures.push(await sendInstruction(connection, cfg, evaluateInstruction(cfg, marketPda, marketConfigPda, exploitPda, vaultPda)));

    // 4. The market reprices to the fair value (back in sync).
    signatures.push(await sendInstruction(connection, cfg, repriceInstruction()));

    // 5. Valid post-reprice YES and NO orders fill into their parimutuel pools.
    const yesOrderId = customOrderId(`${marketKey}:yes`, "YES");
    const yesOrderPda = deriveOrderPda(programId, marketPda, yesOrderId);
    signatures.push(await sendInstruction(connection, cfg, placeOrderInstruction(cfg, marketPda, yesOrderPda, yesOrderId, "YES", SETTLEMENT_STAKE_LAMPORTS)));
    signatures.push(await sendInstruction(connection, cfg, evaluateInstruction(cfg, marketPda, marketConfigPda, yesOrderPda, vaultPda)));
    const noOrderId = customOrderId(`${marketKey}:no`, "NO");
    const noOrderPda = deriveOrderPda(programId, marketPda, noOrderId);
    signatures.push(await sendInstruction(connection, cfg, placeOrderInstruction(cfg, marketPda, noOrderPda, noOrderId, "NO", SETTLEMENT_STAKE_LAMPORTS)));
    signatures.push(await sendInstruction(connection, cfg, evaluateInstruction(cfg, marketPda, marketConfigPda, noOrderPda, vaultPda)));

    // 6. Trading closes.
    signatures.push(await sendInstruction(connection, cfg, closeMarketInstruction(cfg, marketPda)));

    // 7. The genuine TxLINE final result is bound on-chain; the outcome is derived from the score.
    signatures.push(await sendInstruction(connection, cfg, submitTxlineValidationInstruction(cfg, marketPda, marketConfigPda, receiptPda, {
      fixtureId: CANONICAL_FIXTURE_ID,
      sequence: CANONICAL_EVENT_SEQ,
      rootEpochDay: CANONICAL_ROOT_EPOCH_DAY,
      homeScore: CANONICAL_HOME_SCORE,
      awayScore: CANONICAL_AWAY_SCORE,
      validationPayloadHash: CANONICAL_VALIDATION_PAYLOAD_HASH,
      eventStatRoot: CANONICAL_EVENT_STAT_ROOT,
    })));

    // 8. Confirmation freezes the validation draft; only confirmed receipts can resolve.
    signatures.push(await sendInstruction(connection, cfg, confirmValidationInstruction(cfg, marketPda, marketConfigPda, receiptPda)));

    // 9. Resolution consumes the receipt and has no arbitrary outcome argument.
    signatures.push(await sendInstruction(connection, cfg, resolveFromTxlineInstruction(cfg, marketPda, marketConfigPda, receiptPda)));

    // 10. The winning YES order claims its parimutuel payout from the vault.
    signatures.push(await sendInstruction(connection, cfg, settleInstruction(cfg, marketPda, yesOrderPda, cfg.payer.publicKey, vaultPda)));

    const [finalMarket, exploitOrder, yesOrder, noOrder, receipt, vaultBalanceAfterLamports] = await Promise.all([
      fetchMarket(connection, marketPda, cfg.programId),
      fetchOrder(connection, exploitPda, cfg.programId),
      fetchOrder(connection, yesOrderPda, cfg.programId),
      fetchOrder(connection, noOrderPda, cfg.programId),
      fetchReceipt(connection, receiptPda, cfg.programId),
      fetchVaultBalance(connection, vaultPda),
    ]);
    const explorerUrls = compact(signatures.map((s) => explorerUrl(cfg.cluster!, s)));
    const yesPool = finalMarket?.yesPoolLamports ?? 0;
    const noPool = finalMarket?.noPoolLamports ?? 0;
    const totalPool = yesPool + noPool;
    const winnerStake = yesOrder?.stakeLamports ?? SETTLEMENT_STAKE_LAMPORTS;
    const winnerPayout = yesPool > 0 ? Math.floor((winnerStake * totalPool) / yesPool) : 0;

    return {
      ...base,
      ok: true,
      marketPda: marketPda.toBase58(),
      marketConfigPda: marketConfigPda.toBase58(),
      vaultPda: vaultPda.toBase58(),
      signatures,
      explorerUrls,
      proof: {
        cluster: cfg.cluster,
        programId,
        marketPda: marketPda.toBase58(),
        marketConfigPda: marketConfigPda.toBase58(),
        vaultPda: vaultPda.toBase58(),
        resolution: finalMarket?.resolution === "NO_WON" ? "NO_WON" : "YES_WON",
        resolutionEventHash: finalMarket?.resolutionEventHashHex ?? CANONICAL_EVENT_STAT_ROOT.toString("hex"),
        yesPoolLamports: yesPool,
        noPoolLamports: noPool,
        totalPoolLamports: totalPool,
        winningPoolLamports: yesPool,
        yesOrderPda: yesOrderPda.toBase58(),
        noOrderPda: noOrderPda.toBase58(),
        winnerOrderPda: yesOrderPda.toBase58(),
        winnerSide: "YES",
        winnerStakeLamports: winnerStake,
        winnerPayoutLamports: winnerPayout,
        winnerOrderStatus: yesOrder?.status ?? "Unknown",
        loserOrderStatus: noOrder?.status ?? "Unknown",
        vaultBalanceBeforeLamports,
        vaultBalanceAfterLamports,
        txSignatures: signatures,
        explorerUrls,
        protectionOrderPda: exploitPda.toBase58(),
        protectionVerdict: exploitOrder?.verdict ?? "UNKNOWN",
        protectionRefunded: exploitOrder?.status === "VoidedRefunded",
        protectionEdgeMicros: exploitOrder?.edgeMicros ?? 0,
        protectionEventHash: finalMarket?.sourceEventHashHex,
        fixtureId: CANONICAL_FIXTURE_ID,
        fixtureIdHash: commitment.fixtureIdHash,
        sequence: CANONICAL_EVENT_SEQ,
        validationRootPda: receipt?.validationRootPdaBase58 ?? CANONICAL_TXLINE_ROOT_PDA.toBase58(),
        validationPayloadHash: receipt?.validationPayloadHashHex ?? CANONICAL_VALIDATION_PAYLOAD_HASH.toString("hex"),
        eventStatRoot: receipt?.eventStatRootHex ?? CANONICAL_EVENT_STAT_ROOT.toString("hex"),
        homeScore: receipt?.homeScore ?? CANONICAL_HOME_SCORE,
        awayScore: receipt?.awayScore ?? CANONICAL_AWAY_SCORE,
        derivedOutcome: receipt?.derivedOutcome ?? 1,
        resolutionRule: "HOME_TEAM_WINS",
        resolutionRuleCode: receipt?.resolutionRuleCode ?? commitment.resolutionRuleCode,
        yesMeaning: "France/home team wins",
        homeTeam: "France",
        awayTeam: "Morocco",
        homeTeamHash: commitment.homeTeamHash,
        awayTeamHash: commitment.awayTeamHash,
        homeStatKey: receipt?.homeStatKey ?? commitment.homeStatKey,
        awayStatKey: receipt?.awayStatKey ?? commitment.awayStatKey,
        validationConfirmed: receipt?.confirmed ?? false,
        validateStatV2Passed: canonicalValidation.simulationPassed,
        inProgramMerkleVerification: false,
        marketTotalInLamports: finalMarket?.marketTotalInLamports ?? totalPool,
        marketTotalPaidLamports: finalMarket?.marketTotalPaidLamports ?? winnerPayout,
        marketTotalRefundedLamports: finalMarket?.marketTotalRefundedLamports ?? 0,
      },
    };
  } catch (err) {
    return { ...base, signatures, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function sendAndReturnState(
  side: OnChainSide,
  build: (cfg: ServerConfig, pdas: ReturnType<typeof deriveDefaultPdas>) => TransactionInstruction
): Promise<OnChainActionResponse> {
  const cfg = getLineGuardServerConfig();
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...(await getOnChainState(side)), ok: false };
  }

  const pdas = derivePdasFor(cfg.programId.toBase58(), side);
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  try {
    const signature = await sendInstruction(connection, cfg, build(cfg, pdas));
    return { ...(await getOnChainState(side, signature)), signature };
  } catch (err) {
    return {
      ...(await getOnChainState(side)),
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function sendInstruction(connection: Connection, cfg: ServerConfig, instruction: TransactionInstruction): Promise<string> {
  if (!cfg.payer) throw new Error("LINEGUARD_OPERATOR_KEYPAIR is missing or invalid.");
  const latest = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: cfg.payer.publicKey, recentBlockhash: latest.blockhash }).add(instruction);
  tx.sign(cfg.payer);

  const simulation = await connection.simulateTransaction(tx);
  if (simulation.value.err) {
    throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 0 });
  await confirmSignatureHttp(connection, signature, latest.lastValidBlockHeight);
  return signature;
}

async function confirmSignatureHttp(connection: Connection, signature: string, lastValidBlockHeight: number): Promise<void> {
  const deadlineMs = Date.now() + 90_000;

  while (Date.now() < deadlineMs) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];

    if (status?.err) {
      throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.err)}`);
    }

    if (status?.confirmationStatus === "finalized") {
      return;
    }

    const blockHeight = await connection.getBlockHeight("confirmed");
    if (blockHeight > lastValidBlockHeight) {
      throw new Error(`Transaction ${signature} expired before confirmation.`);
    }

    await sleep(750);
  }

  throw new Error(`Timed out waiting for transaction ${signature} confirmation.`);
}

type CanonicalStage = "initialize" | "ingest" | "place" | "evaluate";

function assertCanonicalInstruction(
  stage: CanonicalStage,
  side: OnChainSide,
  cfg: ServerConfig,
  pdas: ReturnType<typeof derivePdasFor>,
  vaultPda: PublicKey | undefined,
  instruction: TransactionInstruction,
): void {
  if (!cfg.payer) throw new Error("Safety stop: approved operator is unavailable.");
  if (!instruction.programId.equals(cfg.programId) || cfg.programId.toBase58() !== CANONICAL_LINEGUARD_PROGRAM_ID) {
    throw new Error(`Safety stop: ${stage} targets an unexpected program.`);
  }
  if (cfg.payer.publicKey.toBase58() !== CANONICAL_OPERATOR_PUBLIC_KEY) throw new Error(`Safety stop: ${stage} has an unexpected fee payer.`);

  const expected = stage === "initialize"
    ? {
        keys: [
          [cfg.payer.publicKey, true, true], [pdas.marketPda, false, true], [pdas.marketConfigPda, false, true], [SystemProgram.programId, false, false],
        ] as const,
        data: ixData("initialize_market_config", [
          Buffer.from(pdas.marketId), u64(CANONICAL_INITIAL_SEQ), u64(CANONICAL_INITIAL_SEQ), u64(CANONICAL_DISPLAYED_PRICE), u64(CANONICAL_DISPLAYED_PRICE), u64(TOLERANCE_2C), ...configIxParts(CANONICAL_CONFIG_COMMITMENT), u64(CANONICAL_FIXTURE_ID), i64(0), ...resolutionIxParts(CANONICAL_CONFIG_COMMITMENT),
        ]),
      }
    : stage === "ingest"
      ? {
          keys: [[cfg.payer.publicKey, true, false], [pdas.marketPda, false, true]] as const,
          data: ixData("ingest_material_event", [u64(CANONICAL_EVENT_SEQ), u64(CANONICAL_FAIR_PRICE), CANONICAL_SOURCE_EVENT_HASH]),
        }
      : stage === "place"
        ? {
            keys: [
              [cfg.payer.publicKey, true, true], [pdas.marketPda, false, false], [pdas.orderEscrowPda, false, true], [SystemProgram.programId, false, false],
            ] as const,
            data: ixData("place_order", [Buffer.from(pdas.orderId), Buffer.from([sideCode(side)]), u64(STAKE_LAMPORTS)]),
          }
        : {
            keys: [
              [pdas.marketPda, false, true], [pdas.marketConfigPda, false, false], [pdas.orderEscrowPda, false, true], [cfg.payer.publicKey, false, true], [vaultPda!, false, true],
            ] as const,
            data: ixData("evaluate_order", []),
          };

  if (instruction.keys.length !== expected.keys.length) throw new Error(`Safety stop: ${stage} has an unexpected account count.`);
  for (let index = 0; index < expected.keys.length; index += 1) {
    const actual = instruction.keys[index];
    const [pubkey, signer, writable] = expected.keys[index];
    if (!actual.pubkey.equals(pubkey) || actual.isSigner !== signer || actual.isWritable !== writable) {
      throw new Error(`Safety stop: ${stage} account ${index} differs from the approved plan.`);
    }
  }
  if (!instruction.data.equals(expected.data)) throw new Error(`Safety stop: ${stage} arguments differ from the approved plan.`);
  if (stage === "place" && instruction.data.readBigUInt64LE(41) !== BigInt(STAKE_LAMPORTS)) throw new Error("Safety stop: escrow amount is not 0.02 SOL.");
  if (stage === "ingest" && instruction.data.subarray(24, 56).toString("hex") !== canonicalCapture.normalizedEventHash) throw new Error("Safety stop: source event hash mismatch.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMarket(connection: Connection, address: PublicKey, programId: PublicKey): Promise<ParsedOnChainMarket | null> {
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info || !info.owner.equals(programId) || info.data.length < 114) return null;
  const data = Buffer.from(info.data);
  if (!data.subarray(0, 8).equals(MARKET_DISCRIMINATOR)) return null;

  return {
    address: address.toBase58(),
    authority: new PublicKey(data.subarray(8, 40)).toBase58(),
    marketIdHex: data.subarray(40, 72).toString("hex"),
    materialSeq: Number(readU64(data, 72)),
    pricedAtSeq: Number(readU64(data, 80)),
    displayedPriceMicros: Number(readU64(data, 88)),
    fairPriceMicros: Number(readU64(data, 96)),
    toleranceMicros: Number(readU64(data, 104)),
    statusCode: data[112] ?? 255,
    status: marketStatus(data[112] ?? 255),
    bump: data[113] ?? 0,
    // source_event_hash is additive at offset 114; older canonical markets predate it → zeros.
    sourceEventHashHex: data.length >= 146 ? data.subarray(114, 146).toString("hex") : "00".repeat(32),
    // Settlement fields are additive at offset 146 (settlement-v3 schema); older markets → defaults.
    yesPoolLamports: data.length >= 154 ? Number(readU64(data, 146)) : 0,
    noPoolLamports: data.length >= 162 ? Number(readU64(data, 154)) : 0,
    resolutionCode: data.length >= 163 ? data[162] ?? 0 : 0,
    resolution: marketResolution(data.length >= 163 ? data[162] ?? 0 : 0),
    resolved: data.length >= 196 ? (data[195] ?? 0) === 1 : false,
    resolutionEventHashHex: data.length >= 195 ? data.subarray(163, 195).toString("hex") : "00".repeat(32),
    // Resolution-integrity fields are additive at offset 196 (settlement-v4 schema).
    fixtureId: data.length >= 204 ? Number(readU64(data, 196)) : 0,
    closeTime: data.length >= 212 ? Number(readI64(data, 204)) : 0,
    tradingClosed: data.length >= 213 ? (data[212] ?? 0) === 1 : false,
    resolvedAt: data.length >= 221 ? Number(readI64(data, 213)) : 0,
    marketTotalInLamports: data.length >= 229 ? Number(readU64(data, 221)) : 0,
    marketTotalPaidLamports: data.length >= 237 ? Number(readU64(data, 229)) : 0,
    marketTotalRefundedLamports: data.length >= 245 ? Number(readU64(data, 237)) : 0,
    validationPayloadHashHex: data.length >= 277 ? data.subarray(245, 277).toString("hex") : "00".repeat(32),
  };
}

function marketResolution(code: number): ParsedOnChainMarket["resolution"] {
  return code === 0 ? "UNRESOLVED" : code === 1 ? "YES_WON" : code === 2 ? "NO_WON" : code === 3 ? "VOIDED" : "UNKNOWN";
}

async function fetchReceipt(connection: Connection, address: PublicKey, programId: PublicKey): Promise<ParsedOnChainReceipt | null> {
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info || !info.owner.equals(programId) || info.data.length < 246) return null;
  const data = Buffer.from(info.data);
  return {
    address: address.toBase58(),
    market: new PublicKey(data.subarray(8, 40)).toBase58(),
    fixtureId: Number(readU64(data, 72)),
    fixtureIdHashHex: data.subarray(80, 112).toString("hex"),
    sequence: Number(readU64(data, 112)),
    homeStatKey: data.readUInt16LE(120),
    awayStatKey: data.readUInt16LE(122),
    resolutionRuleCode: data[124] ?? 255,
    rootEpochDay: data.readUInt16LE(125),
    validationRootPdaBase58: new PublicKey(data.subarray(127, 159)).toBase58(),
    validationPayloadHashHex: data.subarray(159, 191).toString("hex"),
    eventStatRootHex: data.subarray(191, 223).toString("hex"),
    homeScore: data.readUInt16LE(223),
    awayScore: data.readUInt16LE(225),
    derivedOutcome: data[227] ?? 0,
    confirmed: (data[228] ?? 0) === 1,
    updatedAt: Number(readI64(data, 229)),
    confirmedAt: Number(readI64(data, 237)),
  };
}

async function fetchMarketConfig(connection: Connection, address: PublicKey, programId: PublicKey): Promise<ParsedOnChainMarketConfig | null> {
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info || !info.owner.equals(programId) || info.data.length < 246) return null;
  const data = Buffer.from(info.data);
  if (!data.subarray(0, 8).equals(MARKET_CONFIG_DISCRIMINATOR)) return null;
  const marketTypeCode = data[8] ?? 255;
  return {
    address: address.toBase58(),
    marketTypeCode,
    marketType: marketTypeName(marketTypeCode),
    fixtureIdHashHex: data.subarray(9, 41).toString("hex"),
    marketTitleHashHex: data.subarray(41, 73).toString("hex"),
    materialityConfigHashHex: data.subarray(73, 105).toString("hex"),
    settlementConfigHashHex: data.subarray(105, 137).toString("hex"),
    authority: new PublicKey(data.subarray(137, 169)).toBase58(),
    createdAtSlot: Number(readU64(data, 169)),
    resolutionRuleCode: data[177] ?? 255,
    homeStatKey: data.readUInt16LE(178),
    awayStatKey: data.readUInt16LE(180),
    homeTeamHashHex: data.subarray(182, 214).toString("hex"),
    awayTeamHashHex: data.subarray(214, 246).toString("hex"),
  };
}

async function fetchOrder(connection: Connection, address: PublicKey, programId: PublicKey): Promise<ParsedOnChainOrder | null> {
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info || !info.owner.equals(programId) || info.data.length < 140) return null;
  const data = Buffer.from(info.data);
  if (!data.subarray(0, 8).equals(ORDER_DISCRIMINATOR)) return null;

  const side = data[104] ?? 255;
  const status = data[137] ?? 255;
  const verdict = data[138] ?? 255;
  const settlementDestination = data.length >= 141 ? data[140] ?? 255 : 255;

  return {
    address: address.toBase58(),
    trader: new PublicKey(data.subarray(8, 40)).toBase58(),
    market: new PublicKey(data.subarray(40, 72)).toBase58(),
    orderIdHex: data.subarray(72, 104).toString("hex"),
    sideCode: side,
    side: side === 0 ? "YES" : side === 1 ? "NO" : "UNKNOWN",
    stakeLamports: Number(readU64(data, 105)),
    observedPriceMicros: Number(readU64(data, 113)),
    fairSidePriceMicros: Number(readU64(data, 121)),
    edgeMicros: Number(readI64(data, 129)),
    statusCode: status,
    status: orderStatus(status),
    verdictCode: verdict,
    verdict: guardVerdict(verdict),
    bump: data[139] ?? 0,
    settlementDestinationCode: settlementDestination,
    settlementDestination: settlementDestination === 0 ? "REFUNDED_TO_TRADER" : settlementDestination === 1 ? "FINALIZED_TO_VAULT" : settlementDestination === 2 ? "PENDING" : "UNKNOWN",
    sourceEventHashHex: data.length >= 173 ? data.subarray(141, 173).toString("hex") : "00".repeat(32),
    materialityConfigHashHex: data.length >= 205 ? data.subarray(173, 205).toString("hex") : "00".repeat(32),
  };
}

function readOperatorKeypair(): Keypair | null {
  // New canonical name first; older SOLANA_DEMO_KEYPAIR kept as a backward-compatible fallback.
  const raw = process.env.LINEGUARD_OPERATOR_KEYPAIR ?? process.env.SOLANA_OPERATOR_KEYPAIR ?? process.env.SOLANA_DEMO_KEYPAIR;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
  } catch {
    // Fall through to base58 parsing.
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return null;
  }
}

function defaultRpcUrl(cluster: "devnet" | "localnet"): string {
  return cluster === "devnet" ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899";
}

function derivePdasFor(programId: string, side: OnChainSide, labels: PdaLabels = {}) {
  return deriveLineGuardPdas(programId, labels.marketLabel ?? LINEGUARD_MARKET_LABEL, labels.orderLabel ?? orderLabelForSide(side));
}

function deriveVaultPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault")], programId)[0];
}

/** Create the singleton ProtocolVault once. Returns the vault PDA (existing or newly created). */
async function ensureVault(connection: Connection, cfg: ServerConfig): Promise<PublicKey> {
  const vaultPda = deriveVaultPda(cfg.programId);
  const info = await connection.getAccountInfo(vaultPda, "confirmed");
  if (info) return vaultPda;
  await sendInstruction(
    connection,
    cfg,
    new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData("initialize_vault", []),
    })
  );
  return vaultPda;
}

async function fetchVaultBalance(connection: Connection, vaultPda: PublicKey): Promise<number> {
  try {
    return await connection.getBalance(vaultPda, "confirmed");
  } catch {
    return 0;
  }
}

/** evaluate_order accounts are [market(writable), config, order, trader, vault]. market is
 *  writable because a filled order accumulates its stake into the market's settlement pool. */
function evaluateInstruction(cfg: ServerConfig, marketPda: PublicKey, marketConfigPda: PublicKey, orderPda: PublicKey, vaultPda: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: orderPda, isSigner: false, isWritable: true },
      { pubkey: cfg.payer!.publicKey, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
    ],
    data: ixData("evaluate_order", []),
  });
}

/** place_order accounts are [trader(signer), market, order, system]. */
function placeOrderInstruction(cfg: ServerConfig, marketPda: PublicKey, orderPda: PublicKey, orderId: Uint8Array, side: OnChainSide, stakeLamports: number): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: true },
      { pubkey: marketPda, isSigner: false, isWritable: false },
      { pubkey: orderPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData("place_order", [Buffer.from(orderId), Buffer.from([sideCode(side)]), u64(stakeLamports)]),
  });
}

function deriveReceiptPda(programId: PublicKey, marketPda: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("txval"), marketPda.toBuffer()], programId)[0];
}

/** close_market accounts are [closer(signer), market(writable)]. */
function closeMarketInstruction(cfg: ServerConfig, marketPda: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
    ],
    data: ixData("close_market", []),
  });
}

interface TxlineValidationParams {
  fixtureId: number;
  sequence: number;
  rootEpochDay: number;
  homeScore: number;
  awayScore: number;
  validationPayloadHash: Buffer;
  eventStatRoot: Buffer;
}

/** submit_txline_validation reads stat keys/rule from MarketConfig and stores a mutable draft. */
function submitTxlineValidationInstruction(cfg: ServerConfig, marketPda: PublicKey, marketConfigPda: PublicKey, receiptPda: PublicKey, params: TxlineValidationParams): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: true },
      { pubkey: marketPda, isSigner: false, isWritable: false },
      { pubkey: marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: CANONICAL_TXLINE_ROOT_PDA, isSigner: false, isWritable: false },
      { pubkey: receiptPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData("submit_txline_validation", [
      u64(params.fixtureId),
      u64(params.sequence),
      u16(params.rootEpochDay),
      u16(params.homeScore),
      u16(params.awayScore),
      params.validationPayloadHash,
      params.eventStatRoot,
    ]),
  });
}

function confirmValidationInstruction(cfg: ServerConfig, marketPda: PublicKey, marketConfigPda: PublicKey, receiptPda: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: false },
      { pubkey: marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: receiptPda, isSigner: false, isWritable: true },
    ],
    data: ixData("confirm_validation", []),
  });
}

/** resolve_market_from_txline consumes only a confirmed receipt. */
function resolveFromTxlineInstruction(cfg: ServerConfig, marketPda: PublicKey, marketConfigPda: PublicKey, receiptPda: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: marketConfigPda, isSigner: false, isWritable: false },
      { pubkey: receiptPda, isSigner: false, isWritable: false },
    ],
    data: ixData("resolve_market_from_txline", []),
  });
}

/** settle_order accounts are [market(writable), order(writable), trader(writable), vault(writable)]. */
function settleInstruction(cfg: ServerConfig, marketPda: PublicKey, orderPda: PublicKey, trader: PublicKey, vaultPda: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: orderPda, isSigner: false, isWritable: true },
      { pubkey: trader, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
    ],
    data: ixData("settle_order", []),
  });
}

function ixData(name: string, parts: Buffer[]): Buffer {
  return Buffer.concat([instructionDiscriminator(name), ...parts]);
}

function instructionDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function accountDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

function u64(value: number | bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

function i64(value: number | bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigInt64LE(BigInt(value));
  return out;
}

function u16(value: number): Buffer {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
}

function readU64(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function readI64(data: Buffer, offset: number): bigint {
  return data.readBigInt64LE(offset);
}

function marketStatus(code: number): ParsedOnChainMarket["status"] {
  return code === 0 ? "Trading" : code === 1 ? "Stale" : code === 2 ? "Repricing" : "Unknown";
}

function marketTypeName(code: number): ParsedOnChainMarketConfig["marketType"] {
  return code === 0 ? "MATCH_WINNER" : code === 1 ? "TOTAL_GOALS" : code === 2 ? "NEXT_GOAL" : code === 3 ? "CUSTOM_YES_NO" : "UNKNOWN";
}

function orderStatus(code: number): ParsedOnChainOrder["status"] {
  return code === 0
    ? "Submitted"
    : code === 1
      ? "Escrowed"
      : code === 2
        ? "Evaluated"
        : code === 3
          ? "Filled"
          : code === 4
            ? "VoidedRefunded"
            : code === 5
              ? "Settled"
              : "Unknown";
}

function guardVerdict(code: number): ParsedOnChainOrder["verdict"] {
  return code === 0 ? "ALLOWED" : code === 1 ? "STALE_ALLOWED_NO_EDGE" : code === 2 ? "VOIDED_REFUNDED" : "UNKNOWN";
}

function toProof(
  cluster: "devnet" | "localnet",
  programId: string,
  marketPda: string,
  marketConfigPda: string,
  orderEscrowPda: string,
  txSignatures: string[],
  market: ParsedOnChainMarket,
  marketConfig: ParsedOnChainMarketConfig,
  order: ParsedOnChainOrder,
  vaultPda?: string
): OnChainProof {
  const zeroHash = "00".repeat(32);
  return {
    cluster,
    programId,
    marketPda,
    marketConfigPda,
    orderEscrowPda,
    txSignatures,
    explorerUrls: compact(txSignatures.map((signature) => explorerUrl(cluster, signature))),
    materialSeq: market.materialSeq,
    pricedAtSeq: market.pricedAtSeq,
    observedPriceMicros: order.observedPriceMicros,
    fairSidePriceMicros: order.fairSidePriceMicros,
    toleranceMicros: market.toleranceMicros,
    edgeMicros: order.edgeMicros,
    verdictCode: order.verdictCode,
    statusCode: order.statusCode,
    sourceEventHash: market.sourceEventHashHex && market.sourceEventHashHex !== zeroHash ? market.sourceEventHashHex : undefined,
    orderSourceEventHash: order.sourceEventHashHex && order.sourceEventHashHex !== zeroHash ? order.sourceEventHashHex : undefined,
    orderMaterialityConfigHash: order.materialityConfigHashHex && order.materialityConfigHashHex !== zeroHash ? order.materialityConfigHashHex : undefined,
    marketType: marketConfig.marketType,
    fixtureIdHash: marketConfig.fixtureIdHashHex,
    marketTitleHash: marketConfig.marketTitleHashHex,
    materialityConfigHash: marketConfig.materialityConfigHashHex,
    settlementConfigHash: marketConfig.settlementConfigHashHex,
    oracleAuthority: marketConfig.authority,
    settlementDestination: order.verdictCode === 2 ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT",
    vaultPda,
  };
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}
