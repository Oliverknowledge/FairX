import type { V4LifecycleVerification } from "@/lib/proof/v4LifecycleVerifier";

export type PublicV4LifecycleVerification = Omit<V4LifecycleVerification, "rpcUrl">;

export interface V4EvidenceIdentity {
  cluster: string;
  programId: string;
  fixtureVersion: string;
  evidenceHash: string;
  deploymentSlot: number;
  deployedProgramHash: string;
  cacheKey: string;
}

export interface PublicVerificationAttempt {
  status: "VERIFIED" | "FAILED" | "UNKNOWN";
  checkedAt: string;
  durationMs: number;
  rpcRequestCount: number;
  completedAt?: string;
  message?: string;
}

export interface V4VerificationResponse {
  verification: PublicV4LifecycleVerification | null;
  latestAttempt: PublicVerificationAttempt | null;
  evidence: V4EvidenceIdentity;
  cache: {
    source: "snapshot" | "memory" | "fresh" | null;
    cached: boolean;
    stale: boolean;
    ageSeconds: number | null;
    ttlSeconds: number;
    verifiedAt: string | null;
  };
  rpc: {
    privateConfigured: boolean;
  };
}
