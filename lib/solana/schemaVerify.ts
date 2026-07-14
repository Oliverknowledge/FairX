import { Connection, PublicKey } from "@solana/web3.js";
import { inflateSync } from "node:zlib";
import { sha256 } from "js-sha256";
import { LINEGUARD_V2_PROGRAM_ID } from "@/lib/solana/lineguardV2";

/**
 * Read-only deployed-schema verification for the LineGuard V2 program.
 *
 * Confirms — WITHOUT sending or simulating anything — that the program the
 * client would target implements the exact account and instruction layout the
 * `initialize_market_v2` preparation relies on. Anchor discriminators are a
 * function of the compiled struct/instruction name, so a match against live
 * on-chain accounts is stronger evidence than reading byte offsets.
 *
 * It also attempts to retrieve and compare the on-chain Anchor IDL. If that
 * cannot be retrieved, it says so explicitly — it never pretends byte-level
 * instruction compatibility was proven when it was only inferred.
 */

export function accountDiscriminator(name: string): Buffer {
  return Buffer.from(sha256.arrayBuffer(`account:${name}`)).subarray(0, 8);
}

export function instructionDiscriminator(name: string): Buffer {
  return Buffer.from(sha256.arrayBuffer(`global:${name}`)).subarray(0, 8);
}

/** The exact 8-byte discriminator the init instruction must carry. */
export const INITIALIZE_MARKET_V2_DISCRIMINATOR = instructionDiscriminator("initialize_market_v2");

export interface SchemaCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DeployedSchemaReport {
  ok: boolean;
  programId: string;
  checks: SchemaCheck[];
  /** On-chain IDL comparison result — never silently assumed. */
  onChainIdl:
    | { status: "MATCHED"; instructionCount: number }
    | { status: "MISMATCH"; detail: string }
    | { status: "UNRETRIEVABLE"; detail: string };
  initializeDiscriminatorHex: string;
}

async function fetchOnChainAnchorIdl(
  connection: Connection,
  programId: PublicKey,
): Promise<{ instructions?: Array<{ name: string; discriminator?: number[] }> } | null> {
  // Anchor IDL address: createWithSeed(base, "anchor:idl", programId), base = findProgramAddress([]).
  const [base] = PublicKey.findProgramAddressSync([], programId);
  const idlAddress = await PublicKey.createWithSeed(base, "anchor:idl", programId);
  const info = await connection.getAccountInfo(idlAddress, "confirmed");
  if (!info) return null;
  // Layout: 8 disc + 32 authority + 4 len (LE) + zlib(borsh/json) payload.
  const data = Buffer.from(info.data);
  const len = data.readUInt32LE(40);
  const compressed = data.subarray(44, 44 + len);
  const inflated = inflateSync(compressed);
  return JSON.parse(inflated.toString("utf8"));
}

export async function verifyDeployedSchema(
  connection: Connection,
  opts: {
    /** A live MarketV2 account to confirm the account discriminator + size. */
    marketV2Sample: PublicKey;
    /** A live MarketVault account to confirm the account discriminator + size. */
    marketVaultSample: PublicKey;
    /** The authorities-v2 config PDA. */
    authorityConfig: PublicKey;
    programId?: PublicKey;
  },
): Promise<DeployedSchemaReport> {
  const programId = opts.programId ?? LINEGUARD_V2_PROGRAM_ID;
  const checks: SchemaCheck[] = [];

  const [programInfo, marketInfo, vaultInfo, authInfo] = await connection.getMultipleAccountsInfo(
    [programId, opts.marketV2Sample, opts.marketVaultSample, opts.authorityConfig],
    "confirmed",
  );

  checks.push({
    name: "Program is executable",
    ok: Boolean(programInfo?.executable),
    detail: programId.toBase58(),
  });

  const marketDiscOk =
    !!marketInfo && Buffer.from(marketInfo.data).subarray(0, 8).equals(accountDiscriminator("MarketV2"));
  checks.push({
    name: "MarketV2 discriminator + owner",
    ok: marketDiscOk && !!marketInfo?.owner.equals(programId) && marketInfo.data.length === 509,
    detail: marketInfo ? `disc=${Buffer.from(marketInfo.data).subarray(0, 8).toString("hex")} size=${marketInfo.data.length}` : "sample account missing",
  });

  const vaultDiscOk =
    !!vaultInfo && Buffer.from(vaultInfo.data).subarray(0, 8).equals(accountDiscriminator("MarketVault"));
  checks.push({
    name: "MarketVault discriminator + owner",
    ok: vaultDiscOk && !!vaultInfo?.owner.equals(programId) && vaultInfo.data.length === 89,
    detail: vaultInfo ? `disc=${Buffer.from(vaultInfo.data).subarray(0, 8).toString("hex")} size=${vaultInfo.data.length}` : "sample account missing",
  });

  const authDiscOk =
    !!authInfo && Buffer.from(authInfo.data).subarray(0, 8).equals(accountDiscriminator("AuthorityConfig"));
  checks.push({
    name: "AuthorityConfig PDA exists + owner",
    ok: authDiscOk && !!authInfo?.owner.equals(programId),
    detail: authInfo ? `disc=${Buffer.from(authInfo.data).subarray(0, 8).toString("hex")} size=${authInfo.data.length}` : "authority-config missing",
  });

  let onChainIdl: DeployedSchemaReport["onChainIdl"];
  try {
    const idl = await fetchOnChainAnchorIdl(connection, programId);
    if (!idl || !Array.isArray(idl.instructions)) {
      onChainIdl = { status: "UNRETRIEVABLE", detail: "No on-chain Anchor IDL account (or empty). Instruction-arg compatibility is INFERRED from account discriminators + live lifecycle, not byte-proven." };
    } else {
      const init = idl.instructions.find((i) => i.name === "initialize_market_v2");
      const discMatch =
        init?.discriminator && Buffer.from(init.discriminator).equals(INITIALIZE_MARKET_V2_DISCRIMINATOR);
      onChainIdl = discMatch
        ? { status: "MATCHED", instructionCount: idl.instructions.length }
        : { status: "MISMATCH", detail: `on-chain initialize_market_v2 discriminator differs or is absent` };
    }
  } catch (err) {
    onChainIdl = { status: "UNRETRIEVABLE", detail: `IDL retrieval failed: ${err instanceof Error ? err.message : String(err)}. Compatibility INFERRED, not byte-proven.` };
  }

  const ok = checks.every((c) => c.ok);
  return { ok, programId: programId.toBase58(), checks, onChainIdl, initializeDiscriminatorHex: INITIALIZE_MARKET_V2_DISCRIMINATOR.toString("hex") };
}
