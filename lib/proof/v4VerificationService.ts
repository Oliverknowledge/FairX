import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyV4Lifecycle, type V4RpcClient } from "@/lib/proof/v4LifecycleVerifier";
import { createServerRpcConnection, privateRpcConfigured, type RpcTransportMetrics } from "@/lib/proof/serverRpc";
import { VerificationResultCache, type VerificationRun } from "@/lib/proof/verificationCache";
import type { PublicV4LifecycleVerification, V4EvidenceIdentity, V4VerificationResponse } from "@/lib/proof/verificationApi";
import { evidenceIdentityFor } from "@/lib/proof/v4VerificationIdentity";
import { V4_EVIDENCE_IDENTITY, V4_LAST_VERIFIED_SNAPSHOT } from "@/lib/proof/v4VerificationSnapshot";
import type { V4RecordedEvidence } from "@/lib/v4/lifecycleEvidence";

export const V4_VERIFIED_TTL_MS = 10 * 60_000;
export const V4_VERIFY_TIMEOUT_MS = 45_000;

type GlobalCache = typeof globalThis & {
  __fairxV4VerificationCache?: VerificationResultCache<PublicV4LifecycleVerification>;
  __fairxV4SnapshotSeeded?: boolean;
};

const shared = globalThis as GlobalCache;
const cache = shared.__fairxV4VerificationCache ??= new VerificationResultCache<PublicV4LifecycleVerification>();
if (!shared.__fairxV4SnapshotSeeded) {
  cache.seedVerified(V4_EVIDENCE_IDENTITY.cacheKey, V4_LAST_VERIFIED_SNAPSHOT, "snapshot");
  shared.__fairxV4SnapshotSeeded = true;
}

function publicResult(result: Awaited<ReturnType<typeof verifyV4Lifecycle>>): PublicV4LifecycleVerification {
  const { rpcUrl: _privateRpcUrl, ...safe } = result;
  return safe;
}

async function loadRecord() {
  const raw = await readFile(resolve(process.cwd(), "fixtures/lineguard/v4-france-morocco-lifecycle.json"), "utf8");
  const record = JSON.parse(raw) as V4RecordedEvidence;
  return { record, identity: evidenceIdentityFor(raw, record) };
}

async function runFresh(timeoutMs = V4_VERIFY_TIMEOUT_MS): Promise<{ identity: V4EvidenceIdentity; run: VerificationRun<PublicV4LifecycleVerification> }> {
  const startedAt = Date.now();
  const checkedAt = new Date(startedAt).toISOString();
  const metrics: RpcTransportMetrics = { httpRequests: 0, retries: 0, rateLimits: 0 };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { record, identity } = await loadRecord();
    const client = createServerRpcConnection({ signal: controller.signal, metrics }) as unknown as V4RpcClient;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort(new Error("Verification timed out"));
        reject(new Error(`Verification timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const privateRpc = privateRpcConfigured();
    const verification = await Promise.race([verifyV4Lifecycle(record, {
      client,
      transactionBatchSize: privateRpc ? 8 : 1,
      transactionBatchPaceMs: privateRpc ? 0 : 500,
    }), timeout]);
    const safe = publicResult(verification);
    const completedAt = new Date().toISOString();
    return {
      identity,
      run: {
        status: safe.status,
        checkedAt: safe.checkedAt,
        result: safe,
        durationMs: Date.now() - startedAt,
        rpcRequestCount: metrics.httpRequests,
        completedAt,
        message: metrics.rateLimits > 0 ? `RPC recovered after ${metrics.rateLimits} rate-limit response(s).` : undefined,
      },
    };
  } catch (error) {
    return {
      identity: V4_EVIDENCE_IDENTITY,
      run: {
        status: "UNKNOWN",
        checkedAt,
        durationMs: Date.now() - startedAt,
        rpcRequestCount: metrics.httpRequests,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

export function currentV4VerificationResponse(now = Date.now(), latestRun?: VerificationRun<PublicV4LifecycleVerification>): V4VerificationResponse {
  const state = cache.state(V4_EVIDENCE_IDENTITY.cacheKey, now);
  const attempt = latestRun ?? state.lastAttempt;
  const verification = state.lastVerified ?? attempt?.result ?? null;
  return {
    verification,
    latestAttempt: attempt ? {
      status: attempt.status,
      checkedAt: attempt.checkedAt,
      durationMs: attempt.durationMs,
      rpcRequestCount: attempt.rpcRequestCount,
      completedAt: attempt.completedAt,
      message: attempt.message,
    } : null,
    evidence: V4_EVIDENCE_IDENTITY,
    cache: {
      source: state.source,
      cached: latestRun?.status !== "VERIFIED",
      stale: state.stale,
      ageSeconds: state.cacheAgeMs === null ? null : Math.floor(state.cacheAgeMs / 1_000),
      ttlSeconds: Math.floor(V4_VERIFIED_TTL_MS / 1_000),
      verifiedAt: state.verifiedAt,
    },
    rpc: { privateConfigured: privateRpcConfigured() },
  };
}

/** Force a genuine RPC scan. Simultaneous callers share the same promise. */
export async function refreshV4Verification(timeoutMs = V4_VERIFY_TIMEOUT_MS): Promise<V4VerificationResponse> {
  const { identity } = await loadRecord();
  const run = await cache.refresh(identity.cacheKey, async () => (await runFresh(timeoutMs)).run);
  return currentV4VerificationResponse(Date.now(), run);
}

export function v4VerificationIsInFlight() {
  return cache.hasInFlight(V4_EVIDENCE_IDENTITY.cacheKey);
}

export function snapshotMatchesCurrentEvidence(raw: string, record: V4RecordedEvidence) {
  return evidenceIdentityFor(raw, record).cacheKey === V4_EVIDENCE_IDENTITY.cacheKey;
}
