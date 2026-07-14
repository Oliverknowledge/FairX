import { PublicKey } from "@solana/web3.js";
import { buildOddsCommitmentFromCapture } from "@/lib/polymarket/commitment";
import { polyHash } from "@/lib/polymarket/hash";
import type { PolymarketReferenceCapture } from "@/lib/polymarket/types";
import { EVIDENCE_MODE_LIVE, type InitializeMarketV2Params } from "@/lib/solana/initializeMarketV2";

/**
 * The single source of truth that maps a VERIFIED Polymarket reference capture
 * to the exact `initialize_market_v2` arguments for the France–Spain live
 * market. Both the read-only preparation command and the operator initializer
 * import this, so the transaction the operator signs is byte-identical to the
 * one that was previewed. Prices and every hash come from the capture; the
 * fixture id, close time, settlement timestamp, stat keys and tolerance are the
 * reviewed constants for this fixture.
 */

export const LIVE_MARKET = {
  mappingId: "fifwc-fra-esp-2026-07-14-france-win",
  label: "fairx-france-spain-v2",
  fixtureId: 18237038,
  homeStatKey: 1,
  awayStatKey: 2,
  toleranceMicros: 20_000,
  /** Unix seconds — kickoff 2026-07-14T19:00:00Z. */
  closeTime: 1_784_055_600,
  /** Milliseconds — same instant, for settlement_min_timestamp. */
  settlementMinTimestampMs: 1_784_055_600_000,
  evidenceMode: EVIDENCE_MODE_LIVE,
} as const;

export const MAX_CAPTURE_AGE_MS = 60_000;

/** Age of a capture in ms (positive = older). */
export function captureAgeMs(capture: PolymarketReferenceCapture, now: number = Date.now()): number {
  return now - Date.parse(capture.capturedAt);
}

/** AuthorityConfig.admin lives at byte offset 8 (after the 8-byte discriminator). */
export function readAuthorityConfigAdmin(data: Uint8Array): PublicKey {
  return new PublicKey(data.subarray(8, 40));
}

/**
 * Derive the complete `initialize_market_v2` params from a verified capture.
 * Deterministic: the same capture always yields the same args (so the preview
 * and the signed transaction match exactly). Uses only capture-embedded fields
 * plus the reviewed fixture constants — no re-fetch, no drift.
 */
export function deriveInitParamsFromCapture(
  capture: PolymarketReferenceCapture,
  opts: { admin: PublicKey; payer: PublicKey; nowSeconds?: number },
): InitializeMarketV2Params {
  const commitment = buildOddsCommitmentFromCapture(capture);
  const m = capture.mapping;
  const fixtureIdHash = polyHash({
    competition: m.txlineCompetitionId,
    fixtureId: LIVE_MARKET.fixtureId,
    home: m.txlineHomeTeam,
    away: m.txlineAwayTeam,
  });
  const materialityConfigHash = polyHash({ template: m.fairxTemplate, materiality: { goals: true, anyGoalIsMaterial: true } });

  return {
    admin: opts.admin,
    payer: opts.payer,
    label: LIVE_MARKET.label,
    fixtureId: LIVE_MARKET.fixtureId,
    fixtureIdHash,
    homeTeamHash: m.homeTeamHash,
    awayTeamHash: m.awayTeamHash,
    homeStatKey: LIVE_MARKET.homeStatKey,
    awayStatKey: LIVE_MARKET.awayStatKey,
    materialityConfigHash,
    pricingConfigHash: capture.pricingPolicyHash,
    pricingModelHash: commitment.pricingModelHash,
    oddsPayloadHash: commitment.oddsPayloadHash,
    oddsSequence: commitment.oddsSequence,
    materialSeq: commitment.oddsSequence,
    pricedAtSeq: commitment.oddsSequence,
    displayedPriceMicros: commitment.fairPriceMicros,
    fairPriceMicros: commitment.fairPriceMicros,
    toleranceMicros: LIVE_MARKET.toleranceMicros,
    closeTime: LIVE_MARKET.closeTime,
    claimDeadline: 0,
    evidenceMode: LIVE_MARKET.evidenceMode,
    settlementMinTimestampMs: LIVE_MARKET.settlementMinTimestampMs,
    nowSeconds: opts.nowSeconds,
  };
}
