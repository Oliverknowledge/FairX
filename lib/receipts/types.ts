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
  /** Where the stake ended up. REFUNDED_TO_TRADER is enforced on-chain; FINALIZED_TO_VAULT is a documented next step. */
  settlementDestination?: SettlementDestination;
  proofStatus: string;
  createdAt: number;
  onChain?: OnChainProof;
  /** sha256 over the canonical JSON of every field above (receiptHash excluded). */
  receiptHash: string;
}

/**
 * Honest settlement-destination classification.
 * - REFUNDED_TO_TRADER: the on-chain program actually returns the escrowed stake to the trader.
 * - FINALIZED_TO_VAULT: intended protocol-vault destination for allowed/filled orders (not yet on-chain).
 * - RETAINED_IN_ESCROW: current on-chain behaviour for filled orders — lamports stay in the order PDA.
 */
export type SettlementDestination = "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT" | "RETAINED_IN_ESCROW";

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
  /** On-chain settlement destination: refund to trader, or finalize into the ProtocolVault. */
  settlementDestination?: import("@/lib/receipts/types").SettlementDestination;
  /** ProtocolVault PDA that received a finalized (filled) stake. */
  vaultPda?: string;
}
