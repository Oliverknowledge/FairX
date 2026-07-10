import { sha256 } from "js-sha256";
import type { LineGuardReceipt } from "@/lib/receipts/types";

/**
 * Receipt creation + canonical hashing. Deterministic and synchronous
 * (js-sha256) so it can run inside the reducer and be recomputed anywhere —
 * browser, server, or test runner — with identical output.
 */

/** Canonical JSON: recursively key-sorted, no undefined members. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return "null"; // functions/symbols/undefined — never present in receipts
}

/** Hash every receipt field EXCEPT receiptHash itself. */
export function computeReceiptHash(receipt: Omit<LineGuardReceipt, "receiptHash">): string {
  return sha256(canonicalize(receipt));
}

export type ReceiptDraft = Omit<LineGuardReceipt, "receiptHash" | "receiptId">;

/** Seal a receipt: derive a stable id from the order, then hash all fields. */
export function createReceipt(draft: ReceiptDraft): LineGuardReceipt {
  const unsealed: Omit<LineGuardReceipt, "receiptHash"> = {
    ...draft,
    receiptId: `rcpt-${draft.orderId}`,
  };
  return { ...unsealed, receiptHash: computeReceiptHash(unsealed) };
}

/** Compact base64url encoding for shareable verifier URLs. */
export function encodeReceiptForUrl(receipt: LineGuardReceipt): string {
  const json = JSON.stringify(receipt);
  const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeReceiptFromUrl(encoded: string): LineGuardReceipt | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json) as LineGuardReceipt;
    return typeof parsed === "object" && parsed !== null && typeof parsed.receiptHash === "string" ? parsed : null;
  } catch {
    return null;
  }
}
