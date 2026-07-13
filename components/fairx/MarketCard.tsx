import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { FairXMarket } from "@/lib/markets/catalog";

function cents(value: number) { return `${(value * 100).toFixed(1)}¢`; }

export function MarketCard({ market }: { market: FairXMarket; liveConnected?: boolean }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-(--border) bg-white shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-(--ink-3)"><span>France vs Morocco</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Resolved</span></div>
        <h2 className="mt-5 text-[28px] font-extrabold tracking-[-0.045em]">Will France win?</h2>
        <div className="mt-6 grid grid-cols-2 gap-3"><Price label="YES" value={cents(market.displayedPrice)} yes /><Price label="NO" value={cents(1 - market.displayedPrice)} /></div>
        <dl className="mt-6 space-y-3 border-t border-(--border) pt-5 text-[12px]"><Row label="Source" value="TxLINE historical" /><Row label="On-chain collateral" value="0.01 SOL accepted" /><Row label="Result" value="France won" /></dl>
        <p className="mt-5 flex items-center gap-2 text-[12px] font-bold text-(--green)"><ShieldCheck className="h-4 w-4" />LineGuard protected</p>
      </div>
      <Link href={`/markets/${market.id}`} className="flex h-[52px] items-center justify-between border-t border-(--border) bg-[#f8fafc] px-6 text-[12px] font-bold text-(--ink)">View market <ArrowRight className="h-4 w-4" /></Link>
    </article>
  );
}

function Price({ label, value, yes = false }: { label: string; value: string; yes?: boolean }) { return <div className={`rounded-xl p-4 ${yes ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}><p className="text-[11px] font-bold">{label}</p><p className="mt-1 text-[25px] font-extrabold">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-(--ink-3)">{label}</dt><dd className="font-semibold text-(--ink)">{value}</dd></div>; }
