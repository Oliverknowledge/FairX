import { V4_PROGRAM_ID } from "@/lib/v4/program";

/**
 * Versioned schema for the FairX Vault V4 on-chain lifecycle evidence.
 *
 * Before the program is deployed and the lifecycle is recorded, the fixture is in
 * `not_recorded` state and contains NO transaction signatures, PDAs, balances, or
 * explorer links. The recorder ([scripts/fairx-v4-record-lifecycle.ts]) only ever writes
 * the `recorded` state from real, finalized devnet transactions. The verifier
 * ([lib/proof/v4LifecycleVerifier.ts]) recomputes every check from RPC.
 */

export const V4_LIFECYCLE_EVIDENCE_VERSION = 1 as const;

/** Canonical lifecycle constants — the single source of truth shared by recorder and verifier. */
export const V4_CANONICAL = {
  marketIdSeed: "fairx-v4-france-morocco",
  fixtureId: 18209181,
  stakeLamports: 10_000_000,
  operatorDepositLamports: 200_000_000,
  minStakeLamports: 1_000_000,
  maxStakeLamports: 100_000_000,
  spreadMicros: 10_000,
  preGoal: { quoteSequence: 1, materialEventSequence: 738, yesPriceMicros: 532_785, noPriceMicros: 487_215 },
  postGoal: { quoteSequence: 2, materialEventSequence: 739, yesPriceMicros: 874_793 },
  goalSequence: 739,
  finalSequence: 1114,
  homeScore: 2,
  awayScore: 0,
  resolutionYes: 1,
  threshold: 2,
} as const;

/** Every step the recorder sends, in order. The verifier requires this exact set. */
export const V4_LIFECYCLE_STEPS = [
  "initializeMarket",
  "initializeVault",
  "depositLiquidity",
  "commitPreQuote",
  "verifyPreQuote",
  "acceptHonestYes",
  "acceptHonestNo",
  "ingestGoal",
  "refundStaleBot",
  "commitPostQuote",
  "verifyPostQuote",
  "closeStaleRefund",
  "acceptSynchronizedYes",
  "proveResolution",
  "approveResolution",
  "executeResolution",
  "reconcileLosingNo",
  "claimHonestYes",
  "claimSynchronizedYes",
  "reconcileVault",
  "closeHonestYes",
  "closeLosingNo",
  "closeSynchronizedYes",
  "withdrawFreeLiquidity",
] as const;

export type V4LifecycleStep = (typeof V4_LIFECYCLE_STEPS)[number];

export interface V4TxRecord {
  label: string;
  instruction: string;
  discriminatorHex: string;
  signature: string;
  slot: number;
  blockTime: number | null;
  explorerUrl: string;
  finalized: boolean;
}

export interface V4WalletDelta {
  role: string;
  address: string;
  balanceBeforeLamports: number;
  balanceAfterLamports: number;
  netAfterFundingLamports: number;
}

export interface V4SolvencySnapshot {
  label: string;
  freeCollateral: number;
  reservedLiability: number;
  acceptedStakePrincipal: number;
  pendingRefundableStake: number;
}

export interface V4PositionRecord {
  id: "pre-yes" | "pre-no" | "stale-bot" | "post-yes";
  pda: string;
  owner: string;
  side: "YES" | "NO";
  stakeLamports: number;
  executionPriceMicros: number;
  grossPayoutLamports: number;
  quoteSequence: number;
  materialEventSequence: number;
  status: "ACCEPTED" | "REFUNDED" | "CLAIMED" | "LOST" | "CLOSED";
  claimedLamports: number;
}

export interface V4RecordedEvidence {
  version: number;
  state: "recorded";
  recordedAt: string;
  cluster: "devnet";
  rpcUrl: string;
  program: {
    programId: string;
    programDataAddress: string;
    deploymentSlot: number;
    sbfSha256: string;
  };
  txline: {
    programId: string;
    oddsRootPda: string;
    scoresRootPda: string;
    fixtureId: number;
    goalSequence: number;
    finalSequence: number;
    homeScore: number;
    awayScore: number;
    preQuotePayloadHashHex: string;
    postQuotePayloadHashHex: string;
    resolutionPayloadHashHex: string;
  };
  accounts: {
    authorityConfig: string;
    market: string;
    vault: string;
    quoteReceiptPre: string;
    quoteReceiptPost: string;
    resolutionReceipt: string;
    resolutionProposal: string;
  };
  authorities: {
    operator: string;
    feed: string;
    pricing: string;
    resolution: [string, string, string];
    threshold: number;
    approvalsMask: number;
  };
  marketState: {
    resolved: boolean;
    resolution: number;
    tradingClosed: boolean;
    finalSequence: number;
  };
  positions: V4PositionRecord[];
  staleOrder: {
    positionId: "stale-bot";
    verdict: "REFUNDED";
    refundedStakeLamports: number;
    walletNetLamports: number;
  };
  vault: {
    finalFreeCollateral: number;
    finalReservedLiability: number;
    finalAcceptedStakePrincipal: number;
    finalPendingRefundableStake: number;
    lifetimeOperatorDeposits: number;
    lifetimeUserStakes: number;
    lifetimeRefunds: number;
    lifetimePayouts: number;
    lifetimeLosingStakes: number;
    lifetimeOperatorWithdrawals: number;
  };
  solvencySnapshots: V4SolvencySnapshot[];
  wallets: V4WalletDelta[];
  transactions: V4TxRecord[];
  closures: Record<string, boolean>;
}

export interface V4NotRecordedEvidence {
  version: number;
  state: "not_recorded";
  note: string;
  programId: string;
  cluster: "devnet";
}

export type V4LifecycleEvidence = V4RecordedEvidence | V4NotRecordedEvidence;

export const V4_NOT_RECORDED: V4NotRecordedEvidence = {
  version: V4_LIFECYCLE_EVIDENCE_VERSION,
  state: "not_recorded",
  note: "No V4 lifecycle evidence record is available. No transaction signature, PDA, balance, or explorer link may be inferred from absence; run the guarded recorder only for a fresh approved deployment.",
  programId: V4_PROGRAM_ID,
  cluster: "devnet",
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

/**
 * Rejects placeholder/fake transaction signatures. A genuine ed25519 signature is 64 bytes
 * (≈87–88 base58 chars) and is never all-identical, all-zero, or a filler token. The recorder
 * must never emit these, and the verifier refuses any record that contains one.
 */
export function isPlaceholderSignature(signature: unknown): boolean {
  if (typeof signature !== "string") return true;
  const trimmed = signature.trim();
  if (trimmed.length === 0) return true;
  if (/^(0+|1+)$/.test(trimmed)) return true; // all-zero / all-one base58
  if (/^(placeholder|todo|pending|fake|test|xxx+|000+)/i.test(trimmed)) return true;
  if (new Set(trimmed).size <= 2) return true; // degenerate (e.g. all same char)
  if (!BASE58_RE.test(trimmed)) return true; // not a plausible base58 signature length/charset
  return false;
}

export function isRecorded(evidence: V4LifecycleEvidence | null | undefined): evidence is V4RecordedEvidence {
  return Boolean(evidence && typeof evidence === "object" && (evidence as V4LifecycleEvidence).state === "recorded");
}
