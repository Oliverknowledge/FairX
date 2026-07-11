import { describe, expect, it } from "vitest";
import { getMarketById, getMarketCatalog, marketCatalog } from "@/lib/markets/catalog";
import { createFairXMarket, validateFairXMarketInput } from "@/lib/markets/createMarket";
import { applyMarketEvent, createGuardedOrder, previewGuardedOrder, repriceFairXMarket } from "@/lib/markets/routes";
import { verifyReceipt } from "@/lib/receipts/verify";
import {
  FAIRX_LAST_RECEIPT_STORAGE_KEY,
  FAIRX_RECEIPTS_STORAGE_KEY,
  FAIRX_STORAGE_KEY,
  loadFairXStore,
  saveFairXStore,
  type FairXStorageLike,
} from "@/lib/markets/store";

class MemoryStorage implements FairXStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("FairX catalog and creation", () => {
  it("ships a controlled catalog and never exposes mutable seed references", () => {
    expect(marketCatalog.map((market) => market.id)).toEqual(
      expect.arrayContaining(["eng-win", "eng-fra-over-2-5", "next-goal-england", "france-red-card-impact"])
    );

    const copy = getMarketCatalog();
    copy[0].title = "mutated copy";
    expect(marketCatalog[0].title).toBe("France wins");
  });

  it("validates and creates a local creator market without claiming on-chain initialization", () => {
    const input = {
      title: "England reaches extra time",
      fixtureId: "ENG-FRA-2026-QF",
      type: "CUSTOM_YES_NO" as const,
      targetSide: "Extra time occurs",
      displayedPrice: 0.36,
      tolerance: 0.02,
      materialityRules: { goals: true, redCards: false, penalties: true, oddsUpdates: true },
      source: "demo" as const,
    };
    expect(validateFairXMarketInput(input).valid).toBe(true);

    const market = createFairXMarket(input, { id: "creator-extra-time", now: 123 });
    expect(market).toMatchObject({
      id: "creator-extra-time",
      status: "TRADING",
      displayedPrice: 0.36,
      fairPrice: 0.36,
      materialSeq: 1,
      pricedAtSeq: 1,
      createdBy: "user",
      onChain: { initialized: false },
    });
  });

  it("rejects a market with no active materiality rule", () => {
    const result = validateFairXMarketInput({
      title: "No guard market",
      type: "CUSTOM_YES_NO",
      targetSide: "Something happens",
      displayedPrice: 0.5,
      tolerance: 0.02,
      materialityRules: { goals: false, redCards: false, penalties: false, oddsUpdates: false },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.materialityRules).toMatch(/at least one/i);
  });
});

describe("FairX guarded order simulation", () => {
  it("opens a stale window without changing the displayed quote, then reprices it", () => {
    const market = getMarketById("eng-win");
    expect(market).not.toBeNull();
    const result = applyMarketEvent(market!, { eventType: "GOAL", team: "England", seq: 2, source: "demo" }, 1_000);

    expect(result.material).toBe(true);
    expect(result.openedStaleWindow).toBe(true);
    expect(result.market.displayedPrice).toBe(0.4);
    expect(result.market.fairPrice).toBeCloseTo(0.63, 5);
    expect(result.market).toMatchObject({ status: "STALE", materialSeq: 2, pricedAtSeq: 1 });

    const repriced = repriceFairXMarket(result.market, 1_200);
    expect(repriced).toMatchObject({ status: "TRADING", displayedPrice: 0.63, fairPrice: 0.63, materialSeq: 2, pricedAtSeq: 2, staleOpenedAt: null });
  });

  it("uses the shared LineGuard evaluator to predict a stale YES refund and NO fill", () => {
    const market = getMarketById("eng-win")!;
    const stale = applyMarketEvent(market, { eventType: "GOAL", team: "England", seq: 2 }, 1_000).market;

    const yes = previewGuardedOrder(stale, { side: "YES", stake: 100, id: "preview-yes", timestamp: 1_010 });
    const no = previewGuardedOrder(stale, { side: "NO", stake: 100, id: "preview-no", timestamp: 1_010 });

    expect(yes).toMatchObject({ observedPrice: 0.4, fairSidePrice: 0.63, edge: 0.23, verdict: "VOIDED_REFUNDED", wouldRefund: true, wouldFill: false });
    expect(no).toMatchObject({ observedPrice: 0.6, fairSidePrice: 0.37, edge: -0.23, verdict: "STALE_ALLOWED_NO_EDGE", wouldRefund: false, wouldFill: true });
  });

  it("freezes the observed price and seals a tamper-evident local receipt", () => {
    const stale = applyMarketEvent(getMarketById("eng-win")!, { eventType: "GOAL", team: "England", seq: 2 }, 1_000).market;
    const created = createGuardedOrder(stale, { side: "YES", stake: 125, id: "fairx-order-yes", executionMode: "local_simulation" }, 1_010);

    expect(created.order).toMatchObject({
      id: "fairx-order-yes",
      observedPrice: 0.4,
      fairSidePrice: 0.63,
      status: "refunded",
      verdict: "VOIDED_REFUNDED",
      executionMode: "local_simulation",
      receiptId: "rcpt-fairx-order-yes",
    });
    expect(verifyReceipt(created.receipt, 1_020).valid).toBe(true);
    expect(verifyReceipt({ ...created.receipt, edge: 0.01 }, 1_020).valid).toBe(false);
  });
});

describe("FairX local persistence", () => {
  it("persists a receipt-ready catalog snapshot and remains SSR-safe without storage", () => {
    const noStorage = loadFairXStore(null);
    expect(noStorage.hydrated).toBe(false);
    expect(noStorage.markets).toHaveLength(marketCatalog.length);

    const memory = new MemoryStorage();
    const original = loadFairXStore(memory);
    const created = createFairXMarket(
      {
        title: "Stored creator market",
        type: "CUSTOM_YES_NO",
        targetSide: "A controlled outcome",
        displayedPrice: 0.52,
        tolerance: 0.02,
        materialityRules: { goals: true, redCards: false, penalties: false, oddsUpdates: true },
      },
      { id: "stored-creator", now: 10 }
    );
    const order = createGuardedOrder(created, { side: "YES", stake: 10, id: "stored-order" }, 20);
    const snapshot = {
      ...original,
      markets: [...original.markets, created],
      orders: [order.order],
      receipts: [order.receipt],
      hydrated: true,
    };

    expect(saveFairXStore(snapshot, memory)).toBe(true);
    expect(memory.getItem(FAIRX_STORAGE_KEY)).toBeTruthy();
    expect(memory.getItem(FAIRX_RECEIPTS_STORAGE_KEY)).toContain("rcpt-stored-order");
    expect(memory.getItem(FAIRX_LAST_RECEIPT_STORAGE_KEY)).toContain("rcpt-stored-order");

    const reloaded = loadFairXStore(memory);
    expect(reloaded.hydrated).toBe(true);
    expect(reloaded.markets.find((market) => market.id === "stored-creator")?.title).toBe("Stored creator market");
    expect(reloaded.orders[0]?.observedPrice).toBe(0.52);
    expect(verifyReceipt(reloaded.receipts[0], 30).valid).toBe(true);
  });
});
