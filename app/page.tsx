import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, Gauge, Radio, ReceiptText, RefreshCw, ShieldCheck, Vault } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { FairXLiveDemo } from "@/components/runtime/FairXLiveDemo";
import { V4_PROGRAM_ID } from "@/lib/v4/replay";

const HOW_IT_WORKS = [
  {
    icon: Radio,
    number: "01",
    title: "Detect",
    text: "Receive fixture-bound TxLINE evidence and advance the required material-event sequence.",
  },
  {
    icon: Gauge,
    number: "02",
    title: "Measure",
    text: "Expose event sequence, quote sequence, sequence delta, stale-window state, and market health together.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Protect",
    text: "If OrderSequence is behind RequiredSequence, return the full principal and create no position liability.",
  },
  {
    icon: ReceiptText,
    number: "04",
    title: "Explain",
    text: "Issue a readable integrity receipt with the exact comparison, funds outcome, and evidence source.",
  },
  {
    icon: RefreshCw,
    number: "05",
    title: "Recover",
    text: "Synchronize the quote, return market health to green, and give the trader a clean retry path.",
  },
  {
    icon: CheckCircle2,
    number: "06",
    title: "Verify",
    text: "Resolve accepted positions and export the recorded Solana and TxLINE evidence for independent review.",
  },
] as const;

export default function HomePage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1240px]">
        <FairXLiveDemo />

        <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20" aria-labelledby="how-title">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <div>
              <p className="section-label text-(--blue)">How It Works</p>
              <h2 id="how-title" className="mt-3 text-[34px] font-extrabold leading-[1.02] tracking-[-.05em] sm:text-[48px]">One operational loop from evidence to proof.</h2>
            </div>
            <p className="max-w-2xl text-[13px] leading-6 text-(--ink-2) lg:justify-self-end">FairX sits between verified sports evidence and order execution. Operators get a deterministic sequence boundary, a recovery workflow, and public evidence without replacing their market frontend.</p>
          </div>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-(--border) bg-(--border) sm:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS.map(({ icon: Icon, number, title, text }) => (
              <li key={title} className="bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-(--blue)"><Icon className="h-5 w-5" /></span><span className="text-[9px] font-bold text-(--ink-3)">{number}</span></div>
                <h3 className="mt-5 text-[14px] font-extrabold">{title}</h3>
                <p className="mt-2 text-[10px] leading-5 text-(--ink-2)">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-blue-50" aria-labelledby="proof-cta-title">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.1em] text-blue-700"><Database className="h-4 w-4" /> Proof</p>
              <h2 id="proof-cta-title" className="mt-3 text-[30px] font-extrabold tracking-[-.045em] sm:text-[42px]">The runtime explains the guard. Devnet proves the canonical settlement.</h2>
              <p className="mt-4 max-w-3xl text-[11px] leading-5 text-blue-950/70">Program <span className="mono font-bold">{V4_PROGRAM_ID}</span> · 24 finalized transactions · direct TxLINE CPI verification · lifecycle verified 20/20 · every recorded liability reconciled.</p>
            </div>
            <Link href="/proof" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--ink) px-6 text-[12px] font-extrabold text-white">Open proof summary <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-px border-t border-blue-200 bg-blue-200 sm:grid-cols-3">
            <ProofFact icon={ShieldCheck} label="Order protection" value="0.010000000 SOL returned" />
            <ProofFact icon={Vault} label="Accounting" value="Final liabilities and positions: 0" />
            <ProofFact icon={Radio} label="TxLINE" value="Odds and final-result CPI verified" />
          </div>
        </section>
      </div>
    </FairXShell>
  );
}

function ProofFact({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return <div className="flex items-center gap-3 bg-white p-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span><div><p className="text-[8px] font-bold uppercase tracking-[.08em] text-(--ink-3)">{label}</p><p className="mt-1 text-[10.5px] font-extrabold">{value}</p></div></div>;
}
