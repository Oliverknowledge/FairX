"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, History, Loader2, RefreshCw, XCircle } from "lucide-react";

interface V3Verification {
  status: "VERIFIED" | "FAILED" | "UNKNOWN";
  summary: { verified: number; failed: number; unknown: number };
  rpcUrl: string;
}

// Real, finalized facts from fixtures/lineguard/v3-france-morocco-three-wallet.json.
const V3 = {
  programId: "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe",
  market: "3nGRDiqfYYcstrhavoqHAqfmEYckazHDEhV3sNezF2H2",
  refundTx: "3bscw766NW46hVKX4EYAEKutibCPv7T7RW44JGMV5BgWG7TpoNQxVeMMR2ujeCbVevnwDGjkXmGhjKZSmkmJiEx2",
  claimTx: "57AHJUdFkpK5uGgiNvxFAFHuF9nbAgwbSZB4juvchgjWsH3JZJQUss7e3ULRRZSn5v2MSDag1LvgPLYhC96tbyP5",
};
const addr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const txUrl = (t: string) => `https://explorer.solana.com/tx/${t}?cluster=devnet`;

export function V3PredecessorEvidence() {
  const [result, setResult] = useState<V3Verification | "loading" | "error">("loading");

  const load = useCallback(async () => {
    setResult("loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/verify/v3-lifecycle", { cache: "no-store", signal: controller.signal });
      setResult((await response.json()) as V3Verification);
    } catch {
      setResult("error");
    } finally {
      clearTimeout(timeout);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const badge = (() => {
    if (result === "loading") return { text: "checking…", cls: "border-slate-300 text-slate-600", Icon: Loader2, spin: true };
    if (result === "error") return { text: "verifier unavailable", cls: "border-slate-300 text-slate-600", Icon: CircleDashed, spin: false };
    if (result.status === "VERIFIED") return { text: `VERIFIED · ${result.summary.verified} checks`, cls: "border-emerald-300 text-emerald-800", Icon: CheckCircle2, spin: false };
    if (result.status === "FAILED") return { text: "FAILED", cls: "border-red-300 text-red-800", Icon: XCircle, spin: false };
    return { text: "UNKNOWN (RPC)", cls: "border-amber-300 text-amber-800", Icon: CircleDashed, spin: false };
  })();

  return (
    <div className="rounded-xl border border-(--border) bg-[#f8fafc] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[14px] font-extrabold text-(--ink)"><History className="h-4 w-4 text-(--ink-2)" />Deployed predecessor evidence — LineGuard V3</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}>
          <badge.Icon className={`h-3.5 w-3.5 ${badge.spin ? "animate-spin" : ""}`} />RPC check · {badge.text}
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-[11.5px] leading-relaxed text-(--ink-2)">
        V3 (LineGuard) is FairX&rsquo;s <strong>deployed historical predecessor</strong>. On Solana devnet it proves the original core primitive:
        selective refund of only the stale-price exploit order, and genuine counterparty collateral settlement. Its transactions are real and
        independently re-read from RPC (18 checks). <strong>V4 is the hardened successor</strong> with the operator-liquidity fixed-payout vault.
        This V3 evidence is <strong>not</strong> V4 lifecycle evidence; the separate layers above verify V4.
      </p>

      <div className="mt-4 grid gap-2 text-[10.5px] sm:grid-cols-2">
        <a href={addr(V3.programId)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-(--border) bg-white px-3 py-2"><span className="text-(--ink-3)">V3 program</span><span className="mono flex items-center gap-1 font-semibold">{V3.programId.slice(0, 8)}…{V3.programId.slice(-6)}<ExternalLink className="h-3 w-3 opacity-40" /></span></a>
        <a href={addr(V3.market)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-(--border) bg-white px-3 py-2"><span className="text-(--ink-3)">Resolved market</span><span className="mono flex items-center gap-1 font-semibold">{V3.market.slice(0, 8)}…{V3.market.slice(-6)}<ExternalLink className="h-3 w-3 opacity-40" /></span></a>
        <a href={txUrl(V3.refundTx)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-(--border) bg-white px-3 py-2"><span className="text-(--ink-3)">Selective refund (C)</span><span className="flex items-center gap-1 font-semibold text-(--green)">stale exploit refunded 0.01 SOL<ExternalLink className="h-3 w-3 opacity-40" /></span></a>
        <a href={txUrl(V3.claimTx)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-(--border) bg-white px-3 py-2"><span className="text-(--ink-3)">Winner payout (A)</span><span className="flex items-center gap-1 font-semibold text-(--green)">received 0.02 SOL (A+B pool)<ExternalLink className="h-3 w-3 opacity-40" /></span></a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-(--ink-3)">
        <span>Net of equal setup funding: <strong className="text-(--green)">A +0.01</strong> · <strong className="text-(--red)">B −0.01</strong> (real losing counterparty) · <strong>C 0</strong> (refunded).</span>
        <button type="button" onClick={() => void load()} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-4 text-[10.5px] font-bold text-(--ink)"><RefreshCw className="h-3.5 w-3.5" />Re-verify V3</button>
      </div>
    </div>
  );
}
