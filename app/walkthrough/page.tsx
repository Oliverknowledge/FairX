import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Radio, ShieldCheck, Trophy } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";

export const metadata: Metadata = {
  title: "How FairX Works",
  description: "How LineGuard protects a football prediction market from stale-price sniping.",
};

const orderSteps = [
  ["Match event occurs", "France scores and the real match state changes."],
  ["TxLINE evidence reports it", "In the preserved historical capture, the football event arrives before the displayed market price catches up."],
  ["Market price may lag", "For a short moment, the displayed price can still reflect the old match state."],
  ["A user submits an order", "The wallet signs a devnet SOL order at the displayed YES or NO price."],
  ["LineGuard checks the edge", "It asks whether that specific order benefits unfairly from the stale price."],
  ["Refund or accept", "An exploit refunds automatically; a fair order becomes an on-chain position."],
] as const;

const settlementSteps = [
  ["TxLINE validates the final score", "The canonical score is France 1, Morocco 0."],
  ["The market resolves", "The committed rule derives YES: France won."],
  ["The winner claims", "The position owner claims devnet SOL from the isolated market vault."],
] as const;

export default function WalkthroughPage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[980px]">
        <header className="py-6 text-center sm:py-10">
          <p className="text-[11px] font-bold text-(--blue)">How it works</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-[39px] font-extrabold leading-[1] tracking-[-0.06em] sm:text-[56px]">Fair orders continue. Stale-price exploits refund.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-(--ink-2)">LineGuard checks each order against the latest TxLINE match information without stopping the whole market.</p>
        </header>

        <section aria-labelledby="protected-entry">
          <h2 id="protected-entry" className="text-[23px] font-extrabold tracking-[-0.035em]">Protected entry</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{orderSteps.map(([title, text], index) => <Step key={title} number={index + 1} title={title} text={text} icon={index === 1 ? Radio : index === 4 ? ShieldCheck : CheckCircle2} />)}</div>
        </section>

        <section className="mt-12" aria-labelledby="settlement">
          <h2 id="settlement" className="text-[23px] font-extrabold tracking-[-0.035em]">Settlement</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{settlementSteps.map(([title, text], index) => <Step key={title} number={index + 7} title={title} text={text} icon={index === 2 ? Trophy : CheckCircle2} green />)}</div>
        </section>

        <section className="mt-12 rounded-2xl bg-(--ink) p-7 text-white sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div><p className="text-[12px] font-bold text-emerald-300">The verified three-wallet proof</p><p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-200">A finished +0.01 SOL, B −0.01 SOL, and C flat after its stale-order refund. The live verifier currently proves those deltas from devnet and falls back to UNKNOWN if any evidence is unavailable.</p></div>
          <Link href="/proof" className="mt-5 inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-5 text-[12px] font-bold text-(--ink) sm:mt-0">Run verifier <ArrowRight className="h-4 w-4" /></Link>
        </section>

        <details className="mt-6 rounded-xl border border-(--border) bg-white p-4"><summary className="cursor-pointer text-[12px] font-bold">Technical details</summary><p className="mt-3 text-[11px] leading-relaxed text-(--ink-2)">The repository v3 path signs execution price, slippage, pricing sequence, odds sequence and expiry; uses price-weighted pool shares; requires direct TxLINE ValidateStatV2 plus two-of-three resolution; and closes every order and position account on refund, claim or loss.</p><Link href="/proof" className="mt-3 inline-flex text-[11px] font-bold text-(--blue)">Verify current evidence state →</Link></details>
      </div>
    </FairXShell>
  );
}

function Step({ number, title, text, icon: Icon, green = false }: { number: number; title: string; text: string; icon: typeof CheckCircle2; green?: boolean }) {
  return <article className="rounded-2xl border border-(--border) bg-white p-5"><div className="flex items-center justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-full ${green ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}><Icon className="h-4 w-4" /></span><span className="text-[11px] font-bold text-(--ink-3)">{number}</span></div><h3 className="mt-5 text-[15px] font-bold">{title}</h3><p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">{text}</p></article>;
}
