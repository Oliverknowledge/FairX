import type { NormalizedTxLineEvent } from "@/lib/txline/types";

/**
 * Low-level persistence for captured TxLINE payloads — real ones actually
 * received over the live SSE connection, or hand-pasted via the manual import
 * tool. Falls back to an in-memory store when localStorage is unavailable
 * (SSR, privacy mode, or the Vitest node test environment) so the domain
 * layer in capturedSamples.ts never has to special-case the environment.
 *
 * This is intentionally outside the reducer: it's local persistence, not
 * network or timers, but keeping it here still keeps the reducer a pure
 * function of (state, action) with zero I/O of any kind.
 */

export interface CapturedSample {
  id: string;
  capturedAt: number;
  /** Actually received over SSE this session, or hand-pasted by the user. */
  origin: "live-stream" | "manual-import";
  streamType: "scores" | "odds" | "manual";
  raw: unknown;
  event: NormalizedTxLineEvent;
  fixtureId: string;
  seq: number;
}

const STORAGE_KEY = "lineguard:captured-samples";
export const MAX_CAPTURED_SAMPLES = 12;

let memoryFallback: CapturedSample[] = [];

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== "undefined" && typeof globalThis.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readCapturedSamples(): CapturedSample[] {
  if (!hasLocalStorage()) return memoryFallback;
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CapturedSample[]) : [];
  } catch {
    return [];
  }
}

export function writeCapturedSamples(samples: CapturedSample[]): CapturedSample[] {
  const capped = samples.slice(0, MAX_CAPTURED_SAMPLES);
  if (!hasLocalStorage()) {
    memoryFallback = capped;
    return capped;
  }
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Storage unavailable or full — capture is a nice-to-have, never load-bearing; drop silently.
  }
  return capped;
}
