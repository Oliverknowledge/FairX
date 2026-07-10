import { readMarket, sniperEconomics } from "@/lib/bot/sniper";
import { beginEvaluation, escrowOrder, fillOrder, refundOrder, voidOrder } from "@/lib/escrow/engine";
import type { Order } from "@/lib/escrow/types";
import { cents, evaluateLineGuard } from "@/lib/lineguard/evaluate";
import { ingestEvent, repriceMarket } from "@/lib/markets/engine";
import { displayedSidePrice, isStale, type Side } from "@/lib/markets/types";
import { createReceipt, type ReceiptDraft } from "@/lib/receipts/create";
import { verifyReceipt } from "@/lib/receipts/verify";
import type { Action } from "@/lib/terminal/actions";
import {
  BOT_STAKE_USD,
  createInitialState,
  usd,
  type LogEntry,
  type TerminalState,
} from "@/lib/terminal/state";

/**
 * The demo state machine. Pure and deterministic: same (state, action) →
 * same next state, always. Network and timers live in the hook layer and only
 * dispatch actions. THE LineGuard decision is made in exactly one place —
 * REVEAL_VERDICT — via the pure evaluateLineGuard(). Escrow transitions and
 * receipt creation are likewise explicit, single-site, and ledger-accurate.
 */

function pushLog(state: TerminalState, tone: LogEntry["tone"], text: string): { log: LogEntry[]; logSeq: number } {
  const logSeq = state.logSeq + 1;
  return { log: [{ id: `log-${logSeq}`, tone, text }, ...state.log], logSeq };
}

const sideLabel = (side: Side): string => side;

export function reducer(state: TerminalState, action: Action): TerminalState {
  switch (action.type) {
    case "RESET_DEMO":
      return createInitialState(action.mode ?? state.mode);

    case "SET_MODE": {
      if (action.mode === state.mode) return state;
      // Switching mode resets the scenario so live/demo never interleave.
      const fresh = createInitialState(action.mode);
      return { ...fresh, txline: { ...fresh.txline, health: state.txline.health } };
    }

    case "SET_HEALTH":
      return { ...state, txline: { ...state.txline, health: action.health } };

    case "TXLINE_CONNECTING":
      return {
        ...state,
        txline: { ...state.txline, [action.stream]: "connecting", error: null, lastConnectionAttemptAt: action.at },
      };

    case "TXLINE_CONNECTED":
      return { ...state, txline: { ...state.txline, [action.stream]: "live", error: null } };

    case "TXLINE_ERROR":
      return { ...state, txline: { ...state.txline, [action.stream]: "error", error: action.error, lastErrorAt: action.at } };

    case "TXLINE_STATUS":
      return { ...state, txline: { ...state.txline, [action.stream]: action.status } };

    case "TXLINE_RAW":
      return {
        ...state,
        txline: { ...state.txline, lastRaw: action.raw, lastPayloadStream: action.stream, lastPayloadAt: action.at },
      };

    // Demo-only affordance: broadcast sees the goal; officiated feed hasn't published.
    case "GOAL_ON_PITCH": {
      if (state.goalOnPitch || isStale(state.market)) return state;
      return {
        ...state,
        goalOnPitch: true,
        ...pushLog(state, "amber", "⚽ Goal on the pitch — Saka scores. Awaiting officiated TxLINE event…"),
      };
    }

    // The single event that drives everything. Works identically for live and demo.
    case "INGEST_TXLINE_EVENT": {
      const { event, at } = action;
      const result = ingestEvent(state.market, event, at);
      const events = [...state.events, event];
      const txline = {
        ...state.txline,
        lastEvent: event,
        lastRaw: event.raw,
        eventsSeen: state.txline.eventsSeen + 1,
      };

      if (!result.material) {
        return {
          ...state,
          events,
          txline,
          ...pushLog(state, "neutral", `TxLINE seq ${event.seq} · ${event.eventType} — not material to ${state.market.title}. Market unaffected.`),
        };
      }

      const fair = result.market.fairYes;
      return {
        ...state,
        market: result.market,
        events,
        txline,
        ...pushLog(
          state,
          "amber",
          `TxLINE seq ${event.seq} · ${event.eventType}${event.player ? ` (${event.player})` : ""}. Fair ${state.market.title.includes("Over") ? "OVER" : "YES"} → ${cents(fair)}, displayed still ${cents(state.market.yes)}. STALE WINDOW OPEN.`
        ),
      };
    }

    // Explicit stale-window marker (replay uses it; ingest already opens it).
    case "OPEN_STALE_WINDOW":
      return state;

    case "SET_BOT_SIDE": {
      if (state.order) return state; // locked once an order exists
      return { ...state, botSide: action.side };
    }

    // Bot reads the stale market and prepares (attack-ready highlight), no order yet.
    case "BOT_PREPARE_ORDER": {
      if (!isStale(state.market) || state.order) return state;
      const reading = readMarket(state.market, state.botSide, state.tolerance, BOT_STAKE_USD);
      return {
        ...state,
        botPlan: { ...reading, detectedAt: action.at },
        ...pushLog(
          state,
          reading.attackReady ? "red" : "amber",
          reading.attackReady
            ? `🤖 Sniper detects +${cents(reading.edge)} stale edge on ${sideLabel(reading.side)} @ ${cents(reading.observedPrice)} — attack ready.`
            : `🤖 Sniper: ${sideLabel(reading.side)} side shows ${cents(reading.edge)} edge — below tolerance, no attack.`
        ),
      };
    }

    // Bot submits its attack. Price is frozen on the order here.
    case "BOT_SUBMIT_ORDER": {
      if (!isStale(state.market) || state.order) return state;
      const observedPrice = displayedSidePrice(state.market.yes, state.botSide);
      const order: Order = {
        id: `order-${action.at}`,
        marketId: state.market.id,
        actor: "bot",
        side: state.botSide,
        stakeUsd: BOT_STAKE_USD,
        observedPrice,
        shares: observedPrice > 0 ? BOT_STAKE_USD / observedPrice : 0,
        status: "submitted",
        submittedAt: action.at,
      };
      return {
        ...state,
        order,
        ...pushLog(state, "red", `🤖 Bot submits ${sideLabel(order.side)} ${usd(order.stakeUsd)} @ ${cents(order.observedPrice)} on ${state.market.title}.`),
      };
    }

    // submitted → escrowed: stake moves out of the bot's available balance.
    case "ESCROW_ORDER": {
      if (!state.order || state.order.status !== "submitted") return state;
      const { ledger, order } = escrowOrder(state.ledger, state.order);
      return {
        ...state,
        ledger,
        order,
        ...pushLog(state, "amber", `Stake ${usd(order.stakeUsd)} moved to escrow · available ${usd(ledger.botAvailableBalance)} · LineGuard evaluating…`),
      };
    }

    // escrowed → evaluating: funds locked while the guard runs.
    case "EVALUATE_ORDER": {
      if (!state.order || state.order.status !== "escrowed") return state;
      const { ledger, order } = beginEvaluation(state.ledger, state.order);
      return { ...state, ledger, order };
    }

    // THE decision. One call to the pure guard; nothing else evaluates fairness.
    case "REVEAL_VERDICT": {
      const order = state.order;
      if (!order || order.status !== "evaluating" || state.verdict) return state;
      const { market, tolerance } = state;

      const verdict = evaluateLineGuard({
        side: order.side,
        observedPrice: order.observedPrice,
        fairYes: market.fairYes,
        materialSeq: market.materialSeq,
        pricedAtSeq: market.pricedAtSeq,
        tolerance,
        orderId: order.id,
        marketId: market.id,
        actor: order.actor,
        timestamp: action.at,
      });

      const voided = verdict.verdict === "VOIDED_REFUNDED";
      const { ledger, order: ruledOrder } = voided
        ? voidOrder(state.ledger, order) // → "voided"; refund happens in REFUND_ORDER
        : fillOrder(state.ledger, order); // → "filled"; escrow consumed now

      return {
        ...state,
        ledger,
        order: ruledOrder,
        verdict,
        verdictContext: {
          materialSeq: market.materialSeq,
          pricedAtSeq: market.pricedAtSeq,
          fairYes: market.fairYes,
          event: market.lastMaterialEvent,
        },
        ...pushLog(
          state,
          voided ? "red" : "green",
          voided
            ? `🛡 LineGuard VOIDS the order — +${cents(verdict.edge)} unfair edge > ${cents(tolerance)} tolerance. Refund pending.`
            : `🛡 LineGuard allows the order — ${verdict.verdict} (edge ${cents(verdict.edge)} ≤ tolerance). Escrow consumed, order filled.`
        ),
      };
    }

    // voided → refunded: escrow returns to the bot in full.
    case "REFUND_ORDER": {
      if (!state.order || state.order.status !== "voided") return state;
      const { ledger, order } = refundOrder(state.ledger, state.order);
      return {
        ...state,
        ledger,
        order,
        ...pushLog(state, "green", `Escrow ${usd(order.stakeUsd)} refunded to bot · available back to ${usd(ledger.botAvailableBalance)} · filled ${usd(ledger.filledAmount)}.`),
      };
    }

    // Explicit finalize for allowed orders (already filled at reveal; kept for the replay script + symmetry).
    case "FILL_ORDER": {
      if (!state.order || state.order.status !== "evaluating") return state;
      const { ledger, order } = fillOrder(state.ledger, state.order);
      return { ...state, ledger, order, ...pushLog(state, "green", `Order filled · ${usd(order.stakeUsd)} consumed from escrow.`) };
    }

    // Receipt sealed AFTER the verdict, hashing the exact registers + edge that produced it.
    case "CREATE_RECEIPT": {
      if (!state.verdict || !state.order || state.receipt) return state;
      const { verdict, order, market, verdictContext } = state;
      const ev = verdictContext?.event ?? market.lastMaterialEvent;
      const draft: ReceiptDraft = {
        marketId: market.id,
        marketTitle: market.title,
        fixtureId: market.fixtureId,
        orderId: order.id,
        actor: order.actor,
        side: order.side,
        stake: order.stakeUsd,
        stakeUnit: "SANDBOX",
        observedPrice: verdict.observedPrice,
        fairSidePrice: verdict.fairSidePrice,
        fairYes: verdictContext?.fairYes ?? market.fairYes,
        materialSeq: verdictContext?.materialSeq ?? market.materialSeq,
        pricedAtSeq: verdictContext?.pricedAtSeq ?? market.pricedAtSeq,
        staleness: verdict.staleness,
        edge: verdict.edge,
        tolerance: state.tolerance,
        verdict: verdict.verdict,
        reason: verdict.reason,
        txlineEventSeq: ev?.seq,
        txlineEventType: ev?.eventType,
        txlineTimestamp: ev?.ts,
        sourceMode: ev?.source === "live" ? "live" : ev?.source === "captured" ? "captured" : "guided",
        sourceEndpoint: ev?.source === "live" ? "TxLINE via FairX server proxy" : ev?.source === "captured" ? "Captured payload replay" : "FairX guided scenario generator",
        proofStatus: ev?.proofStatus ?? "simulated",
        createdAt: action.at,
        onChain: state.onChainProof ?? undefined,
      };
      const receipt = createReceipt(draft);
      return {
        ...state,
        receipt,
        ...pushLog(state, "blue", `Receipt ${receipt.receiptId} sealed · sha256 ${receipt.receiptHash.slice(0, 12)}… — portable proof of the verdict.`),
      };
    }

    case "ATTACH_ONCHAIN_PROOF": {
      if (!state.receipt) return { ...state, onChainProof: action.proof };
      const { receiptHash: _receiptHash, receiptId: _receiptId, ...draft } = state.receipt;
      const receipt = createReceipt({ ...draft, onChain: action.proof });
      return {
        ...state,
        onChainProof: action.proof,
        receipt,
        ...pushLog(state, "blue", `On-chain verdict linked · tx ${action.proof.txSignatures.at(-1)?.slice(0, 10) ?? "—"}… added to the receipt hash.`),
      };
    }

    case "CLEAR_ONCHAIN_PROOF": {
      if (!state.receipt) return { ...state, onChainProof: null };
      const { receiptHash: _receiptHash, receiptId: _receiptId, onChain: _onChain, ...draft } = state.receipt;
      const receipt = createReceipt(draft);
      return {
        ...state,
        onChainProof: null,
        receipt,
        ...pushLog(state, "neutral", "On-chain proof cleared from the local receipt."),
      };
    }

    case "VERIFY_RECEIPT": {
      if (!state.receipt) return state;
      const receiptVerification = verifyReceipt(state.receipt, action.at);
      return {
        ...state,
        receiptVerification,
        ...pushLog(
          state,
          receiptVerification.valid ? "green" : "red",
          receiptVerification.valid
            ? `✓ Receipt verified — recomputed hash matches. The verdict is tamper-evident.`
            : `✗ Receipt verification FAILED — recomputed hash differs. Receipt was altered.`
        ),
      };
    }

    // Market maker reprices: displayed price catches up to fair, window closes.
    case "REPRICE_MARKET": {
      if (!isStale(state.market)) return state;
      const market = repriceMarket(state.market, action.at);
      return {
        ...state,
        market,
        ...pushLog(state, "blue", `Market repriced → ${cents(market.yes)} · pricedAtSeq → ${market.pricedAtSeq}. In sync, stale window closed. Fair trading resumes.`),
      };
    }

    case "RUN_REPLAY_STEP":
      return state; // orchestration marker; concrete steps dispatch their own actions

    default:
      return state;
  }
}

/** Guard against reducer/UI drift — is `isStale` consistent with lifecycle stage? (tests/dev) */
export function invariantStaleConsistent(state: TerminalState): boolean {
  const stale = isStale(state.market);
  const hasMaterialEvent = state.market.materialSeq > 1;
  const repriced = state.market.pricedAtSeq >= state.market.materialSeq;
  return stale ? hasMaterialEvent && !repriced : !hasMaterialEvent || repriced;
}
