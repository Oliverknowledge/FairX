import { describe, expect, it } from "vitest";
import {
  evaluateGuardVerdict,
  evaluatePlacement,
  type CommittedMarketState,
  type ExecutionContext,
  type SignedOrderConstraints,
} from "@/lib/polymarket/execution";

const market = (o: Partial<CommittedMarketState> = {}): CommittedMarketState => ({
  oddsSequence: 5,
  pricedAtSeq: 3,
  materialSeq: 3,
  displayedPriceMicros: 411_250,
  fairPriceMicros: 411_250,
  oddsPayloadHash: "hash",
  toleranceMicros: 20_000,
  closeTimeSec: 2_000,
  tradingClosed: false,
  resolved: false,
  ...o,
});

const signed = (o: Partial<SignedOrderConstraints> = {}): SignedOrderConstraints => ({
  side: "YES",
  stakeLamports: 10_000_000,
  expectedExecutionPriceMicros: 411_250,
  maxSlippageMicros: 5_000,
  maxAcceptedEdgeMicros: 20_000,
  expectedPricingSequence: 3,
  expectedOddsSequence: 5,
  expirySlot: 100,
  ...o,
});

const ctx: ExecutionContext = { currentSlot: 50, nowSec: 1_000 };

describe("signed execution constraints (place_order_v2 mirror)", () => {
  it("accepts an order whose signed price matches the committed reference", () => {
    expect(evaluatePlacement(market(), signed(), ctx).accepted).toBe(true);
  });

  it("rejects a stale signed odds sequence", () => {
    expect(evaluatePlacement(market(), signed({ expectedOddsSequence: 4 }), ctx).rejection).toBe("ODDS_SEQUENCE_MISMATCH");
  });

  it("rejects a wrong pricing sequence", () => {
    expect(evaluatePlacement(market(), signed({ expectedPricingSequence: 2 }), ctx).rejection).toBe(
      "PRICING_SEQUENCE_MISMATCH"
    );
  });

  it("rejects slippage beyond the signed tolerance", () => {
    const r = evaluatePlacement(market({ displayedPriceMicros: 430_000 }), signed({ maxSlippageMicros: 5_000 }), ctx);
    expect(r.rejection).toBe("SLIPPAGE_EXCEEDED");
  });

  it("rejects an expired order (slot past expiry)", () => {
    expect(evaluatePlacement(market(), signed(), { ...ctx, currentSlot: 200 }).rejection).toBe("ORDER_EXPIRED");
  });

  it("rejects trading after close time", () => {
    expect(evaluatePlacement(market(), signed(), { ...ctx, nowSec: 3_000 }).rejection).toBe("PAST_CLOSE_TIME");
  });

  it("rejects a closed market", () => {
    expect(evaluatePlacement(market({ tradingClosed: true }), signed(), ctx).rejection).toBe("TRADING_CLOSED");
  });
});

describe("guard verdict (evaluate_order_v2 mirror)", () => {
  it("fills an in-sync order", () => {
    const v = evaluateGuardVerdict(market(), { side: "YES", observedPriceMicros: 411_250, pricedAtSeq: 3, maxAcceptedEdgeMicros: 20_000 });
    expect(v.verdict).toBe("FILLED");
    expect(v.stale).toBe(false);
  });

  it("voids+refunds a stale YES order that captures unfair edge", () => {
    const v = evaluateGuardVerdict(market({ materialSeq: 4, fairPriceMicros: 630_000 }), {
      side: "YES",
      observedPriceMicros: 400_000,
      pricedAtSeq: 3,
      maxAcceptedEdgeMicros: 20_000,
    });
    expect(v.verdict).toBe("VOIDED_REFUNDED");
    expect(v.edgeMicros).toBe(230_000);
  });

  it("allows a stale NO order that captures no edge", () => {
    const v = evaluateGuardVerdict(market({ materialSeq: 4, fairPriceMicros: 630_000 }), {
      side: "NO",
      observedPriceMicros: 600_000,
      pricedAtSeq: 3,
      maxAcceptedEdgeMicros: 20_000,
    });
    expect(v.verdict).toBe("FILLED");
  });

  it("lets the trader TIGHTEN protection below market tolerance", () => {
    const v = evaluateGuardVerdict(market({ materialSeq: 4, fairPriceMicros: 425_000 }), {
      side: "YES",
      observedPriceMicros: 411_250,
      pricedAtSeq: 3,
      maxAcceptedEdgeMicros: 5_000, // stricter than the 20_000 market tolerance
    });
    expect(v.acceptedEdgeMicros).toBe(5_000);
    expect(v.verdict).toBe("VOIDED_REFUNDED");
  });
});
