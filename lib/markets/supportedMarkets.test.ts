import { describe, expect, it } from "vitest";
import {
  FRANCE_MOROCCO_MARKET,
  FRANCE_SPAIN_MARKET,
  getSupportedMarketBySlug,
  getSupportedMarketByLabel,
  isMarketOpenForTrading,
  selectActiveTradeMarket,
} from "@/lib/markets/supportedMarkets";
import type { MarketV2State, V2MarketSnapshot } from "@/lib/solana/lineguardV2";

const NOW = 1_784_000_000; // seconds, before the France–Spain kickoff

function marketState(over: Partial<MarketV2State>): MarketV2State {
  return {
    address: "M", authorityConfig: "A", marketIdHex: "00", fixtureId: 18237038, templateId: 1,
    oddsPayloadHash: "00", oddsSequence: 1, materialSeq: 1, pricedAtSeq: 1,
    displayedPriceMicros: 411_250, fairPriceMicros: 411_250, toleranceMicros: 20_000,
    closeTime: NOW + 10_000, claimDeadline: 0, yesPoolLamports: 0, noPoolLamports: 0,
    claimedWinningLamports: 0, resolution: 0, tradingClosed: false, resolved: false,
    resolvedAt: 0, validationPayloadHash: "00", resolutionEventHash: "00",
    yesShares: 0, noShares: 0, claimedWinningShares: 0, ...over,
  };
}
function snapshot(deployed: boolean, market: MarketV2State | null): V2MarketSnapshot {
  return { deployed, marketPda: "P", vaultPda: "V", market, vault: null };
}

describe("supported-market registry", () => {
  it("keeps the France–Morocco historical proof route intact", () => {
    const fm = getSupportedMarketBySlug("france-morocco-france-win");
    expect(fm).toEqual(FRANCE_MOROCCO_MARKET);
    expect(fm?.state).toBe("RESOLVED");
    expect(fm?.hasLifecycleEvidence).toBe(true);
    expect(fm?.label).toBe("fairx-france-morocco-v2");
  });

  it("exposes France–Spain as a pending, non-evidence market bound to the real fixture", () => {
    const fs = getSupportedMarketBySlug("france-spain-france-win");
    expect(fs).toEqual(FRANCE_SPAIN_MARKET);
    expect(fs?.state).toBe("PENDING_DEPLOYMENT");
    expect(fs?.hasLifecycleEvidence).toBe(false);
    expect(fs?.txlineFixtureId).toBe("18237038");
  });

  it("resolves by label and rejects unknown slugs", () => {
    expect(getSupportedMarketByLabel("fairx-france-spain-v2")).toEqual(FRANCE_SPAIN_MARKET);
    expect(getSupportedMarketBySlug("../secret")).toBeNull();
  });
});

describe("on-chain-derived Trade activation", () => {
  it("absent market account → not open → Trade stays France–Morocco", () => {
    expect(isMarketOpenForTrading(null, NOW)).toBe(false);
    expect(isMarketOpenForTrading(snapshot(false, null), NOW)).toBe(false);
    expect(selectActiveTradeMarket(null, NOW)).toEqual(FRANCE_MOROCCO_MARKET);
    expect(selectActiveTradeMarket(snapshot(false, null), NOW)).toEqual(FRANCE_MOROCCO_MARKET);
  });

  it("deployed but resolved / trading-closed / past close → not open → France–Morocco", () => {
    expect(isMarketOpenForTrading(snapshot(true, marketState({ resolved: true })), NOW)).toBe(false);
    expect(isMarketOpenForTrading(snapshot(true, marketState({ tradingClosed: true })), NOW)).toBe(false);
    expect(isMarketOpenForTrading(snapshot(true, marketState({ closeTime: NOW - 1 })), NOW)).toBe(false);
    expect(selectActiveTradeMarket(snapshot(true, marketState({ resolved: true })), NOW)).toEqual(FRANCE_MOROCCO_MARKET);
  });

  it("deployed and genuinely open → Trade activates France–Spain", () => {
    const open = snapshot(true, marketState({ resolved: false, tradingClosed: false, closeTime: NOW + 100 }));
    expect(isMarketOpenForTrading(open, NOW)).toBe(true);
    expect(selectActiveTradeMarket(open, NOW)).toEqual(FRANCE_SPAIN_MARKET);
    expect(selectActiveTradeMarket(open, NOW).slug).toBe("france-spain-france-win");
  });
});
