import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Code2,
  Database,
  Eye,
  PauseCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Vault,
  Zap,
} from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import {
  canonicalStaleCounterfactual,
  V4_REPLAY_SLUG,
} from "@/lib/v4/replay";

const ruleSteps = [
  [Radio, "TxLINE advances", "The recorded goal moves the material event sequence from 738 to 739."],
  [Clock3, "Old quote remains", "The interface still displays the sequence-738 price for a brief window."],
  [ShieldCheck, "Program compares", "The order carries 738 while the market requires 739."],
  [RefreshCw, "Principal returns", "No position or payout liability is created for that order."],
  [CheckCircle2, "Trading continues", "A synchronized sequence-739 order executes at the updated price."],
] as const;

const badChoices = [
  [PauseCircle, "Pause every market", "Safe for the operator, but fair traders lose access whenever the score moves."],
  [CircleDollarSign, "Accept the old quote", "The operator absorbs a payout liability created by obsolete information."],
  [Eye, "Cancel it privately", "Users must trust an internal ledger and cannot verify whether the rule was applied consistently."],
] as const;

function exactSol(lamports: bigint) {
  return `${(Number(lamports) / 1_000_000_000).toFixed(9)} SOL`;
}

export default function HomePage() {
  const economics = canonicalStaleCounterfactual();
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1180px]">
        <section className="grid items-center gap-10 py-8 lg:grid-cols-[1.04fr_.96fr] lg:py-16">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-blue-800">
              <ShieldCheck className="h-3.5 w-3.5" /> Execution integrity for live sports markets
            </p>
            <h1 className="mt-6 max-w-[760px] text-[42px] font-extrabold leading-[.98] tracking-[-0.055em] sm:text-[64px] lg:text-[70px]">
              Return the stale order. Keep the market open.
            </h1>
            <p className="mt-6 max-w-[690px] text-[15px] leading-7 text-(--ink-2)">
              FairX is Solana infrastructure for prediction-market operators. Orders bound to an obsolete TxLINE event sequence return their principal; synchronized orders continue, and every liability is publicly verifiable.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--ink) px-6 text-[12px] font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,.16)] transition-transform hover:-translate-y-0.5">
                Watch the protected market <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/integrate" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--border-strong) bg-white px-6 text-[12px] font-bold transition-colors hover:border-blue-300 hover:text-(--blue)">
                <Code2 className="h-4 w-4 text-(--blue)" /> See operator integration
              </Link>
            </div>
            <p className="mt-6 flex max-w-[760px] flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-semibold text-(--ink-2)">
              <CheckCircle2 className="h-4 w-4 text-(--green)" /> Genuine TxLINE historical replay <span className="text-(--ink-3)">·</span> deployed Solana V4 <span className="text-(--ink-3)">·</span> RPC verified 20/20
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800 text-white shadow-[0_24px_60px_rgba(15,23,42,.18)]" style={{ backgroundColor: "#0c1425" }}>
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.11em] text-blue-300">The operator decision</p><h2 className="mt-1 text-[18px] font-bold">France vs Morocco · historical event</h2></div><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[9px] font-bold text-amber-200">QUOTE 738 · EVENT 739</span></div>
            </div>
            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-3">
                <PriceFact label="Displayed quote" value="53.28%" tone="amber" />
                <PriceFact label="Updated fair price" value="87.48%" tone="green" />
              </div>
              <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-white/10" /><span className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">same order · two outcomes</span><span className="h-px flex-1 bg-white/10" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DecisionCard label="Without sequence protection" title="Accept loss or pause everyone" detail={`${exactSol(economics.staleLiabilityLamports)} payout liability if the stale YES order is accepted and France wins.`} bad />
                <DecisionCard label="With FairX" title="Return one order. Continue trading." detail={`${exactSol(economics.stakeLamports)} principal returned · zero position liability created.`} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-(--border) py-14 sm:py-20">
          <div className="max-w-3xl"><p className="section-label text-(--blue)">The operator&apos;s bad choice</p><h2 className="mt-3 text-[32px] font-extrabold tracking-[-.045em] sm:text-[46px]">Live markets usually choose between downtime, loss, or private discretion.</h2><p className="mt-4 max-w-2xl text-[13px] leading-6 text-(--ink-2)">FairX replaces that choice with one objective rule: the order&apos;s quote sequence must match the market&apos;s latest verified material-event sequence.</p></div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {badChoices.map(([Icon, title, detail]) => <article key={title} className="rounded-2xl border border-(--border) bg-white p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-[14px] font-bold">{title}</h3><p className="mt-2 text-[11px] leading-5 text-(--ink-2)">{detail}</p></article>)}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-800 text-white" style={{ backgroundColor: "#0c1425" }}>
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
            <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-300">Canonical economic impact</p><h2 className="mt-3 text-[34px] font-extrabold leading-[1.02] tracking-[-.045em] sm:text-[44px]">One obsolete order would create 6.13× the liability of the synchronized order.</h2><p className="mt-4 text-[11px] leading-6 text-slate-300">Counterfactual arithmetic uses the recorded 0.01 SOL stake, the same fixed-payout formula, 53.28% old price and 87.48% synchronized price. It is not fabricated volume or traction.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <EconomicOutcome label="Without FairX · counterfactual" tone="bad" rows={[["Old-price gross payout", exactSol(economics.staleGrossPayoutLamports)],["Operator liability", exactSol(economics.staleLiabilityLamports)],["Valid position created", "YES"]]} conclusion="Operator absorbs obsolete-information risk." />
              <EconomicOutcome label="With FairX · recorded" tone="good" rows={[["Principal returned", exactSol(economics.stakeLamports)],["Position liability created", "0.000000000 SOL"],["Next synchronized order", "ACCEPTED AT 87.48%"]]} conclusion="The stale order leaves; the market does not." />
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="max-w-2xl"><p className="section-label text-(--blue)">One enforceable rule</p><h2 className="mt-3 text-[32px] font-extrabold tracking-[-.045em] sm:text-[44px]">Five moments a judge can repeat tomorrow.</h2></div>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-(--border) bg-(--border) lg:grid-cols-5">
            {ruleSteps.map(([Icon, title, detail], index) => <li key={title} className="bg-white p-5"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-(--blue)"><Icon className="h-4 w-4" /></span><span className="text-[9px] font-bold text-(--ink-3)">0{index + 1}</span></div><h3 className="mt-5 text-[12px] font-bold">{title}</h3><p className="mt-2 text-[10px] leading-5 text-(--ink-2)">{detail}</p></li>)}
          </ol>
        </section>

        <section className="grid gap-5 border-y border-(--border) py-14 sm:py-20 lg:grid-cols-2">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 sm:p-8"><p className="section-label text-blue-700">Why Solana</p><h2 className="mt-3 text-[28px] font-extrabold tracking-[-.04em]">The rule is not just an operator promise.</h2><div className="mt-6 space-y-4"><SolanaPoint icon={Database} title="Public accounting" detail="Anyone can recompute the vault balance, liabilities, payouts and final withdrawal from RPC." /><SolanaPoint icon={Vault} title="Program-constrained money" detail="Accepted payout liabilities reserve collateral; operator withdrawal cannot cross the liability boundary." /><SolanaPoint icon={Eye} title="Permissionless verification" detail="The 24 finalized transactions can be checked without trusting this frontend or a private database." /></div></div>
          <div className="rounded-3xl border border-(--border) bg-white p-6 sm:p-8"><p className="section-label">Honest trust boundary</p><h2 className="mt-3 text-[28px] font-extrabold tracking-[-.04em]">Verified does not mean trustless.</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><TrustFact label="TRUSTED / CONFIGURED" value="TxLINE source evidence · pricing authority · 2-of-3 resolution authorities · upgrade authority" icon={SlidersHorizontal} /><TrustFact label="ENFORCED / VERIFIED" value="Sequence comparison · principal return · fixed liabilities · claims · withdrawal boundary" icon={ShieldCheck} /></div><Link href="/proof" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--border) px-4 text-[11px] font-bold hover:border-blue-300 hover:text-(--blue)">Inspect trust and proof <ArrowRight className="h-4 w-4" /></Link></div>
        </section>

        <section className="my-14 overflow-hidden rounded-3xl border border-blue-200 bg-blue-50 sm:my-20">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-blue-700">Reference implementation, independently re-readable</p><h2 className="mt-3 text-[30px] font-extrabold tracking-[-.04em]">The replay explains the rule. Solana proves the settlement.</h2><p className="mt-3 max-w-2xl text-[12px] leading-6 text-blue-950/70">Deployed V4 program · 24 finalized devnet transactions · lifecycle verified 20/20 · final liabilities and open positions equal zero.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col"><Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--ink) px-6 text-[12px] font-bold text-white">Watch the replay <ArrowRight className="h-4 w-4" /></Link><Link href="/proof" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200 bg-white px-6 text-[12px] font-bold text-blue-800">Open proof</Link></div>
          </div>
        </section>
      </div>
    </FairXShell>
  );
}

function PriceFact({ label, value, tone }: { label: string; value: string; tone: "amber" | "green" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-2 text-[30px] font-extrabold tracking-[-.04em] ${tone === "amber" ? "text-amber-200" : "text-emerald-300"}`}>{value}</p></div>;
}

function DecisionCard({ label, title, detail, bad = false }: { label: string; title: string; detail: string; bad?: boolean }) {
  return <article className={`rounded-2xl border p-4 ${bad ? "border-red-300/20 bg-red-300/10" : "border-emerald-300/25 bg-emerald-300/10"}`}><p className={`text-[8px] font-bold uppercase tracking-[.08em] ${bad ? "text-red-200" : "text-emerald-300"}`}>{label}</p><h3 className="mt-2 text-[14px] font-bold">{title}</h3><p className="mt-3 text-[10px] leading-5 text-slate-300">{detail}</p></article>;
}

function EconomicOutcome({ label, rows, conclusion, tone }: { label: string; rows: [string, string][]; conclusion: string; tone: "bad" | "good" }) {
  return <article className={`rounded-2xl border p-5 ${tone === "bad" ? "border-red-300/20 bg-red-300/10" : "border-emerald-300/25 bg-emerald-300/10"}`}><p className={`text-[9px] font-bold uppercase tracking-[.08em] ${tone === "bad" ? "text-red-200" : "text-emerald-300"}`}>{label}</p><dl className="mt-5 space-y-3">{rows.map(([key, value]) => <div key={key} className="flex items-start justify-between gap-3 border-b border-white/10 pb-3"><dt className="text-[9.5px] text-slate-400">{key}</dt><dd className="num text-right text-[10px] font-bold">{value}</dd></div>)}</dl><p className="mt-4 text-[11px] font-bold">{conclusion}</p></article>;
}

function SolanaPoint({ icon: Icon, title, detail }: { icon: typeof Database; title: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700"><Icon className="h-4 w-4" /></span><div><h3 className="text-[11px] font-bold text-blue-950">{title}</h3><p className="mt-1 text-[10px] leading-5 text-blue-950/65">{detail}</p></div></div>;
}

function TrustFact({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShieldCheck }) {
  return <article className="rounded-2xl bg-slate-50 p-4"><Icon className="h-5 w-5 text-(--blue)" /><p className="mt-4 text-[8.5px] font-bold tracking-[.08em] text-(--ink-3)">{label}</p><p className="mt-2 text-[10px] font-semibold leading-5">{value}</p></article>;
}
