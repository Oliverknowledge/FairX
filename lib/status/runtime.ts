import "server-only";

import crypto from "crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSignerInfo } from "@/lib/solana/lineguardServer";
import { LOCAL_LINEGUARD_PROGRAM_ID } from "@/lib/solana/pdas";
import { getTxLineServerConfig, hasTxLineCredentials, txLineAuthHeaders, txLineUrl } from "@/lib/txline/config";
import type { FairXRuntimeStatus } from "@/lib/status/types";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";

const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const VAULT_PDA = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";
const CURRENT_PROGRAM_DATA_ACCOUNT_MIN = 238_717;
const SAFE_PROOF_BALANCE_LAMPORTS = 80_000_000;
const VAULT_DISCRIMINATOR = crypto.createHash("sha256").update("account:ProtocolVault").digest().subarray(0, 8);
const STATUS_CACHE_TTL_MS = 15_000;

let cachedStatus: { value: FairXRuntimeStatus; cachedAt: number } | null = null;
let statusRequest: Promise<FairXRuntimeStatus> | null = null;

function cluster(): "devnet" | "localnet" | "unconfigured" {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet"
    ? "devnet"
    : process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "localnet"
      ? "localnet"
      : "unconfigured";
}

function rpcUrl(currentCluster: ReturnType<typeof cluster>): string | null {
  if (currentCluster === "unconfigured") return null;
  return process.env.SOLANA_RPC_URL
    ?? (currentCluster === "devnet" ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899");
}

function programDataAddress(data: Buffer): PublicKey | null {
  if (data.length !== 36 || data.readUInt32LE(0) !== 2) return null;
  try {
    return new PublicKey(data.subarray(4, 36));
  } catch {
    return null;
  }
}

async function txLineConnectionStatus() {
  const cfg = getTxLineServerConfig();
  const empty = { fixtures: false, scores: false, odds: false, scoresStream: false, oddsStream: false, lastSuccess: null as string | null };
  if (!hasTxLineCredentials(cfg) || !cfg.fixtureId) return empty;
  async function probe(path: string, stream = false): Promise<boolean> {
    try {
      const response = await fetch(txLineUrl(cfg, path, stream), {
        headers: { ...txLineAuthHeaders(cfg), Accept: stream ? "text/event-stream" : "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      });
      const ok = response.ok && (!stream || (response.headers.get("content-type") ?? "").includes("text/event-stream"));
      if (stream) await response.body?.cancel().catch(() => undefined);
      return ok;
    } catch { return false; }
  }
  const [fixtures, scores, odds, scoresStream, oddsStream] = await Promise.all([
    probe(cfg.fixturesSnapshotPath),
    probe(`${cfg.scoresSnapshotPath}/${cfg.fixtureId}`),
    probe(`${cfg.oddsSnapshotPath}/${cfg.fixtureId}`),
    probe(cfg.scoresStreamPath, true),
    probe(cfg.oddsStreamPath, true),
  ]);
  return { fixtures, scores, odds, scoresStream, oddsStream, lastSuccess: [fixtures, scores, odds, scoresStream, oddsStream].some(Boolean) ? new Date().toISOString() : null };
}

export async function getFairXRuntimeStatus(): Promise<FairXRuntimeStatus> {
  const now = Date.now();
  if (cachedStatus && now - cachedStatus.cachedAt < STATUS_CACHE_TTL_MS) return cachedStatus.value;
  if (statusRequest) return statusRequest;
  statusRequest = computeFairXRuntimeStatus();
  try {
    const value = await statusRequest;
    cachedStatus = { value, cachedAt: Date.now() };
    return value;
  } finally {
    statusRequest = null;
  }
}

async function computeFairXRuntimeStatus(): Promise<FairXRuntimeStatus> {
  const currentCluster = cluster();
  const programIdString = process.env.NEXT_PUBLIC_LINEGUARD_PROGRAM_ID || LOCAL_LINEGUARD_PROGRAM_ID;
  const txlineCfg = getTxLineServerConfig();
  const txlineConfigured = hasTxLineCredentials(txlineCfg);
  const base: FairXRuntimeStatus = {
    checkedAt: new Date().toISOString(),
    build: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local").slice(0, 12),
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? "local runtime",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local",
    },
    solana: {
      cluster: currentCluster,
      rpcConnected: false,
      programId: programIdString,
      programExecutable: false,
      schemaCurrent: false,
      schemaLabel: "unknown",
    },
    operator: { configured: false, lowBalance: false },
    vault: { pda: VAULT_PDA, exists: false },
    txline: {
      configured: txlineConfigured,
      authenticated: false,
      connected: false,
      mode: "unconfigured",
      network: txlineConfigured ? txlineCfg.network : null,
      apiOrigin: txlineCfg.apiOrigin,
      fixtureId: txlineCfg.fixtureId,
      endpoints: {
        scoresStream: txlineCfg.scoresStreamPath,
        oddsStream: txlineCfg.oddsStreamPath,
        scoresSnapshot: txlineCfg.scoresSnapshotPath,
        scoresHistorical: txlineCfg.scoresHistoricalPath,
        fixturesSnapshot: txlineCfg.fixturesSnapshotPath,
        oddsSnapshot: txlineCfg.oddsSnapshotPath,
      },
      fixturesAvailable: false,
      scoresAvailable: false,
      oddsAvailable: false,
      scoresStreamConnected: false,
      oddsStreamConnected: false,
      lastSuccessfulRequestAt: null,
      canonicalSourceMode: canonicalCapture.mode as FairXRuntimeStatus["txline"]["canonicalSourceMode"],
      validationAvailable: canonicalValidation.method === "validateStatV2",
      lastValidationPassed: canonicalValidation.simulationPassed,
    },
    freshProofAvailable: false,
    canonicalProofAvailable: true,
    level: "limited",
    reason: "Runtime checks have not completed.",
  };

  const url = rpcUrl(currentCluster);
  if (!url) {
    base.reason = "Solana devnet is not configured; canonical proof remains available.";
    return base;
  }

  let programId: PublicKey;
  try {
    programId = new PublicKey(programIdString);
  } catch {
    base.reason = "Configured program ID is invalid.";
    return base;
  }

  const connection = new Connection(url, "confirmed");
  const [operator, txlineStatus] = await Promise.all([
    getSignerInfo().catch(() => null),
    txLineConnectionStatus(),
  ]);

  if (operator) {
    base.operator = {
      configured: operator.configured,
      publicKey: operator.signerPublicKey,
      balanceLamports: operator.balanceLamports,
      balanceSol: operator.balanceSol,
      lowBalance: operator.configured && (operator.balanceLamports ?? 0) < SAFE_PROOF_BALANCE_LAMPORTS,
    };
  }
  base.txline.fixturesAvailable = txlineStatus.fixtures;
  base.txline.scoresAvailable = txlineStatus.scores;
  base.txline.oddsAvailable = txlineStatus.odds;
  base.txline.scoresStreamConnected = txlineStatus.scoresStream;
  base.txline.oddsStreamConnected = txlineStatus.oddsStream;
  base.txline.lastSuccessfulRequestAt = txlineStatus.lastSuccess;
  base.txline.authenticated = txlineStatus.fixtures;
  base.txline.connected = txlineStatus.scoresStream && txlineStatus.oddsStream;
  base.txline.mode = base.txline.connected ? "live_connected" : txlineConfigured ? "configured_unreachable" : "unconfigured";

  try {
    const [slot, programAccount, vaultAccount] = await Promise.all([
      connection.getSlot("confirmed"),
      connection.getAccountInfo(programId, "confirmed"),
      connection.getAccountInfo(new PublicKey(VAULT_PDA), "confirmed"),
    ]);
    base.solana.rpcConnected = true;
    base.solana.rpcSlot = slot;
    base.solana.programExecutable = Boolean(
      programAccount?.executable
      && programAccount.owner.equals(UPGRADEABLE_LOADER)
      && programAccount.data.length === 36
    );

    const dataAddress = programAccount ? programDataAddress(Buffer.from(programAccount.data)) : null;
    if (dataAddress) {
      base.solana.programDataAddress = dataAddress.toBase58();
      const [programData, signatures] = await Promise.all([
        connection.getAccountInfo(dataAddress, "confirmed"),
        connection.getSignaturesForAddress(dataAddress, { limit: 1 }, "confirmed"),
      ]);
      if (programData?.owner.equals(UPGRADEABLE_LOADER)) {
        const bytes = Buffer.from(programData.data);
        base.solana.programDataLength = Math.max(0, bytes.length - 45);
        if (bytes.length >= 12 && bytes.readUInt32LE(0) === 3) base.solana.deployedSlot = Number(bytes.readBigUInt64LE(4));
        base.solana.schemaCurrent = bytes.length >= CURRENT_PROGRAM_DATA_ACCOUNT_MIN;
        base.solana.schemaLabel = base.solana.schemaCurrent ? "market-config-v2" : "event-hash-v1";
      }
      const latest = signatures[0];
      if (latest) {
        base.solana.deploymentSignature = latest.signature;
        if (latest.blockTime) base.solana.deploymentTime = new Date(latest.blockTime * 1_000).toISOString();
        base.solana.deployedSlot ??= latest.slot;
      }
    }

    if (
      vaultAccount
      && vaultAccount.owner.equals(programId)
      && vaultAccount.data.length >= 57
      && Buffer.from(vaultAccount.data).subarray(0, 8).equals(VAULT_DISCRIMINATOR)
    ) {
      const bytes = Buffer.from(vaultAccount.data);
      base.vault = {
        pda: VAULT_PDA,
        exists: true,
        balanceLamports: vaultAccount.lamports,
        totalFinalizedLamports: Number(bytes.readBigUInt64LE(40)),
        fillCount: Number(bytes.readBigUInt64LE(48)),
      };
    }
  } catch {
    base.reason = "Solana RPC is currently unavailable; canonical proof remains available.";
    return base;
  }

  base.freshProofAvailable = Boolean(
    currentCluster === "devnet"
    && base.solana.rpcConnected
    && base.solana.programExecutable
    && base.solana.schemaCurrent
    && base.operator.configured
    && !base.operator.lowBalance
  );
  base.level = base.freshProofAvailable ? "ready" : base.solana.programExecutable ? "limited" : "unavailable";
  base.reason = base.freshProofAvailable
    ? !base.txline.authenticated
      ? "Live TxLINE authentication is unavailable; canonical TxLINE historical evidence remains available."
      : undefined
    : !base.solana.schemaCurrent
      ? "The deployed program schema does not match MarketConfig v2. Canonical verified proof remains available."
      : !base.operator.configured
        ? "The server operator is not configured; canonical proof is available."
        : base.operator.lowBalance
          ? "The devnet operator balance is below the safe proof-run threshold."
          : "Fresh execution is unavailable; canonical proof is available.";
  return base;
}
