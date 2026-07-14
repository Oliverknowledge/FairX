/**
 * Minimal in-memory fixed-window rate limiter for the public reference-quote
 * routes. Per-IP and global caps stop a visitor (or a scraper) from turning
 * FairX into an open Polymarket proxy or exhausting its upstream budget.
 *
 * In-memory means per-instance on serverless; that is acceptable and documented
 * — the goal is a courtesy limit plus the client-side circuit breaker, not a
 * distributed quota. There are no secrets and no user data here.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitResult {
  const state = buckets.get(key);
  if (!state || state.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (state.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: state.resetAt - now };
  }
  state.count += 1;
  return { allowed: true, remaining: limit - state.count, retryAfterMs: 0 };
}

/** For tests. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort client key from proxy headers; falls back to a shared bucket. */
export function clientKeyFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "anonymous";
}
