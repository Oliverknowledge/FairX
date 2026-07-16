import { sha256 } from "js-sha256";

export const QUOTE_GUARD_VERSION = "fairx-quoteguard-v1" as const;
export const QUOTE_NORMALIZATION_VERSION = "fairx-v4-demargin-spread-v1" as const;
export const DEFAULT_QUOTE_MAX_AGE_MS = 120_000;
const MICROS_ONE = 1_000_000n;

export interface TxlineOddsForQuoteGuard {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState: string | null;
  InRunning: boolean;
  MarketParameters: string | null;
  MarketPeriod: string | null;
  PriceNames: string[];
  Prices: number[];
}
export interface QuoteGuardCommitment {
  version: typeof QUOTE_GUARD_VERSION;
  fixtureId: number;
  quoteSequence: number;
  materialEventSequence: number;
  txlineOddsSequence: string;
  oddsHash: string;
  normalizationVersion: typeof QUOTE_NORMALIZATION_VERSION;
  impliedProbabilityMicros: number;
  generatedYesQuoteMicros: number;
  generatedNoQuoteMicros: number;
  spreadMicros: number;
  sourceTimestampMs: number;
  expiresAtMs: number;
  commitmentHash: string;
}

export interface QuoteGuardCheck {
  id: "fixture" | "odds-sequence" | "odds-hash" | "normalization" | "probability" | "generated-quote" | "timestamp-expiry" | "onchain-anchor";
  label: string;
  passed: boolean;
}

export interface QuoteGuardVerification {
  status: "VERIFIED" | "FAILED";
  checks: QuoteGuardCheck[];
  commitment: QuoteGuardCommitment;
}

class BorshWriter {
  private readonly bytes: number[] = [];

  private pushBuffer(buffer: ArrayBuffer) { this.bytes.push(...new Uint8Array(buffer)); }
  private u32(value: number) { const b = new ArrayBuffer(4); new DataView(b).setUint32(0, value, true); this.pushBuffer(b); }
  private i32(value: number) { const b = new ArrayBuffer(4); new DataView(b).setInt32(0, value, true); this.pushBuffer(b); }
  private i64(value: number) { const b = new ArrayBuffer(8); new DataView(b).setBigInt64(0, BigInt(value), true); this.pushBuffer(b); }
  private bool(value: boolean) { this.bytes.push(value ? 1 : 0); }
  private string(value: string) { const encoded = new TextEncoder().encode(value); this.u32(encoded.length); this.bytes.push(...encoded); }
  private optionString(value: string | null) { if (value === null) this.bytes.push(0); else { this.bytes.push(1); this.string(value); } }

  odds(value: TxlineOddsForQuoteGuard) {
    this.i64(value.FixtureId);
    this.string(value.MessageId);
    this.i64(value.Ts);
    this.string(value.Bookmaker);
    this.i32(value.BookmakerId);
    this.string(value.SuperOddsType);
    this.optionString(value.GameState);
    this.bool(value.InRunning);
    this.optionString(value.MarketParameters);
    this.optionString(value.MarketPeriod);
    this.u32(value.PriceNames.length);
    value.PriceNames.forEach((name) => this.string(name));
    this.u32(value.Prices.length);
    value.Prices.forEach((price) => this.i32(price));
    return new Uint8Array(this.bytes);
  }
}

function assertOdds(value: TxlineOddsForQuoteGuard) {
  if (!Number.isSafeInteger(value.FixtureId) || !Number.isSafeInteger(value.Ts)) throw new Error("QuoteGuard requires safe fixture and timestamp integers");
  if (!value.MessageId || value.Bookmaker !== "TXLineStablePriceDemargined") throw new Error("QuoteGuard requires a TxLINE StablePrice record");
  if (value.SuperOddsType !== "1X2_PARTICIPANT_RESULT" || value.MarketParameters !== null || value.MarketPeriod !== null) throw new Error("QuoteGuard supports the committed full-time 1X2 market only");
  if (value.PriceNames.join(",") !== "part1,draw,part2" || value.Prices.length !== 3 || value.Prices.some((price) => !Number.isInteger(price) || price <= 0)) throw new Error("QuoteGuard requires three valid home/draw/away prices");
}

export function hashTxlineOdds(value: TxlineOddsForQuoteGuard): string {
  assertOdds(value);
  return sha256(new BorshWriter().odds(value));
}

export function deriveQuoteGuardPrices(prices: readonly number[], spreadMicros: number) {
  if (prices.length !== 3 || prices.some((price) => !Number.isInteger(price) || price <= 0)) throw new Error("QuoteGuard requires three positive integer prices");
  if (!Number.isSafeInteger(spreadMicros) || spreadMicros < 0) throw new Error("QuoteGuard spread must be a non-negative integer");
  const [home, draw, away] = prices.map(BigInt);
  const drawAway = draw * away;
  const denominator = drawAway + home * away + home * draw;
  const probability = (drawAway * MICROS_ONE + denominator / 2n) / denominator;
  return {
    impliedProbabilityMicros: Number(probability),
    generatedYesQuoteMicros: Number(probability + BigInt(spreadMicros)),
    generatedNoQuoteMicros: Number(MICROS_ONE - probability + BigInt(spreadMicros)),
  };
}

function commitmentDigest(value: Omit<QuoteGuardCommitment, "commitmentHash">): string {
  return sha256(JSON.stringify([
    value.version,
    value.fixtureId,
    value.quoteSequence,
    value.materialEventSequence,
    value.txlineOddsSequence,
    value.oddsHash,
    value.normalizationVersion,
    value.impliedProbabilityMicros,
    value.generatedYesQuoteMicros,
    value.generatedNoQuoteMicros,
    value.spreadMicros,
    value.sourceTimestampMs,
    value.expiresAtMs,
  ]));
}

export function createQuoteGuardCommitment(input: {
  odds: TxlineOddsForQuoteGuard;
  quoteSequence: number;
  materialEventSequence: number;
  spreadMicros: number;
  maxAgeMs?: number;
}): QuoteGuardCommitment {
  assertOdds(input.odds);
  const prices = deriveQuoteGuardPrices(input.odds.Prices, input.spreadMicros);
  const withoutHash: Omit<QuoteGuardCommitment, "commitmentHash"> = {
    version: QUOTE_GUARD_VERSION,
    fixtureId: input.odds.FixtureId,
    quoteSequence: input.quoteSequence,
    materialEventSequence: input.materialEventSequence,
    txlineOddsSequence: input.odds.MessageId,
    oddsHash: hashTxlineOdds(input.odds),
    normalizationVersion: QUOTE_NORMALIZATION_VERSION,
    ...prices,
    spreadMicros: input.spreadMicros,
    sourceTimestampMs: input.odds.Ts,
    expiresAtMs: input.odds.Ts + (input.maxAgeMs ?? DEFAULT_QUOTE_MAX_AGE_MS),
  };
  return { ...withoutHash, commitmentHash: commitmentDigest(withoutHash) };
}

export function verifyQuoteGuard(
  commitment: QuoteGuardCommitment,
  odds: TxlineOddsForQuoteGuard,
  expectedOnchainOddsHash: string,
): QuoteGuardVerification {
  let derived: ReturnType<typeof createQuoteGuardCommitment> | null = null;
  try {
    derived = createQuoteGuardCommitment({
      odds,
      quoteSequence: commitment.quoteSequence,
      materialEventSequence: commitment.materialEventSequence,
      spreadMicros: commitment.spreadMicros,
      maxAgeMs: commitment.expiresAtMs - commitment.sourceTimestampMs,
    });
  } catch {
    derived = null;
  }
  const checks: QuoteGuardCheck[] = [
    { id: "fixture", label: "Fixture matches", passed: Boolean(derived && commitment.fixtureId === odds.FixtureId && commitment.fixtureId === derived.fixtureId) },
    { id: "odds-sequence", label: "TxLINE odds update matches", passed: Boolean(derived && commitment.txlineOddsSequence === odds.MessageId) },
    { id: "odds-hash", label: "Exact odds snapshot matches", passed: Boolean(derived && commitment.oddsHash === derived.oddsHash) },
    { id: "normalization", label: "Normalization rule matches", passed: commitment.version === QUOTE_GUARD_VERSION && commitment.normalizationVersion === QUOTE_NORMALIZATION_VERSION },
    { id: "probability", label: "Implied probability recomputes", passed: Boolean(derived && commitment.impliedProbabilityMicros === derived.impliedProbabilityMicros) },
    { id: "generated-quote", label: "Displayed quote recomputes", passed: Boolean(derived && commitment.generatedYesQuoteMicros === derived.generatedYesQuoteMicros && commitment.generatedNoQuoteMicros === derived.generatedNoQuoteMicros) },
    { id: "timestamp-expiry", label: "Timestamp and expiry are bounded", passed: Boolean(derived && commitment.sourceTimestampMs === odds.Ts && commitment.expiresAtMs > commitment.sourceTimestampMs && commitment.commitmentHash === derived.commitmentHash) },
    { id: "onchain-anchor", label: "On-chain quote receipt matches", passed: commitment.oddsHash === expectedOnchainOddsHash },
  ];
  return { status: checks.every((check) => check.passed) ? "VERIFIED" : "FAILED", checks, commitment };
}

export function formatQuoteMicros(value: number): string {
  return `${(value / 10_000).toFixed(2)}%`;
}
