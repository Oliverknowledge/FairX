import { createReceipt } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";
import { eventHashPair } from "@/lib/proof/eventHash";
import type { OnChainSide } from "@/lib/solana/pdas";

/**
 * The canonical material event behind the fresh devnet demo: England's goal at
 * source sequence 2, which moves fair YES 40¢ → 63¢ while the quote is frozen.
 * Hashing it binds each fresh receipt to the exact event that opened the window.
 */
const DEMO_EVENT_RAW = {
  provider: "TXLINE",
  fixtureId: "ENG-FRA-2026-QF",
  seq: 2,
  type: "GOAL",
  team: "England",
  player: "Bukayo Saka",
  minute: 62,
  fairPriceMicros: 630_000,
} as const;

const DEMO_EVENT_NORMALIZED = {
  provider: "TXLINE",
  source: "demo",
  fixtureId: "ENG-FRA-2026-QF",
  seq: 2,
  ts: 1_783_615_318_241,
  eventType: "GOAL",
  team: "England",
  player: "Bukayo Saka",
  minute: 62,
  proofStatus: "onchain_verified",
} as const;

function verdictFromCode(code: number): string {
  return code === 2 ? "VOIDED_REFUNDED" : code === 1 ? "STALE_ALLOWED_NO_EDGE" : "ALLOWED";
}

function marketConfigProof(proof: OnChainProof): LineGuardReceipt["marketConfigProof"] {
  if (
    !proof.marketType ||
    !proof.fixtureIdHash ||
    !proof.marketTitleHash ||
    !proof.materialityConfigHash ||
    !proof.settlementConfigHash
  ) return undefined;
  return {
    marketType: proof.marketType,
    fixtureIdHash: proof.fixtureIdHash,
    marketTitleHash: proof.marketTitleHash,
    materialityConfigHash: proof.materialityConfigHash,
    settlementConfigHash: proof.settlementConfigHash,
    onChainMarketPda: proof.marketPda,
  };
}

/**
 * Build a tamper-evident receipt for a *fresh* devnet settlement, attaching the
 * real transaction signatures + on-chain register values returned by the guard.
 */
export function buildFreshDevnetReceipt(side: OnChainSide, proof: OnChainProof, createdAt: number = Date.now()): LineGuardReceipt {
  const observedPrice = proof.observedPriceMicros / 1_000_000;
  const fairSidePrice = proof.fairSidePriceMicros / 1_000_000;
  const fairYes = side === "YES" ? fairSidePrice : 1 - fairSidePrice;
  const edge = proof.edgeMicros / 1_000_000;
  const tolerance = proof.toleranceMicros / 1_000_000;
  const verdict = verdictFromCode(proof.verdictCode);
  const { rawEventHash, normalizedEventHash } = eventHashPair(DEMO_EVENT_RAW, DEMO_EVENT_NORMALIZED);
  const lastSig = proof.txSignatures.at(-1) ?? "unknown";

  return createReceipt({
    marketId: "eng-win",
    marketTitle: "England wins",
    fixtureId: "ENG-FRA-2026-QF",
    orderId: `devnet-${side.toLowerCase()}-${lastSig.slice(0, 10)}`,
    actor: side === "YES" ? "bot" : "user",
    side,
    stake: 0.02,
    stakeUnit: "SOL",
    observedPrice,
    fairSidePrice,
    fairYes,
    materialSeq: proof.materialSeq,
    pricedAtSeq: proof.pricedAtSeq,
    staleness: proof.materialSeq - proof.pricedAtSeq,
    edge,
    tolerance,
    verdict,
    reason:
      verdict === "VOIDED_REFUNDED"
        ? "Fresh devnet run: materialSeq 2 > pricedAtSeq 1 and the YES order captured +23¢ of stale edge above the 2¢ tolerance, so the on-chain guard refunded the escrowed stake."
        : "Fresh devnet run: the market was stale but the NO order had negative edge (no exploit), so the on-chain guard allowed and filled it.",
    txlineEventSeq: 2,
    txlineEventType: "GOAL",
    txlineTimestamp: DEMO_EVENT_NORMALIZED.ts,
    sourceMode: "guided",
    sourceEndpoint: "FairX guided scenario generator",
    rawEventHash,
    normalizedEventHash,
    // The on-chain program enforces the destination: refund to trader, or finalize into the vault.
    settlementDestination: proof.settlementDestination ?? (verdict === "VOIDED_REFUNDED" ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT"),
    proofStatus: "onchain_verified",
    createdAt,
    onChain: proof,
    marketConfigProof: marketConfigProof(proof),
  });
}

export const DEMO_EVENT_HASHES = eventHashPair(DEMO_EVENT_RAW, DEMO_EVENT_NORMALIZED);

/**
 * Build a tamper-evident receipt for ANY on-chain order (e.g. a custom sandbox
 * market settled on devnet). The normalized event hash is taken from the proof's
 * on-chain `sourceEventHash` so the receipt reproduces exactly what the program bound.
 */
export function buildOnChainOrderReceipt(params: {
  marketId: string;
  marketTitle: string;
  fixtureId: string;
  side: OnChainSide;
  proof: OnChainProof;
  stakeDisplay?: number;
  createdAt?: number;
}): LineGuardReceipt {
  const { marketId, marketTitle, fixtureId, side, proof } = params;
  const observedPrice = proof.observedPriceMicros / 1_000_000;
  const fairSidePrice = proof.fairSidePriceMicros / 1_000_000;
  const fairYes = side === "YES" ? fairSidePrice : 1 - fairSidePrice;
  const edge = proof.edgeMicros / 1_000_000;
  const tolerance = proof.toleranceMicros / 1_000_000;
  const verdict = verdictFromCode(proof.verdictCode);
  const lastSig = proof.txSignatures.at(-1) ?? "unknown";
  const destination = proof.settlementDestination ?? (verdict === "VOIDED_REFUNDED" ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT");

  return createReceipt({
    marketId,
    marketTitle,
    fixtureId,
    orderId: `devnet-${side.toLowerCase()}-${lastSig.slice(0, 10)}`,
    actor: side === "YES" ? "bot" : "user",
    side,
    stake: params.stakeDisplay ?? 0.01,
    stakeUnit: "SOL",
    observedPrice,
    fairSidePrice,
    fairYes,
    materialSeq: proof.materialSeq,
    pricedAtSeq: proof.pricedAtSeq,
    staleness: proof.materialSeq - proof.pricedAtSeq,
    edge,
    tolerance,
    verdict,
    reason:
      verdict === "VOIDED_REFUNDED"
        ? `Devnet order on ${marketTitle}: a stale ${side} order captured positive edge above tolerance and was refunded to the trader on-chain.`
        : `Devnet order on ${marketTitle}: a stale ${side} order had no positive edge and was filled, finalizing its stake into the ProtocolVault on-chain.`,
    txlineEventSeq: proof.materialSeq,
    txlineEventType: "ODDS_UPDATE",
    sourceMode: "guided",
    sourceEndpoint: "FairX custom-market guided event",
    normalizedEventHash: proof.sourceEventHash,
    settlementDestination: destination,
    proofStatus: "onchain_verified",
    createdAt: params.createdAt ?? Date.now(),
    onChain: proof,
    marketConfigProof: marketConfigProof(proof),
  });
}
