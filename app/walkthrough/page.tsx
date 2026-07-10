import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileCheck2, Hash, Radio, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/lineguard/ui";
import { DemoSequence } from "@/components/fairx-proof/DemoSequence";
import { FreshDevnetPanel } from "@/components/fairx-proof/FreshDevnetPanel";
import { FairXShell } from "@/components/fairx/FairXShell";

export const metadata: Metadata = {
  title: "Proof Walkthrough | FairX",
  description: "A guided walkthrough of LineGuard's canonical Solana devnet proof cases, with fresh devnet execution.",
};

export default function WalkthroughPage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1180px]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to FairX
          </Link>
          <div className="mt-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--green-bg)">
              <ShieldCheck className="h-5 w-5 text-(--green)" />
            </span>
            <div>
              <p className="mono text-[10px] font-semibold uppercase tracking-[0.16em] text-(--ink-3)">FairX powered by LineGuard</p>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.035em] text-(--ink)">The live proof flow.</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">
                Follow a single stale-price window from event ingestion to two different settlement decisions, then generate fresh devnet execution on demand.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Devnet funds only</Badge>
          <Link href="/proof" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
            <FileCheck2 className="h-3.5 w-3.5" /> Open proof hub
          </Link>
        </div>
      </header>

      <DemoSequence />

      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="section-label">Beyond the recording</span>
          <span className="h-px flex-1 bg-(--border)" />
        </div>
        <FreshDevnetPanel />
      </div>

      <section className="card mt-5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-(--blue)" />
          <p className="section-label">TxLINE provenance — how an event enters the proof chain</p>
        </div>
        <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-(--ink-2)">
          Every material event flows through the same pipeline before the guard sees it. Live TxLINE is used when credentials are configured;
          otherwise a real captured payload or a manually imported payload is used — always labelled honestly, never presented as live.
        </p>
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-[640px] items-center gap-2 text-[10px]">
            <PipeStep icon={<Radio className="h-3 w-3" />} label="Raw payload" sub="live / captured / manual" />
            <Chevron />
            <PipeStep icon={<Hash className="h-3 w-3" />} label="rawEventHash" sub="sha256 of raw" />
            <Chevron />
            <PipeStep icon={<Hash className="h-3 w-3" />} label="normalize + trace" sub="normalizedEventHash" />
            <Chevron />
            <PipeStep icon={<ShieldCheck className="h-3 w-3" />} label="materiality" sub="opens stale window" />
            <Chevron />
            <PipeStep icon={<ShieldCheck className="h-3 w-3" />} label="guard verdict" sub="hash bound on-chain" tone="green" />
          </div>
        </div>
        <Link href="/terminal" className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-(--blue) hover:underline">
          Import a real TxLINE payload in the terminal (capture / paste → hash → normalize → open stale window) <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>
      </div>
    </FairXShell>
  );
}

function PipeStep({ icon, label, sub, tone = "blue" }: { icon: React.ReactNode; label: string; sub: string; tone?: "blue" | "green" }) {
  return (
    <div className={`flex-1 rounded-lg border p-2.5 ${tone === "green" ? "border-[#bce6d5] bg-(--green-bg)" : "border-(--border) bg-white"}`}>
      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] ${tone === "green" ? "text-(--green)" : "text-(--blue)"}`}>{icon} {label}</span>
      <p className="mt-1 text-[9.5px] leading-snug text-(--ink-3)">{sub}</p>
    </div>
  );
}

function Chevron() {
  return <ArrowUpRight className="h-3 w-3 shrink-0 rotate-45 text-(--ink-3)" />;
}
