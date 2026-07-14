/**
 * Polymarket reference-price configuration. Everything here is PUBLIC:
 * read-only market-data endpoints, no API key, no auth header, no cookie.
 *
 * FairX uses Polymarket's public order book as an *external reference quote*
 * for an equivalent market. It never routes orders to Polymarket, never
 * custodies Polygon assets, and never uses Polymarket trading authentication.
 * All user execution stays on Solana devnet under LineGuard.
 *
 * Server-only: import exclusively from route handlers / scripts, never from a
 * client component. (There are no secrets here, but keeping the upstream
 * surface server-side lets us rate-limit, cache, and allowlist centrally.)
 */

/** Micros scale shared with lib/solana/priceMicros.ts and the on-chain program. */
export const REFERENCE_MICROS_ONE = 1_000_000;

/** Official public base URLs (documented, keyless, read-only). */
export const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
export const CLOB_BASE_URL = "https://clob.polymarket.com";

export type ReferenceMethod =
  | "ORDERBOOK_MIDPOINT"
  | "DEPTH_WEIGHTED_MIDPOINT"
  | "LAST_TRADE_FALLBACK"
  | "UNAVAILABLE";

export interface PolymarketReferenceConfig {
  gammaBaseUrl: string;
  clobBaseUrl: string;
  /** Per-request upstream timeout. */
  requestTimeoutMs: number;
  /** Retries on transient upstream failure (capped exponential backoff). */
  maxRetries: number;
  backoffBaseMs: number;
  backoffCapMs: number;
  /** Circuit breaker: after N consecutive failures, refuse for cooldownMs. */
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
  /** Reject a quote whose bid/ask spread exceeds this (micros of $1). */
  maxSpreadMicros: number;
  /** Reject a quote with less than this visible size on either side. */
  minVisibleDepth: number;
  /** Reject a quote whose order-book timestamp is older than this. */
  maxQuoteAgeMs: number;
  /** Default reference-price method for the canonical flow. */
  referenceMethod: ReferenceMethod;
  /** Cumulative size consumed on each side for the depth-weighted diagnostic. */
  depthWindowSize: number;
  /** Reject as unstable if simple vs depth-weighted midpoint diverge beyond this (micros). */
  maxMethodDivergenceMicros: number;
  /** Server cache TTL for a live reference quote. */
  quoteCacheTtlMs: number;
}

const numEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const methodEnv = (key: string, fallback: ReferenceMethod): ReferenceMethod => {
  const raw = (process.env[key] ?? "").trim().toUpperCase();
  return raw === "ORDERBOOK_MIDPOINT" ||
    raw === "DEPTH_WEIGHTED_MIDPOINT" ||
    raw === "LAST_TRADE_FALLBACK"
    ? raw
    : fallback;
};

/**
 * Safe, documented defaults. Every threshold is overridable by env so the
 * demo can be tuned without a code change, but the defaults are conservative:
 * they reject wide, thin, crossed, empty, or stale books rather than invent a
 * number.
 */
export function getPolymarketConfig(): PolymarketReferenceConfig {
  return {
    gammaBaseUrl: (process.env.POLYMARKET_GAMMA_URL ?? GAMMA_BASE_URL).replace(/\/$/, ""),
    clobBaseUrl: (process.env.POLYMARKET_CLOB_URL ?? CLOB_BASE_URL).replace(/\/$/, ""),
    requestTimeoutMs: numEnv("POLYMARKET_REQUEST_TIMEOUT_MS", 8_000),
    maxRetries: numEnv("POLYMARKET_MAX_RETRIES", 2),
    backoffBaseMs: numEnv("POLYMARKET_BACKOFF_BASE_MS", 250),
    backoffCapMs: numEnv("POLYMARKET_BACKOFF_CAP_MS", 2_000),
    circuitFailureThreshold: numEnv("POLYMARKET_CIRCUIT_FAILURE_THRESHOLD", 5),
    circuitCooldownMs: numEnv("POLYMARKET_CIRCUIT_COOLDOWN_MS", 30_000),
    maxSpreadMicros: numEnv("POLYMARKET_MAX_SPREAD_MICROS", 50_000), // 5¢
    minVisibleDepth: numEnv("POLYMARKET_MIN_VISIBLE_DEPTH", 100), // 100 shares each side
    maxQuoteAgeMs: numEnv("POLYMARKET_MAX_QUOTE_AGE_MS", 60_000), // 60s
    referenceMethod: methodEnv("POLYMARKET_REFERENCE_METHOD", "ORDERBOOK_MIDPOINT"),
    depthWindowSize: numEnv("POLYMARKET_DEPTH_WINDOW_SIZE", 500),
    maxMethodDivergenceMicros: numEnv("POLYMARKET_MAX_METHOD_DIVERGENCE_MICROS", 20_000), // 2¢
    quoteCacheTtlMs: numEnv("POLYMARKET_QUOTE_CACHE_TTL_MS", 5_000),
  };
}
