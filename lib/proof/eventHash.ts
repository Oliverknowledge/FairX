import { sha256 } from "js-sha256";
import { canonicalize } from "@/lib/receipts/create";
import type { NormalizedTxLineEvent } from "@/lib/txline/types";

/**
 * Deterministic event hashing for the receipt-level proof chain.
 *
 * Two hashes bind a settlement receipt to the exact source event that opened
 * the stale window:
 *   - rawEventHash — sha256 of the raw provider payload, exactly as received.
 *   - normalizedEventHash — sha256 of the normalized, provenance-relevant fields.
 *
 * Both are isomorphic (js-sha256 + canonical JSON) so a verifier recomputes
 * identical values in the browser, on the server, or in a test runner. This is
 * *receipt-level* binding: it proves the receipt references a specific event,
 * without claiming the hash is stored inside the deployed Anchor program.
 */

export function hashRawEvent(raw: unknown): string {
  return sha256(canonicalize(raw ?? null));
}

/** Only the fields that define the event's meaning — not diagnostic timestamps of ingestion. */
export interface NormalizedEventHashInput {
  provider?: string;
  source: string;
  fixtureId: string;
  seq: number;
  ts: number;
  eventType: string;
  team?: string;
  player?: string;
  minute?: number;
  proofStatus?: string;
}

export function hashNormalizedEvent(event: NormalizedEventHashInput): string {
  const canonical = {
    provider: event.provider ?? "TXLINE",
    source: event.source,
    fixtureId: event.fixtureId,
    seq: event.seq,
    ts: event.ts,
    eventType: event.eventType,
    team: event.team,
    player: event.player,
    minute: event.minute,
    proofStatus: event.proofStatus,
  };
  return sha256(canonicalize(canonical));
}

export function hashNormalizedTxLineEvent(event: NormalizedTxLineEvent): string {
  return hashNormalizedEvent({
    provider: event.provider,
    source: event.source,
    fixtureId: event.fixtureId,
    seq: event.seq,
    ts: event.ts,
    eventType: event.eventType,
    team: event.team,
    player: event.player,
    minute: event.minute,
    proofStatus: event.proofStatus,
  });
}

export interface EventHashPair {
  rawEventHash: string;
  normalizedEventHash: string;
}

/** Convenience: compute both hashes from a raw payload + normalized fields. */
export function eventHashPair(raw: unknown, normalized: NormalizedEventHashInput): EventHashPair {
  return {
    rawEventHash: hashRawEvent(raw),
    normalizedEventHash: hashNormalizedEvent(normalized),
  };
}

/** Short display form for hashes in dense UI. */
export function shortHash(hash: string | undefined): string {
  if (!hash) return "—";
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}
