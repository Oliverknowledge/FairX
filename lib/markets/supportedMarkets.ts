import type { V2MarketSnapshot } from "@/lib/solana/lineguardV2";

/**
 * The typed registry of on-chain v2 markets FairX supports in the primary UX.
 *
 * This replaces the hard-coded `fairx-france-morocco-v2` assumption that used to
 * live inside `DevnetMarket`, `fetchV2MarketSnapshot`, and the market route.
 * Every surface now receives a `SupportedMarket` and derives its on-chain label,
 * PDA, and copy from it — no silent default to France–Morocco.
 *
 * Nothing here asserts a market is deployed or open. That is derived from
 * verified on-chain state at render time (see `isMarketOpenForTrading`).
 */

export type SupportedMarketState = "RESOLVED" | "PENDING_DEPLOYMENT";

export interface SupportedMarket {
  /** Route id under /markets/<slug>. */
  slug: string;
  /** On-chain market label — seeds `market-v2` PDA via `marketIdBytes(label)`. */
  label: string;
  state: SupportedMarketState;
  purpose: string;
  /** Whether a durable settled lifecycle fixture backs the resolved result card. */
  hasLifecycleEvidence: boolean;
  title: string;
  matchLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  /** Real numeric TxLINE fixture id (string form). Never a TXLINE-PENDING-* value. */
  txlineFixtureId: string;
  /** Approved Polymarket reference mapping id, when this market has one. */
  mappingId?: string;
}

/** Historical proof market — the settled, verified France–Morocco lifecycle. */
export const FRANCE_MOROCCO_MARKET: SupportedMarket = {
  slug: "france-morocco-france-win",
  label: "fairx-france-morocco-v2",
  state: "RESOLVED",
  purpose: "Proven settlement & protection lifecycle",
  hasLifecycleEvidence: true,
  title: "Will France win?",
  matchLabel: "France vs Morocco",
  homeTeam: "France",
  awayTeam: "Morocco",
  homeFlag: "🇫🇷",
  awayFlag: "🇲🇦",
  txlineFixtureId: "18209181",
};

/** Prepared live market — France–Spain, pending a reviewed initialization. */
export const FRANCE_SPAIN_MARKET: SupportedMarket = {
  slug: "france-spain-france-win",
  label: "fairx-france-spain-v2",
  state: "PENDING_DEPLOYMENT",
  purpose: "Live trading demo (pending initialization)",
  hasLifecycleEvidence: false,
  title: "Will France win?",
  matchLabel: "France vs Spain",
  homeTeam: "France",
  awayTeam: "Spain",
  homeFlag: "🇫🇷",
  awayFlag: "🇪🇸",
  txlineFixtureId: "18237038",
  mappingId: "fifwc-fra-esp-2026-07-14-france-win",
};

export const SUPPORTED_MARKETS: readonly SupportedMarket[] = [FRANCE_MOROCCO_MARKET, FRANCE_SPAIN_MARKET];

/** The market the primary Trade link points to when no live market is open. */
export const DEFAULT_TRADE_MARKET = FRANCE_MOROCCO_MARKET;

export function getSupportedMarketBySlug(slug: string | null | undefined): SupportedMarket | null {
  if (!slug) return null;
  return SUPPORTED_MARKETS.find((m) => m.slug === slug) ?? null;
}

export function getSupportedMarketByLabel(label: string): SupportedMarket | null {
  return SUPPORTED_MARKETS.find((m) => m.label === label) ?? null;
}

/**
 * Deterministic, on-chain-derived openness test. A market is open for trading
 * only when its account exists, is unresolved, trading is not closed, and the
 * current time is before its committed close time. Never trusts config alone.
 */
export function isMarketOpenForTrading(snapshot: V2MarketSnapshot | null, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  if (!snapshot || !snapshot.deployed || !snapshot.market) return false;
  const m = snapshot.market;
  return !m.resolved && !m.tradingClosed && nowSeconds < m.closeTime;
}

/**
 * The single activation rule for the primary Trade link. If the France–Spain
 * market is verifiably open on-chain, Trade routes there; otherwise it falls
 * back to the resolved France–Morocco proof market. The caller supplies the
 * live France–Spain snapshot (or null when unknown), so activation always
 * derives from verified state, not an environment variable.
 */
export function selectActiveTradeMarket(
  franceSpainSnapshot: V2MarketSnapshot | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SupportedMarket {
  return isMarketOpenForTrading(franceSpainSnapshot, nowSeconds) ? FRANCE_SPAIN_MARKET : DEFAULT_TRADE_MARKET;
}
