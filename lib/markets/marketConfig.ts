import { sha256 } from "js-sha256";
import type { FairXMarketType, MaterialityRules } from "@/lib/markets/fairx";
import { canonicalize } from "@/lib/receipts/create";

export const MARKET_TYPE_CODE: Readonly<Record<FairXMarketType, number>> = Object.freeze({
  MATCH_WINNER: 0,
  TOTAL_GOALS: 1,
  NEXT_GOAL: 2,
  CUSTOM_YES_NO: 3,
});

export const PRICE_PRECISION_MICROS = 1_000_000;

export interface MarketConfigCommitmentInput {
  marketType: FairXMarketType;
  fixtureId: string;
  marketTitle: string;
  materialityRules: MaterialityRules;
  backedTeam?: string;
  awayTeam?: string;
  targetSide?: string;
  toleranceMicros: number;
}

export interface MarketConfigCommitment {
  marketType: FairXMarketType;
  marketTypeCode: number;
  fixtureIdHash: string;
  marketTitleHash: string;
  materialityConfigHash: string;
  settlementConfigHash: string;
  resolutionRule: "HOME_TEAM_WINS";
  resolutionRuleCode: 0;
  homeStatKey: 1;
  awayStatKey: 2;
  homeTeamHash: string;
  awayTeamHash: string;
}

function normalizedText(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

export function hashMarketText(value: string): string {
  return sha256(normalizedText(value) ?? "");
}

export function materialityConfigPayload(input: Pick<MarketConfigCommitmentInput, "materialityRules" | "backedTeam" | "targetSide">) {
  return {
    version: 1,
    goalsAffectMarket: input.materialityRules.goals,
    redCardsAffectMarket: input.materialityRules.redCards,
    penaltiesAffectMarket: input.materialityRules.penalties,
    oddsUpdatesAffectMarket: input.materialityRules.oddsUpdates,
    backedTeamOrTargetSide: normalizedText(input.backedTeam) ?? normalizedText(input.targetSide),
  } as const;
}

export function settlementConfigPayload(toleranceMicros: number) {
  return {
    version: 1,
    toleranceMicros: Math.round(toleranceMicros),
    pricePrecisionMicros: PRICE_PRECISION_MICROS,
    vaultDestinationRules: {
      allowed: "FINALIZED_TO_VAULT",
      staleNoEdge: "FINALIZED_TO_VAULT",
      stalePositiveEdge: "REFUNDED_TO_TRADER",
    },
    allowedSides: ["YES", "NO"],
  } as const;
}

export function hashMaterialityConfig(input: Pick<MarketConfigCommitmentInput, "materialityRules" | "backedTeam" | "targetSide">): string {
  return sha256(canonicalize(materialityConfigPayload(input)));
}

export function hashSettlementConfig(toleranceMicros: number): string {
  return sha256(canonicalize(settlementConfigPayload(toleranceMicros)));
}

export function buildMarketConfigCommitment(input: MarketConfigCommitmentInput): MarketConfigCommitment {
  return {
    marketType: input.marketType,
    marketTypeCode: MARKET_TYPE_CODE[input.marketType],
    fixtureIdHash: hashMarketText(input.fixtureId),
    marketTitleHash: hashMarketText(input.marketTitle),
    materialityConfigHash: hashMaterialityConfig(input),
    settlementConfigHash: hashSettlementConfig(input.toleranceMicros),
    resolutionRule: "HOME_TEAM_WINS",
    resolutionRuleCode: 0,
    homeStatKey: 1,
    awayStatKey: 2,
    homeTeamHash: hashMarketText(input.backedTeam ?? ""),
    awayTeamHash: hashMarketText(input.awayTeam ?? ""),
  };
}
