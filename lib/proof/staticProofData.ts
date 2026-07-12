import canonicalProofJson from "@/fixtures/lineguard/canonical-proof.json";
import settlementProofJson from "@/fixtures/lineguard/settlement-proof.json";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";

const CLUSTER = "devnet";
const EXPLORER_BASE = "https://explorer.solana.com";

export type ProofTone = "green" | "red" | "blue" | "amber" | "neutral";

export interface ProofTx {
  label: string;
  signature: string;
  explorerUrl: string;
  slot?: number;
  blockTime?: string;
}

export interface SettlementProofCase {
  id: "yes" | "no";
  title: string;
  claim: string;
  tone: ProofTone;
  marketPda: string;
  marketConfigPda: string;
  orderPda: string;
  edgeMicros: number;
  verdict: string;
  status: string;
  refunded: boolean;
  settlementDestination: "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT";
  sourceEventHash: string;
  recordedAt: string;
  txs: ProofTx[];
  explanation: string;
  proof: OnChainProof;
}

interface CanonicalFlow {
  proof: OnChainProof;
  transactions: Array<ProofTx & { finalized: true; error: null }>;
  receipt: LineGuardReceipt;
}

interface CanonicalProofRecord {
  programId: string;
  operator: string;
  sourceEventHash: string;
  protocolVaultPda: string;
  vaultBalanceBeforeLamports: number;
  vaultBalanceAfterLamports: number;
  vaultDeltaLamports: number;
  flows: { yes: CanonicalFlow; no: CanonicalFlow };
}

interface SettlementProofRecord {
  programId: string;
  operator: string;
  recordedAt: string;
  fixtureId: number;
  sequence: number;
  resolution: "YES_WON" | "NO_WON";
  resolutionEventHash: string;
  marketPda: string;
  marketConfigPda: string;
  vaultPda: string;
  yesOrderPda: string;
  noOrderPda: string;
  winnerOrderPda: string;
  winnerSide: "YES" | "NO";
  winnerStakeLamports: number;
  winnerPayoutLamports: number;
  yesPoolLamports: number;
  noPoolLamports: number;
  totalPoolLamports: number;
  winningPoolLamports: number;
  winnerOrderStatus: string;
  loserOrderStatus: string;
  vaultBalanceBeforeLamports: number;
  vaultBalanceAfterLamports: number;
  // Unified lifecycle: protection leg + TxLINE resolution binding + per-market accounting.
  protectionOrderPda: string;
  protectionVerdict: string;
  protectionRefunded: boolean;
  protectionEdgeMicros: number;
  validationRootPda: string;
  validationPayloadHash: string;
  eventStatRoot: string;
  homeScore: number;
  awayScore: number;
  derivedOutcome: number;
  marketTotalInLamports: number;
  marketTotalPaidLamports: number;
  marketTotalRefundedLamports: number;
  transactions: Array<ProofTx & { finalized: true; error: null }>;
}

const settlement = settlementProofJson as unknown as SettlementProofRecord;

const canonical = canonicalProofJson as unknown as CanonicalProofRecord;
const yesProof = canonical.flows.yes.proof;
const noProof = canonical.flows.no.proof;
const yesTxs = canonical.flows.yes.transactions;
const noTxs = canonical.flows.no.transactions;
const yesReceipt = canonical.flows.yes.receipt;
const noReceipt = canonical.flows.no.receipt;

function txUrl(signature: string): string {
  return `${EXPLORER_BASE}/tx/${signature}?cluster=${CLUSTER}`;
}

function addressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}?cluster=${CLUSTER}`;
}

// A separate historical custom-market proof remains available in the operator catalogue;
// it is not presented as TxLINE-backed canonical evidence.
const customProof: OnChainProof = {
  cluster: "devnet",
  programId: canonical.programId,
  marketPda: "9ztRvdQGRyJvobyTZbG764RbLUVpyySUUmKWDrd51QUN",
  marketConfigPda: "6UFwQgwfAu6JxT2FMsud4pvcVoEwNpAs6u5v1fPFRx42",
  orderEscrowPda: "6o2YmqZfqR1LpVMzLPszkbNhhsUFBBoFjCpyXR8SsDii",
  txSignatures: [
    "2s2PL1akg41Y5c8oaA1RjBx4q53wrGaxyy4Btodg7RpVcMVYGDpQJuG8omoNkReG3CrsjE61U3D6m6jrHpZWCqgr",
    "58gHVmRRmfJA41Q8kKQAhNXuLGfcqubV8mDbwx1MzruKLxHJx9dGd8tEYAEPhN5DEAtEUfH56sfze3TNZEXoZVrb",
    "3tLQpGr2Uvgz2vbV39XGKst5FQa87k4qJsS6Vs3bkvcVrX9qiRZrZiUhHSmEsUrQnAiKZSnhVZGESv7DQYaskxRW",
    "3TD5aXEpQoSq28B7QFJzqGBZWqj7MtuguYPGV6M4CUe9xeFFtkeDqP1GLP4HtzuM2xvcCL2fVJALZNCv8KC5TYVa",
  ],
  explorerUrls: [],
  materialSeq: 2,
  pricedAtSeq: 1,
  observedPriceMicros: 400_000,
  fairSidePriceMicros: 630_000,
  toleranceMicros: 20_000,
  edgeMicros: 230_000,
  verdictCode: 2,
  statusCode: 4,
  sourceEventHash: "41b3a964625cc7d2639946db52abaacf62ee160f0ceb4492b6540146c8182fd8",
  orderSourceEventHash: "41b3a964625cc7d2639946db52abaacf62ee160f0ceb4492b6540146c8182fd8",
  orderMaterialityConfigHash: "7417f9153a1674529ae6fd097b5ac731f9c294eb3450a7e0b25a552493a5cbdf",
  marketType: "MATCH_WINNER",
  fixtureIdHash: "1735b232d3a8606ef8592feaf40398f289f145874fd3e3c771afb46b69f8767b",
  marketTitleHash: "9785ccfae9ab54e88b6129ec3d5f4fcf7cdebf882c9b4112666f7cc49b2c3afa",
  materialityConfigHash: "7417f9153a1674529ae6fd097b5ac731f9c294eb3450a7e0b25a552493a5cbdf",
  settlementConfigHash: "2940b347bc69a7676eb97565be78a27718185d6c505bf65d35b980f567a856f5",
  oracleAuthority: canonical.operator,
  settlementDestination: "REFUNDED_TO_TRADER",
  vaultPda: canonical.protocolVaultPda,
};
customProof.explorerUrls = customProof.txSignatures.map(txUrl);

const cases: SettlementProofCase[] = [
  {
    id: "yes",
    title: "YES stale attack refunded",
    claim: "A +34.231¢ stale YES order was escrowed and refunded to the trader by LineGuard.",
    tone: "red",
    marketPda: yesProof.marketPda,
    marketConfigPda: yesProof.marketConfigPda!,
    orderPda: yesProof.orderEscrowPda,
    edgeMicros: yesProof.edgeMicros,
    verdict: "VOIDED_REFUNDED",
    status: "VoidedRefunded",
    refunded: true,
    settlementDestination: "REFUNDED_TO_TRADER",
    sourceEventHash: canonical.sourceEventHash,
    recordedAt: yesTxs.at(-1)!.blockTime!,
    txs: yesTxs,
    explanation: "Genuine TxLINE score sequence 739 and its normalized hash were committed on-chain while the quote remained at sequence 738. The +34.231¢ YES edge exceeded tolerance, so the escrowed 0.02 SOL stake returned to the trader.",
    proof: yesProof,
  },
  {
    id: "no",
    title: "NO safe trade finalized",
    claim: "A −34.231¢ stale NO order was allowed and exactly 0.02 SOL finalized to ProtocolVault.",
    tone: "blue",
    marketPda: noProof.marketPda,
    marketConfigPda: noProof.marketConfigPda!,
    orderPda: noProof.orderEscrowPda,
    edgeMicros: noProof.edgeMicros,
    verdict: "STALE_ALLOWED_NO_EDGE",
    status: "Filled",
    refunded: false,
    settlementDestination: "FINALIZED_TO_VAULT",
    sourceEventHash: canonical.sourceEventHash,
    recordedAt: noTxs.at(-1)!.blockTime!,
    txs: noTxs,
    explanation: "The same genuine TxLINE event made NO negative-edge rather than exploitative. LineGuard allowed the order and moved exactly 20,000,000 lamports from escrow into ProtocolVault.",
    proof: noProof,
  },
];

export const proofData = {
  txline: {
    network: "devnet",
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    programExplorerUrl: addressUrl("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    subscriptionTx: "3gCxJZXZxapQhN9giuVeByJxen8yAqVE69pYLhYgL3vNq3hHBibtj5CJJgTqJdkoeQAyiUtcEHfP48Woj2dsDmm",
    subscriptionTxUrl: txUrl("3gCxJZXZxapQhN9giuVeByJxen8yAqVE69pYLhYgL3vNq3hHBibtj5CJJgTqJdkoeQAyiUtcEHfP48Woj2dsDmm"),
    subscriptionLabel: "World Cup & International Friendlies · free tier",
    subscriptionExpiresAt: "2026-08-07T14:27:11.000Z",
    fixtureId: "18209181",
    sequence: 739,
    rootPda: "EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr",
    rootExplorerUrl: addressUrl("EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr"),
    validationMethod: "validateStatV2",
    validationPassed: true,
  },
  program: {
    id: canonical.programId,
    deployer: canonical.operator,
    programData: "D6buB3VxXnxX3jXjPX5HCqRAMJqtV4yLzaKuMra17nPT",
    schemaLabel: "settlement-v4",
    deploymentTx: "3UE7ipWmwJypE6TZNdpZDT9X3Jq2CaKgNHS2unWWK5LVUu96zvpm16yKsotsyJYCBrMwrDX82f7HSQDsB3h2Rcu4",
    deployedSlot: 475793035,
    deployedAt: "2026-07-12T17:32:29.000Z",
    programDataLength: 316_672,
    previousUpgradeTx: "RjdKrMf4s1pdeXJkbjp2rpkMmUDGUBnbYxQjfsEkFeGZfwqtULQ8RSEQTJyUiogxGUgb3pgcd5UGZV7UAsLwBgh",
    initialDeploymentTx: "2WWNS16VPEhVPRpVdvURuCh6gvXz6KzMe5QL449fXcrg87dvs1zndc7LAUvXRZSMATMTqPVb1Bqf1XxtAEapZbks",
    explorerUrl: addressUrl(canonical.programId),
    deploymentTxUrl: txUrl("3UE7ipWmwJypE6TZNdpZDT9X3Jq2CaKgNHS2unWWK5LVUu96zvpm16yKsotsyJYCBrMwrDX82f7HSQDsB3h2Rcu4"),
  },
  vault: {
    pda: canonical.protocolVaultPda,
    explorerUrl: addressUrl(canonical.protocolVaultPda),
    balanceBeforeLamports: canonical.vaultBalanceBeforeLamports,
    balanceLamports: canonical.vaultBalanceAfterLamports,
    deltaLamports: canonical.vaultDeltaLamports,
    totalFinalizedLamports: 60_000_000,
    fillCount: 3,
    lastFinalizationTx: noTxs.at(-1)!.signature,
    lastFinalizationUrl: noTxs.at(-1)!.explorerUrl,
  },
  cases,
  settlement: {
    title: "Unified lifecycle — LineGuard protection, then TxLINE-backed settlement",
    claim: "On one market: a stale exploit is refunded, the market reprices, valid orders fill both pools, the outcome is derived from a genuine on-chain-bound TxLINE result, and the winner is paid parimutuel from the ProtocolVault — the operator never chooses the outcome.",
    resolution: settlement.resolution,
    resolutionEventHash: settlement.resolutionEventHash,
    fixtureId: settlement.fixtureId,
    sequence: settlement.sequence,
    marketPda: settlement.marketPda,
    marketConfigPda: settlement.marketConfigPda,
    vaultPda: settlement.vaultPda,
    vaultExplorerUrl: addressUrl(settlement.vaultPda),
    winnerSide: settlement.winnerSide,
    winnerOrderPda: settlement.winnerOrderPda,
    winnerOrderExplorerUrl: addressUrl(settlement.winnerOrderPda),
    loserOrderPda: settlement.winnerSide === "YES" ? settlement.noOrderPda : settlement.yesOrderPda,
    winnerStakeLamports: settlement.winnerStakeLamports,
    winnerPayoutLamports: settlement.winnerPayoutLamports,
    yesPoolLamports: settlement.yesPoolLamports,
    noPoolLamports: settlement.noPoolLamports,
    totalPoolLamports: settlement.totalPoolLamports,
    winningPoolLamports: settlement.winningPoolLamports,
    winnerOrderStatus: settlement.winnerOrderStatus,
    loserOrderStatus: settlement.loserOrderStatus,
    payoutMultiple: settlement.winnerStakeLamports > 0 ? settlement.winnerPayoutLamports / settlement.winnerStakeLamports : 0,
    recordedAt: settlement.recordedAt,
    // Protection leg (same market).
    protectionOrderPda: settlement.protectionOrderPda,
    protectionOrderExplorerUrl: addressUrl(settlement.protectionOrderPda),
    protectionVerdict: settlement.protectionVerdict,
    protectionRefunded: settlement.protectionRefunded,
    protectionEdgeMicros: settlement.protectionEdgeMicros,
    // TxLINE resolution binding.
    validationRootPda: settlement.validationRootPda,
    validationRootExplorerUrl: addressUrl(settlement.validationRootPda),
    validationPayloadHash: settlement.validationPayloadHash,
    homeScore: settlement.homeScore,
    awayScore: settlement.awayScore,
    derivedOutcome: settlement.derivedOutcome,
    // Per-market accounting.
    marketTotalInLamports: settlement.marketTotalInLamports,
    marketTotalPaidLamports: settlement.marketTotalPaidLamports,
    marketTotalRefundedLamports: settlement.marketTotalRefundedLamports,
    protectionTx: settlement.transactions[3],
    validationTx: settlement.transactions[10],
    resolveTx: settlement.transactions[11],
    settleTx: settlement.transactions[12],
    txs: settlement.transactions,
  },
  custom: {
    title: "Custom guided market settled on devnet",
    marketPda: customProof.marketPda,
    marketConfigPda: customProof.marketConfigPda!,
    orderPda: customProof.orderEscrowPda,
    verdict: "VOIDED_REFUNDED",
    settlementDestination: "REFUNDED_TO_TRADER" as const,
    sourceEventHash: customProof.sourceEventHash!,
    txs: customProof.txSignatures.map((signature, index) => ({
      label: ["Initialize market + config", "Ingest guided event", "Place order into escrow", "Evaluate order"][index],
      signature,
      explorerUrl: txUrl(signature),
    })),
    proof: customProof,
  },
  receipt: {
    claim: "The canonical receipt seals the genuine TxLINE payload and normalized hashes, validation metadata, committed market config, verdict, destination, and four finalized devnet signatures.",
    includesTxSignatures: true,
    verifierTxCount: 4,
    tamperTest: "Change any TxLINE field, sealed hash, verdict, fixture, sequence, or endpoint → verification fails",
    status: "TXLINE + ON-CHAIN INTEGRITY VERIFIED",
    verifierHref: `/verify/${yesReceipt.receiptId}`,
    noVerifierHref: `/verify/${noReceipt.receiptId}`,
    receipt: yesReceipt,
    noReceipt,
  },
  limitations: "Canonical proof uses genuine historical TxLINE data and separate validateStatV2 simulation against the TxLINE devnet program. Direct TxLINE CPI is not implemented; production oracle decentralization, counterparty matching, mainnet operation, and an external audit remain future work.",
} as const;
