import { sha256 } from "js-sha256";
import lifecycleFixture from "@/fixtures/lineguard/v2-france-morocco-lifecycle.json";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";
import { hashRawEvent } from "@/lib/proof/eventHash";

export type V2LifecycleProof = typeof lifecycleFixture;

export interface V2LifecycleVerification {
  valid: boolean;
  issues: string[];
  checks: {
    captureHash: boolean;
    borshPayloadHash: boolean;
    fixtureAndSequence: boolean;
    marketConfiguration: boolean;
    protectionVerdict: boolean;
    positionOwnership: boolean;
    thresholdResolution: boolean;
    payout: boolean;
    vaultConservation: boolean;
    claimTransaction: boolean;
  };
  recomputedCaptureHash: string;
  recomputedBorshPayloadHash: string;
}

const EXPECTED = {
  receiptId: "v2-france-morocco",
  programId: "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe",
  fixtureId: "18209181",
  sequence: 739,
  borshPayloadHash: "1b1c31c9ffee2aec676fa9d9585e677c0c5ee42d38ec137f222fc87ea8501c98",
  claimTransaction: "4q3mMYvWBrJzv3Vyix9TBYJGjCWAtMAAMAMsQrmnM1e7MiHwBvsevZhJf5UBMQvoKW1AtyoE6Ji3S9zY9c2QgJHR",
  trader: "8GEhW9qEJEFPQ6sA34H9fMUk937LPCVvKcVwWbhka4vx",
} as const;

export const canonicalV2Lifecycle = lifecycleFixture;

function pushU32(out: number[], value: number): void {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  out.push(...bytes);
}

function pushI32(out: number[], value: number): void {
  const bytes = Buffer.alloc(4);
  bytes.writeInt32LE(value);
  out.push(...bytes);
}

function pushI64(out: number[], value: number): void {
  const bytes = Buffer.alloc(8);
  bytes.writeBigInt64LE(BigInt(value));
  out.push(...bytes);
}

function pushProofNodes(out: number[], nodes: Array<{ hash: number[]; isRightSibling: boolean }>): void {
  pushU32(out, nodes.length);
  for (const node of nodes) out.push(...node.hash, node.isRightSibling ? 1 : 0);
}

/** Exact Borsh encoding of LineGuard's StatValidationInput / TxLINE validateStatV2 subset. */
export function reconstructTxlineCpiPayload(): Uint8Array {
  const source = canonicalValidation.validationPayload;
  const out: number[] = [];
  pushI64(out, source.ts);
  pushI64(out, source.summary.fixtureId);
  pushI32(out, source.summary.updateStats.updateCount);
  pushI64(out, source.summary.updateStats.minTimestamp);
  pushI64(out, source.summary.updateStats.maxTimestamp);
  out.push(...source.summary.eventStatsSubTreeRoot);
  pushProofNodes(out, source.subTreeProof);
  pushProofNodes(out, source.mainTreeProof);
  out.push(...source.eventStatRoot);
  pushU32(out, source.statsToProve.length);
  source.statsToProve.forEach((stat, index) => {
    pushU32(out, stat.key);
    pushI32(out, stat.value);
    pushI32(out, stat.period);
    pushProofNodes(out, source.statProofs[index]);
  });
  return Uint8Array.from(out);
}

export function recomputeBorshPayloadHash(): string {
  return sha256(reconstructTxlineCpiPayload());
}

export function verifyV2Lifecycle(proof: V2LifecycleProof = canonicalV2Lifecycle): V2LifecycleVerification {
  const issues: string[] = [];
  const recomputedCaptureHash = hashRawEvent(canonicalCapture.rawPayload);
  const recomputedBorshPayloadHash = recomputeBorshPayloadHash();
  const stats = canonicalValidation.validationPayload.statsToProve;
  const home = stats.find((stat) => stat.key === proof.txline.statKeys[0]);
  const away = stats.find((stat) => stat.key === proof.txline.statKeys[1]);
  const expectedOutcome = home && away ? (home.value > away.value ? "YES" : "NO") : "INVALID";
  const maskValue = /^[01]{3}$/.test(proof.authorities.approvalMask) ? Number.parseInt(proof.authorities.approvalMask, 2) : 0;
  const approvals = maskValue.toString(2).split("").filter((bit) => bit === "1").length;

  const checks = {
    captureHash: proof.txline.captureHashDomain === "canonical-json"
      && proof.txline.captureHash === recomputedCaptureHash
      && proof.txline.captureHash === canonicalCapture.rawPayloadHash,
    borshPayloadHash: proof.txline.cpiPayloadHashDomain === "borsh"
      && proof.txline.borshPayloadHash === recomputedBorshPayloadHash
      && proof.txline.borshPayloadHash === EXPECTED.borshPayloadHash,
    fixtureAndSequence: proof.txline.fixtureId === EXPECTED.fixtureId
      && proof.txline.fixtureId === canonicalCapture.fixtureId
      && proof.txline.sequence === EXPECTED.sequence
      && proof.txline.sequence === canonicalCapture.normalizedEvent.seq
      && canonicalValidation.fixtureId === proof.txline.fixtureId
      && canonicalValidation.seq === proof.txline.sequence
      && proof.txline.statKeys.join(",") === canonicalValidation.statKeys.join(",")
      && home?.value === proof.txline.homeScore
      && away?.value === proof.txline.awayScore,
    marketConfiguration: proof.receiptId === EXPECTED.receiptId
      && proof.program.programId === EXPECTED.programId
      && proof.market.template === "MATCH_WINNER_HOME_V1"
      && proof.market.fixtureCommitment === proof.txline.fixtureIdHash
      && proof.market.resolved
      && proof.market.resolution === proof.txline.derivedOutcome,
    protectionVerdict: proof.lifecycle.refundedStakeLamports === 10_000_000
      && proof.vault.totalRefundedLamports === proof.lifecycle.refundedStakeLamports
      && proof.transactions.staleRefund.signature === "53CJo5rqySudR88vbK73CBwa6UoWXQrNwDTw2eKtjZAiFrNZYCfFsbxSAETsmB71E2wd92vZSwbVk5Sut4GPGUqB",
    positionOwnership: proof.lifecycle.positionOwner === proof.lifecycle.traderWallet
      && proof.lifecycle.traderWallet === EXPECTED.trader
      && proof.lifecycle.positionStatus === "CLAIMED"
      && proof.lifecycle.acceptedStakeLamports === proof.market.acceptedCollateralLamports,
    thresholdResolution: proof.authorities.threshold === 2
      && proof.authorities.authorityCount === 3
      && proof.authorities.approvalMask === "011"
      && approvals >= proof.authorities.threshold
      && proof.authorities.proposalExecuted
      && proof.txline.directCpiSuccess
      && proof.txline.cpiInstruction === "ValidateStatV2"
      && proof.txline.derivedOutcome === expectedOutcome,
    payout: proof.lifecycle.claimedPayoutLamports === 10_000_000
      && proof.lifecycle.claimedPayoutLamports === proof.vault.totalPaidLamports
      && proof.lifecycle.claimedPayoutLamports === proof.lifecycle.acceptedStakeLamports,
    vaultConservation: proof.vault.totalDepositedLamports
      === proof.vault.totalRefundedLamports + proof.vault.totalPaidLamports + proof.vault.totalClaimableLamports + proof.vault.roundingDustLamports
      && proof.vault.totalDepositedLamports === 20_000_000
      && proof.vault.totalClaimableLamports === 0
      && proof.vault.roundingDustLamports === 0
      && proof.vault.rentReserveLamports === 1_510_320,
    claimTransaction: proof.transactions.claim.signature === EXPECTED.claimTransaction
      && proof.transactions.claim.explorerUrl.endsWith(`${EXPECTED.claimTransaction}?cluster=devnet`),
  };

  const labels: Record<keyof typeof checks, string> = {
    captureHash: "TxLINE capture hash — canonical JSON domain",
    borshPayloadHash: "TxLINE CPI payload hash — Borsh domain",
    fixtureAndSequence: "TxLINE fixture, sequence, stat keys, and scores",
    marketConfiguration: "Market configuration",
    protectionVerdict: "Stale-order refund",
    positionOwnership: "Position ownership",
    thresholdResolution: "Direct CPI and threshold resolution",
    payout: "Payout",
    vaultConservation: "Vault conservation",
    claimTransaction: "Claim transaction",
  };
  for (const [key, valid] of Object.entries(checks) as Array<[keyof typeof checks, boolean]>) {
    if (!valid) issues.push(`${labels[key]} failed verification.`);
  }
  return { valid: issues.length === 0, issues, checks, recomputedCaptureHash, recomputedBorshPayloadHash };
}

export function cloneV2Lifecycle(): V2LifecycleProof {
  return structuredClone(canonicalV2Lifecycle);
}
