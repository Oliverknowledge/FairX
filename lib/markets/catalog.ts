import {
  cloneFairXMarket,
  type FairXMarket,
  type FairXMarketEventSummary,
  type MaterialityRules,
} from "@/lib/markets/fairx";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import type { TxLineEventType } from "@/lib/txline/types";

export type {
  ExecutionMode,
  FairXMarket,
  FairXMarketStatus,
  FairXMarketType,
  FairXOnChainMarket,
  FairXSource,
  GuardedOrder,
  GuardedOrderPreview,
  GuardedOrderSide,
  GuardedOrderStatus,
  MaterialityRules,
} from "@/lib/markets/fairx";

const allMaterial: MaterialityRules = {
  goals: true,
  redCards: true,
  penalties: true,
  oddsUpdates: true,
};

const goalsAndOdds: MaterialityRules = {
  goals: true,
  redCards: false,
  penalties: false,
  oddsUpdates: true,
};

const redCardOnly: MaterialityRules = {
  goals: false,
  redCards: true,
  penalties: false,
  oddsUpdates: true,
};

const goalAtSeq2: FairXMarketEventSummary = {
  fixtureId: "ENG-FRA-2026-QF",
  seq: 2,
  timestamp: 1_783_615_318_241,
  eventType: "GOAL",
  source: "demo",
  team: "England",
  player: "Bukayo Saka",
  minute: 62,
  rawPayloadHash: "demo:eng-fra-goal-seq-2",
  proofStatus: "simulated",
  material: true,
  impact: "Goal advanced the fair quote while the displayed quote remained at seq 1.",
};

/**
 * A small deliberately opinionated catalog.  These are demo/devnet market
 * descriptors, not real-money contracts.  User-created markets are merged on
 * top by the SSR-safe store rather than mutating this seed data.
 */
export const marketCatalog: FairXMarket[] = [
  {
    id: "france-morocco-france-win",
    title: "France wins",
    fixtureId: canonicalCapture.fixtureId,
    type: "MATCH_WINNER",
    status: "SETTLED",
    displayedPrice: canonicalCapture.odds.normalizedPricingInput.impliedProbability,
    fairPrice: canonicalCapture.odds.normalizedPricingInput.impliedProbability,
    materialSeq: canonicalCapture.normalizedEvent.seq,
    pricedAtSeq: canonicalCapture.normalizedEvent.seq,
    tolerance: 0.02,
    source: "historical",
    materialityRules: { ...allMaterial },
    backedTeam: "France",
    targetSide: "France",
    resolutionNote: "Devnet settled: direct TxLINE CPI validated France 1–0 Morocco; YES resolved after 2-of-3 approval and the wallet-owned Position claimed.",
    createdAt: Number(canonicalCapture.fixture.record.StartTime),
    updatedAt: canonicalCapture.normalizedEvent.ts,
    staleOpenedAt: null,
    lastRepriceAt: Number(canonicalCapture.odds.normalizedPricingInput.timestamp),
    lastEvent: {
      fixtureId: canonicalCapture.fixtureId,
      seq: canonicalCapture.normalizedEvent.seq,
      timestamp: canonicalCapture.normalizedEvent.ts,
      eventType: canonicalCapture.normalizedEvent.eventType as TxLineEventType,
      source: "historical",
      team: canonicalCapture.normalizedEvent.team,
      minute: canonicalCapture.normalizedEvent.minute,
      rawPayloadHash: canonicalCapture.rawPayloadHash,
      proofStatus: "onchain_verified",
      material: true,
      impact: "Confirmed France goal advanced TxLINE sequence and moved the genuine StablePrice fair input.",
    },
  },
  {
    id: "eng-win",
    title: "England wins — offline scenario",
    fixtureId: "ENG-FRA-2026-QF",
    type: "MATCH_WINNER",
    status: "TRADING",
    displayedPrice: 0.4,
    fairPrice: 0.4,
    materialSeq: 1,
    pricedAtSeq: 1,
    tolerance: 0.02,
    source: "demo",
    materialityRules: { ...allMaterial },
    createdBy: "demo",
    backedTeam: "England",
    targetSide: "England",
    resolutionNote: "Guided offline fallback; not a TxLINE fixture.",
    createdAt: 1_783_615_000_000,
    updatedAt: 1_783_615_000_000,
    staleOpenedAt: null,
    lastRepriceAt: 1_783_615_000_000,
    lastEvent: null,
  },
  {
    id: "eng-fra-over-2-5",
    title: "Over 2.5 goals",
    fixtureId: "ENG-FRA-2026-QF",
    type: "TOTAL_GOALS",
    status: "STALE",
    displayedPrice: 0.5,
    fairPrice: 0.7,
    materialSeq: 2,
    pricedAtSeq: 1,
    tolerance: 0.02,
    source: "demo",
    materialityRules: { ...goalsAndOdds },
    createdBy: "demo",
    targetSide: "Over 2.5 goals",
    resolutionNote: "Resolves YES if the fixture records three or more goals.",
    createdAt: 1_783_615_000_000,
    updatedAt: goalAtSeq2.timestamp,
    staleOpenedAt: goalAtSeq2.timestamp,
    lastRepriceAt: 1_783_615_000_000,
    lastEvent: { ...goalAtSeq2 },
  },
  {
    id: "next-goal-england",
    title: "Next goal: England",
    fixtureId: "ENG-FRA-2026-QF",
    type: "NEXT_GOAL",
    status: "TRADING",
    displayedPrice: 0.46,
    fairPrice: 0.46,
    materialSeq: 3,
    pricedAtSeq: 3,
    tolerance: 0.02,
    source: "demo",
    materialityRules: { ...allMaterial },
    createdBy: "demo",
    backedTeam: "England",
    targetSide: "England",
    resolutionNote: "Resolves YES if England score the next goal in the fixture.",
    createdAt: 1_783_615_000_000,
    updatedAt: 1_783_615_600_000,
    staleOpenedAt: null,
    lastRepriceAt: 1_783_615_600_000,
    lastEvent: {
      fixtureId: "ENG-FRA-2026-QF",
      seq: 3,
      timestamp: 1_783_615_600_000,
      eventType: "ODDS_UPDATE",
      source: "demo",
      rawPayloadHash: "guided:odds-seq-3",
      proofStatus: "simulated",
      material: true,
      impact: "Guided odds update repriced the market through seq 3.",
    },
  },
  {
    id: "france-red-card-impact",
    title: "France red card impact",
    fixtureId: "ENG-FRA-2026-QF",
    type: "CUSTOM_YES_NO",
    status: "REPRICING",
    displayedPrice: 0.31,
    fairPrice: 0.43,
    materialSeq: 4,
    pricedAtSeq: 3,
    tolerance: 0.025,
    source: "demo",
    materialityRules: { ...redCardOnly },
    createdBy: "demo",
    backedTeam: "France",
    targetSide: "France receive a red card",
    resolutionNote: "Sandbox market: YES means France receive a red card before full time.",
    createdAt: 1_783_615_000_000,
    updatedAt: 1_783_616_000_000,
    staleOpenedAt: 1_783_616_000_000,
    lastRepriceAt: 1_783_615_600_000,
    lastEvent: {
      fixtureId: "ENG-FRA-2026-QF",
      seq: 4,
      timestamp: 1_783_616_000_000,
      eventType: "RED_CARD",
      source: "demo",
      team: "France",
      rawPayloadHash: "demo:france-discipline-seq-4",
      proofStatus: "simulated",
      material: true,
      impact: "Configured red-card rule opened a protected stale window pending reprice.",
    },
  },
  {
    id: "creator-extra-time-demo",
    title: "Creator sandbox: extra time occurs",
    fixtureId: "ENG-FRA-2026-QF",
    type: "CUSTOM_YES_NO",
    status: "TRADING",
    displayedPrice: 0.18,
    fairPrice: 0.18,
    materialSeq: 1,
    pricedAtSeq: 1,
    tolerance: 0.03,
    source: "demo",
    materialityRules: { goals: true, redCards: true, penalties: true, oddsUpdates: true },
    createdBy: "user",
    targetSide: "Extra time occurs",
    resolutionNote: "A creator sandbox market for local-simulation interaction only.",
    createdAt: 1_783_615_000_000,
    updatedAt: 1_783_615_000_000,
    staleOpenedAt: null,
    lastRepriceAt: 1_783_615_000_000,
    lastEvent: null,
    onChain: { initialized: false },
  },
];

/** Back-compat-friendly name used by market pages and tests. */
export const seedCatalog = marketCatalog;

/** Return a mutable clone so presentation/actions cannot mutate seed data by accident. */
export function getMarketCatalog(catalog: readonly FairXMarket[] = marketCatalog): FairXMarket[] {
  return catalog.map((market) => cloneFairXMarket(market));
}

export function getMarketById(id: string | null | undefined, catalog: readonly FairXMarket[] = marketCatalog): FairXMarket | null {
  if (!id) return null;
  const market = catalog.find((candidate) => candidate.id === id);
  return market ? cloneFairXMarket(market) : null;
}

export function isCreatorMarket(market: Pick<FairXMarket, "createdBy">): boolean {
  return market.createdBy === "user";
}
