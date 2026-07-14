import { getPolymarketConfig, type PolymarketReferenceConfig } from "@/lib/polymarket/config";
import {
  parseClobBook,
  parseClobMidpoint,
  parseClobSpread,
  parseGammaEvent,
  type GammaEvent,
} from "@/lib/polymarket/schemas";
import type { RawOrderBook } from "@/lib/polymarket/types";

/**
 * Server-only HTTP client for Polymarket's PUBLIC market-data APIs.
 *
 * - No API key, no Authorization header, no cookies, no trading auth.
 * - Strict per-request timeout via AbortController.
 * - Capped exponential backoff on transient failures.
 * - A per-host circuit breaker so a Polymarket outage cannot hang FairX or
 *   exhaust its own rate budget; it fails fast with a clear error instead.
 */

export class PolymarketUpstreamError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "PolymarketUpstreamError";
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

interface Breaker {
  failures: number;
  openUntil: number;
}
const breakers = new Map<string, Breaker>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

function breakerFor(host: string): Breaker {
  let b = breakers.get(host);
  if (!b) {
    b = { failures: 0, openUntil: 0 };
    breakers.set(host, b);
  }
  return b;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** For tests: reset breaker state between cases. */
export function resetPolymarketBreakers(): void {
  breakers.clear();
}

async function fetchJson(url: string, cfg: PolymarketReferenceConfig): Promise<unknown> {
  const host = hostOf(url);
  const breaker = breakerFor(host);
  const now = Date.now();
  if (breaker.openUntil > now) {
    throw new PolymarketUpstreamError(`Polymarket circuit open for ${host} (cooling down)`, { retryable: false });
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        // Explicitly public: no credentials, no cookies, no custom auth.
        credentials: "omit",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        throw new PolymarketUpstreamError(`Polymarket ${res.status} for ${url}`, { status: res.status, retryable });
      }
      const json = (await res.json()) as unknown;
      breaker.failures = 0;
      breaker.openUntil = 0;
      return json;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const retryable =
        err instanceof PolymarketUpstreamError ? err.retryable : true; // abort / network → retry
      if (!retryable || attempt === cfg.maxRetries) break;
      const backoff = Math.min(cfg.backoffCapMs, cfg.backoffBaseMs * 2 ** attempt);
      await sleep(backoff);
    }
  }

  breaker.failures += 1;
  if (breaker.failures >= cfg.circuitFailureThreshold) {
    breaker.openUntil = Date.now() + cfg.circuitCooldownMs;
    breaker.failures = 0;
  }
  if (lastErr instanceof PolymarketUpstreamError) throw lastErr;
  const reason = lastErr instanceof Error ? lastErr.message : "unknown error";
  throw new PolymarketUpstreamError(`Polymarket request failed for ${url}: ${reason}`, { retryable: true });
}

export class PolymarketClient {
  private readonly cfg: PolymarketReferenceConfig;
  constructor(cfg: PolymarketReferenceConfig = getPolymarketConfig()) {
    this.cfg = cfg;
  }

  private gamma(path: string): string {
    return `${this.cfg.gammaBaseUrl}${path}`;
  }
  private clob(path: string): string {
    return `${this.cfg.clobBaseUrl}${path}`;
  }

  async getEventBySlug(slug: string): Promise<GammaEvent> {
    return parseGammaEvent(await fetchJson(this.gamma(`/events/slug/${encodeURIComponent(slug)}`), this.cfg));
  }

  async getEventById(eventId: string): Promise<GammaEvent> {
    return parseGammaEvent(await fetchJson(this.gamma(`/events/${encodeURIComponent(eventId)}`), this.cfg));
  }

  async getBook(tokenId: string): Promise<RawOrderBook> {
    return parseClobBook(await fetchJson(this.clob(`/book?token_id=${encodeURIComponent(tokenId)}`), this.cfg));
  }

  async getMidpoint(tokenId: string): Promise<number> {
    return parseClobMidpoint(await fetchJson(this.clob(`/midpoint?token_id=${encodeURIComponent(tokenId)}`), this.cfg));
  }

  async getSpread(tokenId: string): Promise<number> {
    return parseClobSpread(await fetchJson(this.clob(`/spread?token_id=${encodeURIComponent(tokenId)}`), this.cfg));
  }

  /** Raw public-search passthrough for the discovery script only (never a user route). */
  async publicSearch(query: string): Promise<unknown> {
    return fetchJson(this.gamma(`/public-search?q=${encodeURIComponent(query)}&limit_per_type=10`), this.cfg);
  }
}
