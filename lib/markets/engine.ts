import type { NormalizedTxLineEvent } from "@/lib/txline/types";
import { eventImpactsMarket } from "@/lib/markets/materiality";
import { computeFairValueFromEvent } from "@/lib/markets/fairValue";
import { isStale, type Market } from "@/lib/markets/types";

/**
 * Pure market transitions. The reducer calls these; nothing here touches the
 * network or timers.
 *
 * Invariant the whole app hangs on: ingesting a material event advances
 * materialSeq + fairYes but NEVER the displayed price — only repriceMarket
 * moves `yes` and closes the window by advancing pricedAtSeq.
 */

/** Market-maker latency model: how long a live reprice lags a material event. */
export const REPRICE_LAG_MS = 1500;

export interface IngestResult {
  market: Market;
  /** True when this event moved fair value (and so opened/extended staleness). */
  material: boolean;
  /** True when this specific ingest transitioned the market in-sync → stale. */
  openedStaleWindow: boolean;
}

export function ingestEvent(market: Market, event: NormalizedTxLineEvent, at: number): IngestResult {
  if (!eventImpactsMarket(event, market)) {
    return { market, material: false, openedStaleWindow: false };
  }

  const wasStale = isStale(market);
  const fairYes = computeFairValueFromEvent(event, market, market.fairYes);
  const next: Market = {
    ...market,
    materialSeq: Math.max(market.materialSeq, event.seq),
    fairYes,
    // Displayed price and pricedAtSeq deliberately untouched — this gap IS the stale window.
    status: "stale",
    lastMaterialEvent: event,
    staleOpenedAt: wasStale ? market.staleOpenedAt : at,
  };
  return { market: next, material: true, openedStaleWindow: !wasStale };
}

/** Displayed price catches up to fair; registers sync; window closes. */
export function repriceMarket(market: Market, at: number): Market {
  return {
    ...market,
    yes: market.fairYes,
    pricedAtSeq: market.materialSeq,
    status: "trading",
    lastReprice: { at, toSeq: market.materialSeq, price: market.fairYes },
    staleOpenedAt: null,
  };
}

/** Brief intermediate state while the market maker recomputes (UI affordance). */
export function markRepricing(market: Market): Market {
  return isStale(market) ? { ...market, status: "repricing" } : market;
}
