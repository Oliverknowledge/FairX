import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FairXLiveDemo } from "@/components/runtime/FairXLiveDemo";
import {
  deterministicRuntime,
  evaluateIncomingOrder,
  nextRuntimeActionLabel,
  nextRuntimeStage,
  restartRuntime,
  RUNTIME_STAGE_COUNT,
  RUNTIME_STAGE_LABELS,
  runtimeState,
} from "@/lib/runtime/engine";
import { RUNTIME_SCENARIOS, scenarioById, validateRuntimeScenario } from "@/lib/runtime/scenarios";

describe("FairX reusable runtime simulation", () => {
  it("parses both scenario configurations", () => {
    expect(RUNTIME_SCENARIOS.map((scenario) => validateRuntimeScenario(scenario).id)).toEqual(["france-morocco", "argentina-brazil"]);
  });

  it("returns the France-Morocco order because its sequence is stale", () => {
    const decision = evaluateIncomingOrder(scenarioById("france-morocco"));
    expect(decision.decision).toBe("STALE_SEQUENCE_RETURNED");
    expect(decision.illustrativePriceMove).toBeCloseTo(0.342008, 6);
  });

  it("uses the same engine for the second fixture", () => {
    const scenario = scenarioById("argentina-brazil");
    expect(scenario.event.type).toBe("RED_CARD");
    expect(deterministicRuntime(scenario)).toHaveLength(7);
  });

  it("returns a stale order regardless of side or illustrative price direction", () => {
    const decision = evaluateIncomingOrder(scenarioById("argentina-brazil"));
    expect(decision.decision).toBe("STALE_SEQUENCE_RETURNED");
    expect(decision.illustrativePriceMove).toBeCloseTo(-0.16, 8);
    expect(decision.returnedSol).toBe(0.01);
  });

  it("accepts a synchronized follow-up order", () => {
    const final = runtimeState(scenarioById("france-morocco"), 6);
    expect(final.decision).toBe("ACCEPTED");
    expect(final.synchronized).toBe(true);
    expect(final.acceptedSol).toBe(0.01);
    expect(final.orderActor).toBe("Fair trader");
    expect(final.orderSequence).toBe(739);
    expect(nextRuntimeActionLabel(4)).toBe("Accept synchronized retry");
  });

  it("marks the quote stale before evaluation", () => {
    const stale = runtimeState(scenarioById("france-morocco"), 2);
    expect(stale.synchronized).toBe(false);
    expect(stale.eventSequence).toBe(739);
    expect(stale.quoteSequence).toBe(738);
  });

  it("returns the complete stake after the void decision", () => {
    const refunded = runtimeState(scenarioById("france-morocco"), 3);
    expect(refunded.returnedSol).toBe(0.01);
    expect(refunded.acceptedSol).toBe(0);
  });

  it("exposes exactly seven semantically consistent stages", () => {
    expect(RUNTIME_STAGE_COUNT).toBe(7);
    expect(RUNTIME_STAGE_LABELS).toEqual([
      "Market healthy",
      "TxLINE event advances sequence",
      "Stale order arrives",
      "Principal returned",
      "Quote recovering",
      "Synchronized retry accepted",
      "Settlement verified",
    ]);
  });

  it("restarts deterministically", () => {
    expect(restartRuntime()).toBe(0);
    expect(runtimeState(scenarioById("france-morocco"), restartRuntime())).toEqual(runtimeState(scenarioById("france-morocco"), 0));
  });

  it("autoplay progression terminates at the same final state", () => {
    let stage = 0;
    for (let index = 0; index < 20; index += 1) stage = nextRuntimeStage(stage);
    expect(stage).toBe(6);
    expect(runtimeState(scenarioById("france-morocco"), stage)).toEqual(deterministicRuntime(scenarioById("france-morocco"))[6]);
  });

  it("renders the required judge-facing financial consequence", () => {
    const html = renderToStaticMarkup(<FairXLiveDemo />);
    expect(html).toContain("The stale order stops. The market doesn’t.");
    expect(html).toContain("Market integrity panel");
    expect(html).toContain("STALE_SEQUENCE_RETURNED");
    expect(html).toContain("Stay open without private discretion");
  });

  it("uses responsive layouts without a fixed desktop minimum width", () => {
    const html = renderToStaticMarkup(<FairXLiveDemo />);
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-[1.12fr_.88fr]");
    expect(html).not.toContain("min-w-[1180px]");
  });
});
