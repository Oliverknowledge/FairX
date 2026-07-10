import { isMaterialEventType } from "@/lib/txline/materiality";
import type { NormalizedTxLineEvent } from "@/lib/txline/types";
import type { Market } from "@/lib/markets/types";

/**
 * Market-level materiality: does THIS event move THAT market's fair value?
 * These rules decide when a stale window opens — UNKNOWN or irrelevant events
 * never stale-lock a market.
 */
export function eventImpactsMarket(event: NormalizedTxLineEvent, market: Market): boolean {
  if (!isMaterialEventType(event.eventType)) return false;
  if (event.fixtureId !== market.fixtureId) return false;

  switch (event.eventType) {
    case "GOAL":
      // Goals move both total-goals and match-winner markets.
      return market.kind === "OVER_UNDER" || market.kind === "WINNER";
    case "RED_CARD":
    case "PENALTY":
    case "VAR":
      // Discipline/VAR shifts win probability but not (directly) goal totals.
      return market.kind === "WINNER";
    case "ODDS_UPDATE":
      // Odds can reprice any market they quote.
      return true;
    default:
      return false;
  }
}
