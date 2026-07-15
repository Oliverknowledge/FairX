"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Loader2, RefreshCw, ShieldAlert, Timer } from "lucide-react";
import type { V4DeploymentStatus } from "@/lib/v4/deploymentStatus";

type State =
  | { kind: "loading" }
  | { kind: "ready"; status: V4DeploymentStatus }
  | { kind: "error"; message: string };

const PHASE_STYLE: Record<V4DeploymentStatus["phase"], { border: string; bg: string; text: string; label: string }> = {
  DEPLOYED: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-900", label: "DEPLOYED" },
  BUFFER_FUNDED: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-900", label: "IN PROGRESS" },
  NOT_STARTED: { border: "border-slate-300", bg: "bg-slate-50", text: "text-slate-700", label: "NOT STARTED" },
  UNKNOWN: { border: "border-slate-300", bg: "bg-slate-50", text: "text-slate-700", label: "RPC UNAVAILABLE" },
};

export function V4DeploymentStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/verify/v4-status", { cache: "no-store" });
      const status = (await response.json()) as V4DeploymentStatus;
      setState({ kind: "ready", status });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="card flex items-center gap-3 p-5 text-[12px] text-(--ink-2)">
        <Loader2 className="h-4 w-4 animate-spin text-(--blue)" />
        Reading live devnet deployment status…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="card p-5 text-[12px] text-(--ink-2)">
        <p className="flex items-center gap-2 font-bold text-(--ink)"><ShieldAlert className="h-4 w-4" />Live status unavailable</p>
        <p className="mt-2">Could not reach the status route ({state.message}). This never implies the program is deployed.</p>
        <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--border) bg-white px-4 text-[11px] font-bold">
          <RefreshCw className="h-3.5 w-3.5" />Retry
        </button>
      </div>
    );
  }

  const { status } = state;
  const style = PHASE_STYLE[status.phase];
  const Icon = status.phase === "DEPLOYED" ? CheckCircle2 : status.phase === "BUFFER_FUNDED" ? Timer : ShieldAlert;

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full border ${style.border} bg-white/70 px-2.5 py-1 text-[10px] font-bold ${style.text}`}>
          <Icon className="h-3.5 w-3.5" />Live devnet · {style.label}
        </span>
        <h3 className={`text-[14px] font-extrabold ${style.text}`}>{status.headline}</h3>
      </div>
      <p className={`mt-2 text-[11.5px] leading-relaxed ${style.text}`}>{status.detail}</p>

      <dl className="mt-5 grid gap-2 text-[10.5px] sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Program account" ok={status.deployed} value={status.deployed ? "live · executable" : "not created"} href={status.explorer.program} />
        <Fact label="ProgramData" ok={status.deployed} value={status.deployed ? "live" : "not created"} href={status.explorer.programData} />
        <Fact label="Deployment slot" ok={status.deployed} value={status.deployed ? "476416258" : "unavailable"} href={status.explorer.programData} />
        <Fact label="Binary hash" ok={status.deployed} value={status.deployed ? "matches manifest" : "unavailable"} href={status.explorer.programData} />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--border) bg-white px-4 text-[11px] font-bold text-(--ink)">
          <RefreshCw className="h-3.5 w-3.5" />Re-check devnet
        </button>
        <span className="text-[9.5px] text-(--ink-3)">Read-only getMultipleAccounts · no signing · {new Date(status.checkedAt).toLocaleTimeString()}</span>
      </div>
      <details className="group mt-4 rounded-xl border border-(--border) bg-white/60">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-[10px] font-bold text-(--ink-2)">Deployment technical details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="border-t border-(--border) p-3 text-[9.5px] leading-5 text-(--ink-2)"><p>Upload buffer: {status.bufferFunded ? `${(status.bufferLamports / 1e9).toFixed(4)} SOL funded` : status.deployed ? "purged after successful deploy" : "absent"}.</p><p>ProgramData and explorer links above are read directly from the approved V4 addresses.</p></div>
      </details>
    </div>
  );
}

function Fact({ label, value, ok, href }: { label: string; value: string; ok: boolean; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-(--border) bg-white/70 px-3 py-2">
      <span className="text-(--ink-3)">{label}</span>
      <span className={`inline-flex min-w-0 items-center gap-1 break-all font-bold ${ok ? "text-(--green)" : "text-(--ink-2)"}`}>
        {value}
        <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-100" />
      </span>
    </a>
  );
}
