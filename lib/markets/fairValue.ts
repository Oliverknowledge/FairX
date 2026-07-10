import type { NormalizedTxLineEvent } from "@/lib/txline/types";
import type { Market } from "@/lib/markets/types";

/**
 * Deterministic fair-value model. Deliberately simple — fixed probability
 * shifts per event class — but shaped so a real odds feed (ODDS_UPDATE with
 * implied probabilities) can replace the heuristics without touching callers.
 *
 * The demo's sacred numbers come from here: a goal by the backed team shifts
 * a WINNER market by +23¢ (0.40 → 0.63).
 */

export const FAIR_SHIFTS = {
  /** WINNER: goal scored by / conceded by the backed team. */
  GOAL_FOR: 0.23,
  GOAL_AGAINST: -0.18,
  /** WINNER: red card shown to the opponent / to the backed team. */
  RED_CARD_OPPONENT: 0.12,
  RED_CARD_BACKED: -0.15,
  /** WINNER: penalty awarded to / against the backed team (pre-kick). */
  PENALTY_FOR: 0.08,
  PENALTY_AGAINST: -0.07,
  /** OVER_UNDER: every goal pushes the total toward OVER. */
  GOAL_TOTAL: 0.2,
} as const;

export const PRICE_MIN = 0.01;
export const PRICE_MAX = 0.99;

export const clampPrice = (p: number): number =>
  Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.round(p * 1e4) / 1e4));

const isBackedTeam = (event: NormalizedTxLineEvent, market: Market): boolean =>
  Boolean(event.team && market.backedTeam && event.team.toLowerCase() === market.backedTeam.toLowerCase());

/** Extract an implied YES probability from an odds payload, if one exists. */
function impliedYesFromOdds(event: NormalizedTxLineEvent): number | null {
  const raw = event.raw;
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  for (const key of ["impliedYes", "implied_probability", "impliedProbability", "yesPrice", "probability"]) {
    const v = obj[key];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0 && n < 1) return n;
    if (Number.isFinite(n) && n > 1 && n <= 100) return n / 100;
  }
  // Decimal odds → implied probability.
  const odds = obj["decimalOdds"] ?? obj["odds"];
  const d = typeof odds === "number" ? odds : typeof odds === "string" ? Number(odds) : NaN;
  if (Number.isFinite(d) && d > 1) return 1 / d;
  return null;
}

/**
 * New fair YES price after an event lands on a market. Pure and total: events
 * that don't move this market return the previous fair value unchanged.
 */
export function computeFairValueFromEvent(
  event: NormalizedTxLineEvent,
  market: Market,
  previousFairYes: number
): number {
  switch (event.eventType) {
    case "GOAL": {
      if (market.kind === "OVER_UNDER") return clampPrice(previousFairYes + FAIR_SHIFTS.GOAL_TOTAL);
      if (market.kind === "WINNER") {
        const shift = isBackedTeam(event, market) ? FAIR_SHIFTS.GOAL_FOR : FAIR_SHIFTS.GOAL_AGAINST;
        return clampPrice(previousFairYes + shift);
      }
      return previousFairYes;
    }
    case "RED_CARD": {
      if (market.kind !== "WINNER") return previousFairYes;
      const shift = isBackedTeam(event, market) ? FAIR_SHIFTS.RED_CARD_BACKED : FAIR_SHIFTS.RED_CARD_OPPONENT;
      return clampPrice(previousFairYes + shift);
    }
    case "PENALTY": {
      if (market.kind !== "WINNER") return previousFairYes;
      const shift = isBackedTeam(event, market) ? FAIR_SHIFTS.PENALTY_FOR : FAIR_SHIFTS.PENALTY_AGAINST;
      return clampPrice(previousFairYes + shift);
    }
    case "ODDS_UPDATE": {
      const implied = impliedYesFromOdds(event);
      return implied !== null ? clampPrice(implied) : previousFairYes;
    }
    default:
      return previousFairYes;
  }
}
