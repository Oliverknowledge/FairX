"use client";

import { CircleAlert, Cpu, DatabaseZap, Radio, RefreshCw, ShieldCheck, Vault, Wallet } from "lucide-react";
import { useRuntimeStatus } from "@/hooks/useRuntimeStatus";

export function RuntimeStatusStrip({ detailed = false }: { detailed?: boolean }) {
  const { status, loading, error, refresh } = useRuntimeStatus();
  const items = status ? [
    { label: "Solana RPC", value: status.solana.rpcConnected ? `connected · slot ${status.solana.rpcSlot}` : "unavailable", ok: status.solana.rpcConnected, icon: DatabaseZap },
    { label: "Program", value: status.solana.programExecutable ? `executable · slot ${status.solana.deployedSlot ?? "unknown"}` : "not executable", ok: status.solana.programExecutable, icon: Cpu },
    { label: "v3 binary", value: status.solana.schemaCurrent ? "matches verified record" : "not independently matched", ok: status.solana.schemaCurrent, icon: ShieldCheck },
    { label: "Offline signer", value: status.operator.configured ? "configured" : "disabled", ok: !status.operator.configured, icon: Wallet },
    { label: "TxLINE", value: status.txline.authenticated ? `authenticated · ${status.txline.canonicalSourceMode}` : status.txline.configured ? "configured · unreachable" : "not configured", ok: status.txline.authenticated, icon: Radio },
    { label: "Archived TxLINE proof", value: status.txline.lastValidationPassed ? "passed" : "unknown", ok: status.txline.lastValidationPassed === true, icon: ShieldCheck },
    { label: "v3 lifecycle", value: status.canonicalProofAvailable && status.solana.schemaCurrent ? "RPC-verifiable" : "UNKNOWN", ok: status.solana.schemaCurrent, icon: Vault },
  ] : [];

  return (
    <section className="rounded-xl border border-(--border) bg-white" aria-label="Runtime status">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
        <p className="section-label mr-auto">Runtime status</p>
        {loading && <span className="text-[10px] text-(--ink-3)">Checking production-safe status…</span>}
        {error && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-(--red)"><CircleAlert className="h-3 w-3" />{error}</span>}
        {items.map(({ label, value, ok, icon: Icon }) => (
          <span key={label} className="inline-flex min-w-0 items-center gap-1.5 text-[9.5px]">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${ok ? "bg-(--green-bg) text-(--green)" : "bg-(--amber-bg) text-(--amber)"}`}><Icon className="h-3 w-3" /></span>
            <span><strong className="text-(--ink-2)">{label}</strong><span className="ml-1 text-(--ink-3)">{value}</span></span>
          </span>
        ))}
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh runtime status" className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--border) text-(--ink-3) hover:text-(--blue) disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      {detailed && status?.reason && <p className="border-t border-(--border) px-3 py-2 text-[10px] leading-relaxed text-(--ink-2)">{status.reason}</p>}
    </section>
  );
}
