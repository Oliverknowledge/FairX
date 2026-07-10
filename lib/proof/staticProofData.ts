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

function txUrl(signature: string): string {
  return `${EXPLORER_BASE}/tx/${signature}?cluster=${CLUSTER}`;
}

function addressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}?cluster=${CLUSTER}`;
}

function timeline(signatures: string[], slots: number[], times: string[]): ProofTx[] {
  return ["Initialize market + config", "Ingest material event", "Place order into escrow", "Evaluate order"].map((label, index) => ({
    label,
    signature: signatures[index],
    explorerUrl: txUrl(signatures[index]),
    slot: slots[index],
    blockTime: times[index],
  }));
}

const programId = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
const vaultPda = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";
const authority = "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq";
const sourceEventHash = DEMO_EVENT_HASHES.normalizedEventHash;

// Committed config hashes for the canonical England-wins market (MarketConfig v2).
const canonicalConfig = {
  marketType: "MATCH_WINNER",
  fixtureIdHash: "49992ce39fd86852448e5d7242c9e8cfdddf37622049ced7a6a7aef628ce9cde",
  marketTitleHash: "0b7f4d269721ee50211b6f35fd73c9efe1eb1fe8e051b121e330c02ecb69eeb0",
  materialityConfigHash: "17a3b2ecca8d42b0a822a1333d536a6a4d7aca41f478910b219a3f198d5f9c90",
  settlementConfigHash: "2940b347bc69a7676eb97565be78a27718185d6c505bf65d35b980f567a856f5",
} as const;

// Canonical market-config-v2 proof recorded 10 July 2026, after the MarketConfig program upgrade.
const yesSignatures = [
  "3nxY1V79aKPGYhtJLELxpeFsFbRMkGQMxzg88aXDsL5KkHn1ueSSYp3xCArNTANRo7MoU5opwpp7yW84fqapLV3Y",
  "2Kp3EMcqS4C85tuKj6iGrE6ULf1mePMRFBYNvPd5ftaPvBEfo5DaA4LDVC9AEwgCgd6XF13BM8k9kBkeAtcpY6Lb",
  "RqtzoQHLWoCkVLDmzN2nNsSCSzMpVmFyPxsi5FYSWdvFDb5VhNUQjkErYMBfWNfNiS7bw2GustZKSPakAgN2UGz",
  "GF7bGuCDeaWU6iKnu2daxDvCot4T5tkWnpkNJVWw5t5TFUr1vfSDcWGR8Qwm1fHoE9kwrv8NqQ33ejBf3E47AXr",
];
const yesSlots = [475298284, 475298287, 475298289, 475298292];
const yesTimes = ["2026-07-10T13:32:18.000Z", "2026-07-10T13:32:20.000Z", "2026-07-10T13:32:20.000Z", "2026-07-10T13:32:21.000Z"];

const noSignatures = [
  "3yA8oZe8zbZRySQMs7nFTskTfUxUrUymk9p4WgsosoMwReHsXz44XyuSn9CBLm54Y2B23d7AhQQnpkg6mwZ2v9PP",
  "3AR4SrKEMzgvJUx9bqRuL2AhZ6cgRtr3BrqfNWBQ29HSg81ZNN457AUNwmHChrvDFFyPu9gMvspLQgyYR3HkTFkM",
  "4wN3H3zdMDGqTjcCGPtekkKPjo2fHzJfDZcvDtNzwZ7Jhtubn3Yt3MaRbGsxzCvyn9FGLQXsXUx37ThoSnci8UgY",
  "4kKXwLBYKgMBxL5xVEiGZWxGpaj6QSUX55jaA8BsdY8wfe3Z4BpFb97EYAnG2S37dtZrQ7n8wcQ4rD6EicciDXKe",
];
const noSlots = [475298377, 475298380, 475298383, 475298385];
const noTimes = ["2026-07-10T13:32:54.000Z", "2026-07-10T13:32:55.000Z", "2026-07-10T13:32:56.000Z", "2026-07-10T13:32:57.000Z"];

const yesProof: OnChainProof = {
  cluster: "devnet",
  programId,
  marketPda: "6qBpmYgFr8y3tJ8wdd6MNWZzTUggfrpKRVBTeMXt4euk",
  marketConfigPda: "4xofhNHPfxRjUndGYKKkp5w1wzVB1McM3YvqLVgp7xyY",
  orderEscrowPda: "Fn9JPHG6xpsPESbZtouCuKdQDJniWja2EC7LnB3FZwUq",
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
  orderSourceEventHash: sourceEventHash,
  orderMaterialityConfigHash: canonicalConfig.materialityConfigHash,
  oracleAuthority: authority,
  ...canonicalConfig,
  settlementDestination: "REFUNDED_TO_TRADER",
  vaultPda,
};

const noProof: OnChainProof = {
  cluster: "devnet",
  programId,
  marketPda: "6BeFRwooFyZtF4PguXsNArVZvBMBTGyLcF7D6FNVcgEb",
  marketConfigPda: "97PFV6sD4YsTQuReEXf4R4LwNdaCEM8XkozGMk5pBCHS",
  orderEscrowPda: "EFDXBocXnYG6wmZFuih9eNQ1g4tYiZL7mnqoU92vj8QZ",
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
  orderSourceEventHash: sourceEventHash,
  orderMaterialityConfigHash: canonicalConfig.materialityConfigHash,
  oracleAuthority: authority,
  ...canonicalConfig,
  settlementDestination: "FINALIZED_TO_VAULT",
  vaultPda,
};

// A custom creator market ("Spain win"), initialized + settled on devnet through the same program.
const customProof: OnChainProof = {
  cluster: "devnet",
  programId,
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
  oracleAuthority: authority,
  settlementDestination: "REFUNDED_TO_TRADER",
  vaultPda,
};
customProof.explorerUrls = customProof.txSignatures.map(txUrl);

const verifierReceipt: LineGuardReceipt = createReceipt({
  marketId: "eng-win",
  marketTitle: "England wins",
  fixtureId: "ENG-FRA-2026-QF",
  orderId: "canonical-devnet-yes-mcv2-20260710",
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
  reason: "A guided TxLINE scenario advanced materialSeq while the quote remained at pricedAtSeq 1. The +23¢ YES edge was refunded to the trader by the market-config-v2 devnet program.",
  txlineEventSeq: 2,
  txlineEventType: "GOAL",
  txlineTimestamp: 1_783_615_318_241,
  sourceMode: "guided",
  sourceEndpoint: "FairX guided scenario generator",
  rawEventHash: DEMO_EVENT_HASHES.rawEventHash,
  normalizedEventHash: sourceEventHash,
  settlementDestination: "REFUNDED_TO_TRADER",
  proofStatus: "onchain_verified",
  createdAt: Date.parse("2026-07-10T13:32:21.000Z"),
  onChain: yesProof,
});

export const proofData = {
  program: {
    id: programId,
    deployer: authority,
    programData: "D6buB3VxXnxX3jXjPX5HCqRAMJqtV4yLzaKuMra17nPT",
    schemaLabel: "market-config-v2",
    deploymentTx: "525wYLRJL12h7wg6sb7wYFumZB5kUmp7GiPPw8Voc2gDZWmuVFyNHacxJ89C6LyFcxDM1fA9EfSN9RBRcMZQS9mP",
    deployedSlot: 475298151,
    deployedAt: "2026-07-10T13:31:28.000Z",
    programDataLength: 238_672,
    previousUpgradeTx: "3z7S9vVxh1CDWw3b3qYap1m7CSxXuciMdDSXujzxLEudP1YP6YyTx4NhKNrH2xfTYUJngENE3y5tR5sKFg92fw49",
    initialDeploymentTx: "2WWNS16VPEhVPRpVdvURuCh6gvXz6KzMe5QL449fXcrg87dvs1zndc7LAUvXRZSMATMTqPVb1Bqf1XxtAEapZbks",
    explorerUrl: addressUrl(programId),
    deploymentTxUrl: txUrl("525wYLRJL12h7wg6sb7wYFumZB5kUmp7GiPPw8Voc2gDZWmuVFyNHacxJ89C6LyFcxDM1fA9EfSN9RBRcMZQS9mP"),
  },
  vault: {
    pda: vaultPda,
    explorerUrl: addressUrl(vaultPda),
    balanceLamports: 41_287_600,
    totalFinalizedLamports: 40_000_000,
    fillCount: 2,
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
      marketConfigPda: yesProof.marketConfigPda!,
      orderPda: yesProof.orderEscrowPda,
      edgeMicros: yesProof.edgeMicros,
      verdict: "VOIDED_REFUNDED",
      status: "VoidedRefunded",
      refunded: true,
      settlementDestination: "REFUNDED_TO_TRADER",
      sourceEventHash,
      recordedAt: yesTimes[3],
      txs: timeline(yesSignatures, yesSlots, yesTimes),
      explanation: "The market and its config commitment were created on-chain, the guided event hash was bound, materialSeq advanced to 2 while pricedAtSeq stayed 1, and YES carried +23¢ of stale edge. The escrowed stake returned to the trader.",
      proof: yesProof,
    },
    {
      id: "no",
      title: "NO safe trade finalized",
      claim: "A −23¢ stale NO order was allowed and finalized to ProtocolVault by the same guard.",
      tone: "blue",
      marketPda: noProof.marketPda,
      marketConfigPda: noProof.marketConfigPda!,
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
  custom: {
    title: "Custom market settled on devnet",
    marketPda: customProof.marketPda,
    marketConfigPda: customProof.marketConfigPda!,
    orderPda: customProof.orderEscrowPda,
    verdict: "VOIDED_REFUNDED",
    settlementDestination: "REFUNDED_TO_TRADER" as const,
    sourceEventHash: customProof.sourceEventHash!,
    txs: customProof.txSignatures.map((signature, index) => ({
      label: ["Initialize market + config", "Ingest material event", "Place order into escrow", "Evaluate order"][index],
      signature,
      explorerUrl: txUrl(signature),
    })),
    proof: customProof,
  },
  receipt: {
    claim: "The canonical receipt seals the event hash, committed config hashes, guard inputs, verdict, destination, and devnet transaction sequence.",
    includesTxSignatures: true,
    verifierTxCount: 4,
    tamperTest: "Change any sealed hash or verdict → verification fails",
    status: "INTEGRITY VERIFIED",
    verifierHref: `/verify/${verifierReceipt.receiptId}?r=${encodeReceiptForUrl(verifierReceipt)}`,
    receipt: verifierReceipt,
  },
  limitations: "Canonical proof covers the deployed market-config-v2 program: on-chain market-config commitment, source event hash, escrow, refund-to-trader, and ProtocolVault finalization on Solana devnet. Not mainnet, not a real-money product; production oracle decentralization, counterparty matching, and an audit remain future work.",
} as const;
