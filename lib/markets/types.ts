import type { NormalizedTxLineEvent } from "@/lib/txline/types";

/** Market model — one hero market in the demo, but engine-shaped for many. */

export type MarketKind = "WINNER" | "OVER_UNDER";

export type MarketStatus = "trading" | "stale" | "repricing" | "settled";

export type Side = "YES" | "NO" | "OVER" | "UNDER";

export interface Market {
  id: string;
  title: string;
  /** What YES/OVER resolving true means, for panel copy. */
  resolutionNote: string;
  kind: MarketKind;
  fixtureId: string;
  /** Team whose success the YES side backs (WINNER markets). */
  backedTeam?: string;
  /** Goal line for OVER_UNDER markets (e.g. 2.5). */
  line?: number;
  /** Displayed YES/OVER price — what an order executes at. 0..1. */
  yes: number;
  /** True fair YES/OVER price given every known event, incl. un-repriced ones. */
  fairYes: number;
  /** Latest officiated event sequence affecting this market. */
  materialSeq: number;
  /** Latest sequence the displayed price has repriced through. */
  pricedAtSeq: number;
  status: MarketStatus;
  /** Last event that moved materialSeq (null before any). */
  lastMaterialEvent: NormalizedTxLineEvent | null;
  /** Last reprice: when and through which seq. */
  lastReprice: { at: number; toSeq: number; price: number } | null;
  /** When the current stale window opened (null when in sync). */
  staleOpenedAt: number | null;
}

/** materialSeq ahead of pricedAtSeq ⇒ the feed knows something the price doesn't. */
export function isStale(market: Pick<Market, "materialSeq" | "pricedAtSeq">): boolean {
  return market.materialSeq > market.pricedAtSeq;
}

/** How long the current stale window has been open (0 when in sync). */
export function staleDurationMs(market: Market, now: number): number {
  return isStale(market) && market.staleOpenedAt !== null ? Math.max(0, now - market.staleOpenedAt) : 0;
}

/** Fair price for a given side: YES/OVER quote fairYes, NO/UNDER quote the complement. */
export function fairSidePrice(fairYes: number, side: Side): number {
  return side === "YES" || side === "OVER" ? fairYes : 1 - fairYes;
}

/** Displayed price for a given side (same complement rule as fair). */
export function displayedSidePrice(yes: number, side: Side): number {
  return side === "YES" || side === "OVER" ? yes : 1 - yes;
}
