import { describe, expect, it } from "vitest";
import {
  LAB_CASES,
  READY_TO_RUN,
  type LabCaseId,
  type LabOutcome,
  completeRun,
  initialLabState,
  inputForCase,
  labView,
  selectCase,
} from "@/lib/integration-kit/lab-view";
import { evaluateReferenceProtectedOrder } from "@/lib/integration-kit/reference";
import { IntegrationKitError } from "@/lib/integration-kit/types";
import { CANONICAL_POST_GOAL_QUOTE, CANONICAL_PRE_GOAL_QUOTE } from "@/lib/quote-guard/canonical";

const IDS = LAB_CASES.map((item) => item.id);

/** Executes a vector exactly as the component does, producing a real outcome. */
function runVector(id: LabCaseId): LabOutcome {
  try {
    return { kind: "result", result: evaluateReferenceProtectedOrder(inputForCase(id, CANONICAL_PRE_GOAL_QUOTE, CANONICAL_POST_GOAL_QUOTE)) };
  } catch (cause) {
    return cause instanceof IntegrationKitError
      ? { kind: "error", code: cause.code, message: cause.message }
      : { kind: "error", code: "TRANSPORT_ERROR", message: "Reference request failed" };
  }
}

describe("Conformance Lab view state", () => {
  it("shows READY TO RUN on first paint, before any vector is executed", () => {
    const view = labView(initialLabState);
    expect(view.decision).toBe(READY_TO_RUN);
    expect(view.hasExecuted).toBe(false);
    expect(view.matchesExpected).toBeNull();
    expect(view.expected).toBe("STALE_SEQUENCE_RETURNED");
  });

  it("never renders a decision until Run is pressed", () => {
    for (const id of IDS) {
      const view = labView({ selected: id, outcome: null });
      expect(view.decision).toBe(READY_TO_RUN);
      expect(view.responseJson).not.toContain("status");
      expect(view.responseJson).not.toContain("error");
    }
  });

  it("each vector produces its expected decision after Run", () => {
    for (const { id, expected } of LAB_CASES) {
      const view = labView(completeRun({ selected: id, outcome: null }, runVector(id)));
      expect(view.hasExecuted).toBe(true);
      expect(view.decision).toBe(expected);
      expect(view.matchesExpected).toBe(true);
    }
  });

  // The regression: selecting a new vector used to leave the previous decision
  // on screen, producing frames like "Expected: ACCEPTED / STALE_SEQUENCE_RETURNED".
  it("clears the previous decision across every vector transition", () => {
    for (const from of IDS) {
      const executed = completeRun({ selected: from, outcome: null }, runVector(from));
      expect(labView(executed).hasExecuted).toBe(true);

      for (const to of IDS) {
        const next = selectCase(executed, to);
        const view = labView(next);

        expect(next.outcome).toBeNull();
        expect(next.selected).toBe(to);
        expect(view.decision).toBe(READY_TO_RUN);
        expect(view.hasExecuted).toBe(false);
        expect(view.matchesExpected).toBeNull();
        expect(view.expected).toBe(LAB_CASES.find((item) => item.id === to)!.expected);
      }
    }
  });

  it("never displays a decision that contradicts the shown expectation", () => {
    for (const from of IDS) {
      const executed = completeRun({ selected: from, outcome: null }, runVector(from));
      for (const to of IDS) {
        const view = labView(selectCase(executed, to));
        // Either nothing has been executed, or the decision matches the expectation.
        expect(view.hasExecuted === false || view.decision === view.expected).toBe(true);
      }
    }
  });

  it("re-running after a transition reports the new vector's decision", () => {
    const staleRun = completeRun(initialLabState, runVector("stale"));
    expect(labView(staleRun).decision).toBe("STALE_SEQUENCE_RETURNED");

    const selected = selectCase(staleRun, "synchronized");
    expect(labView(selected).decision).toBe(READY_TO_RUN);

    const view = labView(completeRun(selected, runVector("synchronized")));
    expect(view.decision).toBe("ACCEPTED");
    expect(view.matchesExpected).toBe(true);
  });

  it("keeps operator responsibility bound to the selected vector, not the last run", () => {
    const staleRun = completeRun(initialLabState, runVector("stale"));
    expect(labView(staleRun).operatorResponsibility).toMatch(/return the full principal/i);
    expect(labView(selectCase(staleRun, "expired")).operatorResponsibility).toMatch(/fresh verified quote/i);
  });

  it("encodes the frozen three-way sequence policy in the vector inputs", () => {
    // < required -> stale ; == required -> accepted ; > required -> future/invalid
    const stale = inputForCase("stale", CANONICAL_PRE_GOAL_QUOTE, CANONICAL_POST_GOAL_QUOTE);
    expect(stale.quote.materialEventSequence).toBeLessThan(stale.latestMaterialEventSequence);

    const synchronized = inputForCase("synchronized", CANONICAL_PRE_GOAL_QUOTE, CANONICAL_POST_GOAL_QUOTE);
    expect(synchronized.quote.materialEventSequence).toBe(synchronized.latestMaterialEventSequence);

    const future = inputForCase("future", CANONICAL_PRE_GOAL_QUOTE, CANONICAL_POST_GOAL_QUOTE);
    expect(future.quote.materialEventSequence).toBeGreaterThan(future.latestMaterialEventSequence);
  });
});
