import type { EscrowLedger, Order, OrderStatus } from "@/lib/escrow/types";

/**
 * Pure escrow transitions. Each function validates the order's current status
 * and moves real numbers between ledger buckets — "refunded" is an accounting
 * fact here, not a label.
 */

export interface EscrowTransition {
  ledger: EscrowLedger;
  order: Order;
}

const withStatus = (order: Order, status: OrderStatus): Order => ({ ...order, status });

/** submitted → escrowed: stake leaves the bot's available balance. */
export function escrowOrder(ledger: EscrowLedger, order: Order): EscrowTransition {
  if (order.status !== "submitted") return { ledger, order };
  if (ledger.botAvailableBalance < order.stakeUsd) return { ledger, order }; // insufficient funds — no-op
  return {
    ledger: {
      ...ledger,
      botAvailableBalance: ledger.botAvailableBalance - order.stakeUsd,
      escrowedAmount: ledger.escrowedAmount + order.stakeUsd,
    },
    order: withStatus(order, "escrowed"),
  };
}

/** escrowed → evaluating: funds stay locked while LineGuard rules. */
export function beginEvaluation(ledger: EscrowLedger, order: Order): EscrowTransition {
  if (order.status !== "escrowed") return { ledger, order };
  return { ledger, order: withStatus(order, "evaluating") };
}

/** evaluating → voided: guard killed the order; funds still in escrow until refund. */
export function voidOrder(ledger: EscrowLedger, order: Order): EscrowTransition {
  if (order.status !== "evaluating") return { ledger, order };
  return { ledger, order: withStatus(order, "voided") };
}

/** voided → refunded: escrow returns to the bot in full. Filled amount stays 0. */
export function refundOrder(ledger: EscrowLedger, order: Order): EscrowTransition {
  if (order.status !== "voided") return { ledger, order };
  return {
    ledger: {
      ...ledger,
      escrowedAmount: ledger.escrowedAmount - order.stakeUsd,
      botAvailableBalance: ledger.botAvailableBalance + order.stakeUsd,
      refundedAmount: ledger.refundedAmount + order.stakeUsd,
    },
    order: withStatus(order, "refunded"),
  };
}

/** evaluating → filled: escrow is consumed; protocol holds the stake as collateral. */
export function fillOrder(ledger: EscrowLedger, order: Order): EscrowTransition {
  if (order.status !== "evaluating") return { ledger, order };
  return {
    ledger: {
      ...ledger,
      escrowedAmount: ledger.escrowedAmount - order.stakeUsd,
      filledAmount: ledger.filledAmount + order.stakeUsd,
      protocolBalance: ledger.protocolBalance + order.stakeUsd,
    },
    order: withStatus(order, "filled"),
  };
}
