import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { canonicalV2Lifecycle } from "@/lib/proof/v2Lifecycle";

export const metadata: Metadata = {
  title: "Selective stale-price protection for prediction-market orders",
  description: "FairX is a football prediction market protected by LineGuard on Solana devnet.",
};

const proof = canonicalV2Lifecycle;

export default function HomePage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1080px]">
        <section className="py-8 text-center sm:py-14">
          <p className="text-[11px] font-bold text-(--blue)">Solana devnet · devnet SOL only</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-[42px] font-extrabold leading-[0.98] tracking-[-0.065em] text-(--ink) sm:text-[68px]">Refund the stale-price exploit. Keep the market.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-(--ink-2) sm:text-[19px]">FairX is a Solana devnet prototype where LineGuard checks each signed order against committed TxLINE-derived state and refunds only unfair positive stale edge.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/markets/france-morocco-france-win" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-(--blue) px-6 text-[13px] font-bold text-white">Inspect the market <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/proof" className="inline-flex h-12 items-center justify-center rounded-lg border border-(--border) bg-white px-6 text-[13px] font-bold text-(--ink)">Run the verifier</Link>
          </div>
        </section>

        <section aria-labelledby="selective-protection" className="py-10">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-(--ink-3)">Static explanatory example</p>
          <h2 id="selective-protection" className="text-center text-[28px] font-extrabold tracking-[-0.04em] sm:text-[36px]">One event. Two orders. Only the exploit is blocked.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <OutcomeCard title="Exploitative order" side="Buy YES at 52¢" actual="Actual probability: 86¢" edge="Unfair edge: +34¢" verdict="REFUNDED" tone="red" />
            <OutcomeCard title="Fair order" side="Buy NO at 48¢" actual="Actual probability: 14¢" edge="No positive edge" verdict="ACCEPTED" tone="green" />
          </div>
          <p className="mt-5 text-center text-[14px] font-semibold text-(--ink-2)">FairX blocks only the exploitative side. The market keeps trading.</p>
        </section>

        <section className="my-10 overflow-hidden rounded-2xl border border-(--border) bg-white" aria-labelledby="featured-market">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-(--ink-3)"><span>ARCHIVED V2</span><span>·</span><span>TXLINE HISTORICAL</span><span>·</span><span>RESOLVED</span></div>
              <p className="mt-5 text-[14px] font-semibold text-(--ink-2)">France vs Morocco</p>
              <h2 id="featured-market" className="mt-1 text-[30px] font-extrabold tracking-[-0.045em] sm:text-[38px]">Will France win?</h2>
              <div className="mt-6 flex max-w-md gap-3">
                <Price label="YES" value="86.5¢" tone="yes" />
                <Price label="NO" value="13.5¢" tone="no" />
              </div>
            </div>
            <div className="border-t border-(--border) bg-[#f8fafc] p-6 lg:border-l lg:border-t-0">
              <p className="flex items-center gap-2 text-[12px] font-bold text-(--green)"><ShieldCheck className="h-4 w-4" />LineGuard protected</p>
              <dl className="mt-5 space-y-3 text-[12px]"><Row label="On-chain collateral" value="0.01 SOL accepted" /><Row label="Result" value="France won" /><Row label="Payout" value="0.01 SOL claimed" /></dl>
              <Link href="/markets/france-morocco-france-win" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-(--ink) text-[12px] font-bold text-white">Inspect archived market <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section className="py-12">
          <h2 className="text-center text-[28px] font-extrabold tracking-[-0.04em]">From match event to payout</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">{[
            ["1", "TxLINE updates the match", "Genuine football data records the event and final score."],
            ["2", "LineGuard checks each order", "Exploitative stale-price orders refund; fair orders continue."],
            ["3", "Winners claim on Solana", "The winning wallet claims devnet SOL from the same market vault."],
          ].map(([number, title, text]) => <article key={number} className="text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-(--blue-bg) text-[12px] font-bold text-(--blue)">{number}</span><h3 className="mt-4 text-[16px] font-bold">{title}</h3><p className="mt-2 text-[12px] leading-relaxed text-(--ink-2)">{text}</p></article>)}</div>
        </section>

        <p className="pb-4 text-center text-[10px] text-(--ink-3)">Archived v2 record · program {proof.program.programId.slice(0, 8)}… · slot {proof.program.slot} · current v3 truth is reported by the independent verifier</p>
      </div>
    </FairXShell>
  );
}

function OutcomeCard({ title, side, actual, edge, verdict, tone }: { title: string; side: string; actual: string; edge: string; verdict: string; tone: "red" | "green" }) {
  const red = tone === "red";
  return <article className={`rounded-2xl border p-6 sm:p-8 ${red ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-[12px] font-bold text-(--ink-2)">{title}</p><p className="mt-5 text-[23px] font-extrabold tracking-[-0.035em]">{side}</p><p className="mt-3 text-[14px] text-(--ink-2)">{actual}</p><p className={`mt-1 text-[14px] font-bold ${red ? "text-(--red)" : "text-(--green)"}`}>{edge}</p><p className={`mt-7 flex items-center gap-2 text-[13px] font-extrabold ${red ? "text-(--red)" : "text-(--green)"}`}><Check className="h-4 w-4" />{verdict}</p></article>;
}

function Price({ label, value, tone }: { label: string; value: string; tone: "yes" | "no" }) {
  return <div className={`flex-1 rounded-xl px-4 py-4 ${tone === "yes" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}><p className="text-[11px] font-bold">{label}</p><p className="mt-1 text-[26px] font-extrabold">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-(--ink-3)">{label}</dt><dd className="font-semibold text-(--ink)">{value}</dd></div>;
}
