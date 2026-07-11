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
