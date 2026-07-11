import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";
import { createReceipt } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof, TxlineProof } from "@/lib/receipts/types";
import type { OnChainSide } from "@/lib/solana/pdas";

function verdictFromCode(code: number): string {
  return code === 2 ? "VOIDED_REFUNDED" : code === 1 ? "STALE_ALLOWED_NO_EDGE" : "ALLOWED";
}

function marketConfigProof(proof: OnChainProof): LineGuardReceipt["marketConfigProof"] {
  if (!proof.marketType || !proof.fixtureIdHash || !proof.marketTitleHash || !proof.materialityConfigHash || !proof.settlementConfigHash) return undefined;
  return {
    marketType: proof.marketType,
    fixtureIdHash: proof.fixtureIdHash,
    marketTitleHash: proof.marketTitleHash,
    materialityConfigHash: proof.materialityConfigHash,
    settlementConfigHash: proof.settlementConfigHash,
    onChainMarketPda: proof.marketPda,
  };
}

function canonicalTxlineProof(): TxlineProof {
  return {
    source: "txline",
    network: canonicalCapture.network as TxlineProof["network"],
    mode: canonicalCapture.mode as TxlineProof["mode"],
    endpoint: canonicalCapture.endpoint,
    fixtureId: canonicalCapture.fixtureId,
    seq: canonicalCapture.normalizedEvent.seq,
    receivedAt: canonicalCapture.receivedAt,
    rawPayloadHash: canonicalCapture.rawPayloadHash,
    normalizedEventHash: canonicalCapture.normalizedEventHash,
    normalizerVersion: canonicalCapture.normalizerVersion,
    rawPayload: canonicalCapture.rawPayload,
    normalizedEvent: canonicalCapture.normalizedEvent as unknown as TxlineProof["normalizedEvent"],
    validation: {
      method: canonicalValidation.method as "validateStatV2",
      endpoint: canonicalValidation.endpoint as "/api/scores/stat-validation",
      statKeys: canonicalValidation.statKeys,
      dailyScoresRootPda: canonicalValidation.dailyScoresRootPda,
      validationPayloadHash: canonicalValidation.validationPayloadHash,
      passed: canonicalValidation.simulationPassed,
    },
  };
}

/** Build a receipt for a fresh LineGuard devnet run backed by the canonical genuine TxLINE capture. */
export function buildFreshDevnetReceipt(side: OnChainSide, proof: OnChainProof, createdAt: number = Date.now()): LineGuardReceipt {
  const observedPrice = proof.observedPriceMicros / 1_000_000;
  const fairSidePrice = proof.fairSidePriceMicros / 1_000_000;
  const fairYes = side === "YES" ? fairSidePrice : 1 - fairSidePrice;
  const edge = proof.edgeMicros / 1_000_000;
  const tolerance = proof.toleranceMicros / 1_000_000;
  const verdict = verdictFromCode(proof.verdictCode);
  const lastSig = proof.txSignatures.at(-1) ?? "unknown";
  const txlineProof = canonicalTxlineProof();

  return createReceipt({
    marketId: "france-morocco-france-win",
    marketTitle: "France wins",
    fixtureId: canonicalCapture.fixtureId,
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
    reason: verdict === "VOIDED_REFUNDED"
      ? `Genuine TxLINE sequence ${canonicalCapture.normalizedEvent.seq} moved France's fair price above the captured pre-event quote, so LineGuard refunded the stale positive-edge YES order.`
      : "The same genuine TxLINE event made the stale NO side negative-edge, so LineGuard finalized the safe order into ProtocolVault.",
    txlineEventSeq: canonicalCapture.normalizedEvent.seq,
    txlineEventType: canonicalCapture.normalizedEvent.eventType,
    txlineTimestamp: canonicalCapture.normalizedEvent.ts,
    sourceMode: canonicalCapture.mode as LineGuardReceipt["sourceMode"],
    sourceEndpoint: canonicalCapture.endpoint,
    rawEventHash: canonicalCapture.rawPayloadHash,
    normalizedEventHash: canonicalCapture.normalizedEventHash,
    txlineProof,
    settlementDestination: proof.settlementDestination ?? (verdict === "VOIDED_REFUNDED" ? "REFUNDED_TO_TRADER" : "FINALIZED_TO_VAULT"),
    proofStatus: canonicalValidation.simulationPassed ? "txline_validateStatV2_passed+lineguard_onchain" : "lineguard_onchain",
    createdAt,
    onChain: proof,
    marketConfigProof: marketConfigProof(proof),
  });
}

export const CANONICAL_EVENT_HASHES = {
  rawEventHash: canonicalCapture.rawPayloadHash,
  normalizedEventHash: canonicalCapture.normalizedEventHash,
};
/** Backward-compatible export name used by static proof assembly. */
export const DEMO_EVENT_HASHES = CANONICAL_EVENT_HASHES;

/** Build a receipt for an arbitrary custom sandbox market. */
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
    marketId, marketTitle, fixtureId,
    orderId: `devnet-${side.toLowerCase()}-${lastSig.slice(0, 10)}`,
    actor: side === "YES" ? "bot" : "user",
    side,
    stake: params.stakeDisplay ?? 0.01,
    stakeUnit: "SOL",
    observedPrice, fairSidePrice, fairYes,
    materialSeq: proof.materialSeq,
    pricedAtSeq: proof.pricedAtSeq,
    staleness: proof.materialSeq - proof.pricedAtSeq,
    edge, tolerance, verdict,
    reason: verdict === "VOIDED_REFUNDED" ? `Devnet order on ${marketTitle} was refunded.` : `Devnet order on ${marketTitle} was finalized into ProtocolVault.`,
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
