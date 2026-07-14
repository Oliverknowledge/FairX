import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { formatPrice, formatSol, REPLAY_LABEL, runCanonicalLifecycle, V4_REPLAY_SLUG } from "@/lib/v4/replay";

export default function PortfolioPage() {
  const lifecycle = runCanonicalLifecycle();
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1000px]">
        <header className="border-b border-(--border) pb-6"><p className="section-label">Canonical V4 position set</p><h1 className="mt-2 text-[40px] font-extrabold tracking-[-0.055em]">Replay positions</h1><p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-(--ink-2)">{REPLAY_LABEL} These are deterministic lifecycle outputs, not connected-wallet or deployed accounts.</p></header>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {lifecycle.positions.map((position) => (
            <article key={position.id} className="card p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="section-label">{position.ownerLabel}</p><h2 className="mt-1 text-[18px] font-bold">France win · {position.side}</h2></div><Status value={position.status} /></div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-[10.5px]"><Stat label="Stake" value={formatSol(position.stakeLamports)} /><Stat label="Execution" value={position.grossPayoutLamports ? formatPrice(position.priceMicros) : "Never accepted"} /><Stat label="Fixed gross payout" value={position.grossPayoutLamports ? formatSol(position.grossPayoutLamports) : "0 SOL"} /><Stat label="Reserved liability" value={formatSol(position.liabilityLamports)} /></dl>
              <div className="mt-4 border-t border-(--border) pt-3 text-[10.5px] text-(--ink-2)"><p>Quote: {position.quoteLabel} · event sequence {position.materialEventSequence}</p>{position.status === "REFUNDED" && <p className="mt-2 flex items-center gap-1.5 font-semibold text-(--green)"><ShieldCheck className="h-3.5 w-3.5" />Stake returned atomically; claim path permanently unavailable.</p>}{position.status === "CLAIMED" && <p className="mt-2 flex items-center gap-1.5 font-semibold text-(--green)"><CheckCircle2 className="h-3.5 w-3.5" />Exact fixed payout released.</p>}</div>
            </article>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-(--border) bg-white p-5 text-[11px] leading-relaxed text-(--ink-2)"><p className="font-bold text-(--ink)">Rent lifecycle</p><p className="mt-2">After CLAIMED, LOST or REFUNDED becomes terminal, the owner may close the position PDA. The program decrements the vault position count and Anchor returns the full account rent to the recorded owner. Accepted positions cannot close.</p></div>
        <Link href={`/markets/${V4_REPLAY_SLUG}`} className="mt-5 inline-flex h-11 items-center rounded-lg bg-(--ink) px-5 text-[11px] font-bold text-white">Return to replay</Link>
      </div>
    </FairXShell>
  );
}

function Status({ value }: { value: string }) { const green = value === "CLAIMED" || value === "REFUNDED"; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${green ? "bg-(--green-bg) text-(--green)" : "bg-slate-100 text-slate-600"}`}>{value}</span>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#f7f8fa] p-3"><dt className="text-(--ink-3)">{label}</dt><dd className="mt-1 font-semibold text-(--ink)">{value}</dd></div>; }
