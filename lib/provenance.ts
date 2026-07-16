export const FAIRX_SOURCE_BASE_COMMIT = "26db8b50a78953c897f81c9bace4051c1428b046";
export const V4_DEPLOYMENT_TIMESTAMP = "2026-07-15T10:28:14Z";
export const V4_DEPLOYMENT_SLOT = 476_416_258;

type ProvenanceEnvironment = Record<string, string | undefined>;

export type BuildProvenance = {
  commitSha: string;
  commitLabel: "Deployed commit" | "Source base commit";
  buildTimestamp: string;
  deploymentTimestamp: string;
  deploymentSlot: number;
};

export function getBuildProvenance(
  environment: ProvenanceEnvironment = process.env,
  builtAt = new Date(),
): BuildProvenance {
  const deployedCommit = environment.VERCEL_GIT_COMMIT_SHA ?? environment.NEXT_PUBLIC_GIT_COMMIT_SHA;
  return {
    commitSha: deployedCommit ?? FAIRX_SOURCE_BASE_COMMIT,
    commitLabel: deployedCommit ? "Deployed commit" : "Source base commit",
    buildTimestamp: environment.NEXT_PUBLIC_BUILD_TIMESTAMP ?? builtAt.toISOString(),
    deploymentTimestamp: V4_DEPLOYMENT_TIMESTAMP,
    deploymentSlot: V4_DEPLOYMENT_SLOT,
  };
}
