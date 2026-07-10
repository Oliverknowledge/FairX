import { describe, expect, it } from "vitest";
import { eventImpactsMarket } from "@/lib/markets/materiality";
import { computeFairValueFromEvent } from "@/lib/markets/fairValue";
import { ingestEvent } from "@/lib/markets/engine";
import type { Market } from "@/lib/markets/types";
import type { NormalizedTxLineEvent } from "@/lib/txline/types";

const FIXTURE = "ENG-FRA-2026-QF";

const overMarket: Market = {
  id: "over-2.5",
  title: "Over 2.5 total goals",
  resolutionNote: "Resolves OVER if 3+ goals are scored.",
  kind: "OVER_UNDER",
  fixtureId: FIXTURE,
  line: 2.5,
  yes: 0.5,
  fairYes: 0.5,
  materialSeq: 1,
  pricedAtSeq: 1,
  status: "trading",
  lastMaterialEvent: null,
  lastReprice: null,
  staleOpenedAt: null,
};

const winnerMarket: Market = {
  ...overMarket,
  id: "eng-win",
  title: "England wins",
  kind: "WINNER",
  backedTeam: "England",
  line: undefined,
  yes: 0.4,
  fairYes: 0.4,
};

const event = (over: Partial<NormalizedTxLineEvent>): NormalizedTxLineEvent => ({
  provider: "TXLINE",
  source: "demo",
  fixtureId: FIXTURE,
  seq: 2,
  ts: 1_700_000_000_000,
  eventType: "GOAL",
  raw: {},
  proofStatus: "simulated",
  trace: { seqField: "seq", tsField: "ts", eventTypeField: "eventType", eventTypeMethod: "explicit" },
  ...over,
});

describe("market materiality", () => {
  it("GOAL impacts an Over 2.5 goals market", () => {
    expect(eventImpactsMarket(event({ eventType: "GOAL" }), overMarket)).toBe(true);
  });

  it("GOAL impacts a match-winner market", () => {
    expect(eventImpactsMarket(event({ eventType: "GOAL", team: "England" }), winnerMarket)).toBe(true);
  });

  it("UNKNOWN event does not impact any market", () => {
    expect(eventImpactsMarket(event({ eventType: "UNKNOWN" }), overMarket)).toBe(false);
    expect(eventImpactsMarket(event({ eventType: "UNKNOWN" }), winnerMarket)).toBe(false);
  });

  it("RED_CARD impacts winner but not over/under", () => {
    expect(eventImpactsMarket(event({ eventType: "RED_CARD" }), winnerMarket)).toBe(true);
    expect(eventImpactsMarket(event({ eventType: "RED_CARD" }), overMarket)).toBe(false);
  });

  it("events from another fixture never impact the market", () => {
    expect(eventImpactsMarket(event({ fixtureId: "OTHER" }), winnerMarket)).toBe(false);
  });

  it("a backed-team goal raises winner fair value by +23¢", () => {
    const fair = computeFairValueFromEvent(event({ eventType: "GOAL", team: "England" }), winnerMarket, 0.4);
    expect(fair).toBeCloseTo(0.63, 5);
  });

  it("a goal pushes an over/under market toward OVER", () => {
    const fair = computeFairValueFromEvent(event({ eventType: "GOAL" }), overMarket, 0.5);
    expect(fair).toBeGreaterThan(0.5);
  });

  it("ingesting a material event opens the stale window without moving displayed price", () => {
    const { market, material, openedStaleWindow } = ingestEvent(winnerMarket, event({ team: "England" }), 123);
    expect(material).toBe(true);
    expect(openedStaleWindow).toBe(true);
    expect(market.materialSeq).toBe(2);
    expect(market.pricedAtSeq).toBe(1); // unchanged — the gap IS the stale window
    expect(market.yes).toBe(0.4); // displayed price untouched
    expect(market.fairYes).toBeCloseTo(0.63, 5);
    expect(market.staleOpenedAt).toBe(123);
  });

  it("ingesting an UNKNOWN event leaves the market untouched", () => {
    const { market, material } = ingestEvent(winnerMarket, event({ eventType: "UNKNOWN" }), 123);
    expect(material).toBe(false);
    expect(market).toBe(winnerMarket); // same reference — no change
  });
});
