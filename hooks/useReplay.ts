"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/lib/terminal/actions";
import type { Mode, TerminalState } from "@/lib/terminal/state";
import { isStale } from "@/lib/markets/types";
import { DEMO_GOAL_EVENT, stampDemoEvent } from "@/lib/txline/demoFeed";

/**
 * Replay orchestration. ALL timers live here, never in the reducer. A run
 * token invalidates in-flight timers the instant reset (or a new run) fires,
 * so the scripted sequence can always be cancelled cleanly.
 *
 * The demo maps 1:1 onto reducer actions — the same actions live mode would
 * dispatch — so nothing about the mechanism is faked for the replay.
 */

type Timed = { action: (at: number) => Action; delayMs: number };

/** The five judge-visible phases, each expanding to its reducer sub-actions. */
const PHASES: Array<{ label: string; steps: Timed[] }> = [
  {
    label: "Goal happens",
    steps: [{ action: () => ({ type: "GOAL_ON_PITCH" }), delayMs: 600 }],
  },
  {
    label: "TxLINE event ingested",
    steps: [{ action: (at) => ({ type: "INGEST_TXLINE_EVENT", event: stampDemoEvent(DEMO_GOAL_EVENT, at), at }), delayMs: 1500 }],
  },
  {
    label: "Bot attacks stale price",
    steps: [
      { action: (at) => ({ type: "BOT_PREPARE_ORDER", at }), delayMs: 1300 },
      { action: (at) => ({ type: "BOT_SUBMIT_ORDER", at }), delayMs: 1000 },
      { action: () => ({ type: "ESCROW_ORDER" }), delayMs: 800 },
      { action: () => ({ type: "EVALUATE_ORDER" }), delayMs: 650 },
    ],
  },
  {
    label: "LineGuard rules",
    steps: [
      { action: (at) => ({ type: "REVEAL_VERDICT", at }), delayMs: 1200 },
      { action: () => ({ type: "REFUND_ORDER" }), delayMs: 900 },
      { action: (at) => ({ type: "CREATE_RECEIPT", at }), delayMs: 800 },
      { action: (at) => ({ type: "VERIFY_RECEIPT", at }), delayMs: 800 },
    ],
  },
  {
    label: "Market reprices",
    steps: [{ action: (at) => ({ type: "REPRICE_MARKET", at }), delayMs: 1400 }],
  },
];

export const PHASE_LABELS = PHASES.map((p) => p.label);

/** How many phases are complete, derived purely from state (drives the stepper). */
export function completedPhases(state: TerminalState): number {
  const repriced = state.market.materialSeq >= 2 && state.market.pricedAtSeq >= state.market.materialSeq;
  if (repriced) return 5;
  if (state.verdict) return 4;
  if (state.order) return 3;
  if (isStale(state.market)) return 2;
  if (state.goalOnPitch) return 1;
  return 0;
}

export function useReplay(dispatch: React.Dispatch<Action>, mode: Mode) {
  const [playing, setPlaying] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const token = useRef(0);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /** Schedule a list of timed actions from `startAt`, guarded by the current token. */
  const schedule = useCallback((steps: Timed[], onDone?: () => void) => {
    const myToken = token.current;
    let elapsed = 0;
    steps.forEach(({ action, delayMs }, i) => {
      elapsed += delayMs;
      const isLast = i === steps.length - 1;
      timers.current.push(
        setTimeout(() => {
          if (token.current !== myToken) return;
          dispatchRef.current(action(Date.now()));
          if (isLast) onDone?.();
        }, elapsed)
      );
    });
  }, []);

  const reset = useCallback(() => {
    token.current += 1;
    clearTimers();
    setPlaying(false);
    dispatchRef.current({ type: "RESET_DEMO", mode });
  }, [clearTimers, mode]);

  const runFull = useCallback(() => {
    token.current += 1;
    clearTimers();
    dispatchRef.current({ type: "RESET_DEMO", mode });
    setPlaying(true);
    const allSteps = PHASES.flatMap((p) => p.steps);
    schedule(allSteps, () => setPlaying(false));
  }, [clearTimers, mode, schedule]);

  /** Run a single phase's sub-sequence (manual stepping / debugging). */
  const runPhase = useCallback(
    (phaseIndex: number) => {
      const phase = PHASES[phaseIndex];
      if (!phase) return;
      token.current += 1;
      clearTimers();
      setPlaying(true);
      // Fire the phase's steps immediately-ish (small stagger keeps escrow states visible).
      schedule(phase.steps, () => setPlaying(false));
    },
    [clearTimers, schedule]
  );

  return { playing, runFull, runPhase, reset };
}
