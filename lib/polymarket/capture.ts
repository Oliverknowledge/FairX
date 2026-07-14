import { canonicalize } from "@/lib/receipts/create";
import { getPolymarketConfig, type PolymarketReferenceConfig } from "@/lib/polymarket/config";
import {
  computeNormalizedQuoteHash,
  computePricingPolicyHash,
  computeRawPayloadHash,
} from "@/lib/polymarket/hash";
import type {
  FairXExternalMarketMapping,
  PolymarketMarketDescriptor,
  PolymarketReferenceCapture,
  RawOrderBook,
  ReferenceCaptureMode,
  ReferenceQuote,
} from "@/lib/polymarket/types";

/**
 * Durable, replayable reference-quote capture. Canonical JSON + deterministic
 * SHA-256 make it tamper-evident and reproducible offline. It carries NO API
 * secrets, auth headers, or cookies — a `containsSecretMetadata` guard enforces
 * that at serialize time.
 */

const SECRET_KEY = /authorization|api[-_]?token|jwt|secret|keypair|private[-_]?key|cookie/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function containsSecretMetadata(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretMetadata);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) => SECRET_KEY.test(key) || containsSecretMetadata(child));
}

function policyOf(cfg: PolymarketReferenceConfig): PolymarketReferenceCapture["policy"] {
  return {
    maxSpreadMicros: cfg.maxSpreadMicros,
    minVisibleDepth: cfg.minVisibleDepth,
    maxQuoteAgeMs: cfg.maxQuoteAgeMs,
    referenceMethod: cfg.referenceMethod,
    depthWindowSize: cfg.depthWindowSize,
    maxMethodDivergenceMicros: cfg.maxMethodDivergenceMicros,
  };
}

export interface BuildCaptureParams {
  mapping: FairXExternalMarketMapping;
  descriptor: PolymarketMarketDescriptor;
  book: RawOrderBook;
  quote: ReferenceQuote;
  mode: ReferenceCaptureMode;
  config?: PolymarketReferenceConfig;
  capturedAt?: string;
  receivedAt?: string;
}

export function buildReferenceCapture(params: BuildCaptureParams): PolymarketReferenceCapture {
  const cfg = params.config ?? getPolymarketConfig();
  const { mapping, descriptor, book, quote } = params;
  const now = params.capturedAt ?? new Date().toISOString();

  const orderbook: PolymarketReferenceCapture["orderbook"] = {
    timestamp: String(book.timestamp),
    hash: book.hash,
    bids: book.bids,
    asks: book.asks,
    lastTradePrice: book.lastTradePrice !== undefined ? String(book.lastTradePrice) : undefined,
  };

  const derived: PolymarketReferenceCapture["derived"] = {
    bestBidMicros: quote.bestBidMicros,
    bestAskMicros: quote.bestAskMicros,
    midpointMicros: quote.midpointMicros,
    spreadMicros: quote.spreadMicros,
    bidDepth: String(quote.bidDepth),
    askDepth: String(quote.askDepth),
    method: quote.method,
    quoteValid: quote.quoteValid,
    rejectionReasons: quote.rejectionReasons,
    depthWeightedMidpointMicros:
      quote.depthWeighted && quote.depthWeighted.filled ? quote.depthWeighted.weightedMidpointMicros : undefined,
  };

  const policy = policyOf(cfg);

  const rawPayloadHash = computeRawPayloadHash(orderbook);
  const normalizedQuoteHash = computeNormalizedQuoteHash({
    conditionId: mapping.polymarketConditionId,
    yesTokenId: mapping.polymarketYesTokenId,
    bestBidMicros: derived.bestBidMicros,
    bestAskMicros: derived.bestAskMicros,
    midpointMicros: derived.midpointMicros,
    spreadMicros: derived.spreadMicros,
    bidDepth: derived.bidDepth,
    askDepth: derived.askDepth,
    method: derived.method,
    quoteTimestamp: orderbook.timestamp,
    orderBookHash: orderbook.hash,
  });
  const pricingPolicyHash = computePricingPolicyHash(policy);

  return {
    version: 1,
    source: "POLYMARKET_CLOB",
    mode: params.mode,
    capturedAt: now,
    receivedAt: params.receivedAt ?? now,
    mapping,
    market: {
      eventId: descriptor.eventId,
      marketId: descriptor.marketId,
      conditionId: descriptor.conditionId,
      questionId: descriptor.questionId,
      slug: descriptor.slug,
      question: descriptor.question,
      yesTokenId: descriptor.yesTokenId,
      noTokenId: descriptor.noTokenId,
    },
    orderbook,
    derived,
    policy,
    rawPayloadHash,
    mappingHash: mapping.mappingHash,
    normalizedQuoteHash,
    pricingPolicyHash,
  };
}

/** Canonical serialization for durable storage / fixtures. Refuses secrets. */
export function serializeReferenceCapture(capture: PolymarketReferenceCapture): string {
  if (containsSecretMetadata(capture)) throw new Error("reference capture contains secret metadata");
  return `${canonicalize(capture)}\n`;
}
