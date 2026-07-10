import type { NormalizedTxLineEvent, TxLineProofStatus } from "@/lib/txline/types";

/**
 * Bridge between TxLINE's data-integrity story and LineGuard's guard rule.
 * Everything here is honest: we summarize exactly what proof material an
 * event carries and never claim on-chain verification that didn't happen.
 */

export interface ProofSummary {
  status: TxLineProofStatus;
  label: string;
  detail: string;
  tone: "green" | "amber" | "neutral";
}

export function summarizeProof(event: NormalizedTxLineEvent | null, liveConnected: boolean): ProofSummary {
  if (!event) {
    return {
      status: "unverified",
      label: "No event yet",
      detail: liveConnected
        ? "TxLINE stream connected. Waiting for the first event to summarize proof material."
        : "No TxLINE event ingested yet — run the guided scenario or enable live mode.",
      tone: "neutral",
    };
  }
  switch (event.proofStatus) {
    case "onchain_verified":
      return {
        status: "onchain_verified",
        label: "On-chain verified",
        detail: "Event validated against an on-chain TxLINE stat proof.",
        tone: "green",
      };
    case "api_verified":
      return {
        status: "api_verified",
        label: "API proof material present",
        detail: "Event arrived with signature/Merkle fields from the TxLINE API. On-chain validation not performed by this prototype.",
        tone: "green",
      };
    case "simulated":
      return {
        status: "simulated",
        label: "Simulated (guided scenario)",
        detail: "Guided scenario event — identical pipeline to live, honestly labelled. No real proof exists for this event.",
        tone: "amber",
      };
    default:
      if (event.source === "captured") {
        return {
          status: "unverified",
          label: "Unverified (captured replay)",
          detail: "This payload was captured earlier and replayed from local storage — it carries no signature or Merkle root, so on-chain proof cannot be claimed for it.",
          tone: "neutral",
        };
      }
      return {
        status: "unverified",
        label: "Unverified",
        detail: liveConnected
          ? "TxLINE stream connected. On-chain proof validation not yet available for this event in the demo fixture."
          : "Event carries no proof fields.",
        tone: "neutral",
      };
  }
}

/** Defensively pull proof-looking fields out of an arbitrary snapshot payload. */
export function extractProofFields(body: unknown): { merkleRoot?: string; signature?: string; keysSeen: string[] } {
  if (typeof body !== "object" || body === null) return { keysSeen: [] };
  const found: { merkleRoot?: string; signature?: string } = {};
  const keysSeen: string[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 4 || typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (typeof value === "string" && value.length > 0) {
        if (!found.merkleRoot && (lower.includes("merkle") || lower === "root")) {
          found.merkleRoot = value;
          keysSeen.push(key);
        } else if (!found.signature && (lower.includes("signature") || lower === "sig")) {
          found.signature = value;
          keysSeen.push(key);
        }
      } else {
        visit(value, depth + 1);
      }
    }
  };
  visit(body, 0);
  return { ...found, keysSeen };
}

/** The exact rule a deployed LineGuard program would enforce, shown verbatim in the UI. */
export const ONCHAIN_ENFORCEMENT_TARGET = `if market.material_seq > market.priced_at_seq
    && edge > tolerance {
    refund_unfair_trade();
}`;
