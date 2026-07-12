/**
 * LineGuard receipt — a portable, hash-sealed record of why a verdict was
 * reached. Anyone can recompute the hash from the fields and prove the
 * receipt wasn't altered after the fact.
 */

export interface LineGuardReceipt {
  receiptId: string;
  marketId: string;
  marketTitle: string;
  fixtureId: string;
  orderId: string;
  actor: "bot" | "user";
  side: string;
  stake: number;
  /** Display unit only. On-chain receipts use devnet SOL; local previews use sandbox units. */
  stakeUnit?: "SOL" | "SANDBOX";
  observedPrice: number;
  fairSidePrice: number;
  fairYes: number;
  materialSeq: number;
  pricedAtSeq: number;
  staleness: number;
  edge: number;
  tolerance: number;
  verdict: string;
  reason: string;
  txlineEventSeq?: number;
  txlineEventType?: string;
  txlineTimestamp?: number;
  /** Explicit provenance so the verifier never infers "live" from proof status. */
  sourceMode?: "live" | "captured" | "historical" | "guided";
  sourceEndpoint?: string;
  /** sha256 of the raw source payload that opened the stale window (receipt-level event binding). */
  rawEventHash?: string;
  /** sha256 of the normalized event's provenance fields (receipt-level event binding). */
  normalizedEventHash?: string;
  /** Self-contained TxLINE evidence required to recompute both provenance hashes. */
  txlineProof?: TxlineProof;
  /** Where the stake ended up. Refund and vault finalization are both enforced by the on-chain guard. */
  settlementDestination?: SettlementDestination;
  proofStatus: string;
  createdAt: number;
  onChain?: OnChainProof;
  /** On-chain commitment to the market definition and fairness rules. */
  marketConfigProof?: MarketConfigProof;
  /** sha256 over the canonical JSON of every field above (receiptHash excluded). */
  receiptHash: string;
}

/**
 * Honest settlement-destination classification.
 * - REFUNDED_TO_TRADER: the on-chain program actually returns the escrowed stake to the trader.
 * - FINALIZED_TO_VAULT: the on-chain program moved an allowed/filled stake into ProtocolVault.
 * - RETAINED_IN_ESCROW: retained for parsing older receipt formats only.
 */
export type SettlementDestination = "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT" | "RETAINED_IN_ESCROW";

export interface MarketConfigProof {
  marketType: string;
  fixtureIdHash: string;
  marketTitleHash: string;
  materialityConfigHash: string;
  settlementConfigHash: string;
  onChainMarketPda: string;
}

export interface ReceiptVerification {
  valid: boolean;
  expectedHash: string;
  recomputedHash: string;
  checkedAt: number;
  receiptSealVerified: boolean;
  payloadIntegrityVerified: boolean | null;
  normalizedEventVerified: boolean | null;
  onChainSourceEventHashMatches: boolean | null;
  fixtureCommitmentMatches: boolean | null;
  errors: string[];
}

export interface TxlineProof {
  source: "txline";
  network: "devnet" | "mainnet";
  mode: "live" | "historical" | "captured";
  endpoint: string;
  fixtureId: string;
  seq?: number;
  receivedAt?: string;
  rawPayloadHash: string;
  normalizedEventHash: string;
  normalizerVersion: string;
  rawPayload: unknown;
  normalizedEvent: import("@/lib/txline/captureFormat").CapturedNormalizedEvent;
  validation?: {
    method: "validateStatV2";
    endpoint: "/api/scores/stat-validation";
    statKeys: number[];
    dailyScoresRootPda: string;
    validationPayloadHash: string;
    passed: boolean;
  };
}

export interface OnChainProof {
  cluster: "devnet" | "localnet";
  programId: string;
  marketPda: string;
  marketConfigPda?: string;
  orderEscrowPda: string;
  txSignatures: string[];
  explorerUrls: string[];
  materialSeq: number;
  pricedAtSeq: number;
  observedPriceMicros: number;
  fairSidePriceMicros: number;
  toleranceMicros: number;
  edgeMicros: number;
  verdictCode: number;
  statusCode: number;
  /** sha256 (hex) of the normalized source event, as bound into on-chain market state. */
  sourceEventHash?: string;
  /** Event hash snapshotted into OrderEscrow when the verdict was evaluated. */
  orderSourceEventHash?: string;
  /** Materiality commitment snapshotted into OrderEscrow at evaluation. */
  orderMaterialityConfigHash?: string;
  marketType?: string;
  fixtureIdHash?: string;
  marketTitleHash?: string;
  materialityConfigHash?: string;
  settlementConfigHash?: string;
  oracleAuthority?: string;
  /** On-chain settlement destination: refund to trader, or finalize into the ProtocolVault. */
  settlementDestination?: import("@/lib/receipts/types").SettlementDestination;
  /** ProtocolVault PDA that received a finalized (filled) stake. */
  vaultPda?: string;
}

/**
 * Evidence for a complete on-chain market resolution + parimutuel payout: both sides fill
 * into their pools, the authority commits the resolved outcome, and the winning side claims
 * its parimutuel share (stake * total_pool / winning_pool) from the ProtocolVault.
 */
export interface OnChainSettlementProof {
  cluster: "devnet" | "localnet";
  programId: string;
  marketPda: string;
  marketConfigPda: string;
  vaultPda: string;
  resolution: "YES_WON" | "NO_WON";
  /** sha256 (hex) of the normalized final-result event committed on-chain at resolution. */
  resolutionEventHash: string;
  yesPoolLamports: number;
  noPoolLamports: number;
  totalPoolLamports: number;
  winningPoolLamports: number;
  yesOrderPda: string;
  noOrderPda: string;
  winnerOrderPda: string;
  winnerSide: "YES" | "NO";
  winnerStakeLamports: number;
  winnerPayoutLamports: number;
  /** OrderEscrow status after settlement: winner "Settled", loser still "Filled" (forfeited). */
  winnerOrderStatus: string;
  loserOrderStatus: string;
  vaultBalanceBeforeLamports: number;
  vaultBalanceAfterLamports: number;
  txSignatures: string[];
  explorerUrls: string[];
  // Unified lifecycle: the same market first refuses a stale exploit, then settles.
  protectionOrderPda?: string;
  protectionVerdict?: string;
  protectionRefunded?: boolean;
  protectionEdgeMicros?: number;
  protectionEventHash?: string;
  // TxLINE resolution binding: the outcome is derived from the proven score, not chosen.
  fixtureId?: number;
  sequence?: number;
  validationRootPda?: string;
  validationPayloadHash?: string;
  eventStatRoot?: string;
  homeScore?: number;
  awayScore?: number;
  derivedOutcome?: number;
  // Per-market accounting (solvency invariant: totalIn == paid + refunded + remaining).
  marketTotalInLamports?: number;
  marketTotalPaidLamports?: number;
  marketTotalRefundedLamports?: number;
}
