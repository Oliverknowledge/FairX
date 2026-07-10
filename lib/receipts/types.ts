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
  /** sha256 of the raw source payload that opened the stale window (receipt-level event binding). */
  rawEventHash?: string;
  /** sha256 of the normalized event's provenance fields (receipt-level event binding). */
  normalizedEventHash?: string;
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
