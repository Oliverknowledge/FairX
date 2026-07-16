"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Code2, Play, ShieldCheck } from "lucide-react";
import { submitProtectedOrder, IntegrationKitError } from "@/lib/integration-kit";
import {
  LAB_CASES,
  READY_TO_RUN,
  type LabCaseId,
  type LabState,
  completeRun,
  initialLabState,
  inputForCase,
  labView,
  requestJson,
  selectCase,
} from "@/lib/integration-kit/lab-view";
import type { QuoteGuardCommitment } from "@/lib/quote-guard";

interface Props {
  preQuote: QuoteGuardCommitment;
  postQuote: QuoteGuardCommitment;
}

export function IntegrationKitDemo({ preQuote, postQuote }: Props) {
  const [state, setState] = useState<LabState>(initialLabState);
  const [running, setRunning] = useState(false);
  const input = useMemo(() => inputForCase(state.selected, preQuote, postQuote), [postQuote, preQuote, state.selected]);
  const view = labView(state);

  const run = async () => {
    setRunning(true);
    try {
      const result = await submitProtectedOrder(input);
      setState((current) => completeRun(current, { kind: "result", result }));
    } catch (cause) {
      const outcome = cause instanceof IntegrationKitError
        ? { kind: "error" as const, code: cause.code, message: cause.message }
        : { kind: "error" as const, code: "TRANSPORT_ERROR", message: "Reference request failed" };
      setState((current) => completeRun(current, outcome));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 text-white" style={{ backgroundColor: "#0c1425", color: "#fff" }} aria-labelledby="conformance-lab-title">
      <div className="grid gap-7 border-b border-white/10 p-6 sm:p-8 lg:grid-cols-[.78fr_1.22fr]">
        <div>
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-blue-300"><Code2 className="h-4 w-4" />IntegrationKit · Conformance Lab</p>
          <h2 id="conformance-lab-title" className="mt-3 text-[30px] font-extrabold tracking-[-.04em]">Know every outcome before integration.</h2>
          <p className="mt-4 text-[11px] leading-6 text-slate-300">Exercise the frozen V4 decision contract, validation failures, typed responses, and operator handoff without signing or sending a transaction.</p>
        </div>
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-5 text-[10px] leading-6 text-slate-300"><code>{`const result = await submitProtectedOrder({
  marketId, side, stakeLamports,
  quote, latestMaterialEventSequence
});

// OrderSequence <  RequiredSequence -> STALE_SEQUENCE_RETURNED
// OrderSequence == RequiredSequence -> ACCEPTED
// OrderSequence >  RequiredSequence -> FUTURE_SEQUENCE (invalid)`}</code></pre>
      </div>

      <div className="border-b border-white/10 p-4 sm:p-6">
        <p className="text-[8px] font-extrabold uppercase tracking-[.1em] text-slate-500">Select a test vector</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Conformance test vectors">
          {LAB_CASES.map((item) => <button key={item.id} type="button" onClick={() => setState((current) => selectCase(current, item.id as LabCaseId))} aria-pressed={state.selected === item.id} className={`min-h-12 rounded-xl border px-3 text-left transition-all ${state.selected === item.id ? "border-blue-300/35 bg-blue-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}><span className={`block text-[9.5px] font-extrabold ${state.selected === item.id ? "text-white" : "text-slate-300"}`}>{item.label}</span><span className="mt-1 block break-words text-[7.5px] font-bold text-slate-500">{item.expected}</span></button>)}
        </div>
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-3">
        <LabStep index="01" label="Request">
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[9px] leading-5 text-slate-300"><code>{requestJson(input)}</code></pre>
        </LabStep>
        <LabStep index="02" label="Decision">
          <div className="mt-3 flex min-h-[92px] flex-col items-start justify-center rounded-xl border border-white/10 bg-black/10 p-4" aria-live="polite">
            <p className={`break-all font-black ${view.hasExecuted ? "text-[13px] text-white" : "text-[11px] tracking-[.08em] text-slate-500"}`}>{view.decision}</p>
            <p className="mt-2 text-[8.5px] leading-4 text-slate-400">Expected: {view.expected}</p>
            {view.matchesExpected !== null && (
              <p className={`mt-1 text-[8.5px] font-bold leading-4 ${view.matchesExpected ? "text-emerald-300" : "text-amber-300"}`}>
                {view.matchesExpected ? "Matches expected" : "Does not match expected"}
              </p>
            )}
          </div>
        </LabStep>
        <LabStep index="03" label="Typed response">
          <pre className="mt-3 max-h-[150px] overflow-auto whitespace-pre-wrap text-[8.5px] leading-4 text-slate-300"><code>{view.responseJson}</code></pre>
        </LabStep>
      </div>

      <div className="grid gap-px border-t border-white/10 bg-white/10 lg:grid-cols-[1fr_1fr_.8fr]">
        <LabStep index="04" label="Explanation"><p className="mt-3 text-[10px] leading-5 text-slate-300">{view.explanation}</p></LabStep>
        <LabStep index="05" label="Operator responsibility"><p className="mt-3 text-[10px] font-semibold leading-5 text-white">{view.operatorResponsibility}</p></LabStep>
        <div className="bg-[#091120] p-5 sm:p-6">
          <button type="button" onClick={() => void run()} disabled={running} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[10.5px] font-extrabold text-slate-950 disabled:opacity-60"><Play className="h-3.5 w-3.5" />{running ? "Running vector…" : "Run selected vector"}</button>
          <p className="mt-3 text-[8.5px] leading-4 text-slate-500">Reference no-send adapter · recorded V4 quote evidence · zero transactions.</p>
        </div>
      </div>

      <details className="group border-t border-white/10 px-6 py-4 sm:px-8">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-[10px] font-bold text-slate-300"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Integration checklist</span><ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
        <ol className="grid gap-3 pb-3 pt-4 sm:grid-cols-2 lg:grid-cols-4"><ChecklistItem text="Bind the operator market to the intended TxLINE fixture." /><ChecklistItem text="Submit the verified quote and latest required event sequence." /><ChecklistItem text="Map returned principal and accepted liability without inventing an execution outcome the rule does not define." /><ChecklistItem text="Log evidence, recover the quote, and expose a retry path." /></ol>
      </details>
    </section>
  );
}

function LabStep({ index, label, children }: { index: string; label: string; children: React.ReactNode }) { return <article className="min-w-0 bg-[#0c1425] p-5 sm:p-6"><p className="flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[.1em] text-blue-300"><span className="text-slate-600">{index}</span>{label}</p>{children}</article>; }
function ChecklistItem({ text }: { text: string }) { return <li className="flex items-start gap-2 rounded-xl bg-white/5 p-4 text-[9.5px] leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />{text}</li>; }
