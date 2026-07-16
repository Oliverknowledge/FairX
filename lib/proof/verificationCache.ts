export type VerificationStatus = "VERIFIED" | "FAILED" | "UNKNOWN";
export type VerificationCacheSource = "snapshot" | "memory" | "fresh";

export interface CacheableVerification {
  status: VerificationStatus;
  checkedAt: string;
}

export interface VerificationRun<T extends CacheableVerification> {
  status: VerificationStatus;
  checkedAt: string;
  result?: T;
  durationMs: number;
  rpcRequestCount: number;
  completedAt?: string;
  message?: string;
}

interface VerifiedEntry<T> {
  result: T;
  source: VerificationCacheSource;
  verifiedAt: string;
}

interface AttemptEntry<T extends CacheableVerification> {
  run: VerificationRun<T>;
  expiresAt: number;
}

export interface VerificationCacheState<T extends CacheableVerification> {
  lastVerified: T | null;
  lastAttempt: VerificationRun<T> | null;
  source: VerificationCacheSource | null;
  cacheAgeMs: number | null;
  verifiedAt: string | null;
  stale: boolean;
}

export interface VerificationCacheTtls {
  verifiedMs: number;
  failedMs: number;
  unknownMs: number;
}

export const DEFAULT_VERIFICATION_TTLS: VerificationCacheTtls = {
  verifiedMs: 10 * 60_000,
  failedMs: 45_000,
  unknownMs: 15_000,
};

/**
 * Process-local cache and single-flight coordinator.
 *
 * A FAILED or UNKNOWN attempt is recorded separately and can never replace a
 * previous VERIFIED result. A rejected runner is never retained in-flight.
 */
export class VerificationResultCache<T extends CacheableVerification> {
  private readonly verified = new Map<string, VerifiedEntry<T>>();
  private readonly attempts = new Map<string, AttemptEntry<T>>();
  private readonly inFlight = new Map<string, Promise<VerificationRun<T>>>();

  constructor(private readonly ttls: VerificationCacheTtls = DEFAULT_VERIFICATION_TTLS) {}

  seedVerified(key: string, result: T, source: VerificationCacheSource = "snapshot", verifiedAt = result.checkedAt) {
    if (result.status !== "VERIFIED") throw new Error("Only a complete VERIFIED result may seed the verified cache");
    this.verified.set(key, { result, source, verifiedAt });
  }

  state(key: string, now = Date.now()): VerificationCacheState<T> {
    const verified = this.verified.get(key);
    const attempted = this.attempts.get(key);
    if (attempted && attempted.expiresAt <= now) this.attempts.delete(key);
    const verifiedAtMs = verified ? Date.parse(verified.verifiedAt) : NaN;
    const cacheAgeMs = Number.isFinite(verifiedAtMs) ? Math.max(0, now - verifiedAtMs) : null;
    return {
      lastVerified: verified?.result ?? null,
      lastAttempt: attempted && attempted.expiresAt > now ? attempted.run : null,
      source: verified?.source ?? null,
      cacheAgeMs,
      verifiedAt: verified?.verifiedAt ?? null,
      stale: cacheAgeMs === null || cacheAgeMs > this.ttls.verifiedMs,
    };
  }

  refresh(key: string, runner: () => Promise<VerificationRun<T>>, now = () => Date.now()): Promise<VerificationRun<T>> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const started = (async () => {
      const run = await runner();
      if (run.status === "VERIFIED" && run.result?.status === "VERIFIED") {
        this.verified.set(key, { result: run.result, source: "fresh", verifiedAt: run.completedAt ?? run.checkedAt });
        this.attempts.delete(key);
      } else {
        const ttl = run.status === "FAILED" ? this.ttls.failedMs : this.ttls.unknownMs;
        this.attempts.set(key, { run, expiresAt: now() + ttl });
      }
      return run;
    })();
    this.inFlight.set(key, started);
    void started.finally(() => {
      if (this.inFlight.get(key) === started) this.inFlight.delete(key);
    }).catch(() => undefined);
    return started;
  }

  hasInFlight(key: string) {
    return this.inFlight.has(key);
  }
}
