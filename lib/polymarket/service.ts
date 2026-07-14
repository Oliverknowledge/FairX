import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPolymarketConfig } from "@/lib/polymarket/config";
import { fetchReferenceQuoteForMapping } from "@/lib/polymarket/discovery";
import { getApprovedMapping } from "@/lib/polymarket/mapping";
import type {
  FairXExternalMarketMapping,
  PolymarketMarketDescriptor,
  PolymarketReferenceCapture,
  ReferenceQuote,
  ReferenceQuoteFreshness,
} from "@/lib/polymarket/types";
import { verifyReferenceCapture } from "@/lib/polymarket/verify";

/**
 * Server-facing reference-quote service: allowlist, short-lived cache with
 * stale-while-revalidate, and a VERIFIED bundled-capture fallback so the judge
 * experience never depends on a fresh upstream request succeeding. Cache and
 * history are never labelled "live".
 */

export const POLYMARKET_DISCLAIMER =
  "FairX is not affiliated with Polymarket. Public Polymarket market data is used only as an external reference source.";

export interface ReferenceQuoteView {
  mappingId: string;
  freshness: ReferenceQuoteFreshness;
  source: "Polymarket order book";
  disclaimer: string;
  fetchedAt: string;
  capturedAt?: string;
  unavailableReason?: string;
  market?: {
    question: string;
    slug: string;
    eventId: string;
    conditionId: string;
    yesTokenId: string;
    noTokenId: string;
    closeTime?: string;
    closed: boolean;
  };
  mapping?: {
    fixture: string;
    yesMeaning: string;
    resolutionScope: string;
    mappingHash: string;
  };
  quote?: {
    method: string;
    quoteValid: boolean;
    rejectionReasons: string[];
    midpointMicros: number;
    midpointCents: string;
    bestBidMicros: number;
    bestAskMicros: number;
    spreadMicros: number;
    bestBidCents: string;
    bestAskCents: string;
    spreadCents: string;
    bidDepth: number;
    askDepth: number;
    lastTradeMicros: number | null;
    quoteTimestamp: number;
    quoteAgeMs: number;
    orderBookHash?: string;
    depthWeightedMidpointMicros?: number;
  };
}

interface CacheEntry {
  servedAt: number;
  quote: ReferenceQuote;
  descriptor: PolymarketMarketDescriptor;
}
const quoteCache = new Map<string, CacheEntry>();
const historyCache = new Map<string, PolymarketReferenceCapture | null>();

function centsPrecise(micros: number): string {
  return `${((micros / 1_000_000) * 100).toFixed(1)}¢`;
}

function projectMapping(mapping: FairXExternalMarketMapping): NonNullable<ReferenceQuoteView["mapping"]> {
  return {
    fixture: `${mapping.txlineHomeTeam} vs ${mapping.txlineAwayTeam}`,
    yesMeaning: mapping.fairxYesMeaning,
    resolutionScope: mapping.resolutionSemantics.scope,
    mappingHash: mapping.mappingHash,
  };
}

function projectQuote(quote: ReferenceQuote): NonNullable<ReferenceQuoteView["quote"]> {
  return {
    method: quote.method,
    quoteValid: quote.quoteValid,
    rejectionReasons: quote.rejectionReasons,
    midpointMicros: quote.midpointMicros,
    midpointCents: centsPrecise(quote.midpointMicros),
    bestBidMicros: quote.bestBidMicros,
    bestAskMicros: quote.bestAskMicros,
    spreadMicros: quote.spreadMicros,
    bestBidCents: centsPrecise(quote.bestBidMicros),
    bestAskCents: centsPrecise(quote.bestAskMicros),
    spreadCents: centsPrecise(quote.spreadMicros),
    bidDepth: quote.bidDepth,
    askDepth: quote.askDepth,
    lastTradeMicros: quote.lastTradeMicros,
    quoteTimestamp: quote.quoteTimestamp,
    quoteAgeMs: quote.quoteAgeMs,
    orderBookHash: quote.orderBookHash,
    depthWeightedMidpointMicros:
      quote.depthWeighted && quote.depthWeighted.filled ? quote.depthWeighted.weightedMidpointMicros : undefined,
  };
}

/** Load + verify the bundled historical capture; null if absent or tampered. */
export function loadHistoricalCapture(mappingId: string): PolymarketReferenceCapture | null {
  if (historyCache.has(mappingId)) return historyCache.get(mappingId) ?? null;
  let capture: PolymarketReferenceCapture | null = null;
  try {
    const path = resolve(process.cwd(), `fixtures/polymarket/${mappingId}.capture.json`);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as PolymarketReferenceCapture;
    capture = verifyReferenceCapture(parsed).valid ? parsed : null;
  } catch {
    capture = null;
  }
  historyCache.set(mappingId, capture);
  return capture;
}

function historicalView(mappingId: string, mapping: FairXExternalMarketMapping, now: number): ReferenceQuoteView {
  const capture = loadHistoricalCapture(mappingId);
  if (!capture) {
    return {
      mappingId,
      freshness: "UNAVAILABLE",
      source: "Polymarket order book",
      disclaimer: POLYMARKET_DISCLAIMER,
      fetchedAt: new Date(now).toISOString(),
      unavailableReason: "Polymarket is unreachable and no bundled reference capture is available.",
      mapping: projectMapping(mapping),
    };
  }
  return {
    mappingId,
    freshness: "HISTORICAL_CAPTURE",
    source: "Polymarket order book",
    disclaimer: POLYMARKET_DISCLAIMER,
    fetchedAt: new Date(now).toISOString(),
    capturedAt: capture.capturedAt,
    market: {
      question: capture.market.question,
      slug: capture.market.slug,
      eventId: capture.market.eventId,
      conditionId: capture.market.conditionId,
      yesTokenId: capture.market.yesTokenId,
      noTokenId: capture.market.noTokenId,
      closed: false,
    },
    mapping: projectMapping(mapping),
    quote: {
      method: capture.derived.method,
      quoteValid: capture.derived.quoteValid,
      rejectionReasons: capture.derived.rejectionReasons,
      midpointMicros: capture.derived.midpointMicros,
      midpointCents: centsPrecise(capture.derived.midpointMicros),
      bestBidMicros: capture.derived.bestBidMicros,
      bestAskMicros: capture.derived.bestAskMicros,
      spreadMicros: capture.derived.spreadMicros,
      bestBidCents: centsPrecise(capture.derived.bestBidMicros),
      bestAskCents: centsPrecise(capture.derived.bestAskMicros),
      spreadCents: centsPrecise(capture.derived.spreadMicros),
      bidDepth: Number(capture.derived.bidDepth),
      askDepth: Number(capture.derived.askDepth),
      lastTradeMicros: null,
      quoteTimestamp: Number(capture.orderbook.timestamp),
      quoteAgeMs: 0,
      orderBookHash: capture.orderbook.hash,
      depthWeightedMidpointMicros: capture.derived.depthWeightedMidpointMicros,
    },
  };
}

export interface ServeOptions {
  forceRefresh?: boolean;
  now?: number;
}

/**
 * Return the reference quote for an approved mapping, choosing the freshest
 * trustworthy source and labelling it honestly.
 */
export async function getReferenceQuoteView(mappingId: string, opts: ServeOptions = {}): Promise<ReferenceQuoteView | null> {
  const mapping = getApprovedMapping(mappingId);
  if (!mapping) return null; // not allowlisted → route replies 404
  const cfg = getPolymarketConfig();
  const now = opts.now ?? Date.now();

  const cached = quoteCache.get(mappingId);
  const cacheFresh = cached && now - cached.servedAt <= cfg.quoteCacheTtlMs;
  if (cacheFresh && !opts.forceRefresh) {
    return liveView(mappingId, mapping, cached!.quote, cached!.descriptor, now, "LIVE");
  }

  try {
    const { descriptor, quote } = await fetchReferenceQuoteForMapping(mapping, { now });
    quoteCache.set(mappingId, { servedAt: now, quote, descriptor });
    // A fetched-but-rejected quote is honestly UNAVAILABLE, with diagnostics.
    const freshness: ReferenceQuoteFreshness = quote.quoteValid ? "LIVE" : "UNAVAILABLE";
    return liveView(mappingId, mapping, quote, descriptor, now, freshness);
  } catch {
    if (cached) return liveView(mappingId, mapping, cached.quote, cached.descriptor, now, "RECENTLY_CACHED");
    return historicalView(mappingId, mapping, now);
  }
}

function liveView(
  mappingId: string,
  mapping: FairXExternalMarketMapping,
  quote: ReferenceQuote,
  descriptor: PolymarketMarketDescriptor,
  now: number,
  freshness: ReferenceQuoteFreshness
): ReferenceQuoteView {
  return {
    mappingId,
    freshness,
    source: "Polymarket order book",
    disclaimer: POLYMARKET_DISCLAIMER,
    fetchedAt: new Date(now).toISOString(),
    unavailableReason: freshness === "UNAVAILABLE" ? quote.rejectionReasons.join(", ") : undefined,
    market: {
      question: descriptor.question,
      slug: descriptor.slug,
      eventId: descriptor.eventId,
      conditionId: descriptor.conditionId,
      yesTokenId: descriptor.yesTokenId,
      noTokenId: descriptor.noTokenId,
      closeTime: descriptor.closeTime,
      closed: descriptor.closed,
    },
    mapping: projectMapping(mapping),
    quote: projectQuote(quote),
  };
}

/** For tests. */
export function resetReferenceServiceCaches(): void {
  quoteCache.clear();
  historyCache.clear();
}
