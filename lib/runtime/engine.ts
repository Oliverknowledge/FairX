import type { MarketSide, RuntimeScenario } from "@/lib/runtime/scenarios";

export const RUNTIME_STAGE_COUNT = 7;

export type GuardDecision = "STALE_SEQUENCE_RETURNED" | "ACCEPTED";
export type MarketHealth = "HEALTHY" | "STALE" | "RECOVERING";

export const RUNTIME_STAGE_LABELS = [
  "Market healthy",
  "TxLINE event advances sequence",
  "Stale order arrives",
  "Principal returned",
  "Quote recovering",
  "Synchronized retry accepted",
  "Settlement verified",
] as const;

export function runtimeStageLabels(scenario: RuntimeScenario): readonly string[] {
  void scenario;
  return RUNTIME_STAGE_LABELS;
}

export type RuntimeState = {
  stage: number;
  title: string;
  score: [number, number];
  clock: string;
  eventSequence: number;
  quoteSequence: number;
  sequenceDelta: number;
  yesPrice: number;
  noPrice: number;
  synchronized: boolean;
  health: MarketHealth;
  staleWindow: "CLOSED" | "OPEN" | "RECOVERING" | "RECOVERED";
  marketStatus: "OPEN" | "SETTLED";
  orderVisible: boolean;
  decision: GuardDecision | null;
  orderId: string | null;
  orderActor: string | null;
  orderSide: MarketSide | null;
  orderStakeSol: number;
  orderSequence: number | null;
  illustrativePriceMove: number;
  returnedSol: number;
  acceptedSol: number;
  liabilitySol: number;
  proofAvailable: boolean;
};

export function sidePrice(side: MarketSide, quote: { yes: number; no: number }): number {
  return side === "YES" ? quote.yes : quote.no;
}

export function evaluateIncomingOrder(scenario: RuntimeScenario): {
  decision: GuardDecision;
  illustrativePriceMove: number;
  returnedSol: number;
} {
  const before = sidePrice(scenario.incomingOrder.side, scenario.quote.before);
  const after = sidePrice(scenario.incomingOrder.side, scenario.quote.after);
  const illustrativePriceMove = after - before;
  const stale = scenario.quote.sequence < scenario.event.sequence;
  const decision = stale ? "STALE_SEQUENCE_RETURNED" : "ACCEPTED";
  return {
    decision,
    illustrativePriceMove,
    returnedSol: decision === "STALE_SEQUENCE_RETURNED" ? scenario.incomingOrder.stakeSol : 0,
  };
}

export function clampRuntimeStage(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.max(0, Math.min(RUNTIME_STAGE_COUNT - 1, Math.trunc(stage)));
}

export function nextRuntimeStage(stage: number): number {
  return clampRuntimeStage(stage + 1);
}

export function nextRuntimeActionLabel(stage: number): "Next step" | "Accept synchronized retry" {
  return clampRuntimeStage(stage) === 4 ? "Accept synchronized retry" : "Next step";
}

export function restartRuntime(): number {
  return 0;
}

export function runtimeState(scenario: RuntimeScenario, requestedStage: number): RuntimeState {
  const stage = clampRuntimeStage(requestedStage);
  const eventArrived = stage >= 1;
  const repriced = stage >= 4;
  const orderVisible = stage >= 2;
  const evaluated = stage >= 3;
  const retryAccepted = stage >= 5;
  const finished = stage >= 6;
  const evaluation = evaluateIncomingOrder(scenario);
  const quoteSequence = repriced ? scenario.event.sequence : scenario.quote.sequence;
  const order = retryAccepted ? scenario.synchronizedOrder : scenario.incomingOrder;
  const orderSequence = orderVisible ? (retryAccepted ? scenario.event.sequence : scenario.quote.sequence) : null;
  const decision = retryAccepted ? "ACCEPTED" : evaluated ? evaluation.decision : null;
  const acceptedSol = retryAccepted ? scenario.synchronizedOrder.stakeSol : 0;
  const acceptedPrice = sidePrice(scenario.synchronizedOrder.side, scenario.quote.after);
  const liabilitySol = retryAccepted ? (scenario.synchronizedOrder.stakeSol / acceptedPrice) - scenario.synchronizedOrder.stakeSol : 0;

  return {
    stage,
    title: runtimeStageLabels(scenario)[stage],
    score: eventArrived ? scenario.event.score : scenario.initial.score,
    clock: eventArrived ? scenario.event.clock : scenario.initial.clock,
    eventSequence: eventArrived ? scenario.event.sequence : scenario.initial.eventSequence,
    quoteSequence,
    sequenceDelta: (eventArrived ? scenario.event.sequence : scenario.initial.eventSequence) - quoteSequence,
    yesPrice: repriced ? scenario.quote.after.yes : scenario.quote.before.yes,
    noPrice: repriced ? scenario.quote.after.no : scenario.quote.before.no,
    synchronized: !eventArrived || repriced,
    health: stage === 0 || retryAccepted ? "HEALTHY" : stage === 4 ? "RECOVERING" : "STALE",
    staleWindow: stage === 0 ? "CLOSED" : stage < 4 ? "OPEN" : stage === 4 ? "RECOVERING" : "RECOVERED",
    marketStatus: finished ? "SETTLED" : "OPEN",
    orderVisible,
    decision,
    orderId: orderVisible ? (retryAccepted ? "post-yes" : "stale-bot") : null,
    orderActor: orderVisible ? order.actor : null,
    orderSide: orderVisible ? order.side : null,
    orderStakeSol: orderVisible ? order.stakeSol : 0,
    orderSequence,
    illustrativePriceMove: evaluation.illustrativePriceMove,
    returnedSol: evaluated && !retryAccepted ? evaluation.returnedSol : 0,
    acceptedSol,
    liabilitySol,
    proofAvailable: finished,
  };
}

export function deterministicRuntime(scenario: RuntimeScenario): RuntimeState[] {
  return Array.from({ length: RUNTIME_STAGE_COUNT }, (_, stage) => runtimeState(scenario, stage));
}
