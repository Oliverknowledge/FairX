import { describe, expect, it } from "vitest";
import { beginEvaluation, escrowOrder, fillOrder, refundOrder, voidOrder } from "@/lib/escrow/engine";
import { INITIAL_LEDGER, ledgerBalances, type Order } from "@/lib/escrow/types";

const makeOrder = (): Order => ({
  id: "order-1",
  marketId: "eng-win",
  actor: "bot",
  side: "YES",
  stakeUsd: 500,
  observedPrice: 0.4,
  shares: 1250,
  status: "submitted",
  submittedAt: 0,
});

describe("escrow engine", () => {
  it("moves stake from available balance to escrow", () => {
    const { ledger, order } = escrowOrder(INITIAL_LEDGER, makeOrder());
    expect(order.status).toBe("escrowed");
    expect(ledger.escrowedAmount).toBe(500);
    expect(ledger.botAvailableBalance).toBe(INITIAL_LEDGER.botStartingBalance - 500);
    expect(ledgerBalances(ledger)).toBe(true);
  });

  it("refunds an escrowed→voided order correctly (filled stays 0)", () => {
    let step = escrowOrder(INITIAL_LEDGER, makeOrder());
    step = beginEvaluation(step.ledger, step.order);
    step = voidOrder(step.ledger, step.order);
    expect(step.order.status).toBe("voided");
    const { ledger, order } = refundOrder(step.ledger, step.order);

    expect(order.status).toBe("refunded");
    expect(ledger.refundedAmount).toBe(500);
    expect(ledger.filledAmount).toBe(0);
    expect(ledger.escrowedAmount).toBe(0);
    expect(ledger.botAvailableBalance).toBe(INITIAL_LEDGER.botStartingBalance); // whole again
    expect(ledgerBalances(ledger)).toBe(true);
  });

  it("consumes escrow when an order is filled", () => {
    let step = escrowOrder(INITIAL_LEDGER, makeOrder());
    step = beginEvaluation(step.ledger, step.order);
    const { ledger, order } = fillOrder(step.ledger, step.order);

    expect(order.status).toBe("filled");
    expect(ledger.filledAmount).toBe(500);
    expect(ledger.escrowedAmount).toBe(0);
    expect(ledger.protocolBalance).toBe(500);
    expect(ledger.refundedAmount).toBe(0);
    expect(ledgerBalances(ledger)).toBe(true);
  });

  it("is a no-op when transitions are applied out of order", () => {
    // Cannot refund an order that was never voided.
    const order = makeOrder();
    const { ledger, order: same } = refundOrder(INITIAL_LEDGER, order);
    expect(same.status).toBe("submitted");
    expect(ledger).toEqual(INITIAL_LEDGER);
  });

  it("refuses to escrow beyond available balance", () => {
    const poor = { ...INITIAL_LEDGER, botAvailableBalance: 100 };
    const { ledger, order } = escrowOrder(poor, makeOrder()); // stake 500 > 100
    expect(order.status).toBe("submitted"); // unchanged
    expect(ledger.escrowedAmount).toBe(0);
  });
});
