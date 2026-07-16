"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Clock3,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Siren,
  Zap,
} from "lucide-react";
import {
  deterministicRuntime,
  evaluateIncomingOrder,
  nextRuntimeActionLabel,
  nextRuntimeStage,
  restartRuntime,
  RUNTIME_STAGE_COUNT,
  RUNTIME_STAGE_LABELS,
  runtimeStageLabels,
  runtimeState,
} from "@/lib/runtime/engine";
import { RUNTIME_SCENARIOS, scenarioById, type RuntimeScenario } from "@/lib/runtime/scenarios";

const AUTOPLAY_MS = [1400, 1650, 1800, 2200, 1750] as const;

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function cents(value: number) {
  return `${(value * 100).toFixed(2)}¢`;
}

function sol(value: number) {
  return `${value.toFixed(9)} SOL`;
}

export function FairXLiveDemo({ initialScenarioId = "france-morocco" }: { initialScenarioId?: string }) {
  const [scenarioId, setScenarioId] = useState(initialScenarioId);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId]);
  const state = runtimeState(scenario, stage);
  const evaluation = evaluateIncomingOrder(scenario);
  const stageLabels = runtimeStageLabels(scenario);

  useEffect(() => {
    if (!playing || stage >= RUNTIME_STAGE_COUNT - 1) return;
    const timer = window.setTimeout(() => setStage((current) => nextRuntimeStage(current)), AUTOPLAY_MS[stage]);
    return () => window.clearTimeout(timer);
  }, [playing, stage]);

  useEffect(() => {
    if (stage === RUNTIME_STAGE_COUNT - 1) setPlaying(false);
  }, [stage]);

  const selectScenario = (id: string) => {
    setPlaying(false);
    setStage(restartRuntime());
    setScenarioId(id);
  };

  const runScenario = () => {
    setStage(restartRuntime());
    setPlaying(true);
  };

  return (
    <section aria-labelledby="live-demo-title" className="min-w-0" data-testid="fairx-live-demo">
      <div className="flex flex-col gap-5 border-b border-(--border) pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[820px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-emerald-800">
              <span className="dot-pulse h-2 w-2 rounded-full bg-emerald-500" /> Live Demo
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[9px] font-bold text-blue-800">Runtime simulation using captured TxLINE-schema events.</span>
          </div>
          <h1 id="live-demo-title" className="mt-5 max-w-[800px] text-[42px] font-extrabold leading-[.96] tracking-[-0.055em] sm:text-[60px] lg:text-[72px]">
            Fair execution for live prediction markets.
          </h1>
          <p className="mt-5 max-w-[760px] text-[14px] leading-6 text-(--ink-2) sm:text-[15px]">
            FairX detects orders that exploit the gap between a TxLINE event and a market reprice, refunds them atomically, and keeps fair trading open.
          </p>
        </div>
        <button type="button" onClick={runScenario} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-(--ink) px-6 text-[12px] font-extrabold text-white shadow-[0_16px_35px_rgba(15,23,42,.18)] hover:bg-slate-800">
          <Zap className="h-4 w-4 text-amber-300" /> {scenario.id === "france-morocco" ? "Run exploit" : "Run scenario"}
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-(--border) bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div>
          <p className="text-[8px] font-extrabold uppercase tracking-[.12em] text-(--ink-3)">Scenario</p>
          <p className="mt-1 text-[11px] font-bold">Same FairX guard. Different fixture. Different event. Same deterministic protection.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Runtime fixture">
          {RUNTIME_SCENARIOS.map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => selectScenario(candidate.id)} aria-pressed={candidate.id === scenario.id} className={`min-h-10 rounded-lg px-3 text-[10px] font-bold transition-colors ${candidate.id === scenario.id ? "bg-white text-(--ink) shadow-sm" : "text-(--ink-2) hover:text-(--ink)"}`}>
              {candidate.teams.homeCode}–{candidate.teams.awayCode}
            </button>
          ))}
        </div>
      </div>

      <div className="fx-dark-panel mt-4 min-w-0 overflow-hidden rounded-[24px] border border-slate-800 shadow-[0_24px_70px_rgba(15,23,42,.16)]" style={{ backgroundColor: "#0c1425", color: "#fff" }}>
        <MatchHeader scenario={scenario} state={state} />

        <div className="grid min-w-0 lg:grid-cols-[1.05fr_.95fr]">
          <div className="min-w-0 border-b border-white/10 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <MarketPanel scenario={scenario} state={state} />
            <OrderDecision scenario={scenario} state={state} />
          </div>
          <RuntimeFeed scenario={scenario} stage={stage} />
        </div>

        <WowComparison scenario={scenario} stage={stage} edgePerShare={evaluation.edgePerShare} decision={evaluation.decision} />

        <div className="border-t border-white/10 bg-white/[.035] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPlaying((value) => !value)} disabled={stage === RUNTIME_STAGE_COUNT - 1} className="inline-flex min-h-11 min-w-[96px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[10px] font-extrabold text-white disabled:opacity-40">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Pause" : "Autoplay"}
            </button>
            <button type="button" onClick={() => { setPlaying(false); setStage(nextRuntimeStage(stage)); }} disabled={stage === RUNTIME_STAGE_COUNT - 1} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-[10px] font-bold text-white disabled:opacity-40">
              {nextRuntimeActionLabel(stage)} <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => { setPlaying(false); setStage(restartRuntime()); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-[10px] font-bold text-slate-300">
              <RotateCcw className="h-4 w-4" /> Restart
            </button>
            <span className="ml-auto text-[9px] font-bold text-slate-400">DETERMINISTIC · NO TRANSACTION SENT</span>
          </div>
          <ol className="mt-4 grid gap-1 sm:grid-cols-3 lg:grid-cols-6" aria-label="Six-stage runtime progression">
            {stageLabels.map((label, index) => (
              <li key={label}>
                <button type="button" onClick={() => { setPlaying(false); setStage(index); }} aria-current={index === stage ? "step" : undefined} className={`min-h-12 w-full rounded-lg px-2 text-left text-[8.5px] font-bold leading-3.5 ${index < stage ? "bg-emerald-400/10 text-emerald-300" : index === stage ? "bg-white text-slate-950" : "bg-white/5 text-slate-500"}`}>
                  <span className="mr-1 opacity-60">0{index + 1}</span>{label}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="mt-3 text-center text-[9px] leading-4 text-(--ink-3)">
        The runtime is deterministic and sends no transaction. France–Morocco uses canonical captured evidence; Argentina–Brazil proves the reusable scenario path and makes no on-chain evidence claim.
      </p>
    </section>
  );
}

function MatchHeader({ scenario, state }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState> }) {
  return (
    <header className="grid gap-4 border-b border-white/10 p-4 sm:p-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.1em] text-blue-300">
          <Radio className="h-3.5 w-3.5" /> Captured feed connected <span className="text-slate-600">·</span> {scenario.evidenceLabel}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Fixture {scenario.fixtureId} · runtime simulation, not a live external match</p>
      </div>
      <div className="flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
        <Team code={scenario.teams.homeCode} name={scenario.teams.home} active={state.score[0] > state.score[1]} />
        <div className="text-center"><p className="num text-[30px] font-black tracking-[-.06em]">{state.score[0]}–{state.score[1]}</p><p className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400"><Clock3 className="h-3 w-3" />{state.clock}</p></div>
        <Team code={scenario.teams.awayCode} name={scenario.teams.away} active={state.score[1] > state.score[0]} />
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        <StatusPill label={state.synchronized ? "MARKET SYNCHRONISED" : "MARKET STALE"} tone={state.synchronized ? "green" : "amber"} pulse={!state.synchronized} />
        <StatusPill label="MARKET OPEN" tone="blue" />
      </div>
    </header>
  );
}

function MarketPanel({ scenario, state }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState> }) {
  return (
    <section aria-label="Prediction market">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[8.5px] font-bold uppercase tracking-[.1em] text-slate-500">Prediction market</p><h2 className="mt-2 text-[25px] font-extrabold tracking-[-.04em]">{scenario.marketQuestion}</h2></div>
        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-bold text-slate-300">Fixed payout</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <QuoteCard side="YES" value={state.yesPrice} active={scenario.incomingOrder.side === "YES" && state.orderVisible} />
        <QuoteCard side="NO" value={state.noPrice} active={scenario.incomingOrder.side === "NO" && state.orderVisible} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="EVENT SEQUENCE" value={String(state.eventSequence)} tone={!state.synchronized ? "amber" : "neutral"} />
        <Metric label="QUOTE SEQUENCE" value={String(state.quoteSequence)} tone={!state.synchronized ? "amber" : "neutral"} />
        <Metric label="SYNC CHECK" value={state.synchronized ? `${state.eventSequence} = ${state.quoteSequence}` : `${state.eventSequence} ≠ ${state.quoteSequence}`} tone={state.synchronized ? "green" : "amber"} wide />
      </dl>
    </section>
  );
}

function OrderDecision({ scenario, state }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState> }) {
  const decisionShown = state.stage >= 3;
  const refunded = state.decision === "VOID_REFUND";
  const allowed = state.decision === "ALLOW_NO_EDGE";
  const synchronized = state.decision === "ACCEPT_SYNCHRONIZED";
  return (
    <section className={`mt-4 overflow-hidden rounded-2xl border transition-colors ${refunded ? "border-emerald-300/30 bg-emerald-300/10" : allowed || synchronized ? "border-blue-300/30 bg-blue-300/10" : state.orderVisible ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-white/5"}`} aria-label="Incoming order and FairX decision">
      <div className="grid gap-px bg-white/10 sm:grid-cols-2">
        <div className="bg-[#101a2d] p-4">
          <p className="flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[.1em] text-slate-400"><Bot className="h-3.5 w-3.5" /> Incoming order</p>
          <p className="mt-3 text-[15px] font-extrabold">{state.orderVisible ? `${scenario.incomingOrder.side} · ${sol(scenario.incomingOrder.stakeSol)}` : "Waiting for order"}</p>
          <p className="mt-1 text-[9px] text-slate-400">{state.orderVisible ? `${scenario.incomingOrder.actor} · priced at sequence ${scenario.quote.sequence}` : "Market is synchronized"}</p>
        </div>
        <div className="bg-[#101a2d] p-4">
          <p className="flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[.1em] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> FairX guard decision</p>
          <p className={`mt-3 text-[15px] font-extrabold ${refunded ? "text-emerald-300" : allowed || synchronized ? "text-blue-300" : state.orderVisible ? "text-amber-200" : "text-slate-500"}`}>
            {!decisionShown ? (state.orderVisible ? "EVALUATING SEQUENCE" : "GUARD ARMED") : refunded ? "INFORMATIONAL EDGE DETECTED" : allowed ? "ALLOW · NO EDGE" : "ORDER ACCEPTED"}
          </p>
          <p className="mt-1 text-[9px] text-slate-400">{refunded ? "ORDER VOIDED · ATOMIC REFUND · no position or liability" : allowed ? "Stale, but this side did not benefit from the event" : synchronized ? `Sequence ${state.eventSequence} matches · fair order succeeds` : "Deterministic side-and-sequence evaluation"}</p>
        </div>
      </div>
      {decisionShown && <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4"><DecisionFact label="ORDER RESULT" value={refunded ? "VOIDED" : "ACCEPTED"} /><DecisionFact label="USER FUNDS" value={refunded ? `${sol(state.returnedSol)} RETURNED` : `${sol(state.acceptedSol)} STAKED`} /><DecisionFact label="LIABILITY CREATED" value={refunded ? "0.000000000 SOL" : synchronized ? "0.001431275 SOL" : "NORMAL PATH"} /><DecisionFact label="MARKET" value="REMAINS OPEN" /></div>}
    </section>
  );
}

function RuntimeFeed({ scenario, stage }: { scenario: RuntimeScenario; stage: number }) {
  const evaluation = evaluateIncomingOrder(scenario);
  const events = [
    { at: scenario.initial.clock, seq: scenario.initial.eventSequence, label: `${scenario.teams.home} ${scenario.initial.score[0]}–${scenario.initial.score[1]} ${scenario.teams.away}`, kind: "FEED READY" },
    { at: scenario.event.clock, seq: scenario.event.sequence, label: scenario.event.label, kind: "MATERIAL EVENT" },
    { at: "+120ms", seq: scenario.event.sequence, label: `Quote still priced at ${scenario.quote.sequence}`, kind: "MARKET STALE" },
    { at: "+340ms", seq: scenario.event.sequence, label: evaluation.decision === "VOID_REFUND" ? `${scenario.incomingOrder.side} order voided · principal returned` : `${scenario.incomingOrder.side} order has no informational edge · allowed`, kind: evaluation.decision === "VOID_REFUND" ? "ATOMIC REFUND" : "NO EDGE" },
    { at: "+860ms", seq: scenario.event.sequence, label: `Market repriced · YES ${pct(scenario.quote.after.yes)}`, kind: "SYNCHRONISED" },
    { at: "+1.1s", seq: scenario.event.sequence, label: `${scenario.synchronizedOrder.side} order accepted at updated price`, kind: "ORDER ACCEPTED" },
  ];
  return (
    <aside className="min-w-0 bg-[#091120] p-4 sm:p-6" aria-label="TxLINE runtime feed">
      <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.1em] text-blue-300"><Radio className="h-3.5 w-3.5" /> TxLINE runtime feed</p><h2 className="mt-2 text-[18px] font-extrabold">Captured-schema events, played deterministically.</h2></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] font-bold text-slate-400">NOT LIVE</span></div>
      <ol className="mt-5 space-y-2">
        {events.map((event, index) => {
          const visible = index <= stage;
          const current = index === stage;
          return <li key={`${event.kind}-${event.seq}`} className={`grid grid-cols-[42px_1fr] gap-3 rounded-xl border p-3 transition-all ${visible ? current ? "border-blue-300/30 bg-blue-300/10" : "border-white/10 bg-white/5" : "border-white/5 opacity-30"}`}><span className="num text-[8.5px] font-bold text-slate-500">{event.at}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`text-[8px] font-extrabold uppercase tracking-[.08em] ${event.kind === "MARKET STALE" ? "text-amber-200" : event.kind === "ATOMIC REFUND" ? "text-emerald-300" : "text-blue-300"}`}>{event.kind}</span><span className="text-[8px] font-bold text-slate-600">SEQ {event.seq}</span></div><p className="mt-1 text-[10px] font-semibold leading-4 text-slate-200">{event.label}</p></div></li>;
        })}
      </ol>
    </aside>
  );
}

function WowComparison({ scenario, stage, edgePerShare, decision }: { scenario: RuntimeScenario; stage: number; edgePerShare: number; decision: ReturnType<typeof evaluateIncomingOrder>["decision"] }) {
  const revealed = stage >= 3;
  return (
    <section className="border-t border-white/10 bg-[#0d1729] p-4 sm:p-6" aria-label="Unprotected versus FairX comparison">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[8.5px] font-extrabold uppercase tracking-[.11em] text-amber-300">The financial consequence</p><h2 className="mt-2 text-[22px] font-extrabold tracking-[-.035em]">The goal arrived before the price changed. The bot saw free money. FairX saw the stale sequence.</h2></div><span className="text-[9px] font-bold text-slate-400">SAME EVENT · SAME ORDER · DIFFERENT OUTCOME</span></div>
      <div className={`grid gap-3 transition-opacity lg:grid-cols-2 ${revealed ? "opacity-100" : "opacity-45"}`}>
        <article className="overflow-hidden rounded-2xl border border-red-300/25 bg-red-300/[.07]">
          <div className="flex items-center justify-between border-b border-red-300/15 px-4 py-3"><p className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.08em] text-red-200"><Siren className="h-4 w-4" /> Unprotected market</p><span className="text-[8px] font-bold text-red-200">STALE ORDER FILLS</span></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 text-center"><PriceBeat label="BOT BUYS" value={cents(scenario.quote.before.yes)} /><ArrowRight className="h-4 w-4 text-red-300" /><PriceBeat label="MARKET REPRICES" value={cents(scenario.quote.after.yes)} /></div>
          <div className="border-t border-red-300/15 bg-red-300/10 px-4 py-4 text-center"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-red-200">Bot advantage without FairX</p><p className="num mt-1 text-[28px] font-black text-red-100">+{(edgePerShare * 100).toFixed(2)}¢ <span className="text-[11px] font-bold">per $1 payout share</span></p></div>
        </article>
        <article className="overflow-hidden rounded-2xl border border-emerald-300/30 bg-emerald-300/[.08]">
          <div className="flex items-center justify-between border-b border-emerald-300/15 px-4 py-3"><p className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.08em] text-emerald-300"><ShieldCheck className="h-4 w-4" /> FairX-protected market</p><span className="text-[8px] font-bold text-emerald-300">MARKET STAYS OPEN</span></div>
          <div className="grid gap-2 p-4 sm:grid-cols-2"><CompareFact label="EVENT SEQUENCE" value={String(scenario.event.sequence)} /><CompareFact label="QUOTE SEQUENCE" value={String(scenario.quote.sequence)} /><CompareFact label="ORDER BENEFITED BY EVENT" value={`${scenario.incomingOrder.side} · ${edgePerShare > 0 ? "YES" : "NO"}`} /><CompareFact label="ACTION" value={decision === "VOID_REFUND" ? "VOID + ATOMIC REFUND" : "ALLOW · NO EDGE"} strong /></div>
          <div className="border-t border-emerald-300/15 bg-emerald-300/10 px-4 py-4 text-center"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-emerald-300">Bot advantage with FairX</p><p className="num mt-1 text-[28px] font-black text-emerald-100">0 <span className="text-[11px] font-bold">· honest market remains open</span></p></div>
        </article>
      </div>
    </section>
  );
}

function Team({ code, name, active }: { code: string; name: string; active: boolean }) { return <div className="text-center"><span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-[9px] font-black ${active ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}>{code}</span><p className="mt-1 max-w-16 truncate text-[8px] font-bold text-slate-400">{name}</p></div>; }
function StatusPill({ label, tone, pulse = false }: { label: string; tone: "green" | "amber" | "blue"; pulse?: boolean }) { const style = tone === "green" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-300" : tone === "amber" ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-blue-300/25 bg-blue-300/10 text-blue-200"; return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[8.5px] font-extrabold ${style}`}><span className={`h-1.5 w-1.5 rounded-full ${tone === "green" ? "bg-emerald-300" : tone === "amber" ? "bg-amber-300" : "bg-blue-300"} ${pulse ? "dot-pulse" : ""}`} />{label}</span>; }
function QuoteCard({ side, value, active }: { side: "YES" | "NO"; value: number; active: boolean }) { return <article className={`rounded-2xl border p-4 transition-colors ${active ? side === "YES" ? "border-blue-300/40 bg-blue-300/10" : "border-violet-300/40 bg-violet-300/10" : "border-white/10 bg-white/5"}`}><div className="flex items-center justify-between"><span className={`text-[9px] font-extrabold ${side === "YES" ? "text-blue-300" : "text-violet-300"}`}>{side}</span><span className="text-[8px] text-slate-500">BUY</span></div><p className="num mt-3 text-[34px] font-black tracking-[-.05em]">{cents(value)}</p><p className="mt-1 text-[9px] text-slate-500">{pct(value)} implied</p></article>; }
function Metric({ label, value, tone = "neutral", wide = false }: { label: string; value: string; tone?: "neutral" | "green" | "amber"; wide?: boolean }) { const color = tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-200" : "text-slate-200"; return <div className={`rounded-xl border border-white/10 bg-white/5 p-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`}><dt className="text-[7.5px] font-bold tracking-[.08em] text-slate-500">{label}</dt><dd className={`num mt-1 text-[13px] font-extrabold ${color}`}>{value}</dd></div>; }
function DecisionFact({ label, value }: { label: string; value: string }) { return <div className="bg-[#101a2d] p-3"><p className="text-[7px] font-bold tracking-[.08em] text-slate-500">{label}</p><p className="mt-1 text-[9px] font-extrabold text-slate-200">{value}</p></div>; }
function PriceBeat({ label, value }: { label: string; value: string }) { return <div><p className="text-[7.5px] font-bold tracking-[.08em] text-red-200/70">{label}</p><p className="num mt-2 text-[23px] font-black text-red-100">{value}</p></div>; }
function CompareFact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="rounded-xl bg-black/10 p-3"><p className="text-[7px] font-bold tracking-[.08em] text-emerald-200/65">{label}</p><p className={`mt-1 text-[10px] font-extrabold ${strong ? "text-emerald-200" : "text-white"}`}>{value}</p></div>; }

export const FAIRX_RUNTIME_TEST_SURFACE = {
  stages: RUNTIME_STAGE_LABELS,
  count: RUNTIME_STAGE_COUNT,
  scenarios: RUNTIME_SCENARIOS.map((scenario) => scenario.id),
  deterministicRuntime,
};
