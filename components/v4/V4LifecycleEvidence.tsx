"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, Coins, FileCheck2, Loader2, RefreshCw, ShieldCheck, ShieldX, Vault, XCircle } from "lucide-react";
import type { V4VerificationResponse } from "@/lib/proof/verificationApi";

const ICON = { VERIFIED: CheckCircle2, FAILED: XCircle, UNKNOWN: CircleDashed } as const;

function ageLabel(seconds: number | null) {
  if (seconds === null) return "unknown age";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function utcTimestamp(value: string) {
  return new Date(value).toISOString().replace("T", " ").replace(".000Z", "Z");
}

export function reverificationNotice(response: V4VerificationResponse) {
  if (response.latestAttempt && response.latestAttempt.status !== "VERIFIED" && response.verification?.status === "VERIFIED") {
    return "Fresh re-verification unavailable; displaying the last successful verified result.";
  }
  if (response.latestAttempt?.status === "VERIFIED") return "Fresh Solana re-verification completed successfully.";
  return null;
}

export function V4LifecycleEvidence({ initialResponse }: { initialResponse: V4VerificationResponse }) {
  const [response, setResponse] = useState(initialResponse);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), force ? 50_000 : 8_000);
    try {
      const api = await fetch(`/api/verify/v4-lifecycle${force ? "?force=1" : ""}`, { cache: "no-store", signal: controller.signal });
      const next = (await api.json()) as V4VerificationResponse;
      setResponse(next);
      setNotice(force ? reverificationNotice(next) : null);
    } catch {
      if (force) setNotice("Fresh re-verification unavailable; displaying the last successful verified result.");
    } finally {
      clearTimeout(timeout);
      if (force) setRefreshing(false);
    }
  }, []);

  // This reads the fast server cache only. A complete verified result is already
  // present in initialResponse, so React development double-invocation never
  // produces a loading screen or duplicate browser-visible verifier state.
  useEffect(() => { void load(false); }, [load]);

  const result = response.verification;
  const verified = result?.status === "VERIFIED" && result.recordState === "recorded";
  const notRecorded = result?.recordState === "not_recorded";
  const style = verified
    ? { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-900", label: `VERIFIED ${result.summary.verified}/20` }
    : result?.status === "FAILED"
      ? { border: "border-red-300", bg: "bg-red-50", text: "text-red-900", label: "FAILED" }
      : { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-900", label: notRecorded ? "NOT RECORDED" : "VERIFICATION PENDING" };

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-5 sm:p-6`} data-proof-state={refreshing ? "refreshing" : notice?.startsWith("Fresh re-verification unavailable") ? "refresh-failed" : verified ? "verified" : "pending"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white/80 px-3 py-1.5 text-[10px] font-bold text-emerald-900"><ShieldCheck className="h-3.5 w-3.5" />DEPLOYED</span>
            <span className="inline-flex rounded-full border border-slate-300 bg-white/80 px-3 py-1.5 text-[10px] font-bold text-slate-700">CANONICAL LIFECYCLE RECORDED</span>
            <span className={`inline-flex rounded-full border ${style.border} bg-white/80 px-3 py-1.5 text-[10px] font-bold ${style.text}`}>{style.label}</span>
          </div>
          {verified ? (
            <p className="mt-3 text-[10.5px] leading-5 text-emerald-950/75">
              Last independently rechecked from Solana {ageLabel(response.cache.ageSeconds)} · <span className="mono">{utcTimestamp(response.cache.verifiedAt ?? result.checkedAt)}</span>
            </p>
          ) : (
            <p className="mt-3 text-[10.5px] leading-5 text-amber-950/75">No complete verified result is available. Explorer evidence remains accessible; absence is never rendered as success.</p>
          )}
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--border) bg-white px-4 text-[10.5px] font-bold text-(--ink) disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Re-verifying from Solana…" : "Re-verify from Solana"}</button>
      </div>

      {refreshing && <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[10.5px] leading-5 text-blue-950"><Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /><p><strong>Fresh verification in progress.</strong> Existing verified evidence remains visible while the server re-reads deployment accounts and 24 finalized transactions. The run is bounded to 45 seconds.</p></div>}
      {notice && <div className={`mt-4 flex items-start gap-3 rounded-xl border p-3 text-[10.5px] leading-5 ${notice.includes("unavailable") ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-white text-emerald-950"}`}>{notice.includes("unavailable") ? <ShieldX className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}<p>{notice}</p></div>}

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ProofOutcome icon={FileCheck2} label="Finalized transactions" value="24 recorded" />
        <ProofOutcome icon={ShieldCheck} label="Evidence identity" value={response.evidence.fixtureVersion} />
        <ProofOutcome icon={Coins} label="Verifier result" value={verified ? "20/20 checks" : "Pending"} />
        <ProofOutcome icon={Vault} label="Server RPC" value={response.rpc.privateConfigured ? "Private configured" : "Public fallback"} />
      </div>

      <div className="mt-3 grid gap-2 text-[9.5px] text-(--ink-2) sm:grid-cols-2">
        <p className="rounded-lg bg-white/70 px-3 py-2"><strong>Evidence hash</strong><br /><span className="mono break-all">{response.evidence.evidenceHash.slice(0, 16)}…{response.evidence.evidenceHash.slice(-8)}</span></p>
        <p className="rounded-lg bg-white/70 px-3 py-2"><strong>Cache status</strong><br />{response.cache.cached ? "Cached verified result" : "Fresh verifier result"} · TTL {response.cache.ttlSeconds / 60} minutes</p>
      </div>

      {result && (
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
      )}
    </div>
  );
}

function ProofOutcome({ icon: Icon, label, value }: { icon: typeof FileCheck2; label: string; value: string }) {
  return <div className="rounded-xl border border-(--border) bg-white p-3"><Icon className="h-4 w-4 text-(--green)" /><p className="mt-3 text-[8.5px] font-bold uppercase tracking-[.06em] text-(--ink-3)">{label}</p><p className="mt-1 break-words text-[10.5px] font-extrabold">{value}</p></div>;
}
