import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileCheck2, Hash, Radio, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/lineguard/ui";
import { DemoSequence } from "@/components/fairx-proof/DemoSequence";
import { FreshDevnetPanel } from "@/components/fairx-proof/FreshDevnetPanel";
import { FairXShell } from "@/components/fairx/FairXShell";
import { RuntimeStatusStrip } from "@/components/fairx/RuntimeStatusStrip";
import { TxLineProvenance } from "@/components/fairx/TxLineProvenance";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";

export const metadata: Metadata = {
  title: "Proof Walkthrough",
  description: "The continuous FairX v2 devnet lifecycle: TxLINE evidence, refund, Position, direct CPI, threshold resolution, payout, and vault conservation.",
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
              <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.035em] text-(--ink)">Watch selective settlement in 60 seconds.</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">
                One genuine TxLINE event, one market, one exact stale refund, one accepted Position, direct CPI, threshold resolution and owner claim.
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

      <div className="mb-4"><RuntimeStatusStrip detailed /></div>

      <div className="mb-5">
        <TxLineProvenance mode="historical" endpoint={canonicalCapture.endpoint} fixtureId={canonicalCapture.fixtureId} eventType={canonicalCapture.normalizedEvent.eventType} sequence={canonicalCapture.normalizedEvent.seq} receivedAt={canonicalCapture.receivedAt} rawEventHash={canonicalCapture.rawPayloadHash} normalizedEventHash={canonicalCapture.normalizedEventHash} proofState={canonicalValidation.simulationPassed ? "Direct TxLINE ValidateStatV2 CPI verified" : "TxLINE validation unavailable"} trace={canonicalCapture.normalizedEvent.trace} />
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-semibold leading-relaxed text-emerald-900">LineGuard reconstructed the exact Borsh payload, invoked TxLINE on devnet, required success, and derived YES from the validated 1–0 score.</p>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Canonical v2 lifecycle steps">{[
        "Genuine TxLINE event",
        "Stale exploit refunded",
        "Market repriced",
        "Accepted Position created",
        "Market closed",
        "Direct TxLINE CPI",
        "Two approvals",
        "YES derived",
        "User payout claimed",
        "Conservation verified",
      ].map((label, index) => <article key={label} className="rounded-xl border border-(--border) bg-white p-3"><span className="mono text-[9px] font-bold text-(--blue)">{String(index + 1).padStart(2, "0")}</span><p className="mt-2 text-[11px] font-bold text-(--ink)">{label}</p></article>)}</section>
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[12px] font-bold text-emerald-950">FairX protected entry, verified the result and paid the winning position from the same isolated market vault. <Link href="/verify/v2-france-morocco" className="ml-1 text-(--blue) underline">Verify all 12 checks.</Link></div>

      <section className="card mt-5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-(--blue)" />
          <p className="section-label">TxLINE provenance — how an event enters the proof chain</p>
        </div>
        <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-(--ink-2)">
          The canonical path preserves the genuine historical TxLINE record, hashes it, normalizes it, verifies its stats against the TxLINE devnet program, and then commits the normalized event hash through LineGuard.
        </p>
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-[640px] items-center gap-2 text-[10px]">
            <PipeStep icon={<Radio className="h-3 w-3" />} label="Genuine payload" sub="TxLINE historical" />
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
          Inspect the technical ingestion and normalizer trace <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <details className="mt-4 rounded-lg border border-(--border) bg-[#f8fafc] p-3">
          <summary className="cursor-pointer text-[10.5px] font-bold text-(--ink-2)">Historical protocol versions</summary>
          <p className="mt-2 text-[10px] leading-relaxed text-(--ink-2)">Legacy shared-vault and separate-validation proofs are retained for audit history and are not the current canonical story.</p>
          <div className="mt-3"><DemoSequence /></div><div className="mt-3"><FreshDevnetPanel /></div>
        </details>
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
