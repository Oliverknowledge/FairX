import { openSSEStream, safeJsonParse, type SSEMessage, type StreamHandle } from "@/lib/txline/sse";
import type { TxLineHealth } from "@/lib/txline/types";

/**
 * Browser-side TxLINE client. Talks ONLY to our internal API routes — the
 * server proxies attach credentials. Nothing secret ever reaches this file.
 */

export const INTERNAL_ROUTES = {
  scoresStream: "/api/txline/scores/stream",
  oddsStream: "/api/txline/odds/stream",
  scoresSnapshot: "/api/txline/scores/snapshot",
  health: "/api/txline/health",
} as const;

export async function fetchTxLineHealth(): Promise<TxLineHealth | null> {
  try {
    const res = await fetch(INTERNAL_ROUTES.health, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as TxLineHealth;
  } catch {
    return null;
  }
}

export interface TxLineStreamCallbacks {
  onStatus(status: "connecting" | "live" | "error" | "disconnected", detail?: string): void;
  /** Fires with the parsed JSON payload (or raw string if not JSON). */
  onPayload(payload: unknown, msg: SSEMessage): void;
}

function openInternalStream(url: string, callbacks: TxLineStreamCallbacks): StreamHandle {
  return openSSEStream(url, {
    onStatus: callbacks.onStatus,
    onMessage(msg) {
      const parsed = safeJsonParse(msg.data);
      callbacks.onPayload(parsed ?? msg.data, msg);
    },
  });
}

export function openScoresStream(callbacks: TxLineStreamCallbacks): StreamHandle {
  return openInternalStream(INTERNAL_ROUTES.scoresStream, callbacks);
}

export function openOddsStream(callbacks: TxLineStreamCallbacks): StreamHandle {
  return openInternalStream(INTERNAL_ROUTES.oddsStream, callbacks);
}

export async function fetchScoresSnapshot(): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(INTERNAL_ROUTES.scoresSnapshot, { cache: "no-store" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: safeJsonParse(text) ?? text };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err) };
  }
}
