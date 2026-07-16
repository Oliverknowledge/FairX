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

  it("voids the France-Morocco stale-benefiting YES order", () => {
    const decision = evaluateIncomingOrder(scenarioById("france-morocco"));
    expect(decision.decision).toBe("VOID_REFUND");
    expect(decision.edgePerShare).toBeCloseTo(0.342008, 6);
  });

  it("uses the same engine for the second fixture", () => {
    const scenario = scenarioById("argentina-brazil");
    expect(scenario.event.type).toBe("RED_CARD");
    expect(deterministicRuntime(scenario)).toHaveLength(6);
  });

  it("allows a stale order whose side did not benefit from the event", () => {
    const decision = evaluateIncomingOrder(scenarioById("argentina-brazil"));
    expect(decision).toEqual({ decision: "ALLOW_NO_EDGE", edgePerShare: 0, returnedSol: 0 });
  });

  it("accepts a synchronized follow-up order", () => {
    const final = runtimeState(scenarioById("france-morocco"), 5);
    expect(final.decision).toBe("ACCEPT_SYNCHRONIZED");
    expect(final.synchronized).toBe(true);
    expect(final.acceptedSol).toBe(0.01);
    expect(nextRuntimeActionLabel(4)).toBe("Retry with synchronized quote");
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

  it("exposes exactly six semantically consistent stages", () => {
    expect(RUNTIME_STAGE_COUNT).toBe(6);
    expect(RUNTIME_STAGE_LABELS).toEqual([
      "Market open and synchronised",
      "Material TxLINE event arrives",
      "Market becomes stale",
      "Exploitative order is voided and refunded",
      "Market reprices",
      "Fair order succeeds and proof is available",
    ]);
  });

  it("restarts deterministically", () => {
    expect(restartRuntime()).toBe(0);
    expect(runtimeState(scenarioById("france-morocco"), restartRuntime())).toEqual(runtimeState(scenarioById("france-morocco"), 0));
  });

  it("autoplay progression terminates at the same final state", () => {
    let stage = 0;
    for (let index = 0; index < 20; index += 1) stage = nextRuntimeStage(stage);
    expect(stage).toBe(5);
    expect(runtimeState(scenarioById("france-morocco"), stage)).toEqual(deterministicRuntime(scenarioById("france-morocco"))[5]);
  });

  it("renders the required judge-facing financial consequence", () => {
    const html = renderToStaticMarkup(<FairXLiveDemo />);
    expect(html).toContain("Runtime simulation using captured TxLINE-schema events.");
    expect(html).toContain("Bot advantage without FairX");
    expect(html).toContain("Bot advantage with FairX");
    expect(html).toContain("honest market remains open");
  });

  it("uses responsive layouts without a fixed desktop minimum width", () => {
    const html = renderToStaticMarkup(<FairXLiveDemo />);
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).not.toContain("min-w-[1180px]");
  });
});
