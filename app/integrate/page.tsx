import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
  Radio,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Vault,
} from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { IntegrationKitDemo } from "@/components/integration-kit/IntegrationKitDemo";
import { CANONICAL_POST_GOAL_QUOTE, CANONICAL_PRE_GOAL_QUOTE } from "@/lib/quote-guard/canonical";
import { evaluateReferenceProtectedOrder } from "@/lib/integration-kit/reference";
import {
  canonicalStaleCounterfactual,
  V4_PROGRAM_ID,
  V4_REPLAY_SLUG,
} from "@/lib/v4/replay";

export const metadata: Metadata = {
  title: "For prediction-market operators",
  description: "How operators use FairX to bind live-sports order execution to verified TxLINE event sequences on Solana.",
};

const explorerProgram = `https://explorer.solana.com/address/${V4_PROGRAM_ID}?cluster=devnet`;

function exactSol(lamports: bigint) {
  return `${(Number(lamports) / 1_000_000_000).toFixed(9)} SOL`;
}

export default function IntegratePage() {
  const economics = canonicalStaleCounterfactual();
  const initialKitResult = evaluateReferenceProtectedOrder({ marketId: "fairx-v4-france-morocco", side: "YES", stakeLamports: 10_000_000n, quote: CANONICAL_PRE_GOAL_QUOTE, latestMaterialEventSequence: 739, submittedAtMs: CANONICAL_PRE_GOAL_QUOTE.sourceTimestampMs + 110_000 });
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1120px]">
        <header className="grid gap-8 border-b border-(--border) pb-10 pt-3 lg:grid-cols-[1fr_.8fr] lg:items-end">
          <div><p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-(--blue)"><Code2 className="h-4 w-4" />For prediction-market operators</p><h1 className="mt-4 max-w-3xl text-[40px] font-extrabold leading-[.99] tracking-[-.055em] sm:text-[60px]">Integrate with confidence.</h1><p className="mt-5 max-w-2xl text-[14px] leading-7 text-(--ink-2)">Run every decision and validation branch before touching production. The V4 order rule remains exactly two outcomes: <strong>ACCEPTED</strong> or <strong>STALE_SEQUENCE_RETURNED</strong>.</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-blue-700">The integration contract</p><p className="mt-3 text-[20px] font-extrabold tracking-[-.03em] text-blue-950">Verified odds → deterministic quote → protected order</p><p className="mt-3 text-[10.5px] leading-5 text-blue-950/70">Matching sequence: accept and reserve liability. Old sequence: return principal and create no position liability.</p></div>
        </header>

        <div className="mt-8"><IntegrationKitDemo preQuote={CANONICAL_PRE_GOAL_QUOTE} postQuote={CANONICAL_POST_GOAL_QUOTE} initialResult={initialKitResult} /></div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-(--border) bg-white" aria-labelledby="operator-reality"><div className="border-b border-(--border) p-5"><p className="section-label text-(--blue)">Operator reality</p><h2 id="operator-reality" className="mt-2 text-[22px] font-extrabold">What this reference proves—and what it does not.</h2></div><dl className="grid gap-px bg-(--border) sm:grid-cols-2 lg:grid-cols-4"><RealityFact label="Network" value="Solana devnet" /><RealityFact label="Browser demo" value="Deterministic no-send adapter · 0 transactions" /><RealityFact label="On-chain path" value="Deployed Vault V4 · 24 recorded lifecycle transactions" /><RealityFact label="Order outcomes" value="ACCEPTED · STALE_SEQUENCE_RETURNED" /><RealityFact label="Fees" value="Network transaction fees remain separate from principal" /><RealityFact label="External audit" value="None · unaudited hackathon prototype" /><RealityFact label="Custody" value="Consumer custody and wallet flows are outside this reference" /><RealityFact label="Authority" value="Configured roles · 2-of-3 resolution · single upgrade authority" /></dl></section>

        <section className="py-12 sm:py-16">
          <div className="max-w-3xl"><p className="section-label text-(--blue)">The operator workflow</p><h2 className="mt-3 text-[32px] font-extrabold tracking-[-.045em] sm:text-[44px]">One path from fixture binding to exported evidence.</h2><p className="mt-4 text-[12px] leading-6 text-(--ink-2)">This is the complete integration journey—not ten unrelated features.</p></div>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-(--border) bg-(--border) sm:grid-cols-2 lg:grid-cols-5">
            <IntegrationStep index="01" icon={Radio} title="Bind fixture" detail="Anchor the market to the intended TxLINE fixture identity." />
            <IntegrationStep index="02" icon={Radio} title="Receive TxLINE" detail="Receive verified event and odds evidence for that fixture." />
            <IntegrationStep index="03" icon={SlidersHorizontal} title="Generate quote" detail="Create the deterministic executable quote commitment." />
            <IntegrationStep index="04" icon={Gauge} title="Monitor health" detail="Watch required sequence, quote sequence, and stale state." />
            <IntegrationStep index="05" icon={ShieldCheck} title="Return stale order" detail="Return principal when OrderSequence is behind RequiredSequence." />
            <IntegrationStep index="06" icon={RefreshCw} title="Synchronize quote" detail="Update the quote to the required event sequence." />
            <IntegrationStep index="07" icon={ReceiptText} title="Accept retry" detail="Open the synchronized position and reserve its fixed liability." />
            <IntegrationStep index="08" icon={CheckCircle2} title="Resolve" detail="Use final TxLINE evidence and configured resolution authority." />
            <IntegrationStep index="09" icon={Vault} title="Reconcile" detail="Pay valid claims and constrain operator withdrawal to free liquidity." />
            <IntegrationStep index="10" icon={FileCheck2} title="Export evidence" detail="Hand auditors the recorded outcome and complete verification trail." />
          </ol>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-slate-800 p-6 text-white sm:p-8" style={{ backgroundColor: "#0c1425" }}><p className="text-[9px] font-bold uppercase tracking-[.1em] text-emerald-300">Canonical operator economics</p><h2 className="mt-3 text-[30px] font-extrabold tracking-[-.04em]">Protection is measurable, not a fairness slogan.</h2><dl className="mt-7 space-y-4"><Metric label="Stale order principal" value={exactSol(economics.stakeLamports)} /><Metric label="Liability if old-price YES were accepted" value={exactSol(economics.staleLiabilityLamports)} /><Metric label="Recorded liability created by returned order" value="0.000000000 SOL" /><Metric label="Next synchronized order" value="Accepted at 87.48%" /></dl><p className="mt-6 border-t border-white/10 pt-5 text-[10px] leading-5 text-slate-400">The first liability is a counterfactual derived from the canonical payout formula. The returned principal and zero created liability are recorded lifecycle outcomes.</p></div>
          <div className="rounded-3xl border border-(--border) bg-white p-6 sm:p-8"><p className="section-label">Scope you keep</p><h2 className="mt-3 text-[30px] font-extrabold tracking-[-.04em]">FairX does not pretend to be the whole exchange.</h2><div className="mt-6 space-y-3"><ScopeRow label="Operator owns" value="Market discovery · user acquisition · liquidity · frontend · compliance" /><ScopeRow label="TxLINE supplies" value="Fixture-bound event, odds, and final-result source evidence" /><ScopeRow label="FairX enforces" value="Quote derivation · sequence eligibility · fixed liabilities · principal return · claims · withdrawal boundary" /><ScopeRow label="Public RPC verifies" value="Quote receipts · program identity · transactions · wallet deltas · final solvency" /></div></div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 sm:p-8"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><div><p className="section-label text-blue-700">Why not keep it private?</p><h2 className="mt-3 text-[30px] font-extrabold tracking-[-.04em] text-blue-950">A centralized exchange can apply the rule. It cannot offer the same independent evidence.</h2></div><div className="grid gap-3 sm:grid-cols-2"><Comparison title="Private operator ledger" rows={["Operator reports whether an order was cancelled","Liabilities are an internal database balance","Settlement history can be rewritten internally"]} /><Comparison title="FairX on Solana" rows={["Anyone can re-read the order outcome","Liabilities reserve program-controlled collateral","Finalized settlement and wallet deltas are externally reproducible"]} strong /></div></div></div>
        </section>

        <section className="grid gap-5 border-y border-(--border) py-12 md:grid-cols-3">
          <OperatorProof icon={Database} label="Program" value="Deployed V4" detail={V4_PROGRAM_ID} />
          <OperatorProof icon={CheckCircle2} label="Lifecycle" value="RPC verified 20/20" detail="24 finalized devnet transactions" />
          <OperatorProof icon={CircleDollarSign} label="Final state" value="Every liability zero" detail="Exact 0.199799428 SOL withdrawal" />
        </section>

        <section className="py-12 text-center sm:py-16"><p className="section-label text-(--blue)">Reference implementation</p><h2 className="mx-auto mt-3 max-w-2xl text-[34px] font-extrabold tracking-[-.045em] sm:text-[44px]">See the rule before reading the accounts.</h2><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--ink) px-6 text-[12px] font-bold text-white">Watch the historical replay <ArrowRight className="h-4 w-4" /></Link><Link href="/proof" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--border) bg-white px-6 text-[12px] font-bold">Inspect verified settlement</Link><a href={explorerProgram} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--border) bg-white px-6 text-[12px] font-bold">Program on Explorer <ExternalLink className="h-4 w-4" /></a></div></section>
      </div>
    </FairXShell>
  );
}

function IntegrationStep({ index, icon: Icon, title, detail }: { index: string; icon: typeof Radio; title: string; detail: string }) { return <li className="bg-white p-5"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-(--blue)"><Icon className="h-5 w-5" /></span><span className="text-[9px] font-bold text-(--ink-3)">{index}</span></div><h3 className="mt-5 text-[13px] font-bold">{title}</h3><p className="mt-2 text-[10.5px] leading-5 text-(--ink-2)">{detail}</p></li>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><dt className="text-[9.5px] text-slate-400">{label}</dt><dd className="num text-right text-[11px] font-bold">{value}</dd></div>; }
function ScopeRow({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-[8.5px] font-bold uppercase tracking-[.08em] text-(--ink-3)">{label}</p><p className="mt-2 text-[10.5px] font-semibold leading-5">{value}</p></div>; }
function Comparison({ title, rows, strong = false }: { title: string; rows: string[]; strong?: boolean }) { return <article className={`rounded-2xl border p-5 ${strong ? "border-emerald-200 bg-white" : "border-blue-200 bg-blue-100/50"}`}><h3 className="text-[12px] font-bold text-blue-950">{title}</h3><ul className="mt-4 space-y-3">{rows.map((row) => <li key={row} className="flex items-start gap-2 text-[10px] leading-5 text-blue-950/70"><CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${strong ? "text-emerald-600" : "text-blue-500"}`} />{row}</li>)}</ul></article>; }
function OperatorProof({ icon: Icon, label, value, detail }: { icon: typeof Database; label: string; value: string; detail: string }) { return <article className="min-w-0"><Icon className="h-5 w-5 text-(--blue)" /><p className="mt-4 text-[8.5px] font-bold uppercase tracking-[.08em] text-(--ink-3)">{label}</p><h3 className="mt-1 text-[16px] font-extrabold">{value}</h3><p className="mt-2 break-all text-[9.5px] leading-4 text-(--ink-2)">{detail}</p></article>; }
function RealityFact({ label, value }: { label: string; value: string }) { return <div className="bg-white p-4"><dt className="text-[8.5px] font-bold uppercase tracking-[.08em] text-(--ink-3)">{label}</dt><dd className="mt-2 text-[10px] font-semibold leading-5">{value}</dd></div>; }
