import { createReceipt, encodeReceiptForUrl } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";
import { DEMO_EVENT_HASHES } from "@/lib/proof/onchainReceipt";

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

function txUrl(signature: string): string {
  return `${EXPLORER_BASE}/tx/${signature}?cluster=${CLUSTER}`;
}

function addressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}?cluster=${CLUSTER}`;
}

function timeline(signatures: string[], slots: number[], times: string[]): ProofTx[] {
  return ["Initialize market", "Ingest material event", "Place order into escrow", "Evaluate order"].map((label, index) => ({
    label,
    signature: signatures[index],
    explorerUrl: txUrl(signatures[index]),
    slot: slots[index],
    blockTime: times[index],
  }));
}

const programId = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
const vaultPda = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";
const sourceEventHash = DEMO_EVENT_HASHES.normalizedEventHash;

// Canonical post-ProtocolVault/event-hash proof recorded 10 July 2026.
const yesSignatures = [
  "5cMHjD3JkzkJgfStJhrQtoMLozcgNrV7jcnDKnLtcqEQSivwU8T24evuNNsEM2FRWpNFW27zFTwWumF3YaWpgLif",
  "5dfrQNRyxvLN8YyFEcGWVxPfZT4bebRuc1cnNjyi6EFjVvoQjmjnM5Cdkd3Xj4B4eb5EFUB427W9AT1v44odWeY8",
  "WBWBHmktP5HzL3YNtAJ5Zt3J8xPVWV6kRA1XRmde2vSfxksPHJDwtewX5rAFvrBF1573s5FsWR7vaLNDiW8H3Bs",
  "2tR13kJbCS4K75f2UFiLEExgsDdoRo26B8Q7tZGhEhWwiAtDJkaQcGerJiQ3GEzqdxKvs8NWc4Rkqe6oXHuCNcH2",
];
const yesSlots = [475253603, 475253606, 475253611, 475253614];
const yesTimes = ["2026-07-10T08:49:58.000Z", "2026-07-10T08:49:59.000Z", "2026-07-10T08:50:01.000Z", "2026-07-10T08:50:02.000Z"];

const noSignatures = [
  "648msqkbBW9F18xKWcTxvaBN9r1eTU7yBVip3zhfvXndNui4Bec7rBookL1AtdgNXbpofoWi2JCkugrpMPPwRPRc",
  "4YN6XVNmGkvjLvrGGw3VdQmULL5CxC5KMfjFb4MsCh17PtFTDxGUuS2NzPvKTdDsVQquL31xaaNs6FrLMDinqXyq",
  "3jodiyLyHLgQ2ABUoSnzXwxTx3rmVAQTk6aRiD9mjX6fYV2Paov2t19WKPehRthi7ue4ty9CMQwPnFemec4E89uM",
  "5m7rcQYWn55s1qDJqLcwEG3Y6aYMDSqMSukX9N5E9muX75LB3wABMgPstwbD4i2zChV3mWK5aohcy7zGKFhpBx6g",
];
const noSlots = [475253648, 475253652, 475253655, 475253657];
const noTimes = ["2026-07-10T08:50:15.000Z", "2026-07-10T08:50:17.000Z", "2026-07-10T08:50:18.000Z", "2026-07-10T08:50:19.000Z"];

const yesProof: OnChainProof = {
  cluster: "devnet",
  programId,
  marketPda: "HvfPZpLz5Sym6LSKQtKoATJ8VaAv9KmbjdLEjHuAzt8C",
  orderEscrowPda: "FGHuTa2YtoBDkQY31V5iCQQiyNcLhJfsbQFJcRxPRXhB",
  txSignatures: yesSignatures,
  explorerUrls: yesSignatures.map(txUrl),
  materialSeq: 2,
  pricedAtSeq: 1,
  observedPriceMicros: 400_000,
  fairSidePriceMicros: 630_000,
  toleranceMicros: 20_000,
  edgeMicros: 230_000,
  verdictCode: 2,
  statusCode: 4,
  sourceEventHash,
  settlementDestination: "REFUNDED_TO_TRADER",
  vaultPda,
};

const noProof: OnChainProof = {
  cluster: "devnet",
  programId,
  marketPda: "6JWmWT8Nf5Z3hRKspaAZY7oG9y195E6NhPCFDk6uqQ3K",
  orderEscrowPda: "D8ac76DsU7gusDRcGnD9eFsttLteFgc89nWHKTHe6vzu",
  txSignatures: noSignatures,
  explorerUrls: noSignatures.map(txUrl),
  materialSeq: 2,
  pricedAtSeq: 1,
  observedPriceMicros: 600_000,
  fairSidePriceMicros: 370_000,
  toleranceMicros: 20_000,
  edgeMicros: -230_000,
  verdictCode: 1,
  statusCode: 3,
  sourceEventHash,
  settlementDestination: "FINALIZED_TO_VAULT",
  vaultPda,
};

const verifierReceipt: LineGuardReceipt = createReceipt({
  marketId: "eng-win",
  marketTitle: "England wins",
  fixtureId: "ENG-FRA-2026-QF",
  orderId: "canonical-devnet-yes-20260710",
  actor: "bot",
  side: "YES",
  stake: 0.02,
  stakeUnit: "SOL",
  observedPrice: 0.4,
  fairSidePrice: 0.63,
  fairYes: 0.63,
  materialSeq: 2,
  pricedAtSeq: 1,
  staleness: 1,
  edge: 0.23,
  tolerance: 0.02,
  verdict: "VOIDED_REFUNDED",
  reason: "A guided TxLINE scenario advanced materialSeq while the quote remained at pricedAtSeq 1. The +23¢ YES edge was refunded by the devnet program.",
  txlineEventSeq: 2,
  txlineEventType: "GOAL",
  txlineTimestamp: 1_783_615_318_241,
  sourceMode: "guided",
  sourceEndpoint: "FairX guided scenario generator",
  rawEventHash: DEMO_EVENT_HASHES.rawEventHash,
  normalizedEventHash: sourceEventHash,
  settlementDestination: "REFUNDED_TO_TRADER",
  proofStatus: "onchain_verified",
  createdAt: Date.parse("2026-07-10T08:50:02.000Z"),
  onChain: yesProof,
});

export const proofData = {
  program: {
    id: programId,
    deployer: "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq",
    programData: "D6buB3VxXnxX3jXjPX5HCqRAMJqtV4yLzaKuMra17nPT",
    deploymentTx: "3z7S9vVxh1CDWw3b3qYap1m7CSxXuciMdDSXujzxLEudP1YP6YyTx4NhKNrH2xfTYUJngENE3y5tR5sKFg92fw49",
    deployedSlot: 475252011,
    deployedAt: "2026-07-10T08:39:55.000Z",
    initialDeploymentTx: "2WWNS16VPEhVPRpVdvURuCh6gvXz6KzMe5QL449fXcrg87dvs1zndc7LAUvXRZSMATMTqPVb1Bqf1XxtAEapZbks",
    explorerUrl: addressUrl(programId),
    deploymentTxUrl: txUrl("3z7S9vVxh1CDWw3b3qYap1m7CSxXuciMdDSXujzxLEudP1YP6YyTx4NhKNrH2xfTYUJngENE3y5tR5sKFg92fw49"),
  },
  vault: {
    pda: vaultPda,
    explorerUrl: addressUrl(vaultPda),
    balanceLamports: 21_287_600,
    totalFinalizedLamports: 20_000_000,
    fillCount: 1,
    lastFinalizationTx: noSignatures[3],
    lastFinalizationUrl: txUrl(noSignatures[3]),
  },
  cases: [
    {
      id: "yes",
      title: "YES stale attack refunded",
      claim: "A +23¢ stale YES order was escrowed and refunded to the trader by LineGuard.",
      tone: "red",
      marketPda: yesProof.marketPda,
      orderPda: yesProof.orderEscrowPda,
      edgeMicros: yesProof.edgeMicros,
      verdict: "VOIDED_REFUNDED",
      status: "VoidedRefunded",
      refunded: true,
      settlementDestination: "REFUNDED_TO_TRADER",
      sourceEventHash,
      recordedAt: yesTimes[3],
      txs: timeline(yesSignatures, yesSlots, yesTimes),
      explanation: "The guided event was committed on-chain, materialSeq advanced to 2 while pricedAtSeq stayed 1, and YES carried +23¢ of stale edge. The escrowed stake returned to the trader.",
      proof: yesProof,
    },
    {
      id: "no",
      title: "NO safe trade finalized",
      claim: "A −23¢ stale NO order was allowed and finalized to ProtocolVault by the same guard.",
      tone: "blue",
      marketPda: noProof.marketPda,
      orderPda: noProof.orderEscrowPda,
      edgeMicros: noProof.edgeMicros,
      verdict: "STALE_ALLOWED_NO_EDGE",
      status: "Filled",
      refunded: false,
      settlementDestination: "FINALIZED_TO_VAULT",
      sourceEventHash,
      recordedAt: noTimes[3],
      txs: timeline(noSignatures, noSlots, noTimes),
      explanation: "The market was equally stale, but NO had negative edge and did not exploit the lag. LineGuard allowed the order and finalized its stake to ProtocolVault.",
      proof: noProof,
    },
  ] satisfies SettlementProofCase[],
  receipt: {
    claim: "The canonical receipt seals the event hash, guard inputs, verdict, destination, and devnet transaction sequence.",
    includesTxSignatures: true,
    verifierTxCount: 4,
    tamperTest: "Change any sealed hash or verdict → verification fails",
    status: "INTEGRITY VERIFIED",
    verifierHref: `/verify/${verifierReceipt.receiptId}?r=${encodeReceiptForUrl(verifierReceipt)}`,
    receipt: verifierReceipt,
  },
  limitations: "Canonical proof currently covers deployed event-hash, escrow, refund, and ProtocolVault behavior. MarketConfig commitments are locally implemented but require the pending devnet program upgrade before they can be claimed as current on-chain evidence.",
} as const;
