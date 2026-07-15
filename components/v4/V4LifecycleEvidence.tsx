"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, Coins, FileCheck2, Loader2, RefreshCw, ShieldCheck, ShieldX, Vault, XCircle } from "lucide-react";
import type { V4LifecycleVerification } from "@/lib/proof/v4LifecycleVerifier";

type State = { kind: "loading" } | { kind: "ready"; result: V4LifecycleVerification } | { kind: "error"; message: string };

const ICON = { VERIFIED: CheckCircle2, FAILED: XCircle, UNKNOWN: CircleDashed } as const;

export function V4LifecycleEvidence() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70_000);
    try {
      const response = await fetch("/api/verify/v4-lifecycle", { cache: "no-store", signal: controller.signal });
      setState({ kind: "ready", result: (await response.json()) as V4LifecycleVerification });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (state.kind === "loading") {
    return <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6"><p className="flex items-center gap-3 text-[12px] font-bold text-blue-950"><Loader2 className="h-4 w-4 animate-spin text-blue-600" />Re-reading the finalized V4 lifecycle from devnet…</p><p className="mt-2 text-[10.5px] leading-5 text-blue-900/65">This can take up to a minute because the verifier checks the program, accounts and 24 recorded transactions. Loading is never shown as success.</p></div>;
  }
  if (state.kind === "error") {
    return (
      <div className="card p-5 text-[12px] text-(--ink-2)">
        <p className="flex items-center gap-2 font-bold text-(--ink)"><ShieldX className="h-4 w-4" />Verifier unavailable</p>
        <p className="mt-2">Could not reach the verifier ({state.message}). This never implies the lifecycle is verified.</p>
        <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--border) bg-white px-4 text-[11px] font-bold"><RefreshCw className="h-3.5 w-3.5" />Retry RPC verification</button>
      </div>
    );
  }

  const { result } = state;
  const notRecorded = result.recordState === "not_recorded";
  const style = notRecorded
    ? { border: "border-slate-300", bg: "bg-slate-50", text: "text-slate-700", label: "NOT RECORDED YET" }
    : result.status === "VERIFIED"
      ? { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-900", label: "VERIFIED" }
      : result.status === "FAILED"
        ? { border: "border-red-300", bg: "bg-red-50", text: "text-red-900", label: "FAILED" }
        : { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-900", label: "UNKNOWN" };

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border ${style.border} bg-white/70 px-3 py-1.5 text-[10px] font-bold ${style.text}`}><ShieldCheck className="h-3.5 w-3.5" />V4 lifecycle · {style.label}</span>
          {!notRecorded && <span className="text-[10px] font-semibold text-(--ink-2)">{result.summary.verified}/20 verified</span>}
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-4 text-[10.5px] font-bold text-(--ink)"><RefreshCw className="h-3.5 w-3.5" />Re-verify from RPC</button>
      </div>

      {notRecorded ? (
        <div className="mt-3 text-[11.5px] leading-relaxed text-(--ink-2)">
          <p className="font-bold text-(--ink)">No on-chain V4 lifecycle has been recorded.</p>
          <p className="mt-1">The evidence fixture is absent or has not been recorded. This is not success or failure: it is the honest absence of evidence, and no transaction or account state is inferred from it.</p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><ProofOutcome icon={FileCheck2} label="Finalized transactions" value="24 verified" /><ProofOutcome icon={ShieldCheck} label="Stale exploit" value="Refund verified" /><ProofOutcome icon={Coins} label="User payouts" value="Payouts verified" /><ProofOutcome icon={Vault} label="Final vault" value="Solvency verified" /></div>
          <details className="group mt-4 overflow-hidden rounded-xl border border-(--border) bg-white/75">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[10.5px] font-bold text-(--ink)"><span>Transaction and account evidence · {result.checks.length} checks</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
            <div className="grid gap-2 border-t border-(--border) p-3 sm:grid-cols-2">
              {result.checks.map((check) => {
                const Icon = ICON[check.status];
                const color = check.status === "VERIFIED" ? "text-(--green)" : check.status === "FAILED" ? "text-(--red)" : "text-amber-600";
                return <div key={check.id} className="flex items-start gap-2 rounded-lg bg-white p-3"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} /><div><p className="text-[10.5px] font-bold text-(--ink)">{check.label}</p><p className="mt-1 text-[9.5px] leading-4 text-(--ink-3)">{check.detail}</p></div></div>;
              })}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ProofOutcome({ icon: Icon, label, value }: { icon: typeof FileCheck2; label: string; value: string }) {
  return <div className="rounded-xl border border-(--border) bg-white p-3"><Icon className="h-4 w-4 text-(--green)" /><p className="mt-3 text-[8.5px] font-bold uppercase tracking-[.06em] text-(--ink-3)">{label}</p><p className="mt-1 text-[10.5px] font-extrabold">{value}</p></div>;
}
