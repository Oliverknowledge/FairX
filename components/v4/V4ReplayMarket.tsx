"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  ExternalLink,
  Gauge,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Vault,
  Zap,
} from "lucide-react";
import {
  formatPrice,
  formatSol,
  invariantHolds,
  runCanonicalLifecycle,
  shortHash,
  V4_EVIDENCE,
} from "@/lib/v4/replay";

const stages = [
  { title: "Fair market", copy: "France trades at 53.28% and the quote is bound to the latest recorded event sequence.", fact: "Quote · sequence 738", state: "SYNCHRONIZED" },
  { title: "Fair positions open", copy: "Valid YES and NO positions are accepted with their fixed-payout liabilities fully reserved.", fact: "0.02 SOL accepted", state: "OPEN" },
  { title: "Goal reaches TxLINE", copy: "The genuine historical France goal advances the material event sequence from 738 to 739.", fact: "Goal · sequence 739", state: "EVENT RECEIVED" },
  { title: "Quote becomes stale", copy: "TxLINE implies 87.48%, but the interface still displays the sequence-738 price for a brief window.", fact: "+34.20 point stale gap", state: "STALE" },
  { title: "Old-sequence order submitted", copy: "A 0.01 SOL YES order arrives bound to quote sequence 738 while the market requires event sequence 739.", fact: "Order sequence · 738", state: "RULE CHECK" },
  { title: "Principal returned", copy: "The sequence rule returns the 0.01 SOL principal atomically. No position or payout liability is created.", fact: "0.01 SOL returned", state: "RETURNED" },
  { title: "Quote catches up", copy: "The displayed quote catches up to sequence 739 and the market returns to synchronized.", fact: "53.28% → 87.48%", state: "SYNCHRONIZED" },
  { title: "Synchronized order accepted", copy: "A sequence-739 YES order executes at 87.48%. Fair trading never stopped.", fact: "0.01 SOL accepted", state: "OPEN" },
  { title: "Match resolves", copy: "Final TxLINE evidence at sequence 1114 proves France won 2–0 in regulation time.", fact: "France 2–0 Morocco", state: "RESOLVED" },
  { title: "Valid positions settle", copy: "Both valid YES positions receive their fixed payouts; the valid NO position closes as lost.", fact: "0.030200572 SOL paid", state: "SETTLED" },
  { title: "Settlement verified", copy: "The exact free remainder is withdrawn. Every liability and open position reaches zero.", fact: "Every lamport reconciled", state: "CLOSED" },
] as const;

const chapters = [
  { title: "Fair market", start: 0, end: 1 },
  { title: "Goal happens", start: 2, end: 3 },
  { title: "Principal returned", start: 4, end: 5 },
  { title: "Market continues", start: 6, end: 7 },
  { title: "Settlement verified", start: 8, end: 10 },
] as const;

const speedMs: Record<string, number> = { "1×": 2200, "1.5×": 1450, "2×": 1000 };

export function V4ReplayMarket() {
  const lifecycle = useMemo(runCanonicalLifecycle, []);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof speedMs>("1×");
  const current = stages[stage];
  const last = stage === stages.length - 1;
  const chapterIndex = chapters.findIndex((chapter) => stage >= chapter.start && stage <= chapter.end);
  const chapter = chapters[chapterIndex];

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get("stage"));
    if (Number.isInteger(requested) && requested >= 1 && requested <= stages.length) {
      setStage(requested - 1);
    }
  }, []);

  useEffect(() => {
    if (!playing || last) return;
    const id = window.setTimeout(() => setStage((value) => Math.min(value + 1, stages.length - 1)), speedMs[speed]);
    return () => window.clearTimeout(id);
  }, [last, playing, speed, stage]);

  useEffect(() => { if (last) setPlaying(false); }, [last]);

  const snapshotIndex = stage === 0 ? 0 : stage === 1 ? 2 : stage < 7 ? 4 : stage === 7 || stage === 8 ? 5 : stage === 9 ? 8 : 9;
  const vaultSnapshot = lifecycle.snapshots[snapshotIndex];
  const stale = stage === 3 || stage === 4;
  const protectedState = stage === 5;

  const restart = () => { setPlaying(false); setStage(0); };
  const next = () => setStage((value) => Math.min(value + 1, stages.length - 1));

  return (
    <div className="mx-auto min-w-0 max-w-[1180px]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold text-blue-950"><Radio className="h-4 w-4 text-blue-600" /><strong>TxLINE historical replay</strong><span className="text-blue-500">·</span> Genuine recorded evidence, not a live match</div>
        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[9px] font-bold text-blue-700">QUOTE SEQUENCE MUST MATCH EVENT SEQUENCE</span>
      </div>

      <header className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,.07)]">
        <div className="grid gap-5 border-b border-(--border) p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-(--ink-3)"><span>France vs Morocco</span><span>·</span><span>Chapter {chapterIndex + 1} of {chapters.length}</span><span>·</span><span>{chapter.title}</span></div>
            <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.05em] sm:text-[46px]">France to win</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={current.state} tone={stale ? "amber" : protectedState ? "green" : current.state === "CLOSED" ? "slate" : "blue"} />
            <StatusPill label="LINEGUARD ACTIVE" tone="green" icon />
          </div>
        </div>

        <div className="grid min-h-[420px] lg:grid-cols-[1.38fr_.62fr]">
          <section
            className="fx-dark-panel relative overflow-hidden p-5 text-white sm:p-7"
            style={{ backgroundColor: "#0c1425", color: "#fff" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-blue-300">{String(stage + 1).padStart(2, "0")} · {current.title}</p><h2 className="mt-3 max-w-2xl text-[26px] font-extrabold tracking-[-.035em] sm:text-[34px]">{current.copy}</h2></div>
              <span className="fx-dark-card rounded-lg px-3 py-2 text-[10px] font-bold text-slate-300">{current.fact}</span>
            </div>
            <ReplayVisual stage={stage} pre={formatPrice(lifecycle.pre.yesPriceMicros)} post={formatPrice(lifecycle.post.yesPriceMicros)} />
          </section>

          <aside className="flex flex-col bg-white p-5 sm:p-6">
            <div>
              <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[11px] font-bold"><Vault className="h-4 w-4 text-(--blue)" />Vault at this moment</p><span className={`text-[9px] font-bold ${invariantHolds(vaultSnapshot) ? "text-(--green)" : "text-(--red)"}`}>{invariantHolds(vaultSnapshot) ? "EXACT" : "FAILED"}</span></div>
              <dl className="mt-5 space-y-4"><DataRow label="Spendable balance" value={formatSol(vaultSnapshot.spendableLamports)} /><DataRow label="Free collateral" value={formatSol(vaultSnapshot.freeCollateral)} /><DataRow label="Reserved liability" value={formatSol(vaultSnapshot.reservedLiability)} /><DataRow label="Accepted principal" value={formatSol(vaultSnapshot.acceptedStakePrincipal)} /></dl>
              <div className="mt-5 rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold text-(--ink-3)">SOLVENCY RULE</p><p className="mt-1 text-[11px] font-bold">Balance = free + reserve + principal</p></div>
            </div>
            <div className="mt-auto pt-6">
              <Link href="/proof" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-(--border) bg-white px-4 text-[11px] font-bold hover:border-blue-300 hover:text-(--blue)"><ExternalLink className="h-3.5 w-3.5" />View on-chain evidence</Link>
              <p className="mt-3 text-center text-[9.5px] leading-4 text-(--ink-3)">Replay controls animate recorded evidence and send no transactions.</p>
            </div>
          </aside>
        </div>

        <div className="border-t border-(--border) bg-white p-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPlaying((value) => !value)} disabled={last} className="inline-flex min-h-11 min-w-[96px] items-center justify-center gap-2 rounded-xl bg-(--blue) px-4 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Pause" : "Play"}</button>
            <button type="button" onClick={next} disabled={last} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--border) bg-white px-4 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40">Next event <ArrowRight className="h-4 w-4" /></button>
            <button type="button" onClick={restart} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--border) bg-white px-4 text-[11px] font-bold"><RotateCcw className="h-4 w-4" />Restart</button>
            <div className="ml-auto flex items-center gap-1 rounded-xl bg-slate-100 p-1" aria-label="Replay speed"><span className="hidden px-2 text-[9px] font-bold text-(--ink-3) sm:inline">SPEED</span>{(Object.keys(speedMs) as (keyof typeof speedMs)[]).map((value) => <button key={value} type="button" onClick={() => setSpeed(value)} aria-pressed={speed === value} className={`min-h-9 min-w-10 rounded-lg px-2 text-[10px] font-bold ${speed === value ? "bg-white text-(--ink) shadow-sm" : "text-(--ink-2)"}`}>{value}</button>)}</div>
          </div>
          <ol className="mt-4 grid gap-1 sm:grid-cols-5" aria-label="Replay chapters">
            {chapters.map((item, index) => <li key={item.title}><button type="button" onClick={() => { setPlaying(false); setStage(item.start); }} aria-label={`Go to chapter ${index + 1}: ${item.title}`} aria-current={index === chapterIndex ? "step" : undefined} className={`flex min-h-9 w-full items-center justify-center rounded-lg px-2 text-[9px] font-bold transition-colors ${index < chapterIndex ? "bg-emerald-50 text-emerald-700" : index === chapterIndex ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}. {item.title}</button></li>)}
          </ol>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniFact icon={Radio} label="Protection boundary" value="Applies after TxLINE event sequence 739 is recorded, before the displayed quote catches up" />
        <MiniFact icon={ShieldCheck} label="Operator outcome" value="Old-sequence principal returned · synchronized order accepted" />
        <MiniFact icon={CheckCircle2} label="Public proof" value={`Final sequence ${V4_EVIDENCE.finalSequence} · RPC lifecycle verified 20/20`} />
      </section>
    </div>
  );
}

function ReplayVisual({ stage, pre, post }: { stage: number; pre: string; post: string }) {
  const postEvent = stage >= 2;
  const displayedPost = stage >= 6;
  const stale = stage === 3 || stage === 4;
  const attempt = stage === 4;
  const refunded = stage === 5;
  const resolved = stage >= 8;
  const paid = stage >= 9;
  const reconciled = stage >= 10;

  if (reconciled) return <div className="mt-10"><div className="grid grid-cols-1 items-center gap-2 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]"><Equation value="0.200000000" label="Operator deposit" /><span>+</span><Equation value="0.030000000" label="Accepted principal" /><span>−</span><Equation value="0.030200572" label="User payouts" /></div><div className="mx-auto my-5 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10"><ArrowDown className="h-5 w-5 text-emerald-300" /></div><div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-5 text-center sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-emerald-300">Every lamport reconciled</p><p className="mt-2 text-[24px] font-extrabold tracking-[-.04em] sm:text-[34px]">0.199799428 SOL withdrawn</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><Zero label="Free collateral" /><Zero label="Reserved liability" /><Zero label="Pending refunds" /><Zero label="Open positions" /></div></div></div>;

  if (paid) return <div className="mt-10 grid gap-3 sm:grid-cols-3"><Payout label="Pre-goal YES" amount="0.018769297 SOL" status="PAID" winner /><Payout label="Post-goal YES" amount="0.011431275 SOL" status="PAID" winner /><Payout label="Pre-goal NO" amount="0 SOL" status="CLOSED · LOST" /></div>;

  if (resolved) return <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-center"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-blue-300">Final TxLINE evidence · sequence 1114</p><div className="mx-auto mt-6 grid max-w-[520px] grid-cols-[1fr_auto_1fr] items-center gap-6"><Team name="France" score="2" active /><span className="text-[14px] text-slate-500">FINAL</span><Team name="Morocco" score="0" /></div><p className="mt-6 text-[11px] text-slate-400">Regulation-time period 100 · two of three resolution authorities approve YES</p></div>;

  if (refunded) return <div className="mt-9"><div className="mx-auto max-w-[660px] rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-6 sm:p-7"><div className="flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-300 text-emerald-950"><ShieldCheck className="h-7 w-7" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-emerald-300">Sequence 738 ≠ required sequence 739</p><h3 className="mt-1 text-[28px] font-extrabold sm:text-[34px]">0.01 SOL principal returned</h3></div></div><div className="mt-6 grid gap-2 sm:grid-cols-3"><FlowFact icon={CircleDollarSign} text="Order carries 738" done /><FlowFact icon={ShieldCheck} text="Program requires 739" done /><FlowFact icon={RefreshCw} text="Principal returns" done /></div><p className="mt-5 border-t border-emerald-300/15 pt-4 text-center text-[14px] font-bold text-emerald-200">Return the stale order. Keep the market open.</p><p className="mt-2 text-center text-[9px] leading-4 text-slate-400">No position or payout liability is created. Network transaction fees are separate from returned principal.</p></div></div>;

  return <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr]"><div className={`rounded-2xl border p-5 transition-colors ${stale ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/5"}`}><div className="flex items-center justify-between"><p className="text-[10px] font-bold text-slate-400">DISPLAYED MARKET PRICE</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${stale ? "bg-amber-300/15 text-amber-200" : "bg-emerald-300/15 text-emerald-300"}`}>{stale ? "STALE" : "SYNCHRONIZED"}</span></div><p className={`mt-5 text-[58px] font-extrabold leading-none tracking-[-.06em] ${stale ? "text-amber-200" : "text-white"}`}>{displayedPost ? post.replace("¢", "%") : pre.replace("¢", "%")}</p><p className="mt-3 text-[11px] text-slate-400">France to win · quote sequence {displayedPost ? "739" : "738"}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-[10px] font-bold text-slate-400">LATEST TxLINE FAIR PRICE</p><p className="mt-5 text-[58px] font-extrabold leading-none tracking-[-.06em] text-emerald-300">{postEvent ? post.replace("¢", "%") : pre.replace("¢", "%")}</p><p className="mt-3 text-[11px] text-slate-400">Material sequence {postEvent ? "739" : "738"}</p></div>{postEvent && !displayedPost && <div className="sm:col-span-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-[11px] font-bold text-amber-200"><Zap className="h-4 w-4" />STALE PRICE ADVANTAGE · +34.20 POINTS</span><span className="text-[10px] font-bold text-amber-200">53.28% → 87.48%</span></div></div>}{attempt && <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300/30 bg-red-300/10 px-4 py-3"><span className="flex items-center gap-2 text-[11px] font-bold"><Bot className="h-4 w-4 text-red-300" />Old-sequence YES order · objective rule check</span><span className="rounded-full bg-red-300/15 px-3 py-1 text-[9px] font-bold text-red-200">ORDER 738 · MARKET 739</span></div>}{stage === 7 && <div className="sm:col-span-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-center text-[12px] font-bold text-emerald-200">The market was not frozen. Synchronized sequence-739 order accepted at 87.48%.</div>}</div>;
}

function StatusPill({ label, tone, icon = false }: { label: string; tone: "blue" | "green" | "amber" | "slate"; icon?: boolean }) { const cls = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : tone === "slate" ? "border-slate-200 bg-slate-100 text-slate-700" : "border-blue-200 bg-blue-50 text-blue-700"; return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold ${cls}`}>{icon && <ShieldCheck className="h-3.5 w-3.5" />}{label}</span>; }
function DataRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><dt className="text-[10px] text-(--ink-3)">{label}</dt><dd className="num text-[11px] font-bold">{value}</dd></div>; }
function MiniFact({ icon: Icon, label, value }: { icon: typeof Radio; label: string; value: string }) { return <article className="rounded-xl border border-(--border) bg-white p-4"><div className="flex items-center gap-2 text-[10px] font-bold text-(--ink-3)"><Icon className="h-4 w-4 text-(--blue)" />{label}</div><p className="mt-2 text-[11px] font-semibold leading-5">{value}</p></article>; }
function Equation({ value, label }: { value: string; label: string }) { return <div><p className="num text-[15px] font-bold sm:text-[20px]">{value}</p><p className="mt-1 text-[8px] text-slate-500">{label}</p></div>; }
function Zero({ label }: { label: string }) { return <div className="rounded-lg bg-black/10 p-3"><p className="text-[9px] text-emerald-200">{label}</p><p className="mt-1 text-[13px] font-bold">0</p></div>; }
function Payout({ label, amount, status, winner = false }: { label: string; amount: string; status: string; winner?: boolean }) { return <article className={`rounded-2xl border p-5 ${winner ? "border-emerald-300/25 bg-emerald-300/10" : "border-white/10 bg-white/5"}`}><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${winner ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-slate-400"}`}>{winner ? <Trophy className="h-5 w-5" /> : <Check className="h-5 w-5" />}</span><p className="mt-5 text-[11px] font-bold">{label}</p><p className="mt-2 text-[20px] font-extrabold">{amount}</p><p className={`mt-3 text-[9px] font-bold ${winner ? "text-emerald-300" : "text-slate-400"}`}>{status}</p></article>; }
function Team({ name, score, active = false }: { name: string; score: string; active?: boolean }) { return <div><p className="text-[13px] font-bold text-slate-300">{name}</p><p className={`mt-2 text-[64px] font-extrabold leading-none ${active ? "text-emerald-300" : "text-white"}`}>{score}</p></div>; }
function FlowFact({ icon: Icon, text, done }: { icon: typeof CircleDollarSign; text: string; done?: boolean }) { return <div className="flex items-center gap-2 rounded-lg bg-black/10 p-3 text-[10px] font-bold"><Icon className="h-4 w-4 text-emerald-300" />{text}{done && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-300" />}</div>; }
