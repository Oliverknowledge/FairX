import { displayedSidePrice, fairSidePrice, isStale, type Market, type Side } from "@/lib/markets/types";

/**
 * The sniper bot's brain — pure market-reading logic. The bot watches for
 * materialSeq > pricedAtSeq, prices both sides against fair value, and fires
 * when its edge clears tolerance. Timers/dispatching live in the hook layer.
 */

export const BOT_STAKE_USD = 500;

export interface SniperReading {
  staleWindowOpen: boolean;
  side: Side;
  /** Stale displayed price for the chosen side — what the order would fill at. */
  observedPrice: number;
  /** Fair price for that side given every known event. */
  fairSidePrice: number;
  /** fair − observed. Positive = free money at the market's expense. */
  edge: number;
  /** Bot only fires when the window is open AND edge clears tolerance. */
  attackReady: boolean;
  stakeUsd: number;
  shares: number;
}

/** Read the market from the bot's seat for a given side. */
export function readMarket(market: Market, side: Side, tolerance: number, stakeUsd: number = BOT_STAKE_USD): SniperReading {
  const staleWindowOpen = isStale(market);
  const observedPrice = displayedSidePrice(market.yes, side);
  const fair = fairSidePrice(market.fairYes, side);
  const edge = Math.round((fair - observedPrice) * 1e4) / 1e4;
  return {
    staleWindowOpen,
    side,
    observedPrice,
    fairSidePrice: fair,
    edge,
    attackReady: staleWindowOpen && edge > tolerance,
    stakeUsd,
    shares: observedPrice > 0 ? stakeUsd / observedPrice : 0,
  };
}

/** Which side benefits from the un-repriced event? (the side the bot attacks) */
export function beneficialSide(market: Market): Side {
  const yesLike: Side = market.kind === "OVER_UNDER" ? "OVER" : "YES";
  const noLike: Side = market.kind === "OVER_UNDER" ? "UNDER" : "NO";
  return market.fairYes >= market.yes ? yesLike : noLike;
}

/**
 * Counterfactual economics, pinned to the FROZEN observed price the bot
 * actually sniped — never the live displayed price, or the "profit denied"
 * number would evaporate the moment the market reprices.
 */
export function sniperEconomics(stakeUsd: number, frozenObservedPrice: number, fairSide: number) {
  const shares = frozenObservedPrice > 0 ? stakeUsd / frozenObservedPrice : 0;
  const markToFair = shares * fairSide;
  return {
    shares,
    /** What the bot walks away with if nothing stops it: mark stale fill to fair. */
    withoutLineGuardProfit: markToFair - stakeUsd,
    withLineGuardProfit: 0,
  };
}
