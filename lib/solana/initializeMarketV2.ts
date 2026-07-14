import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import {
  LINEGUARD_V2_PROGRAM_ID,
  deriveMarketV2Pda,
  deriveMarketVaultPda,
  marketIdBytes,
} from "@/lib/solana/lineguardV2";
import { INITIALIZE_MARKET_V2_DISCRIMINATOR } from "@/lib/solana/schemaVerify";

/**
 * Pure, isomorphic builder for the DEPLOYED `initialize_market_v2` instruction.
 *
 * It NEVER signs, sends, or simulates. It Borsh-encodes the exact
 * `InitializeMarketV2Args` (24 fields, in struct order) and returns an unsigned
 * `TransactionInstruction` plus the derived PDAs. It fail-closes on every
 * constraint the on-chain program enforces, so an invalid set of arguments can
 * never be turned into transaction material.
 *
 * Constants mirror the deployed program (programs/lineguard/src/lib.rs):
 *   MATCH_WINNER_HOME_V1 = 1, resolution_rule must be 0, price micros in (0,1e6),
 *   claim_deadline must be 0, evidence_mode LIVE=0/HISTORICAL=1,
 *   pricing_model_version = 1, settlement_min_timestamp(ms) >= close_time(s)*1000 when LIVE.
 */

export const MICROS_ONE = 1_000_000;
export const MATCH_WINNER_HOME_V1 = 1;
export const PRICING_MODEL_VERSION_V1 = 1;
export const EVIDENCE_MODE_LIVE = 0;
export const EVIDENCE_MODE_HISTORICAL = 1;

const HEX32 = /^[0-9a-f]{64}$/;

function hex32ToBytes(hex: string, field: string): Buffer {
  if (!HEX32.test(hex)) throw new Error(`${field} must be a 32-byte lowercase hex hash`);
  return Buffer.from(hex, "hex");
}
function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v); return b; }
function u16(v: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function u64(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function i64(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigInt64LE(v); return b; }

export interface InitializeMarketV2Params {
  admin: PublicKey;
  payer: PublicKey;
  label: string;
  fixtureId: number;
  templateId?: number;
  fixtureIdHash: string;
  homeTeamHash: string;
  awayTeamHash: string;
  homeStatKey: number;
  awayStatKey: number;
  resolutionRule?: number;
  materialityConfigHash: string;
  pricingConfigHash: string;
  pricingModelHash: string;
  pricingModelVersion?: number;
  oddsPayloadHash: string;
  oddsSequence: number;
  materialSeq: number;
  pricedAtSeq: number;
  displayedPriceMicros: number;
  fairPriceMicros: number;
  toleranceMicros: number;
  /** Unix SECONDS. Must be > nowSeconds. */
  closeTime: number;
  /** Must be 0 — claims never expire. */
  claimDeadline?: number;
  evidenceMode?: number;
  /** Milliseconds. Must be > 0 and (LIVE) >= closeTime*1000. */
  settlementMinTimestampMs: number;
  /** For the close_time > now check. Defaults to Date.now()/1000. */
  nowSeconds?: number;
}

export interface BuiltInitializeMarketV2 {
  instruction: TransactionInstruction;
  marketId: Buffer;
  marketPda: PublicKey;
  vaultPda: PublicKey;
  authorityConfigPda: PublicKey;
}

export function deriveAuthorityConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("authorities-v2")], LINEGUARD_V2_PROGRAM_ID)[0];
}

export function buildInitializeMarketV2Instruction(p: InitializeMarketV2Params): BuiltInitializeMarketV2 {
  const templateId = p.templateId ?? MATCH_WINNER_HOME_V1;
  const resolutionRule = p.resolutionRule ?? 0;
  const pricingModelVersion = p.pricingModelVersion ?? PRICING_MODEL_VERSION_V1;
  const claimDeadline = p.claimDeadline ?? 0;
  const evidenceMode = p.evidenceMode ?? EVIDENCE_MODE_LIVE;
  const now = p.nowSeconds ?? Math.floor(Date.now() / 1000);

  // Fail-closed validation mirroring the on-chain require! checks.
  if (templateId !== MATCH_WINNER_HOME_V1) throw new Error("template_id must be MATCH_WINNER_HOME_V1 (1)");
  if (resolutionRule !== 0) throw new Error("resolution_rule must be 0");
  if (!(p.fixtureId > 0) || !Number.isInteger(p.fixtureId)) throw new Error("fixture_id must be a positive integer");
  if (p.homeStatKey === p.awayStatKey) throw new Error("home_stat_key and away_stat_key must differ");
  if (!(p.closeTime > now)) throw new Error("close_time must be in the future");
  if (claimDeadline !== 0) throw new Error("claim_deadline must be 0 (claims never expire)");
  if (evidenceMode !== EVIDENCE_MODE_LIVE && evidenceMode !== EVIDENCE_MODE_HISTORICAL) throw new Error("evidence_mode must be LIVE(0) or HISTORICAL(1)");
  if (!(p.settlementMinTimestampMs > 0)) throw new Error("settlement_min_timestamp must be > 0");
  if (evidenceMode === EVIDENCE_MODE_LIVE && p.settlementMinTimestampMs < p.closeTime * 1000) throw new Error("LIVE settlement_min_timestamp must be >= close_time*1000 (ms)");
  for (const [name, v] of [["displayed_price_micros", p.displayedPriceMicros], ["fair_price_micros", p.fairPriceMicros]] as const) {
    if (!(v > 0 && v < MICROS_ONE)) throw new Error(`${name} must be in (0, 1_000_000)`);
  }
  if (!(p.toleranceMicros <= MICROS_ONE)) throw new Error("tolerance_micros must be <= 1_000_000");
  if (!(p.pricedAtSeq <= p.materialSeq)) throw new Error("priced_at_seq must be <= material_seq");
  if (pricingModelVersion !== PRICING_MODEL_VERSION_V1) throw new Error("pricing_model_version must be 1");

  const marketId = Buffer.from(marketIdBytes(p.label));
  const fixtureIdHash = hex32ToBytes(p.fixtureIdHash, "fixture_id_hash");
  const homeTeamHash = hex32ToBytes(p.homeTeamHash, "home_team_hash");
  const awayTeamHash = hex32ToBytes(p.awayTeamHash, "away_team_hash");
  const materialityConfigHash = hex32ToBytes(p.materialityConfigHash, "materiality_config_hash");
  const pricingConfigHash = hex32ToBytes(p.pricingConfigHash, "pricing_config_hash");
  const pricingModelHash = hex32ToBytes(p.pricingModelHash, "pricing_model_hash");
  const oddsPayloadHash = hex32ToBytes(p.oddsPayloadHash, "odds_payload_hash");
  for (const [name, h] of [["fixture_id_hash", fixtureIdHash], ["home_team_hash", homeTeamHash], ["away_team_hash", awayTeamHash], ["materiality_config_hash", materialityConfigHash], ["pricing_config_hash", pricingConfigHash], ["pricing_model_hash", pricingModelHash], ["odds_payload_hash", oddsPayloadHash]] as const) {
    if (h.every((b) => b === 0)) throw new Error(`${name} must be non-zero`);
  }

  const marketPda = deriveMarketV2Pda(p.label);
  const vaultPda = deriveMarketVaultPda(marketPda);
  const authorityConfigPda = deriveAuthorityConfigPda();

  const data = Buffer.concat([
    INITIALIZE_MARKET_V2_DISCRIMINATOR,
    marketId,                             // market_id [u8;32]
    u64(BigInt(p.fixtureId)),             // fixture_id u64
    u16(templateId),                      // template_id u16
    fixtureIdHash,                        // fixture_id_hash
    homeTeamHash,                         // home_team_hash
    awayTeamHash,                         // away_team_hash
    u16(p.homeStatKey),                   // home_stat_key u16
    u16(p.awayStatKey),                   // away_stat_key u16
    u8(resolutionRule),                   // resolution_rule u8
    materialityConfigHash,                // materiality_config_hash
    pricingConfigHash,                    // pricing_config_hash
    pricingModelHash,                     // pricing_model_hash
    u16(pricingModelVersion),             // pricing_model_version u16
    oddsPayloadHash,                      // odds_payload_hash
    u64(BigInt(p.oddsSequence)),          // odds_sequence u64
    u64(BigInt(p.materialSeq)),           // material_seq u64
    u64(BigInt(p.pricedAtSeq)),           // priced_at_seq u64
    u64(BigInt(p.displayedPriceMicros)),  // displayed_price_micros u64
    u64(BigInt(p.fairPriceMicros)),       // fair_price_micros u64
    u64(BigInt(p.toleranceMicros)),       // tolerance_micros u64
    i64(BigInt(p.closeTime)),             // close_time i64 (seconds)
    i64(BigInt(claimDeadline)),           // claim_deadline i64 (0)
    u8(evidenceMode),                     // evidence_mode u8
    i64(BigInt(p.settlementMinTimestampMs)), // settlement_min_timestamp i64 (ms)
  ]);

  const instruction = new TransactionInstruction({
    programId: LINEGUARD_V2_PROGRAM_ID,
    keys: [
      { pubkey: p.admin, isSigner: true, isWritable: false },
      { pubkey: p.payer, isSigner: true, isWritable: true },
      { pubkey: authorityConfigPda, isSigner: false, isWritable: false },
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return { instruction, marketId, marketPda, vaultPda, authorityConfigPda };
}
