import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, ShieldCheck, Vault } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { formatPrice, REPLAY_LABEL, runCanonicalLifecycle, V4_EVIDENCE, V4_REPLAY_SLUG } from "@/lib/v4/replay";

export default function HomePage() {
  const lifecycle = runCanonicalLifecycle();
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1120px]">
        <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.15fr_.85fr] lg:py-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-(--green-bg) px-3 py-1.5 text-[10px] font-bold text-(--green)"><ShieldCheck className="h-3.5 w-3.5" />FIXED PAYOUT · FULLY COLLATERALISED</p>
            <h1 className="mt-5 max-w-3xl text-[48px] font-extrabold leading-[.98] tracking-[-0.065em] sm:text-[64px]">A sports vault that cannot sell yesterday’s price.</h1>
            <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-(--ink-2)">TxLINE supplies the source probability. The operator supplies every payout liability. LineGuard invalidates the quote the instant a genuine material-event sequence advances.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex h-12 items-center gap-2 rounded-lg bg-(--blue) px-6 text-[12px] font-bold text-white">Run the France–Morocco replay <ArrowRight className="h-4 w-4" /></Link><Link href="/proof" className="inline-flex h-12 items-center gap-2 rounded-lg border border-(--border) bg-white px-6 text-[12px] font-bold"><ShieldCheck className="h-4 w-4 text-(--green)" />Inspect the proof</Link></div>
          </div>
          <div className="card overflow-hidden">
            <div className="border-b border-(--border) bg-[#f8fafc] p-5"><p className="section-label">Canonical replay · fixture {V4_EVIDENCE.fixtureId}</p><h2 className="mt-2 text-[24px] font-extrabold">France 2–0 Morocco</h2><p className="mt-2 text-[11px] leading-relaxed text-(--ink-2)">{REPLAY_LABEL}</p></div>
            <div className="grid grid-cols-2 gap-px bg-(--border)"><Metric label="PRE-GOAL YES" value={formatPrice(lifecycle.pre.yesPriceMicros)} /><Metric label="POST-GOAL YES" value={formatPrice(lifecycle.post.yesPriceMicros)} /><Metric label="GOAL EVENT" value="SEQ 739" /><Metric label="FINAL PROOF" value="SEQ 1114" /></div>
          </div>
        </section>
        <section className="grid gap-4 border-t border-(--border) py-9 sm:grid-cols-3">
          <Feature icon={<Database className="h-5 w-5" />} title="Genuine source evidence" copy="Two StablePrice Merkle branches, the confirmed France goal and four final-period stat proofs are recorded together." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Strict sequence invalidation" copy="Sequence 739 makes every sequence-738 order stale. No synthetic edge model and no selective stale acceptance." />
          <Feature icon={<Vault className="h-5 w-5" />} title="Fixed liabilities" copy="Each fill freezes gross payout and reserves gross minus stake. Opposite-side netting is intentionally absent." />
        </section>
        <p className="pb-4 text-center text-[10px] text-(--ink-3)"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-(--green)" />Isolated local Phase B prototype · no deployment or wallet signing</p>
      </div>
    </FairXShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white p-5"><p className="text-[9px] font-bold text-(--ink-3)">{label}</p><p className="mt-2 text-[20px] font-extrabold">{value}</p></div>; }
function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <article className="card p-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--blue-bg) text-(--blue)">{icon}</span><h2 className="mt-4 text-[14px] font-bold">{title}</h2><p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">{copy}</p></article>; }
