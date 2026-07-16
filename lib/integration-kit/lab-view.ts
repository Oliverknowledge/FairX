import type { ProtectedOrderInput, ProtectedOrderResult } from "@/lib/integration-kit/types";
import type { QuoteGuardCommitment } from "@/lib/quote-guard";

/**
 * Pure state machine for the /integrate Conformance Lab.
 *
 * The lab must never show a decision that was not produced by the currently
 * selected vector. Selecting a vector clears the previous executed result, so
 * the panel reports READY_TO_RUN until Run executes the new vector. Keeping the
 * transitions here rather than in the component lets the invariant be tested
 * without a DOM environment.
 */

export type LabCaseId = "stale" | "synchronized" | "malformed" | "expired" | "future";

export type LabOutcome =
  | { kind: "result"; result: ProtectedOrderResult }
  | { kind: "error"; code: string; message: string };

export interface LabState {
  selected: LabCaseId;
  outcome: LabOutcome | null;
}

export const READY_TO_RUN = "READY TO RUN";

export const LAB_CASES: readonly { id: LabCaseId; label: string; expected: string }[] = [
  { id: "stale", label: "Stale order", expected: "STALE_SEQUENCE_RETURNED" },
  { id: "synchronized", label: "Synchronized order", expected: "ACCEPTED" },
  { id: "malformed", label: "Malformed", expected: "INVALID_INPUT" },
  { id: "expired", label: "Expired", expected: "QUOTE_EXPIRED" },
  { id: "future", label: "Future sequence", expected: "FUTURE_SEQUENCE" },
] as const;

export const initialLabState: LabState = { selected: "stale", outcome: null };

/** Selecting a vector always discards the previous vector's executed result. */
export function selectCase(_state: LabState, id: LabCaseId): LabState {
  return { selected: id, outcome: null };
}

export function completeRun(state: LabState, outcome: LabOutcome): LabState {
  return { selected: state.selected, outcome };
}

export function caseFor(id: LabCaseId) {
  const found = LAB_CASES.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown conformance vector: ${id}`);
  return found;
}

export function inputForCase(
  id: LabCaseId,
  preQuote: QuoteGuardCommitment,
  postQuote: QuoteGuardCommitment,
): ProtectedOrderInput {
  const common = { marketId: "fairx-v4-france-morocco", side: "YES" as const, stakeLamports: 10_000_000n };
  if (id === "stale") return { ...common, quote: preQuote, latestMaterialEventSequence: 739, submittedAtMs: preQuote.sourceTimestampMs + 110_000 };
  if (id === "synchronized") return { ...common, quote: postQuote, latestMaterialEventSequence: 739, submittedAtMs: postQuote.sourceTimestampMs + 1_000 };
  if (id === "malformed") return { ...common, marketId: "", stakeLamports: 0n, quote: postQuote, latestMaterialEventSequence: 739, submittedAtMs: postQuote.sourceTimestampMs + 1_000 };
  if (id === "expired") return { ...common, quote: postQuote, latestMaterialEventSequence: 739, submittedAtMs: postQuote.expiresAtMs + 1 };
  return { ...common, quote: postQuote, latestMaterialEventSequence: 738, submittedAtMs: postQuote.sourceTimestampMs + 1_000 };
}

export function operatorResponsibility(id: LabCaseId) {
  if (id === "stale") return "Return the full principal, synchronize the quote, and offer a clean retry.";
  if (id === "synchronized") return "Persist the accepted position, reserve the exact fixed liability, and continue trading.";
  if (id === "malformed") return "Reject at the integration boundary. Do not build or send a transaction.";
  if (id === "expired") return "Fetch a fresh verified quote before accepting another order.";
  return "Treat future sequence input as feed or client skew. Investigate it; never coerce it into acceptance.";
}

export function requestJson(input: ProtectedOrderInput) {
  return JSON.stringify(
    {
      marketId: input.marketId || "(missing)",
      side: input.side,
      stakeLamports: input.stakeLamports.toString(),
      orderSequence: input.quote.materialEventSequence,
      requiredSequence: input.latestMaterialEventSequence,
    },
    null,
    2,
  );
}

export interface LabView {
  /** The decision to display: READY_TO_RUN until this vector has been executed. */
  decision: string;
  expected: string;
  /** True once Run has produced a result for the selected vector. */
  hasExecuted: boolean;
  /** null until executed, then whether the decision matched the expectation. */
  matchesExpected: boolean | null;
  explanation: string;
  responseJson: string;
  operatorResponsibility: string;
}

export function labView(state: LabState): LabView {
  const expected = caseFor(state.selected).expected;
  const responsibility = operatorResponsibility(state.selected);

  if (state.outcome === null) {
    return {
      decision: READY_TO_RUN,
      expected,
      hasExecuted: false,
      matchesExpected: null,
      explanation: "Run this vector to execute it against the frozen V4 decision contract.",
      responseJson: "// Run the vector to produce a typed response.",
      operatorResponsibility: responsibility,
    };
  }

  const decision = state.outcome.kind === "result" ? state.outcome.result.status : state.outcome.code;
  const explanation = state.outcome.kind === "result" ? state.outcome.result.reason : state.outcome.message;
  const responseJson =
    state.outcome.kind === "error"
      ? JSON.stringify({ error: state.outcome.code, message: state.outcome.message }, null, 2)
      : JSON.stringify(
          {
            status: state.outcome.result.status,
            principalReturned: state.outcome.result.returnedPrincipalLamports,
            liabilityReserved: state.outcome.result.reservedLiabilityLamports,
          },
          null,
          2,
        );

  return {
    decision,
    expected,
    hasExecuted: true,
    matchesExpected: decision === expected,
    explanation,
    responseJson,
    operatorResponsibility: responsibility,
  };
}
