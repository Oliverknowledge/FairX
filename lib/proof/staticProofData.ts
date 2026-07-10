import { createReceipt, encodeReceiptForUrl } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";

const CLUSTER = "devnet";
const EXPLORER_BASE = "https://explorer.solana.com";

export type ProofTone = "green" | "red" | "blue" | "amber" | "neutral";

export interface ProofTx {
  label: string;
  signature: string;
  explorerUrl: string;
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
  status?: string;
  refunded: boolean;
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

function timeline(signatures: string[]): ProofTx[] {
  return ["Initialize market", "Ingest material event", "Place order into escrow", "Evaluate order"].map((label, index) => ({
    label,
    signature: signatures[index],
    explorerUrl: txUrl(signatures[index]),
  }));
}

const programId = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";

const yesSignatures = [
  "3nxMTmkqBhekhqChe85QST9ypKyWyBzZoPE1EV62Y9CvgG2d2Pe7dWHiRNRDRLwT2PY3yVhHbfXGRg8akoPnE367",
  "2kconXTGBD9G2GqX7ftf63LkKeXVcmsDGkUyQJM1Rtr8Ve4kfWCrdvsSSwKwSJ3S7WHY1oaCouitttDtMnXSpzqv",
  "2gA8QGUNEDXBmtH8iqrxL135AhhcecFdBSdNghzJuh3DUUhMiKcoAUrT9GiV7SdEnEeHyPWUtuisfAhNK6RB4Q2y",
  "2kdy7Jw65WkaotvM749MFSdtoNbxTS2Q8Wb6rAyCQCuT8iEhVXxNgMHPmEkZKv7DwcuemqxnkP8WDBLMFW7YW2LU",
];

const noSignatures = [
  "4SPrLtMrZ4QPmoMuDnTpP3N7XTCvwji9GNSW9VHf1jcv7qWgJPyX4As2cty6YtekS4T8L4E7E1cbUxferYhga6R9",
  "2gdJVLcLFr7oyzs8Lfj8b1jhi1QUaY8HsxRrAE5pFDENUiQZbr8fQ9ozPZfJ6tCUB8fxxEi8siqhSp5LoVSv5aSd",
  "4kHjR8hxuRH6Ws1PxDAaetvccZsiGWW1EmZyXHFr2NcrxEBW3dLeKsfWEcv7nNhv4qc18H9D1GbG2quAiad3j6LP",
  "pq4KQJgJqRhLHdreXpqwLkuQzz55JFou9Bhr2PfawFs4hR4gEASTEt3W8Kh5tHwYXFS5kXFUW87opktiGaaywkA",
];

const yesProof: OnChainProof = {
  cluster: "devnet",
  programId,
  marketPda: "GSVsEECW7EuXQbS8ztskoYDE18GhRvY8wFNbxHwrezZs",
  orderEscrowPda: "8khPDtj1S1yQA67898yRXKyUdgV45cMUiBainz1JCxo2",
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
};

const noProof: OnChainProof = {
  cluster: "devnet",
  programId,
  marketPda: "HTs6RaHawcnffbKgGNjiXBhh5eAmWn2A9qKD5nRjp4pH",
  orderEscrowPda: "Cu2c5BffadxKwRXHpSKbzrF5TNT9wpd54vL3dzUX6bF2",
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
};

const verifierReceipt: LineGuardReceipt = createReceipt({
  marketId: "eng-win",
  marketTitle: "England wins",
  fixtureId: "ENG-FRA-2026-QF",
  orderId: "proof-devnet-yes",
  actor: "bot",
  side: "YES",
  stake: 500,
  observedPrice: 0.4,
  fairSidePrice: 0.63,
  fairYes: 0.63,
  materialSeq: 2,
  pricedAtSeq: 1,
  staleness: 1,
  edge: 0.23,
  tolerance: 0.02,
  verdict: "VOIDED_REFUNDED",
  reason:
    "TxLINE-style event advanced materialSeq to 2 while pricedAtSeq stayed 1. Buying YES at 40c while fair YES was 63c created +23c stale edge, so the on-chain guard refunded the order.",
  txlineEventSeq: 2,
  txlineEventType: "GOAL",
  txlineTimestamp: 1_783_615_318_241,
  proofStatus: "simulated",
  createdAt: 1_783_615_324_890,
  onChain: yesProof,
});

export const proofData = {
  program: {
    id: programId,
    deployer: "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq",
    deploymentTx: "2WWNS16VPEhVPRpVdvURuCh6gvXz6KzMe5QL449fXcrg87dvs1zndc7LAUvXRZSMATMTqPVb1Bqf1XxtAEapZbks",
    deployedSlot: "475095642",
    explorerUrl: addressUrl(programId),
    deploymentTxUrl: txUrl("2WWNS16VPEhVPRpVdvURuCh6gvXz6KzMe5QL449fXcrg87dvs1zndc7LAUvXRZSMATMTqPVb1Bqf1XxtAEapZbks"),
  },
  cases: [
    {
      id: "yes",
      title: "YES stale attack refunded",
      claim: "A stale YES order with +23c edge was escrowed and refunded on-chain.",
      tone: "red",
      marketPda: yesProof.marketPda,
      orderPda: yesProof.orderEscrowPda,
      edgeMicros: yesProof.edgeMicros,
      verdict: "VOIDED_REFUNDED",
      refunded: true,
      txs: timeline(yesSignatures),
      explanation:
        "TxLINE-style event advanced materialSeq to 2 while pricedAtSeq stayed 1. The order bought YES at 40c while fair YES was 63c, creating +23c stale edge. The program refunded it.",
      proof: yesProof,
    },
    {
      id: "no",
      title: "NO stale trade filled",
      claim: "A stale NO order with negative edge was allowed and filled on-chain.",
      tone: "blue",
      marketPda: noProof.marketPda,
      orderPda: noProof.orderEscrowPda,
      edgeMicros: noProof.edgeMicros,
      verdict: "STALE_ALLOWED_NO_EDGE",
      status: "Filled",
      refunded: false,
      txs: timeline(noSignatures),
      explanation:
        "The market was stale, but the NO order did not profit from the unrepriced event. LineGuard did not pause the market; it allowed the no-edge trade.",
      proof: noProof,
    },
  ] satisfies SettlementProofCase[],
  receipt: {
    claim: "Receipts bind the verdict and on-chain proof into a tamper-evident hash.",
    includesTxSignatures: true,
    verifierTxCount: 4,
    tamperTest: "onChain.verdictCode changed -> hash mismatch",
    status: "TAMPER-EVIDENT",
    verifierHref: `/verify/${verifierReceipt.receiptId}?r=${encodeReceiptForUrl(verifierReceipt)}`,
    demoHref: "/",
    receipt: verifierReceipt,
  },
  limitations:
    "LineGuard's devnet proof covers the settlement guard: market registers, order escrow, guard evaluation, and refund/fill verdict. It does not yet include production counterparty settlement, mainnet deployment, or production oracle authority management.",
} as const;
