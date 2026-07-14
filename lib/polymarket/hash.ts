import { sha256 } from "js-sha256";
import { canonicalize } from "@/lib/receipts/create";
import type { FairXExternalMarketMapping, PolymarketReferenceCapture } from "@/lib/polymarket/types";

/**
 * Deterministic hashing for the Polymarket reference-price proof chain.
 *
 * Every hash is sha256(canonicalJSON(...)) using the same `canonicalize` the
 * LineGuard receipts use, so a verifier recomputes identical values in the
 * browser, on the server, or in a test runner. Four hashes bind a capture:
 *   - rawPayloadHash     — the exact order book as received (tamper-evident)
 *   - mappingHash        — the approved TxLINE↔Polymarket mapping identity
 *   - normalizedQuoteHash— the recomputed bid/ask/mid/spread/depth (not upstream's numbers)
 *   - pricingPolicyHash  — the spread/depth/age thresholds in force
 */

export const HASH_RE = /^[a-f0-9]{64}$/;

export function polyHash(value: unknown): string {
  return sha256(canonicalize(value ?? null));
}

/** Normalize a team name before hashing so orientation checks are stable. */
export function hashTeamName(name: string): string {
  return polyHash(name.trim().toLowerCase());
}

export function hashResolutionRule(rules: string): string {
  return polyHash(rules.trim());
}

/**
 * Canonical mapping-identity hash. Excludes the mutable attestation metadata
 * (`verifiedAt`, `verifiedBy`) and the `mappingHash` field itself, so the hash
 * is a stable function of *what* is mapped, not *when* it was reviewed.
 */
export function computeMappingHash(mapping: Omit<FairXExternalMarketMapping, "mappingHash">): string {
  const identity = {
    version: mapping.version,
    mappingId: mapping.mappingId,
    txlineFixtureId: mapping.txlineFixtureId,
    txlineCompetitionId: mapping.txlineCompetitionId,
    txlineHomeTeam: mapping.txlineHomeTeam,
    txlineAwayTeam: mapping.txlineAwayTeam,
    fairxTemplate: mapping.fairxTemplate,
    fairxYesMeaning: mapping.fairxYesMeaning,
    polymarketEventId: mapping.polymarketEventId,
    polymarketMarketId: mapping.polymarketMarketId,
    polymarketConditionId: mapping.polymarketConditionId,
    polymarketQuestionId: mapping.polymarketQuestionId,
    polymarketSlug: mapping.polymarketSlug,
    polymarketYesTokenId: mapping.polymarketYesTokenId,
    polymarketNoTokenId: mapping.polymarketNoTokenId,
    polymarketQuestion: mapping.polymarketQuestion,
    polymarketResolutionRules: mapping.polymarketResolutionRules,
    resolutionSemantics: mapping.resolutionSemantics,
    homeTeamHash: mapping.homeTeamHash,
    awayTeamHash: mapping.awayTeamHash,
    resolutionRuleHash: mapping.resolutionRuleHash,
  };
  return polyHash(identity);
}

export interface NormalizedQuoteHashInput {
  conditionId: string;
  yesTokenId: string;
  bestBidMicros: number;
  bestAskMicros: number;
  midpointMicros: number;
  spreadMicros: number;
  bidDepth: string;
  askDepth: string;
  method: string;
  quoteTimestamp: string;
  orderBookHash?: string;
}

/**
 * Hash of the *recomputed* quote, not the upstream's precomputed midpoint.
 * This is what the on-chain `odds_payload_hash` commits to and what the
 * trader's signed `expected_odds_sequence` ultimately pins.
 */
export function computeNormalizedQuoteHash(input: NormalizedQuoteHashInput): string {
  return polyHash(input);
}

export function computePricingPolicyHash(policy: PolymarketReferenceCapture["policy"]): string {
  return polyHash(policy);
}

/** Raw order-book payload hash: canonical over exactly the fields we store. */
export function computeRawPayloadHash(orderbook: PolymarketReferenceCapture["orderbook"]): string {
  return polyHash(orderbook);
}

/** Short display form for dense UI. */
export function shortPolyHash(hash: string | undefined): string {
  if (!hash) return "—";
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}
