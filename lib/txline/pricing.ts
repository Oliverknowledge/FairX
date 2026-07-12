export interface TxlineStablePriceRecord {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  MarketPeriod: string | null;
  MarketParameters: string | null;
  InRunning: boolean;
  PriceNames: string[];
  Prices: number[];
  Pct: string[];
}

export interface NormalizedPricingInput {
  fixtureId: string;
  messageId: string;
  timestamp: number;
  bookmaker: "TXLineStablePriceDemargined";
  market: string;
  marketPeriod: string | null;
  marketParameters: string | null;
  selection: string;
  decimalOdds: number;
  txlineDemarginedPct: string;
  impliedProbability: number;
  fairPriceMicros: number;
  derivation: "txline-demargined-pct-v1";
}

export const TXLINE_PRICING_MODEL_V1 = {
  id: "MATCH_WINNER_HOME_TXLINE_DEMARGINED_V1",
  version: 1,
  bookmaker: "TXLineStablePriceDemargined",
  market: "1X2_PARTICIPANT_RESULT",
  homeSelection: "part1",
  probabilitySource: "Pct",
  microsScale: 1_000_000,
} as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStablePriceRecord(value: unknown): value is TxlineStablePriceRecord {
  if (!record(value)) return false;
  return Number.isSafeInteger(value.FixtureId)
    && typeof value.MessageId === "string"
    && Number.isSafeInteger(value.Ts)
    && value.Bookmaker === "TXLineStablePriceDemargined"
    && Array.isArray(value.PriceNames)
    && Array.isArray(value.Prices)
    && Array.isArray(value.Pct);
}

export function normalizeStablePriceSelection(value: unknown, selection: string): NormalizedPricingInput {
  if (!isStablePriceRecord(value)) throw new Error("Expected a genuine TxLINE StablePrice record");
  const index = value.PriceNames.indexOf(selection);
  if (index < 0) throw new Error(`TxLINE selection ${selection} is unavailable`);
  const pctText = value.Pct[index];
  const pct = Number(pctText);
  const scaledDecimal = value.Prices[index];
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error("TxLINE de-margined percentage is invalid");
  if (!Number.isFinite(scaledDecimal) || scaledDecimal <= 0) throw new Error("TxLINE StablePrice decimal odds are invalid");
  const impliedProbability = Math.round((pct / 100) * 1_000_000) / 1_000_000;
  return {
    fixtureId: String(value.FixtureId),
    messageId: value.MessageId,
    timestamp: value.Ts,
    bookmaker: "TXLineStablePriceDemargined",
    market: value.SuperOddsType,
    marketPeriod: value.MarketPeriod,
    marketParameters: value.MarketParameters,
    selection,
    decimalOdds: scaledDecimal / 1_000,
    txlineDemarginedPct: pctText,
    impliedProbability,
    fairPriceMicros: Math.round(impliedProbability * 1_000_000),
    derivation: "txline-demargined-pct-v1",
  };
}

export function findStablePriceRecord(value: unknown, fixtureId: string): TxlineStablePriceRecord {
  const queue: unknown[] = [value];
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (isStablePriceRecord(candidate) && String(candidate.FixtureId) === fixtureId) return candidate;
    if (Array.isArray(candidate)) queue.push(...candidate);
    else if (record(candidate)) queue.push(...Object.values(candidate));
  }
  throw new Error(`No genuine TxLINE StablePrice record found for fixture ${fixtureId}`);
}

export function deriveMatchWinnerHomePrice(value: unknown, fixtureId: string): NormalizedPricingInput {
  const stablePrice = findStablePriceRecord(value, fixtureId);
  if (stablePrice.SuperOddsType !== TXLINE_PRICING_MODEL_V1.market) throw new Error("TxLINE odds market is not the committed 1X2 participant-result market");
  const normalized = normalizeStablePriceSelection(stablePrice, TXLINE_PRICING_MODEL_V1.homeSelection);
  if (normalized.fixtureId !== fixtureId || normalized.selection !== "part1") throw new Error("TxLINE fixture or home-selection identity mismatch");
  return normalized;
}
