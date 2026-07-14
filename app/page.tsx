import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { ExploitAnimation } from "@/components/fairx/ExploitAnimation";

export const metadata: Metadata = {
  title: "Impossible-to-exploit prediction markets",
  description: "FairX is like Polymarket, except stale-price snipes get refunded — not rewarded. Built on Solana devnet.",
};

export default function HomePage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1080px]">
        <section className="py-8 text-center sm:py-14">
          <p className="text-[11px] font-bold text-(--blue)">Prediction markets · Solana devnet</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-[42px] font-extrabold leading-[0.98] tracking-[-0.065em] text-(--ink) sm:text-[68px]">Impossible-to-exploit prediction markets.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-(--ink-2) sm:text-[19px]">It&rsquo;s like Polymarket &mdash; except when someone snipes a stale price, they get refunded, not rewarded. Honest trades keep going.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/markets/france-morocco-france-win" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-(--blue) px-6 text-[13px] font-bold text-white">Trade <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/proof" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-(--border) bg-white px-6 text-[13px] font-bold text-(--ink)"><ShieldCheck className="h-4 w-4 text-(--blue)" />Verify Proof</Link>
          </div>
        </section>

        <section aria-labelledby="selective-protection" className="py-6">
          <h2 id="selective-protection" className="text-center text-[24px] font-extrabold tracking-[-0.04em] sm:text-[32px]">The same snipe, two markets.</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[14px] leading-relaxed text-(--ink-2)">A goal is scored. A bot rushes to buy the stale price before it updates.</p>
          <div className="mt-7"><ExploitAnimation /></div>
        </section>

        <section className="my-10 overflow-hidden rounded-2xl border border-(--border) bg-white" aria-labelledby="featured-market">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-(--green)"><ShieldCheck className="h-3.5 w-3.5" /><span>SETTLED · VERIFIED ON SOLANA</span></div>
              <p className="mt-5 text-[14px] font-semibold text-(--ink-2)">France vs Morocco</p>
              <h2 id="featured-market" className="mt-1 text-[30px] font-extrabold tracking-[-0.045em] sm:text-[38px]">Will France win?</h2>
              <div className="mt-6 flex max-w-md gap-3">
                <Price label="YES" value="86.5¢" tone="yes" />
                <Price label="NO" value="13.5¢" tone="no" />
              </div>
            </div>
            <div className="border-t border-(--border) bg-[#f8fafc] p-6 lg:border-l lg:border-t-0">
              <p className="flex items-center gap-2 text-[12px] font-bold text-(--green)"><ShieldCheck className="h-4 w-4" />Protected by LineGuard</p>
              <dl className="mt-5 space-y-3 text-[12px]"><Row label="Staked" value="0.01 SOL" /><Row label="Outcome" value="France won" /><Row label="Paid out" value="0.01 SOL" /></dl>
              <Link href="/markets/france-morocco-france-win" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-(--ink) text-[12px] font-bold text-white">View this market <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="grid gap-6 sm:grid-cols-3">{[
            ["Capture", "FairX tracks the real market price as the match unfolds."],
            ["Protect", "Snipe a stale price and you're refunded — not rewarded."],
            ["Verify", "Every trade and payout settles on Solana. Check it yourself."],
          ].map(([title, text], i) => <article key={title} className="text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-(--blue-bg) text-[12px] font-bold text-(--blue)">{i + 1}</span><h3 className="mt-4 text-[16px] font-bold">{title}</h3><p className="mt-2 text-[12px] leading-relaxed text-(--ink-2)">{text}</p></article>)}</div>
          <div className="mt-9 flex justify-center">
            <Link href="/proof" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-(--border) bg-white px-6 text-[12px] font-bold text-(--ink)"><ShieldCheck className="h-4 w-4 text-(--blue)" />See the proof, re-read live from Solana</Link>
          </div>
        </section>

        <p className="pb-4 text-center text-[10px] text-(--ink-3)">Settled on Solana devnet · devnet SOL only · <Link href="/proof" className="font-semibold text-(--ink-2) hover:text-(--blue)">verify every number yourself &rarr;</Link></p>
      </div>
    </FairXShell>
  );
}

function Price({ label, value, tone }: { label: string; value: string; tone: "yes" | "no" }) {
  return <div className={`flex-1 rounded-xl px-4 py-4 ${tone === "yes" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}><p className="text-[11px] font-bold">{label}</p><p className="mt-1 text-[26px] font-extrabold">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-(--ink-3)">{label}</dt><dd className="font-semibold text-(--ink)">{value}</dd></div>;
}
