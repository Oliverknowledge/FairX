"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Code2, Play, RotateCcw } from "lucide-react";
import { submitProtectedOrder, IntegrationKitError, type ProtectedOrderResult } from "@/lib/integration-kit";
import type { QuoteGuardCommitment } from "@/lib/quote-guard";

interface Props {
  preQuote: QuoteGuardCommitment;
  postQuote: QuoteGuardCommitment;
  initialResult: ProtectedOrderResult;
}

export function IntegrationKitDemo({ preQuote, postQuote, initialResult }: Props) {
  const [result, setResult] = useState(initialResult);
  const [running, setRunning] = useState<"stale" | "current" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "stale" | "current") => {
    setRunning(kind);
    setError(null);
    const quote = kind === "stale" ? preQuote : postQuote;
    try {
      setResult(await submitProtectedOrder({
        marketId: "fairx-v4-france-morocco",
        side: "YES",
        stakeLamports: 10_000_000n,
        quote,
        latestMaterialEventSequence: 739,
        submittedAtMs: quote.sourceTimestampMs + (kind === "stale" ? 110_000 : 1_000),
      }));
    } catch (cause) {
      setError(cause instanceof IntegrationKitError ? `${cause.code}: ${cause.message}` : "Reference request failed");
    } finally {
      setRunning(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 text-white" style={{ backgroundColor: "#0c1425", color: "#fff" }} aria-labelledby="integration-kit-title">
      <div className="grid gap-7 border-b border-white/10 p-6 sm:p-8 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-blue-300"><Code2 className="h-4 w-4" />IntegrationKit</p>
          <h2 id="integration-kit-title" className="mt-3 text-[30px] font-extrabold tracking-[-.04em]">Two inputs. Two outcomes.</h2>
          <p className="mt-4 text-[11px] leading-6 text-slate-300">The operator-facing facade submits the order and its quote sequence. The expanded reference contract below carries the verified QuoteGuard commitment needed to reproduce the decision.</p>
        </div>
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-5 text-[10px] leading-6 text-slate-300"><code>{`const result = await submitProtectedOrder({
  market, side: "YES", stake,
  quoteSequence
});

result.status; // ${result.status}`}</code></pre>
      </div>

      <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_.72fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void run("stale")} disabled={running !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-[10.5px] font-extrabold disabled:opacity-60" style={{ color: "#0c1425" }}><Play className="h-3.5 w-3.5" />{running === "stale" ? "Submitting…" : "Submit stale-sequence order"}</button>
            <button type="button" onClick={() => void run("current")} disabled={running !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-[10.5px] font-bold text-white disabled:opacity-60"><RotateCcw className="h-3.5 w-3.5" />{running === "current" ? "Submitting…" : "Submit synchronized order"}</button>
          </div>
          <p className="mt-3 text-[9px] leading-4 text-slate-500">Reference no-send adapter using the recorded V4 state. It exercises the same typed frontend contract without signing or sending a transaction.</p>
          {error && <p className="mt-4 rounded-xl border border-red-300/25 bg-red-300/10 p-3 text-[10px] text-red-200">{error}</p>}
        </div>

        <div className={`rounded-2xl border p-5 ${result.status === "ACCEPTED" ? "border-blue-300/25 bg-blue-300/10" : "border-emerald-300/30 bg-emerald-300/10"}`} aria-live="polite">
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.1em] text-slate-400"><CheckCircle2 className="h-4 w-4 text-emerald-300" />QuoteGuard verified</p>
          <p className="mt-3 break-words text-[17px] font-extrabold text-white">{result.status}</p>
          <dl className="mt-4 space-y-2 text-[9.5px] text-slate-300"><ResultRow label="Position created" value={result.status === "ACCEPTED" ? "Yes" : "No"} /><ResultRow label="Principal returned" value={`${result.returnedPrincipalLamports} lamports`} /><ResultRow label="Liability created / reserved" value={`${result.reservedLiabilityLamports} lamports`} /></dl>
        </div>
      </div>

      <details className="group border-t border-white/10 px-6 py-4 sm:px-8">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-[10px] font-bold text-slate-300"><span>Inputs, outputs, and errors</span><ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
        <div className="grid gap-3 pb-3 pt-4 sm:grid-cols-3"><ContractFact title="Inputs" text="market · side · stake · QuoteGuard quote · latest event sequence" /><ContractFact title="Outputs" text="ACCEPTED · STALE_SEQUENCE_RETURNED · principal and liability amounts" /><ContractFact title="Errors" text="INVALID_INPUT · QUOTE_UNVERIFIED · QUOTE_EXPIRED · FUTURE_SEQUENCE · TRANSPORT_ERROR" /></div>
      </details>
    </section>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><dt>{label}</dt><dd className="num text-right font-bold text-white">{value}</dd></div>; }
function ContractFact({ title, text }: { title: string; text: string }) { return <article className="rounded-xl bg-white/5 p-4"><h3 className="text-[9px] font-bold uppercase tracking-[.08em] text-blue-300">{title}</h3><p className="mt-2 text-[9.5px] leading-5 text-slate-300">{text}</p></article>; }
