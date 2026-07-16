import { createHash } from "node:crypto";
import type { V4EvidenceIdentity } from "@/lib/proof/verificationApi";
import type { V4RecordedEvidence } from "@/lib/v4/lifecycleEvidence";

export function evidenceIdentityFor(raw: string, record: V4RecordedEvidence): V4EvidenceIdentity {
  const evidenceHash = createHash("sha256").update(raw).digest("hex");
  const fixtureVersion = `v4-lifecycle-${record.version}-fixture-${record.txline.fixtureId}`;
  const fields = [record.cluster, record.program.programId, fixtureVersion, evidenceHash, record.program.deploymentSlot, record.program.sbfSha256];
  return {
    cluster: record.cluster,
    programId: record.program.programId,
    fixtureVersion,
    evidenceHash,
    deploymentSlot: record.program.deploymentSlot,
    deployedProgramHash: record.program.sbfSha256,
    cacheKey: fields.join(":"),
  };
}
