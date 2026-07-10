import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, FileCheck2, ShieldAlert, ShieldCheck, Workflow } from "lucide-react";
import { DevnetBadge, FairXShell } from "@/components/fairx/FairXShell";
import { ProofStat } from "@/components/fairx/ProofStat";

export const metadata: Metadata = {
  title: "FairX — Protected prediction markets",
  description: "A devnet prototype for prediction markets protected by LineGuard settlement verification.",
};

export default function HomePage() {
  return (
    <FairXShell compact>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch">
        <div className="card relative overflow-hidden p-5 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#2563eb] via-[#60a5fa] to-[#dbeafe]" />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full border border-[#d6e4fd] bg-[#f4f8ff] px-2.5 text-[9.5px] font-bold uppercase tracking-[0.11em] text-[#2563b5]">
              FairX powered by LineGuard
            </span>
            <DevnetBadge className="sm:hidden" />
          </div>
          <h1 className="mt-5 max-w-3xl text-[33px] font-bold leading-[0.98] tracking-[-0.06em] text-(--ink) sm:text-[46px]">
            Every market can prove who won. <span className="text-(--blue)">FairX proves each trade was fair.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">
            A protected prediction-market prototype where a material event can never let an unfair stale-price order quietly fill.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/walkthrough" className="inline-flex h-10 items-center gap-2 rounded-md bg-(--ink) px-3.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#273244]">
              Proof walkthrough
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
            <Link
              href="/markets"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#bdd2f7] bg-[#f8fbff] px-3.5 text-[11px] font-semibold text-(--blue) transition-colors hover:bg-[#eff5ff]"
            >
              Explore markets
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
            <Link
              href="/proof"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-(--border) bg-white px-3.5 text-[11px] font-semibold text-(--ink-2) transition-colors hover:border-[#cbd5e1] hover:text-(--ink)"
            >
              View proof
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <Link href="/terminal" className="font-semibold text-(--ink-2) hover:text-(--blue) hover:underline">
              Open technical LineGuard terminal
            </Link>
            <span className="hidden h-3 w-px bg-(--border) sm:block" />
            <span className="text-(--ink-3)">Canonical devnet proof cases remain available.</span>
          </div>
        </div>

        <aside className="card overflow-hidden bg-[#101827] p-5 text-white sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9db9ea]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Settlement guard
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2f6ace]/40 bg-[#16458d]/30 px-2 py-1 text-[9.5px] font-semibold text-[#c7dcff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#69a0ff]" />
              DEVNET
            </span>
          </div>
          <h2 className="mt-5 text-[20px] font-bold leading-tight tracking-[-0.035em]">A clear verdict before funds move.</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[#aebbd0]">
            The market stays visible. LineGuard only intervenes when its source sequence proves the quoted price is no longer fair.
          </p>
          <ol className="mt-5 space-y-0 border-l border-white/15 pl-4">
            {[
              ["01", "Observed price frozen", "Order captures the quote it saw."],
              ["02", "Materiality checked", "TxLINE sequence tests freshness."],
              ["03", "Receipt + verdict", "Fill or refund is evidence-backed."],
            ].map(([step, title, description]) => (
              <li key={step} className="relative pb-4 last:pb-0">
                <span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#101827] bg-[#5d94ef]" />
                <p className="text-[9px] font-bold tracking-[0.12em] text-[#7fa8ed]">{step}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-[#aebbd0]">{description}</p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3" aria-label="Verified proof outcomes">
        <ProofStat
          icon={BadgeCheck}
          eyebrow="On-chain program"
          title="Program deployed on devnet"
          detail="Anchor program is configured for the canonical LineGuard proof flow."
          tone="blue"
        />
        <ProofStat
          icon={ShieldAlert}
          eyebrow="Canonical YES case"
          title="YES stale attack refunded"
          detail="A stale-edge attempt reaches the guard and is voided with proof."
          tone="red"
        />
        <ProofStat
          icon={CheckCircle2}
          eyebrow="Canonical NO case"
          title="NO stale trade filled"
          detail="A no-edge order remains eligible and settles through the same guard."
          tone="green"
        />
      </section>

      <section className="card mt-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#d8e5fa] bg-[#f6f9ff] text-(--blue)">
            <Workflow className="h-4 w-4" strokeWidth={2.1} />
          </span>
          <div>
            <p className="text-[11px] font-bold text-(--ink)">Start with the proof, not the pitch.</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-(--ink-2)">
              Inspect the devnet transactions, receipt verification, and captured TxLINE provenance behind the LineGuard guard engine.
            </p>
          </div>
        </div>
        <Link href="/proof" className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] font-semibold text-(--blue) hover:underline">
          <FileCheck2 className="h-3.5 w-3.5" />
          Open proof hub
        </Link>
      </section>
    </FairXShell>
  );
}
