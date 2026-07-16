import type { MarketSide, RuntimeScenario } from "@/lib/runtime/scenarios";

export const RUNTIME_STAGE_COUNT = 6;

export type GuardDecision = "VOID_REFUND" | "ALLOW_NO_EDGE" | "ACCEPT_SYNCHRONIZED";

export const RUNTIME_STAGE_LABELS = [
  "Market open and synchronised",
  "Material TxLINE event arrives",
  "Market becomes stale",
  "Exploitative order is voided and refunded",
  "Market reprices",
  "Fair order succeeds and proof is available",
] as const;

export function runtimeStageLabels(scenario: RuntimeScenario): readonly string[] {
  if (evaluateIncomingOrder(scenario).decision === "VOID_REFUND") return RUNTIME_STAGE_LABELS;
  return [
    RUNTIME_STAGE_LABELS[0],
    RUNTIME_STAGE_LABELS[1],
    RUNTIME_STAGE_LABELS[2],
    "Non-benefiting order is allowed",
    RUNTIME_STAGE_LABELS[4],
    RUNTIME_STAGE_LABELS[5],
  ];
}

export type RuntimeState = {
  stage: number;
  title: string;
  score: [number, number];
  clock: string;
  eventSequence: number;
  quoteSequence: number;
  yesPrice: number;
  noPrice: number;
  synchronized: boolean;
  orderVisible: boolean;
  decision: GuardDecision | null;
  edgePerShare: number;
  returnedSol: number;
  acceptedSol: number;
  proofAvailable: boolean;
};

export function sidePrice(side: MarketSide, quote: { yes: number; no: number }): number {
  return side === "YES" ? quote.yes : quote.no;
}

export function evaluateIncomingOrder(scenario: RuntimeScenario): {
  decision: Exclude<GuardDecision, "ACCEPT_SYNCHRONIZED">;
  edgePerShare: number;
  returnedSol: number;
} {
  const before = sidePrice(scenario.incomingOrder.side, scenario.quote.before);
  const after = sidePrice(scenario.incomingOrder.side, scenario.quote.after);
  const edgePerShare = Math.max(0, after - before);
  const stale = scenario.quote.sequence < scenario.event.sequence;
  const decision = stale && edgePerShare > 0.000001 ? "VOID_REFUND" : "ALLOW_NO_EDGE";
  return {
    decision,
    edgePerShare,
    returnedSol: decision === "VOID_REFUND" ? scenario.incomingOrder.stakeSol : 0,
  };
}

export function clampRuntimeStage(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.max(0, Math.min(RUNTIME_STAGE_COUNT - 1, Math.trunc(stage)));
}

export function nextRuntimeStage(stage: number): number {
  return clampRuntimeStage(stage + 1);
}

export function nextRuntimeActionLabel(stage: number): "Next step" | "Retry with synchronized quote" {
  return clampRuntimeStage(stage) === 4 ? "Retry with synchronized quote" : "Next step";
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
  const finished = stage >= 5;
  const evaluation = evaluateIncomingOrder(scenario);

  return {
    stage,
    title: runtimeStageLabels(scenario)[stage],
    score: eventArrived ? scenario.event.score : scenario.initial.score,
    clock: eventArrived ? scenario.event.clock : scenario.initial.clock,
    eventSequence: eventArrived ? scenario.event.sequence : scenario.initial.eventSequence,
    quoteSequence: repriced ? scenario.event.sequence : scenario.quote.sequence,
    yesPrice: repriced ? scenario.quote.after.yes : scenario.quote.before.yes,
    noPrice: repriced ? scenario.quote.after.no : scenario.quote.before.no,
    synchronized: !eventArrived || repriced,
    orderVisible,
    decision: finished ? "ACCEPT_SYNCHRONIZED" : evaluated ? evaluation.decision : null,
    edgePerShare: evaluation.edgePerShare,
    returnedSol: evaluated ? evaluation.returnedSol : 0,
    acceptedSol: finished ? scenario.synchronizedOrder.stakeSol : evaluated && evaluation.decision === "ALLOW_NO_EDGE" ? scenario.incomingOrder.stakeSol : 0,
    proofAvailable: finished,
  };
}

export function deterministicRuntime(scenario: RuntimeScenario): RuntimeState[] {
  return Array.from({ length: RUNTIME_STAGE_COUNT }, (_, stage) => runtimeState(scenario, stage));
}
