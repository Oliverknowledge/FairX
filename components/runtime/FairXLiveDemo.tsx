"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileCheck2,
  Gauge,
  Pause,
  Play,
  Radio,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WalletCards,
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
  type MarketHealth,
} from "@/lib/runtime/engine";
import { RUNTIME_SCENARIOS, scenarioById, type RuntimeScenario } from "@/lib/runtime/scenarios";
import { canonicalStaleCounterfactual } from "@/lib/v4/replay";

const AUTOPLAY_MS = [1250, 1500, 1600, 1900, 1500, 1800] as const;

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function cents(value: number) {
  return `${(value * 100).toFixed(2)}¢`;
}

function sol(value: number) {
  return `${value.toFixed(9)} SOL`;
}

function lamportsToSol(value: bigint) {
  return `${(Number(value) / 1_000_000_000).toFixed(9)} SOL`;
}

export function FairXLiveDemo({ initialScenarioId = "france-morocco" }: { initialScenarioId?: string }) {
  const [scenarioId, setScenarioId] = useState(initialScenarioId);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId]);
  const state = runtimeState(scenario, stage);
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
        <div className="max-w-[840px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-emerald-800">
              <span className="dot-pulse h-2 w-2 rounded-full bg-emerald-500" /> Market integrity replay
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[9px] font-bold text-blue-800">Recorded evidence + deterministic controls</span>
          </div>
          <h1 id="live-demo-title" className="mt-5 max-w-[820px] text-[42px] font-extrabold leading-[.96] tracking-[-0.055em] sm:text-[60px] lg:text-[72px]">
            The stale order stops. The market doesn’t.
          </h1>
          <p className="mt-5 max-w-[760px] text-[14px] leading-6 text-(--ink-2) sm:text-[15px]">
            FairX is execution-integrity infrastructure for <strong className="font-bold text-(--ink)">operators running live sports markets</strong> — prediction-market and sportsbook operators and the liquidity and risk teams behind them: detect, measure, protect, explain, recover, and verify.
          </p>
          <p className="mt-3 max-w-[760px] text-[12.5px] leading-6 text-(--ink-3)">
            Fans keep access to synchronized markets instead of a full suspension after every material event.
          </p>
        </div>
        <button type="button" onClick={runScenario} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-(--ink) px-6 text-[12px] font-extrabold text-white shadow-[0_16px_35px_rgba(15,23,42,.18)] hover:bg-slate-800">
          <Zap className="h-4 w-4 text-amber-300" /> Run integrity incident
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-(--border) bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div>
          <p className="text-[8px] font-extrabold uppercase tracking-[.12em] text-(--ink-3)">Evidence mode</p>
          <p className="mt-1 text-[11px] font-bold">Canonical recorded incident or clearly labelled runtime reference.</p>
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
        <IntegrityHeader scenario={scenario} state={state} />
        <IntegrityPanel scenario={scenario} state={state} onRetry={() => { setPlaying(false); setStage(4); }} />
        <StaleWindowTimeline stage={stage} />
        <OperatorValue scenario={scenario} state={state} />

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
            <span className="ml-auto text-[9px] font-bold text-slate-400">REPLAY CONTROL · NO TRANSACTION SENT</span>
          </div>
          <ol className="mt-4 grid gap-1 sm:grid-cols-4 lg:grid-cols-7" aria-label="Seven-stage integrity progression">
            {stageLabels.map((label, index) => (
              <li key={label}>
                <button type="button" onClick={() => { setPlaying(false); setStage(index); }} aria-current={index === stage ? "step" : undefined} className={`min-h-12 w-full rounded-lg px-2 text-left text-[8.5px] font-bold leading-3.5 transition-all ${index < stage ? "bg-emerald-400/10 text-emerald-300" : index === stage ? "bg-white text-slate-950" : "bg-white/5 text-slate-500"}`}>
                  <span className="mr-1 opacity-60">0{index + 1}</span>{label}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="mt-3 text-center text-[9px] leading-4 text-(--ink-3)">
        France–Morocco mirrors the finalized V4 lifecycle. Argentina–Brazil is a runtime reference and makes no on-chain settlement claim. Neither control sends a transaction.
      </p>
    </section>
  );
}

function IntegrityHeader({ scenario, state }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState> }) {
  return (
    <header className="grid gap-4 border-b border-white/10 p-4 sm:p-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.1em] text-blue-300">
          <Radio className="h-3.5 w-3.5" /> {scenario.canonicalEvidence ? "Recorded TxLINE evidence" : "Runtime reference"}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Fixture {scenario.fixtureId} · {scenario.marketQuestion}</p>
      </div>
      <div className="flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
        <Team code={scenario.teams.homeCode} name={scenario.teams.home} active={state.score[0] > state.score[1]} />
        <div className="text-center"><p className="num text-[30px] font-black tracking-[-.06em]">{state.score[0]}–{state.score[1]}</p><p className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400"><Clock3 className="h-3 w-3" />{state.clock}</p></div>
        <Team code={scenario.teams.awayCode} name={scenario.teams.away} active={state.score[1] > state.score[0]} />
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        <HealthPill health={state.health} />
        <span className="rounded-full border border-blue-300/25 bg-blue-300/10 px-3 py-1.5 text-[8.5px] font-extrabold text-blue-200">MARKET {state.marketStatus}</span>
      </div>
    </header>
  );
}

function IntegrityPanel({ scenario, state, onRetry }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState>; onRetry: () => void }) {
  const staleReturned = state.decision === "STALE_SEQUENCE_RETURNED";
  const accepted = state.decision === "ACCEPTED";
  return (
    <section className="grid min-w-0 lg:grid-cols-[1.12fr_.88fr]" aria-labelledby="integrity-panel-title">
      <div className="min-w-0 border-b border-white/10 p-4 sm:p-6 lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.11em] text-blue-300"><Gauge className="h-4 w-4" /> Market integrity panel</p>
            <h2 id="integrity-panel-title" className="mt-2 text-[25px] font-extrabold tracking-[-.04em]">What is happening right now?</h2>
          </div>
          <HealthTransition health={state.health} />
        </div>

        <div key={`metrics-${state.stage}`} className="fx-stage-enter mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          <ConsoleMetric label="EVENT SEQUENCE" value={String(state.eventSequence)} tone={state.sequenceDelta > 0 ? "amber" : "green"} />
          <ConsoleMetric label="QUOTE SEQUENCE" value={String(state.quoteSequence)} tone={state.sequenceDelta > 0 ? "amber" : "green"} />
          <ConsoleMetric label="SEQUENCE DELTA" value={state.sequenceDelta > 0 ? `+${state.sequenceDelta}` : "0"} tone={state.sequenceDelta > 0 ? "amber" : "green"} />
          <ConsoleMetric label="STALE WINDOW" value={state.staleWindow} tone={state.staleWindow === "OPEN" ? "amber" : state.staleWindow === "RECOVERING" ? "blue" : "green"} />
          <ConsoleMetric label="CURRENT QUOTE" value={`YES ${cents(state.yesPrice)}`} detail={`NO ${cents(state.noPrice)}`} />
          <ConsoleMetric label="MARKET STATUS" value={state.marketStatus} tone={state.marketStatus === "OPEN" ? "green" : "blue"} />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            <div key={`order-${state.orderId ?? "waiting"}`} className="fx-stage-enter bg-[#101a2d] p-4">
              <p className="flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[.1em] text-slate-400"><WalletCards className="h-3.5 w-3.5" /> Incoming order</p>
              <p className="mt-3 text-[15px] font-extrabold">{state.orderVisible ? `${state.orderSide} · ${sol(state.orderStakeSol)}` : "Waiting for order"}</p>
              <p className="mt-1 text-[9px] text-slate-400">{state.orderVisible ? `${state.orderActor} · order sequence ${state.orderSequence}` : "Guard armed · sequence equality required"}</p>
            </div>
            <div key={`decision-${state.decision ?? state.stage}`} className={`fx-stage-enter p-4 ${staleReturned ? "bg-emerald-300/10" : accepted ? "bg-blue-300/10" : "bg-[#101a2d]"}`}>
              <p className="flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[.1em] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Decision</p>
              <p className={`mt-3 break-words text-[15px] font-extrabold ${staleReturned ? "text-emerald-300" : accepted ? "text-blue-300" : state.orderVisible ? "text-amber-200" : "text-slate-500"}`}>
                {staleReturned ? "STALE_SEQUENCE_RETURNED" : accepted ? "ACCEPTED" : state.orderVisible ? "COMPARING SEQUENCES" : "READY"}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">{staleReturned ? `${state.orderSequence} < ${state.eventSequence} · principal returned · zero liability` : accepted ? `${state.orderSequence} = ${state.eventSequence} · position and fixed liability created` : "Behind → STALE_SEQUENCE_RETURNED · level → ACCEPTED · ahead → FUTURE_SEQUENCE"}</p>
            </div>
          </div>
        </div>
      </div>

      <IntegrityReceipt scenario={scenario} state={state} onRetry={onRetry} />
    </section>
  );
}

function IntegrityReceipt({ scenario, state, onRetry }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState>; onRetry: () => void }) {
  const hasDecision = state.decision !== null;
  const returned = state.decision === "STALE_SEQUENCE_RETURNED";
  const evidenceLabel = scenario.canonicalEvidence ? "Recorded On-chain" : "Runtime Reference";
  return (
    <aside className="min-w-0 bg-[#091120] p-4 sm:p-6" aria-label="Integrity receipt">
      <div className="flex items-start justify-between gap-3">
        <div><p className="flex items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.1em] text-blue-300"><ReceiptText className="h-4 w-4" /> Integrity receipt</p><h2 className="mt-2 text-[18px] font-extrabold">Every order gets an explanation.</h2></div>
        <span className={`rounded-full border px-2.5 py-1 text-[8px] font-bold ${scenario.canonicalEvidence ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-300" : "border-blue-300/25 bg-blue-300/10 text-blue-200"}`}>{evidenceLabel}</span>
      </div>

      {!hasDecision ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-5 text-center">
          <ReceiptText className="mx-auto h-6 w-6 text-slate-600" />
          <p className="mt-3 text-[11px] font-bold text-slate-300">Receipt pending</p>
          <p className="mt-1 text-[9px] leading-4 text-slate-500">The sequence decision will produce a concise operator and trader record.</p>
        </div>
      ) : (
        <div key={`${state.orderId}-${state.decision}`} className="fx-stage-enter mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className={`border-b px-4 py-4 ${returned ? "border-emerald-300/15 bg-emerald-300/10" : "border-blue-300/15 bg-blue-300/10"}`}>
            <p className="text-[8px] font-bold uppercase tracking-[.09em] text-slate-400">Decision</p>
            <p className={`mt-1 break-words text-[14px] font-black ${returned ? "text-emerald-300" : "text-blue-300"}`}>{state.decision}</p>
          </div>
          <dl className="divide-y divide-white/10 px-4">
            <ReceiptRow label="Order ID" value={state.orderId ?? "—"} />
            <ReceiptRow label="Required sequence" value={String(state.eventSequence)} />
            <ReceiptRow label="Order sequence" value={String(state.orderSequence)} />
            <ReceiptRow label="Principal returned" value={returned ? sol(state.returnedSol) : "0.000000000 SOL"} />
            <ReceiptRow label="Position created" value={returned ? "No" : "Yes"} />
            <ReceiptRow label="Liability created" value={returned ? "0.000000000 SOL" : sol(state.liabilitySol)} />
            <ReceiptRow label="Evidence source" value={scenario.canonicalEvidence ? "TxLINE + Solana V4" : "Runtime fixture"} />
          </dl>
        </div>
      )}

      {returned && state.stage < 5 && (
        <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[10px] font-extrabold text-slate-950"><RefreshCw className="h-4 w-4" /> Synchronize and retry</button>
      )}
      <p className="mt-4 text-[8.5px] leading-4 text-slate-500">Replay controls send no transaction. {scenario.canonicalEvidence ? "“Recorded On-chain” identifies the canonical order mirrored by this replay." : "“Runtime Reference” means this scenario has no on-chain record; it exercises the same sequence rule against a schema-compatible fixture."}</p>
    </aside>
  );
}

const TIMELINE = [
  { label: "Goal", state: "Sequence changed", threshold: 1 },
  { label: "TxLINE update", state: "Received", threshold: 1 },
  { label: "Quote stale", state: "Open", threshold: 1 },
  { label: "Order arrives", state: "Compared", threshold: 2 },
  { label: "Principal returned", state: "Protected", threshold: 3 },
  { label: "Quote synchronized", state: "Recovered", threshold: 4 },
  { label: "Replacement accepted", state: "Accepted", threshold: 5 },
  { label: "Settlement", state: "Resolved", threshold: 6 },
  { label: "Proof", state: "Verified", threshold: 6 },
] as const;

function StaleWindowTimeline({ stage }: { stage: number }) {
  return (
    <section className="border-t border-white/10 bg-[#0a1323] p-4 sm:p-6" aria-labelledby="stale-window-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="flex items-center gap-2 text-[8.5px] font-extrabold uppercase tracking-[.11em] text-amber-300"><Activity className="h-4 w-4" /> Stale window timeline</p><h2 id="stale-window-title" className="mt-2 text-[22px] font-extrabold tracking-[-.035em]">See the protection window open—and close.</h2></div>
        <span className="text-[8.5px] font-bold text-slate-500">NO SYNTHETIC LATENCY OR TIMESTAMPS</span>
      </div>
      <ol className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-9">
        {TIMELINE.map((item, index) => {
          const complete = stage >= item.threshold;
          const current = complete && (index === TIMELINE.length - 1 || stage < TIMELINE[index + 1].threshold);
          return (
            <li key={item.label} className={`relative min-h-[86px] rounded-xl border p-3 transition-all duration-500 ${complete ? current ? "fx-timeline-current border-blue-300/35 bg-blue-300/10" : "border-emerald-300/20 bg-emerald-300/[.07]" : "border-white/5 bg-white/[.025] opacity-45"}`}>
              <div className="flex items-center justify-between gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${complete ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-300" : "border-white/10 text-slate-600"}`}>{complete ? <CheckCircle2 className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}</span><span className="text-[8px] font-bold text-slate-600">0{index + 1}</span></div>
              <p className="mt-3 text-[9px] font-extrabold leading-3 text-slate-200">{item.label}</p>
              <p className={`mt-1 text-[8px] font-bold ${complete ? "text-emerald-300" : "text-slate-600"}`}>{complete ? item.state : "Pending"}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OperatorValue({ scenario, state }: { scenario: RuntimeScenario; state: ReturnType<typeof runtimeState> }) {
  const economics = canonicalStaleCounterfactual();
  const evaluation = evaluateIncomingOrder(scenario);
  const revealed = state.stage >= 3;
  return (
    <section className={`grid gap-px border-t border-white/10 bg-white/10 transition-opacity sm:grid-cols-3 ${revealed ? "opacity-100" : "opacity-45"}`} aria-label="Operator value">
      <ValueFact label="PROTECTED OUTCOME" value={revealed ? "Principal returned · zero liability" : "Awaiting decision"} detail={scenario.canonicalEvidence ? "Recorded outcome for the canonical stale order" : "Deterministic outcome for this runtime scenario · no on-chain record"} />
      <ValueFact label={scenario.canonicalEvidence ? "ILLUSTRATIVE COUNTERFACTUAL" : "ILLUSTRATIVE PRICE MOVE"} value={scenario.canonicalEvidence ? lamportsToSol(economics.staleLiabilityLamports) : `${evaluation.illustrativePriceMove >= 0 ? "+" : ""}${cents(evaluation.illustrativePriceMove)}`} detail={scenario.canonicalEvidence ? "Old-price liability if the order had been accepted" : "Not a measured loss, latency, or adoption metric"} />
      <ValueFact label="OPERATOR PAYOFF" value="Stay open without private discretion" detail="Every returned order has a reason and a recovery path" strong />
    </section>
  );
}

function HealthTransition({ health }: { health: MarketHealth }) {
  const steps: MarketHealth[] = ["STALE", "RECOVERING", "HEALTHY"];
  const active = health === "HEALTHY" ? 2 : health === "RECOVERING" ? 1 : 0;
  return <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1" aria-label={`Market health ${health}`}>{steps.map((step, index) => <span key={step} className={`rounded-lg px-2 py-1.5 text-[7.5px] font-extrabold transition-all ${index === active ? step === "STALE" ? "bg-amber-300/15 text-amber-200" : step === "RECOVERING" ? "bg-blue-300/15 text-blue-200" : "bg-emerald-300/15 text-emerald-300" : "text-slate-600"}`}>{step}</span>)}</div>;
}

function HealthPill({ health }: { health: MarketHealth }) {
  const style = health === "HEALTHY" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-300" : health === "RECOVERING" ? "border-blue-300/25 bg-blue-300/10 text-blue-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[8.5px] font-extrabold ${style}`}><span className={`h-1.5 w-1.5 rounded-full ${health === "HEALTHY" ? "bg-emerald-300" : health === "RECOVERING" ? "bg-blue-300" : "dot-pulse bg-amber-300"}`} />{health}</span>;
}

function Team({ code, name, active }: { code: string; name: string; active: boolean }) { return <div className="text-center"><span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-[9px] font-black ${active ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}>{code}</span><p className="mt-1 max-w-16 truncate text-[8px] font-bold text-slate-400">{name}</p></div>; }
function ConsoleMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: string; tone?: "neutral" | "green" | "amber" | "blue" }) { const color = tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-200" : tone === "blue" ? "text-blue-200" : "text-slate-100"; return <div className="bg-[#101a2d] p-4"><dt className="text-[7.5px] font-bold tracking-[.08em] text-slate-500">{label}</dt><dd className={`num mt-1 text-[15px] font-extrabold ${color}`}>{value}</dd>{detail && <p className="mt-1 text-[8px] font-semibold text-slate-500">{detail}</p>}</div>; }
function ReceiptRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 py-3"><dt className="text-[8.5px] text-slate-500">{label}</dt><dd className="num max-w-[58%] break-words text-right text-[9px] font-bold text-slate-200">{value}</dd></div>; }
function ValueFact({ label, value, detail, strong = false }: { label: string; value: string; detail: string; strong?: boolean }) { return <article className={`p-5 ${strong ? "bg-emerald-300/[.08]" : "bg-[#0d1729]"}`}><p className={`text-[8px] font-extrabold tracking-[.09em] ${strong ? "text-emerald-300" : "text-slate-500"}`}>{label}</p><p className="mt-2 text-[13px] font-extrabold text-white">{value}</p><p className="mt-1 text-[8.5px] leading-4 text-slate-500">{detail}</p></article>; }

export const FAIRX_RUNTIME_TEST_SURFACE = {
  stages: RUNTIME_STAGE_LABELS,
  count: RUNTIME_STAGE_COUNT,
  scenarios: RUNTIME_SCENARIOS.map((scenario) => scenario.id),
  deterministicRuntime,
};
