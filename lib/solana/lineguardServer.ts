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
import {
  explorerUrl,
  programExplorerUrl,
  type OnChainActionResponse,
  type OnChainApiState,
  type OnChainMode,
  type ParsedOnChainMarket,
  type ParsedOnChainOrder,
} from "@/lib/solana/lineguardProgram";
import {
  bytes32,
  deriveDefaultPdas,
  deriveLineGuardPdas,
  deriveMarketPda,
  deriveOrderPda,
  LINEGUARD_MARKET_LABEL,
  LOCAL_LINEGUARD_PROGRAM_ID,
  orderLabelForSide,
  sideCode,
  type OnChainSide,
} from "@/lib/solana/pdas";
import { DEMO_EVENT_HASHES } from "@/lib/proof/onchainReceipt";
import { hashNormalizedEvent } from "@/lib/proof/eventHash";

const DISPLAYED_40 = 400_000;
const FAIR_40 = 400_000;
const FAIR_63 = 630_000;
const TOLERANCE_2C = 20_000;
// On-chain sandbox stake in lamports (0.02 SOL). Kept small because filled orders now
// finalize into the ProtocolVault; the receipt's display stake ($500) is separate.
const STAKE_LAMPORTS = 20_000_000;

const MARKET_DISCRIMINATOR = accountDiscriminator("MarketState");
const ORDER_DISCRIMINATOR = accountDiscriminator("OrderEscrow");
const VAULT_DISCRIMINATOR = accountDiscriminator("ProtocolVault");
/** 32-byte normalized-event hash bound on-chain for the canonical proof flow. */
const DEMO_SOURCE_EVENT_HASH = Buffer.from(DEMO_EVENT_HASHES.normalizedEventHash, "hex");

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
  marketPdaExplorerUrl?: string;
  signature?: string;
  explorerUrl?: string;
  alreadyInitialized?: boolean;
  reason?: string;
}

export interface CustomInitInput {
  /** The FairX app-level market id. Hashed to a deterministic 32-byte on-chain market id. */
  marketId: string;
  displayedPriceMicros: number;
  fairPriceMicros: number;
  toleranceMicros: number;
}

/**
 * Initialize an arbitrary creator market on devnet. This ONLY creates the
 * MarketState account — it does not settle any trade. Callers must keep custom
 * trading labelled as local simulation unless they also route orders on-chain.
 */
export async function initializeCustomOnChainMarket(input: CustomInitInput): Promise<CustomInitResult> {
  const cfg = getLineGuardServerConfig();
  const programId = cfg.programId.toBase58();
  const base: CustomInitResult = { ok: false, configured: cfg.configured, cluster: cfg.cluster, programId, marketId: input.marketId };
  if (!cfg.configured || !cfg.cluster || !cfg.rpcUrl || !cfg.payer) {
    return { ...base, reason: cfg.reason ?? "Devnet signer not configured." };
  }

  const seed = marketIdSeed(input.marketId);
  const marketPda = deriveMarketPda(programId, seed);
  const marketPdaExplorerUrl = addressExplorerUrl(cfg.cluster, marketPda.toBase58());
  const connection = new Connection(cfg.rpcUrl, "confirmed");

  try {
    const existing = await connection.getAccountInfo(marketPda, "confirmed");
    if (existing) {
      return { ...base, ok: true, marketPda: marketPda.toBase58(), marketPdaExplorerUrl, alreadyInitialized: true, reason: "Market already initialized on devnet." };
    }

    const signature = await sendInstruction(
      connection,
      cfg,
      new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: marketPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("initialize_market", [
          Buffer.from(seed),
          u64(1),
          u64(1),
          u64(clampMicros(input.displayedPriceMicros)),
          u64(clampMicros(input.fairPriceMicros)),
          u64(clampMicros(input.toleranceMicros)),
        ]),
      })
    );
    return {
      ...base,
      ok: true,
      marketPda: marketPda.toBase58(),
      marketPdaExplorerUrl,
      signature,
      explorerUrl: explorerUrl(cfg.cluster, signature),
      reason: "Market initialized on devnet.",
    };
  } catch (err) {
    return { ...base, marketPda: marketPda.toBase58(), marketPdaExplorerUrl, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Small sandbox stake (0.01 SOL) for custom devnet orders — filled stakes finalize into the vault. */
const CUSTOM_STAKE_LAMPORTS = 10_000_000;

export interface CustomOrderInput {
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

  const connection = new Connection(cfg.rpcUrl, "confirmed");
  const seed = marketIdSeed(input.marketId);
  const marketPda = deriveMarketPda(programId, seed);
  const displayed = clampMicros(input.displayedPriceMicros);
  const tolerance = clampMicros(input.toleranceMicros ?? TOLERANCE_2C);
  const signatures: string[] = [];

  try {
    let market = await fetchMarket(connection, marketPda, cfg.programId);
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
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: ixData("initialize_market", [
              Buffer.from(seed),
              u64(1),
              u64(1),
              u64(displayed),
              u64(clampMicros(input.fairPriceMicros ?? displayed)),
              u64(tolerance),
            ]),
          })
        )
      );
      market = await fetchMarket(connection, marketPda, cfg.programId);
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

    signatures.push(await sendInstruction(connection, cfg, evaluateInstruction(cfg, marketPda, orderPda, vaultPda)));

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
      result.proof = toProof(cfg.cluster, programId, marketPda.toBase58(), orderPda.toBase58(), signatures, finalMarket, order, vaultPda.toBase58());
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
  let order: ParsedOnChainOrder | null = null;

  if (cfg.cluster) {
    try {
      const connection = new Connection(cfg.rpcUrl || defaultRpcUrl(cfg.cluster), "confirmed");
      market = await fetchMarket(connection, pdas.marketPda, cfg.programId);
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
    orderEscrowPda: pdas.orderEscrowPda.toBase58(),
    yesOrderEscrowPda: yes.orderEscrowPda.toBase58(),
    noOrderEscrowPda: no.orderEscrowPda.toBase58(),
    selectedSide: side,
    latestSignature,
    explorerUrl: cfg.cluster && latestSignature ? explorerUrl(cfg.cluster, latestSignature) : undefined,
    signatures: latestSignature ? [latestSignature] : undefined,
    explorerUrls: cfg.cluster && latestSignature ? compact([explorerUrl(cfg.cluster, latestSignature)]) : undefined,
    market,
    order,
    localTestsAvailable: true,
  };
}

export async function initializeOnChainMarket() {
  return sendAndReturnState("YES", (cfg, pdas) =>
    new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: true },
        { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData("initialize_market", [
        Buffer.from(bytes32(LINEGUARD_MARKET_LABEL)),
        u64(1),
        u64(1),
        u64(DISPLAYED_40),
        u64(FAIR_40),
        u64(TOLERANCE_2C),
      ]),
    })
  );
}

export async function ingestOnChainEvent() {
  return sendAndReturnState("YES", (cfg, pdas) =>
    new TransactionInstruction({
      programId: cfg.programId,
      keys: [
        { pubkey: cfg.payer!.publicKey, isSigner: true, isWritable: false },
        { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
      ],
      data: ixData("ingest_material_event", [u64(2), u64(FAIR_63), DEMO_SOURCE_EVENT_HASH]),
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
      data: ixData("reprice_market", [u64(FAIR_63)]),
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
    const signature = await sendInstruction(connection, cfg, evaluateInstruction(cfg, pdas.marketPda, pdas.orderEscrowPda, vaultPda));
    const result: OnChainActionResponse = { ...(await getOnChainState(side, signature)), signature };
    if (result.cluster && result.market && result.order) {
      result.proof = toProof(result.cluster, result.programId, result.marketPda!, result.orderEscrowPda!, [signature], result.market, result.order, vaultPda.toBase58());
    }
    return result;
  } catch (err) {
    return { ...(await getOnChainState(side)), ok: false, reason: err instanceof Error ? err.message : String(err) };
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
  const signatures: string[] = [];

  signatures.push(
    await sendInstruction(
      connection,
      cfg,
      new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("initialize_market", [
          Buffer.from(pdas.marketId),
          u64(1),
          u64(1),
          u64(DISPLAYED_40),
          u64(FAIR_40),
          u64(TOLERANCE_2C),
        ]),
      })
    )
  );

  signatures.push(
    await sendInstruction(
      connection,
      cfg,
      new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: true },
        ],
        data: ixData("ingest_material_event", [u64(2), u64(FAIR_63), DEMO_SOURCE_EVENT_HASH]),
      })
    )
  );

  // The vault must exist before evaluation finalizes a filled stake into it.
  const vaultPda = await ensureVault(connection, cfg);

  const balanceBeforePlace = await connection.getBalance(cfg.payer.publicKey, "confirmed");
  signatures.push(
    await sendInstruction(
      connection,
      cfg,
      new TransactionInstruction({
        programId: cfg.programId,
        keys: [
          { pubkey: cfg.payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: pdas.marketPda, isSigner: false, isWritable: false },
          { pubkey: pdas.orderEscrowPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData("place_order", [Buffer.from(pdas.orderId), Buffer.from([sideCode(side)]), u64(STAKE_LAMPORTS)]),
      })
    )
  );
  const balanceAfterPlace = await connection.getBalance(cfg.payer.publicKey, "confirmed");

  signatures.push(await sendInstruction(connection, cfg, evaluateInstruction(cfg, pdas.marketPda, pdas.orderEscrowPda, vaultPda)));
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

  if (state.cluster && state.market && state.order) {
    response.proof = toProof(
      state.cluster,
      state.programId,
      pdas.marketPda.toBase58(),
      pdas.orderEscrowPda.toBase58(),
      signatures,
      state.market,
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
      vaultBalanceLamports,
      sourceEventHash: state.market.sourceEventHashHex,
    };
  }

  return response;
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

  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
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

    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized" || status?.confirmations === null) {
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

/** evaluate_order accounts are [market (ro), order (mut), trader (mut), vault (mut)]. */
function evaluateInstruction(cfg: ServerConfig, marketPda: PublicKey, orderPda: PublicKey, vaultPda: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: cfg.programId,
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: false },
      { pubkey: orderPda, isSigner: false, isWritable: true },
      { pubkey: cfg.payer!.publicKey, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
    ],
    data: ixData("evaluate_order", []),
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

function readU64(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function readI64(data: Buffer, offset: number): bigint {
  return data.readBigInt64LE(offset);
}

function marketStatus(code: number): ParsedOnChainMarket["status"] {
  return code === 0 ? "Trading" : code === 1 ? "Stale" : code === 2 ? "Repricing" : "Unknown";
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
            : "Unknown";
}

function guardVerdict(code: number): ParsedOnChainOrder["verdict"] {
  return code === 0 ? "ALLOWED" : code === 1 ? "STALE_ALLOWED_NO_EDGE" : code === 2 ? "VOIDED_REFUNDED" : "UNKNOWN";
}

function toProof(
  cluster: "devnet" | "localnet",
  programId: string,
  marketPda: string,
  orderEscrowPda: string,
  txSignatures: string[],
  market: ParsedOnChainMarket,
  order: ParsedOnChainOrder,
  vaultPda?: string
): OnChainProof {
  const zeroHash = "00".repeat(32);
  return {
    cluster,
    programId,
    marketPda,
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
    settlementDestination: order.verdictCode === 2 ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT",
    vaultPda,
  };
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}
