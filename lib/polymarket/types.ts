import type { ReferenceMethod } from "@/lib/polymarket/config";

/**
 * Types for the Polymarket external-reference-price adapter.
 *
 * Vocabulary is deliberate: everything is a "reference quote" from an
 * "external market". FairX does not claim Polymarket liquidity, does not route
 * orders to Polymarket, and does not treat Polymarket as an oracle. TxLINE
 * remains the sports-event and settlement source of truth.
 */

export type { ReferenceMethod };

/** A single order-book level as delivered by the CLOB (string decimals). */
export interface RawBookLevel {
  price: string;
  size: string;
}

/** Normalized raw order book, exactly as received from CLOB /book. */
export interface RawOrderBook {
  /** Polymarket condition id (0x…) — CLOB calls this `market`. */
  market: string;
  /** CLOB token id — CLOB calls this `asset_id`. */
  assetId: string;
  /** Milliseconds epoch, as reported by the CLOB. */
  timestamp: number;
  /** Polymarket's own book hash, when supplied. */
  hash?: string;
  bids: RawBookLevel[];
  asks: RawBookLevel[];
  tickSize?: string;
  negRisk?: boolean;
  lastTradePrice?: number;
}

/** Recomputed order-book metrics — never trusted from a precomputed field. */
export interface OrderBookMetrics {
  bestBidMicros: number;
  bestAskMicros: number;
  midpointMicros: number;
  spreadMicros: number;
  /** Total visible size on each side (sum of level sizes). */
  bidDepth: number;
  askDepth: number;
  bidLevels: number;
  askLevels: number;
  lastTradeMicros: number | null;
}

/** Optional depth-weighted diagnostic, computed over a fixed size window. */
export interface DepthWeightedQuote {
  windowSize: number;
  bidNotional: number;
  askNotional: number;
  weightedBidMicros: number;
  weightedAskMicros: number;
  weightedMidpointMicros: number;
  /** True when the window could be filled on both sides. */
  filled: boolean;
}

/**
 * The deterministic reference quote produced by the pricing policy. When
 * `quoteValid` is false, `method` is UNAVAILABLE and `rejectionReasons` lists
 * every failed check — the caller must never fall back to 0.5.
 */
export interface ReferenceQuote {
  method: ReferenceMethod;
  quoteValid: boolean;
  rejectionReasons: string[];
  midpointMicros: number;
  bestBidMicros: number;
  bestAskMicros: number;
  spreadMicros: number;
  bidDepth: number;
  askDepth: number;
  lastTradeMicros: number | null;
  quoteTimestamp: number;
  quoteAgeMs: number;
  tokenId: string;
  conditionId: string;
  orderBookHash?: string;
  depthWeighted?: DepthWeightedQuote;
}

/** Market descriptor extracted from Gamma discovery. */
export interface PolymarketMarketDescriptor {
  eventId: string;
  marketId: string;
  conditionId: string;
  questionId?: string;
  slug: string;
  question: string;
  yesTokenId: string;
  noTokenId: string;
  outcomes: [string, string];
  startTime?: string;
  closeTime?: string;
  resolutionRules: string;
  active: boolean;
  closed: boolean;
  enableOrderBook: boolean;
}

export type FairXTemplate = "MATCH_WINNER_HOME_V1";
export type FairXYesMeaning = "HOME_TEAM_WINS";

/**
 * Versioned, explicitly-approved mapping between a TxLINE fixture and an
 * equivalent Polymarket market. Fuzzy title matching alone is never enough:
 * fixture identity, home/away orientation, YES-meaning, and resolution
 * semantics must all be manually confirmed before a mapping is canonical.
 */
export interface FairXExternalMarketMapping {
  version: 1;
  /** Stable id used by allowlisted API routes; never a raw upstream id. */
  mappingId: string;

  txlineFixtureId: string;
  txlineCompetitionId?: string;
  txlineHomeTeam: string;
  txlineAwayTeam: string;

  fairxTemplate: FairXTemplate;
  fairxYesMeaning: FairXYesMeaning;

  polymarketEventId: string;
  polymarketMarketId: string;
  polymarketConditionId: string;
  polymarketQuestionId?: string;
  polymarketSlug: string;

  polymarketYesTokenId: string;
  polymarketNoTokenId: string;

  polymarketQuestion: string;
  polymarketResolutionRules: string;

  /** Documented semantic comparison — must be reviewed, not assumed. */
  resolutionSemantics: {
    /** e.g. "90 minutes + stoppage (regulation full-time)". */
    scope: string;
    /** How a regulation draw resolves the FairX YES side. */
    drawMeansYesLoses: boolean;
    /** Extra-time / penalties handling notes. */
    extraTimeNote: string;
    /** Cancellation / postponement handling notes. */
    cancellationNote: string;
    /** True only when TxLINE and Polymarket resolve on the same basis. */
    semanticsMatch: boolean;
  };

  homeTeamHash: string;
  awayTeamHash: string;
  resolutionRuleHash: string;
  mappingHash: string;

  verifiedAt: string;
  verifiedBy: "manual_review";
}

export type ReferenceCaptureMode = "LIVE" | "HISTORICAL_CAPTURE";

/**
 * Durable, replayable reference-quote capture. Canonical JSON + deterministic
 * SHA-256 hashes make it tamper-evident and reproducible offline. Contains no
 * API secrets, auth headers, or cookies.
 */
export interface PolymarketReferenceCapture {
  version: 1;
  source: "POLYMARKET_CLOB";
  mode: ReferenceCaptureMode;

  capturedAt: string;
  receivedAt: string;

  mapping: FairXExternalMarketMapping;

  market: {
    eventId: string;
    marketId: string;
    conditionId: string;
    questionId?: string;
    slug: string;
    question: string;
    yesTokenId: string;
    noTokenId: string;
  };

  orderbook: {
    timestamp: string;
    hash?: string;
    bids: RawBookLevel[];
    asks: RawBookLevel[];
    lastTradePrice?: string;
  };

  derived: {
    bestBidMicros: number;
    bestAskMicros: number;
    midpointMicros: number;
    spreadMicros: number;
    bidDepth: string;
    askDepth: string;
    method: ReferenceMethod;
    quoteValid: boolean;
    rejectionReasons: string[];
    depthWeightedMidpointMicros?: number;
  };

  /** Policy thresholds in force when the quote was judged (for reproducibility). */
  policy: {
    maxSpreadMicros: number;
    minVisibleDepth: number;
    maxQuoteAgeMs: number;
    referenceMethod: ReferenceMethod;
    depthWindowSize: number;
    maxMethodDivergenceMicros: number;
  };

  rawPayloadHash: string;
  mappingHash: string;
  normalizedQuoteHash: string;
  pricingPolicyHash: string;
}

/** How a served quote should be labelled in the UI. Never mislabel cache/history as live. */
export type ReferenceQuoteFreshness =
  | "LIVE"
  | "RECENTLY_CACHED"
  | "HISTORICAL_CAPTURE"
  | "UNAVAILABLE";
