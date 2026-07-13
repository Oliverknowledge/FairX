"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleHelp, RefreshCw, XCircle } from "lucide-react";
import type { V3LifecycleVerification, VerificationStatus } from "@/lib/proof/v3LifecycleVerifier";

const tone: Record<VerificationStatus, string> = {
  VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FAILED: "border-red-200 bg-red-50 text-red-800",
  UNKNOWN: "border-amber-200 bg-amber-50 text-amber-900",
};

export function V3LifecycleVerifier() {
  const [verification, setVerification] = useState<V3LifecycleVerification | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/verify/v3-lifecycle", { cache: "no-store" });
      setVerification(await response.json() as V3LifecycleVerification);
    } catch (error) {
      setVerification({
        status: "UNKNOWN",
        checkedAt: new Date().toISOString(),
        rpcUrl: "unavailable",
        checks: [{ id: "request", label: "Verifier request", status: "UNKNOWN", detail: error instanceof Error ? error.message : String(error) }],
        summary: { verified: 0, failed: 0, unknown: 1 },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  const state = verification?.status ?? "UNKNOWN";
  const Icon = state === "VERIFIED" ? CheckCircle2 : state === "FAILED" ? XCircle : CircleHelp;

  return (
    <section className="space-y-4" aria-live="polite">
      <div className={`rounded-2xl border p-5 sm:p-7 ${tone[state]}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Icon className="mt-1 h-6 w-6 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Independent RPC verifier</p>
              <h2 className="mt-1 text-[27px] font-extrabold tracking-[-0.045em]">{loading ? "CHECKING DEVNET" : state}</h2>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed">
                {state === "VERIFIED"
                  ? "Program, transactions, TxLINE receipt, three wallet deltas, vault conservation, and account closure all match devnet."
                  : state === "FAILED"
                    ? "At least one recorded claim contradicts current devnet evidence."
                    : "The lifecycle stays UNKNOWN until every required devnet RPC check completes; unavailable evidence never becomes success."}
              </p>
            </div>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-current/20 bg-white/70 px-3 text-[10.5px] font-bold disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Recheck</button>
        </div>
        {verification && <p className="mt-4 text-[9.5px] opacity-75">{verification.summary.verified} verified · {verification.summary.failed} failed · {verification.summary.unknown} unknown · checked {new Date(verification.checkedAt).toLocaleString("en-GB")}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <WalletCard name="Wallet A" role="Honest YES" amount="+0.01 SOL net" result="Receives the 0.02 SOL A+B accepted pool" />
        <WalletCard name="Wallet B" role="Honest NO" amount="−0.01 SOL net" result="Loses accepted collateral; all account rent returns" />
        <WalletCard name="Wallet C" role="Stale YES exploit" amount="0 SOL net" result="0.01 SOL stake refunds; all account rent returns" />
      </div>

      <div className="space-y-2">
        {(verification?.checks ?? []).map((check) => {
          const CheckIcon = check.status === "VERIFIED" ? CheckCircle2 : check.status === "FAILED" ? XCircle : AlertTriangle;
          return <article key={check.id} className="rounded-xl border border-(--border) bg-white p-4"><div className="flex items-start gap-3"><CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${check.status === "VERIFIED" ? "text-emerald-600" : check.status === "FAILED" ? "text-red-600" : "text-amber-600"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[12px] font-bold">{check.label}</h3><span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold ${tone[check.status]}`}>{check.status}</span></div><p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">{check.detail}</p>{check.evidence && <a href={check.evidence} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-(--blue)">Open evidence <ArrowUpRight className="h-3 w-3" /></a>}</div></div></article>;
        })}
      </div>
    </section>
  );
}

function WalletCard({ name, role, amount, result }: { name: string; role: string; amount: string; result: string }) {
  return <article className="rounded-xl border border-(--border) bg-white p-4"><p className="text-[10px] font-bold text-(--blue)">{name}</p><h3 className="mt-1 text-[14px] font-bold">{role}</h3><p className="mt-2 text-[15px] font-extrabold tracking-[-0.02em] text-(--ink)">{amount}</p><p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">{result}</p></article>;
}
