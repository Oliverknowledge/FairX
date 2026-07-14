import { computeMappingHash, hashResolutionRule, hashTeamName } from "@/lib/polymarket/hash";
import type { FairXExternalMarketMapping } from "@/lib/polymarket/types";

/**
 * The approved mapping registry — FairX's allowlist. A TxLINE fixture is bound
 * to a Polymarket market only after MANUAL review of: exact fixture identity,
 * home/away orientation, YES-meaning, resolution scope, and draw / extra-time /
 * cancellation semantics. Nothing here is derived from fuzzy title matching.
 *
 * User routes address markets by `mappingId` (allowlisted) — never by a raw
 * upstream condition id or token id supplied by a caller.
 */

export type MappingIdentity = Omit<
  FairXExternalMarketMapping,
  "homeTeamHash" | "awayTeamHash" | "resolutionRuleHash" | "mappingHash"
>;

/** Fill the four derived hashes deterministically. */
export function finalizeMapping(identity: MappingIdentity): FairXExternalMarketMapping {
  const homeTeamHash = hashTeamName(identity.txlineHomeTeam);
  const awayTeamHash = hashTeamName(identity.txlineAwayTeam);
  const resolutionRuleHash = hashResolutionRule(identity.polymarketResolutionRules);
  const withoutMappingHash = { ...identity, homeTeamHash, awayTeamHash, resolutionRuleHash };
  const mappingHash = computeMappingHash(withoutMappingHash);
  return { ...withoutMappingHash, mappingHash };
}

/** Recompute every hash + check the structural invariants. Empty array = valid. */
export function verifyMapping(mapping: FairXExternalMarketMapping): string[] {
  const errors: string[] = [];
  if (mapping.version !== 1) errors.push("mapping version must be 1");
  if (mapping.fairxTemplate !== "MATCH_WINNER_HOME_V1") errors.push("unsupported fairx template");
  if (mapping.fairxYesMeaning !== "HOME_TEAM_WINS") errors.push("unsupported yes meaning");
  if (hashTeamName(mapping.txlineHomeTeam) !== mapping.homeTeamHash) errors.push("home team hash mismatch");
  if (hashTeamName(mapping.txlineAwayTeam) !== mapping.awayTeamHash) errors.push("away team hash mismatch");
  if (hashResolutionRule(mapping.polymarketResolutionRules) !== mapping.resolutionRuleHash) {
    errors.push("resolution rule hash mismatch");
  }
  const { mappingHash, ...rest } = mapping;
  if (computeMappingHash(rest) !== mappingHash) errors.push("mapping hash mismatch");
  if (!mapping.resolutionSemantics.semanticsMatch) errors.push("resolution semantics were not confirmed to match");
  return errors;
}

// ── Approved mappings ───────────────────────────────────────────────────────

/**
 * France vs. Spain, 2026 FIFA World Cup semi-final (14 Jul 2026). FairX YES =
 * "France (home) wins". Polymarket market "Will France win on 2026-07-14?"
 * resolves on the first-90'-plus-stoppage regulation result — the SAME basis
 * as FairX's on-chain `home_score > away_score` derivation from TxLINE, so the
 * YES-side probability semantics align exactly.
 *
 * REISSUED 2026-07-13: bound to the REAL TxLINE fixture id `18237038` (World
 * Cup, France home vs Spain, kickoff 2026-07-14T19:00:00Z), confirmed against
 * the live TxLINE fixtures snapshot. The earlier `TXLINE-PENDING-*` placeholder
 * is retired; the prior historical capture
 * (`fixtures/polymarket/fifwc-fra-esp-2026-07-14-france-win.capture.json`)
 * embeds the old placeholder mapping and is retained UNMODIFIED as auditable
 * prior evidence. Changing the fixture id changes `mappingHash` by design.
 * Polymarket supplies only the reference PRICE; TxLINE remains the settlement
 * source. `ValidateStatV2` for the final result is only provable after kickoff.
 */
const FRANCE_SPAIN_RESOLUTION_RULES =
  'In the upcoming game, scheduled for July 14, 2026\n' +
  'If France wins, this market will resolve to "Yes".\n' +
  'Otherwise, this market will resolve to "No".\n' +
  'If the game is postponed, this market will remain open until the game has been completed.\n' +
  'If the game is canceled entirely, with no make-up game, this market will resolve "No".\n' +
  'This market refers only to the outcome within the first 90 minutes of regular play plus stoppage time.\n\n' +
  'The primary resolution source for this market is the official statistics of the event as recognized by the governing body or event organizers. However, if the governing body or event organizers have not published final match statistics within 2 hours after the event\'s conclusion, a consensus of credible reporting may be used instead. All markets will settle based on the official final result as recognized by the governing body or event organizers. Revisions to officially declared final scores made after market resolution will not be accounted for in determining the outcome.';

const FRANCE_SPAIN_IDENTITY: MappingIdentity = {
  version: 1,
  mappingId: "fifwc-fra-esp-2026-07-14-france-win",
  txlineFixtureId: "18237038",
  txlineCompetitionId: "FIFA-WORLD-CUP-2026",
  txlineHomeTeam: "France",
  txlineAwayTeam: "Spain",
  fairxTemplate: "MATCH_WINNER_HOME_V1",
  fairxYesMeaning: "HOME_TEAM_WINS",
  polymarketEventId: "691040",
  polymarketMarketId: "2879968",
  polymarketConditionId: "0x20fac1c925b7a2fed6b3b2736f47a800b4d0d4001b9deaeb7b918868eb63d081",
  polymarketQuestionId: "0x6dfb9f380450dd29df57e68454836c3cdb24312fbfb2a68a9d5fc35ead72d400",
  polymarketSlug: "fifwc-fra-esp-2026-07-14",
  polymarketYesTokenId: "25312457392074064866955638920139332428292497556441446372623464789018436410183",
  polymarketNoTokenId: "114008288197553961583518307739897802587067075299935011621746237390478872496575",
  polymarketQuestion: "Will France win on 2026-07-14?",
  polymarketResolutionRules: FRANCE_SPAIN_RESOLUTION_RULES,
  resolutionSemantics: {
    scope: "First 90 minutes of regular play plus stoppage time (regulation full-time).",
    drawMeansYesLoses: true,
    extraTimeNote:
      "Knockout ties are decided by extra time / penalties, but both FairX (home_score > away_score at TxLINE regulation full-time) and this Polymarket market resolve on the 90'+stoppage result, so a France win via ET/penalties resolves both sides to NO. Consistent.",
    cancellationNote:
      "On full cancellation with no make-up, Polymarket resolves NO whereas FairX would emergency-void and refund all stakes. Divergence limited to cancellation; documented and immaterial to reference pricing.",
    semanticsMatch: true,
  },
  verifiedAt: "2026-07-13T00:00:00.000Z",
  verifiedBy: "manual_review",
};

export const FRANCE_SPAIN_MAPPING: FairXExternalMarketMapping = finalizeMapping(FRANCE_SPAIN_IDENTITY);

const REGISTRY: readonly FairXExternalMarketMapping[] = [FRANCE_SPAIN_MAPPING];

export const MAPPING_REGISTRY: ReadonlyMap<string, FairXExternalMarketMapping> = new Map(
  REGISTRY.map((m) => [m.mappingId, m])
);

export function isApprovedMappingId(mappingId: string): boolean {
  return MAPPING_REGISTRY.has(mappingId);
}

export function getApprovedMapping(mappingId: string): FairXExternalMarketMapping | null {
  return MAPPING_REGISTRY.get(mappingId) ?? null;
}

export function listApprovedMappings(): FairXExternalMarketMapping[] {
  return [...MAPPING_REGISTRY.values()];
}
