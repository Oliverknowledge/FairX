import type { TxLineEventType } from "@/lib/txline/types";

/**
 * Event-level materiality: which TxLINE event types are ever capable of
 * moving a market's fair value. Market-specific impact (does THIS event move
 * THAT market) lives in lib/markets/materiality.ts.
 */

export const MATERIAL_EVENT_TYPES: ReadonlySet<TxLineEventType> = new Set([
  "GOAL",
  "RED_CARD",
  "PENALTY",
  "VAR",
  "ODDS_UPDATE",
]);

/** UNKNOWN and cosmetic events never stale-lock a market. */
export function isMaterialEventType(type: TxLineEventType): boolean {
  return MATERIAL_EVENT_TYPES.has(type);
}
