import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, CircleDollarSign, ShieldCheck, Trophy, XCircle } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { formatPrice, formatSol, runCanonicalLifecycle, V4_REPLAY_SLUG, type ReplayPosition } from "@/lib/v4/replay";

const positionCopy: Record<ReplayPosition["id"], { label: string; headline: string; result: string; protection: string }> = {
  "pre-yes": { label: "Fair pre-event position", headline: "France YES before the goal", result: "Won · fixed payout received", protection: "Accepted at synchronized sequence 738" },
  "stale-bot": { label: "Stale-sequence order returned", headline: "France YES bound to sequence 738", result: "Principal returned · no position created", protection: "Order sequence 738 did not match required sequence 739" },
  "post-yes": { label: "Fair post-event position", headline: "France YES after repricing", result: "Won · fixed payout received", protection: "Accepted at synchronized sequence 739" },
  "pre-no": { label: "Losing position closed", headline: "France NO before the goal", result: "Lost · no payout", protection: "Fair position remained valid and closed normally" },
};

const displayOrder: ReplayPosition["id"][] = ["pre-yes", "stale-bot", "post-yes", "pre-no"];

export default function PortfolioPage() {
  const lifecycle = runCanonicalLifecycle();
  const positions = displayOrder.map((id) => lifecycle.positions.find((position) => position.id === id)!);
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1080px]">
        <header className="grid gap-5 border-b border-(--border) pb-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0"><p className="section-label text-(--blue)">Recorded position outcomes</p><h1 className="mt-3 max-w-full text-[36px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[52px]">One sequence rule. Four outcomes.</h1><p className="mt-4 max-w-2xl text-[13px] leading-6 text-(--ink-2)">These are deterministic reference outcomes from the finalized TxLINE historical lifecycle—not connected-wallet balances. Intent never decides the result; sequence eligibility does.</p></div>
          <Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-(--ink) px-5 text-[11px] font-bold text-white">Watch the replay <ArrowRight className="h-4 w-4" /></Link>
        </header>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {positions.map((position) => <PositionCard key={position.id} position={position} />)}
        </div>

        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="flex items-center gap-2 text-[12px] font-bold text-blue-950"><ShieldCheck className="h-4 w-4 text-blue-600" />Return the stale order. Keep the market open.</p><p className="mt-2 text-[11px] leading-5 text-blue-900/70">Only the sequence-738 order returned its principal. The synchronized sequence-739 position opened and later received its fixed payout.</p></div><Link href="/proof" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-5 text-[11px] font-bold text-blue-700">Verify these outcomes</Link></div>
        </section>
      </div>
    </FairXShell>
  );
}

function PositionCard({ position }: { position: ReplayPosition }) {
  const copy = positionCopy[position.id];
  const refunded = position.status === "REFUNDED";
  const won = position.status === "CLAIMED";
  const lost = position.status === "LOST";
  const amountLabel = refunded ? "Principal returned" : won ? "Payout" : "Payout";
  const amount = refunded ? formatSol(position.stakeLamports) : won ? formatSol(position.grossPayoutLamports) : "0 SOL";
  const StatusIcon = refunded ? ShieldCheck : won ? Trophy : XCircle;
  const tone = refunded ? "border-blue-200 bg-blue-50 text-blue-700" : won ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700";
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-(--border) bg-white shadow-[0_10px_30px_rgba(15,23,42,.04)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-[9.5px] font-bold uppercase tracking-[.09em] text-(--ink-3)">{copy.label}</p><h2 className="mt-2 text-[19px] font-extrabold tracking-[-.025em]">{copy.headline}</h2></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold ${tone}`}><StatusIcon className="h-3.5 w-3.5" />{refunded ? "PRINCIPAL RETURNED" : won ? "PAID" : "CLOSED · LOST"}</span></div>
        <p className="mt-4 text-[9.5px] font-semibold text-(--ink-2)">Actor: <span className="text-(--ink)">{position.ownerLabel}</span></p>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-(--border) sm:grid-cols-4"><OutcomeStat label="SIDE" value={position.side} /><OutcomeStat label="QUOTE" value={formatPrice(position.priceMicros).replace("¢", "%")} /><OutcomeStat label="SEQUENCE" value={String(position.materialEventSequence)} /><OutcomeStat label="STAKE" value={formatSol(position.stakeLamports)} /></div>
        <div className={`mt-4 rounded-xl border p-4 ${tone}`}><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold opacity-70">{amountLabel.toUpperCase()}</p><p className="mt-1 text-[20px] font-extrabold">{amount}</p></div><CircleDollarSign className="h-6 w-6 opacity-70" /></div><p className="mt-2 text-[10.5px] font-semibold">{copy.result}</p></div>
        <p className="mt-4 flex items-start gap-2 text-[10.5px] leading-5 text-(--ink-2)"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--green)" />{copy.protection}</p>
      </div>
      <details className="group border-t border-(--border) bg-slate-50/70">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-[10.5px] font-bold text-(--ink-2)">Technical details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <dl className="grid gap-3 border-t border-(--border) px-5 py-4 text-[10px] sm:grid-cols-2"><Technical label="Recorded actor" value={position.ownerLabel} /><Technical label="Material sequence" value={String(position.materialEventSequence)} /><Technical label="Reserved liability" value={formatSol(position.liabilityLamports)} /><Technical label="Fixed gross payout" value={position.grossPayoutLamports ? formatSol(position.grossPayoutLamports) : "None — order not opened"} /></dl>
      </details>
    </article>
  );
}

function OutcomeStat({ label, value }: { label: string; value: string }) { return <div className="min-w-0 bg-slate-50 p-3"><p className="text-[8px] font-bold text-(--ink-3)">{label}</p><p className="mt-1 break-words text-[10.5px] font-bold">{value}</p></div>; }
function Technical({ label, value }: { label: string; value: string }) { return <div><dt className="text-(--ink-3)">{label}</dt><dd className="mt-1 font-semibold text-(--ink)">{value}</dd></div>; }
