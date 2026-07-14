import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Radio, ShieldCheck, CheckCircle2 } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";

export const metadata: Metadata = {
  title: "How FairX Works",
  description: "Capture, protect, verify — how LineGuard keeps a prediction market unexploitable.",
};

const steps = [
  {
    icon: Radio,
    title: "Capture",
    text: "FairX continuously captures real market prices from genuine match evidence.",
  },
  {
    icon: ShieldCheck,
    title: "Protect",
    text: "When an event moves faster than the price, LineGuard refunds only the orders that exploit the stale price. Every fair trade keeps going.",
  },
  {
    icon: CheckCircle2,
    title: "Verify",
    text: "Every market decision settles on Solana and can be re-checked by anyone, independently.",
  },
] as const;

export default function WalkthroughPage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[900px]">
        <header className="py-6 text-center sm:py-12">
          <p className="text-[11px] font-bold text-(--blue)">How it works</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-[39px] font-extrabold leading-[1] tracking-[-0.06em] sm:text-[56px]">Why is this fair?</h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-(--ink-2)">Three things happen to every order. That&rsquo;s the whole protocol.</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="rounded-2xl border border-(--border) bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--blue-bg) text-(--blue)"><Icon className="h-5 w-5" /></span>
                <span className="text-[12px] font-bold text-(--ink-3)">{index + 1}</span>
              </div>
              <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.02em]">{title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-(--ink-2)">{text}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-2xl bg-(--ink) p-7 text-white sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <p className="text-[12px] font-bold text-emerald-300">See it proven</p>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-200">One real event, one exploit refunded, one winner paid &mdash; all re-read live from Solana devnet.</p>
          </div>
          <Link href="/proof" className="mt-5 inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-5 text-[12px] font-bold text-(--ink) sm:mt-0">Verify Proof <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </FairXShell>
  );
}
