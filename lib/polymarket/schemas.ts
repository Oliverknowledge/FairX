import type { PolymarketMarketDescriptor, RawBookLevel, RawOrderBook } from "@/lib/polymarket/types";

/**
 * Strict, hand-rolled validators for Polymarket's public responses. We never
 * trust the upstream shape: every field is checked, every array is bounded,
 * and unusable payloads raise a clear error instead of yielding a silent 0.5.
 *
 * Two Gamma quirks the parsers absorb:
 *   - `clobTokenIds`, `outcomes`, `outcomePrices` arrive as JSON-encoded
 *     STRINGS (e.g. '["Yes","No"]'), not arrays.
 *   - CLOB `timestamp` / `last_trade_price` may be a string or a number.
 */

export class PolymarketSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolymarketSchemaError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

/** Accept a numeric string or number; return null if not finite. */
function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** A Gamma field that is either a JSON-encoded string array or a real array. */
function parseStringArray(value: unknown): string[] | null {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const out = arr.map((v) => (typeof v === "string" ? v : String(v)));
  return out;
}

const CONDITION_ID_RE = /^0x[a-fA-F0-9]{64}$/;
const TOKEN_ID_RE = /^[0-9]{6,}$/; // CLOB token ids are large decimal integers

/**
 * Parse one Gamma market object into a validated descriptor. `eventId` is
 * supplied by the caller (the event wrapper), because a bare market response
 * does not always echo its parent event id.
 */
export function parseGammaMarket(raw: unknown, eventId: string): PolymarketMarketDescriptor {
  if (!isObject(raw)) throw new PolymarketSchemaError("market is not an object");

  const marketId = asString(raw.id) ?? asString(raw.marketMakerAddress);
  const conditionId = asString(raw.conditionId);
  const slug = asString(raw.slug) ?? "";
  const question = asString(raw.question) ?? "";
  if (!marketId) throw new PolymarketSchemaError("market.id missing");
  if (!conditionId || !CONDITION_ID_RE.test(conditionId)) {
    throw new PolymarketSchemaError("market.conditionId missing or malformed");
  }

  const tokens = parseStringArray(raw.clobTokenIds);
  if (!tokens || tokens.length !== 2) {
    throw new PolymarketSchemaError("market.clobTokenIds must be a pair");
  }
  const [yesTokenId, noTokenId] = tokens;
  if (!TOKEN_ID_RE.test(yesTokenId) || !TOKEN_ID_RE.test(noTokenId)) {
    throw new PolymarketSchemaError("market token ids are malformed");
  }

  const outcomesArr = parseStringArray(raw.outcomes) ?? ["Yes", "No"];
  if (outcomesArr.length !== 2) throw new PolymarketSchemaError("market.outcomes must be a pair");
  const outcomes: [string, string] = [outcomesArr[0], outcomesArr[1]];

  return {
    eventId,
    marketId,
    conditionId,
    questionId: asString(raw.questionID) ?? asString(raw.questionId) ?? undefined,
    slug,
    question,
    yesTokenId,
    noTokenId,
    outcomes,
    startTime: asString(raw.startDate) ?? undefined,
    closeTime: asString(raw.endDate) ?? undefined,
    resolutionRules: asString(raw.description) ?? "",
    active: asBool(raw.active),
    closed: asBool(raw.closed),
    enableOrderBook: asBool(raw.enableOrderBook),
  };
}

export interface GammaEvent {
  eventId: string;
  slug: string;
  title: string;
  closed: boolean;
  active: boolean;
  markets: PolymarketMarketDescriptor[];
}

/** Parse a Gamma event (from /events/{id} or /events/slug/{slug}). */
export function parseGammaEvent(raw: unknown): GammaEvent {
  if (!isObject(raw)) throw new PolymarketSchemaError("event is not an object");
  const eventId = asString(raw.id);
  if (!eventId) throw new PolymarketSchemaError("event.id missing");
  const marketsRaw = Array.isArray(raw.markets) ? raw.markets : [];
  const markets: PolymarketMarketDescriptor[] = [];
  for (const m of marketsRaw) {
    try {
      markets.push(parseGammaMarket(m, eventId));
    } catch {
      // Skip malformed sub-markets rather than fail the whole event; the
      // caller selects the specific mapped market by condition id / token.
    }
  }
  return {
    eventId,
    slug: asString(raw.slug) ?? "",
    title: asString(raw.title) ?? "",
    closed: asBool(raw.closed),
    active: asBool(raw.active),
    markets,
  };
}

function parseLevel(raw: unknown): RawBookLevel | null {
  if (!isObject(raw)) return null;
  const price = asNumber(raw.price);
  const size = asNumber(raw.size);
  if (price === null || size === null) return null;
  if (price < 0 || price > 1 || size < 0) return null;
  return { price: String(raw.price), size: String(raw.size) };
}

/** Parse and validate a CLOB /book response. */
export function parseClobBook(raw: unknown): RawOrderBook {
  if (!isObject(raw)) throw new PolymarketSchemaError("book is not an object");
  const market = asString(raw.market);
  const assetId = asString(raw.asset_id);
  if (!market) throw new PolymarketSchemaError("book.market missing");
  if (!assetId) throw new PolymarketSchemaError("book.asset_id missing");
  const timestamp = asNumber(raw.timestamp);
  if (timestamp === null) throw new PolymarketSchemaError("book.timestamp missing or malformed");

  const bidsRaw = Array.isArray(raw.bids) ? raw.bids : [];
  const asksRaw = Array.isArray(raw.asks) ? raw.asks : [];
  const bids = bidsRaw.map(parseLevel).filter((l): l is RawBookLevel => l !== null);
  const asks = asksRaw.map(parseLevel).filter((l): l is RawBookLevel => l !== null);

  return {
    market,
    assetId,
    timestamp,
    hash: asString(raw.hash) ?? undefined,
    bids,
    asks,
    tickSize: asString(raw.tick_size) ?? undefined,
    negRisk: typeof raw.neg_risk === "boolean" ? raw.neg_risk : undefined,
    lastTradePrice: asNumber(raw.last_trade_price) ?? undefined,
  };
}

/** Parse a CLOB /midpoint response `{ mid: "0.415" }`. */
export function parseClobMidpoint(raw: unknown): number {
  if (!isObject(raw)) throw new PolymarketSchemaError("midpoint is not an object");
  const mid = asNumber(raw.mid);
  if (mid === null) throw new PolymarketSchemaError("midpoint.mid malformed");
  return mid;
}

/** Parse a CLOB /spread response `{ spread: "0.01" }`. */
export function parseClobSpread(raw: unknown): number {
  if (!isObject(raw)) throw new PolymarketSchemaError("spread is not an object");
  const spread = asNumber(raw.spread);
  if (spread === null) throw new PolymarketSchemaError("spread.spread malformed");
  return spread;
}
