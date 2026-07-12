"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Play, RotateCcw, ShieldAlert, ShieldCheck, TrendingDown } from "lucide-react";
import { simulateAttackWave, type AttackLabResult } from "@/lib/attack/simulate";

const PRESETS = [100, 250, 500] as const;

function sandbox(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} sandbox units`;
}

export function AttackLab() {
  const [count, setCount] = useState<number>(100);
  const [seed, setSeed] = useState<number>(42);
  const [result, setResult] = useState<AttackLabResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(false);
  const frame = useRef<number | null>(null);

  const run = (bots: number, nextSeed: number) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const wave = simulateAttackWave(bots, nextSeed);
    setResult(wave);
    setRevealed(0);
    setRunning(true);
    const duration = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setRevealed(Math.round(eased * wave.totalBots));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setRevealed(wave.totalBots);
        setRunning(false);
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    run(100, 42);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = result ? revealed / result.totalBots : 0;
  const shown = useMemo(() => (result ? result.scenarios.slice(0, revealed) : []), [result, revealed]);
  const deniedNow = Math.round((result?.staleProfitDenied ?? 0) * progress);
  const refundedNow = Math.round((result?.attacksRefunded ?? 0) * progress);
  const allowedNow = Math.round((result?.safeTradesAllowed ?? 0) * progress);
  const volumeNow = Math.round((result?.protectedVolume ?? 0) * progress);

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--red-bg) text-(--red)">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="section-label">Attack Lab</p>
              <p className="text-[10.5px] text-(--ink-2)">Stress-test the guard against a wave of latency bots.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setCount(preset);
                  run(preset, seed);
                }}
                className={`h-8 rounded-md border px-2.5 text-[10.5px] font-bold transition-colors ${
                  count === preset ? "border-[#bdd2f8] bg-[#eef4ff] text-(--blue)" : "border-(--border) bg-white text-(--ink-2) hover:border-[#cbd5e1]"
                }`}
              >
                {preset} bots
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const nextSeed = seed + 1;
                setSeed(nextSeed);
                run(count, nextSeed);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-(--ink) px-3 text-[10.5px] font-bold text-white hover:bg-[#273244]"
            >
              {running ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run new wave
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="rounded-xl border border-[#f0c5c5] bg-gradient-to-br from-[#fff6f6] to-white p-4">
              <div className="flex items-center gap-2 text-(--red)">
                <TrendingDown className="h-4 w-4" />
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em]">Modeled stale edge denied</p>
              </div>
              <p className="num mt-1 text-[32px] font-extrabold leading-none tracking-[-0.04em] text-(--red)">{sandbox(deniedNow)}</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-(--ink-2)">
                Unfair edge that would have leaked to latency bots at frozen prices — refunded instead of filled.
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Bots run" value={revealed} tone="neutral" />
              <Stat label="Attacks refunded" value={refundedNow} tone="red" />
              <Stat label="Safe previews allowed" value={allowedNow} tone="green" />
              <Stat label="Modeled stakes" value={sandbox(volumeNow)} tone="blue" isText />
            </div>

            <div className="mt-3 rounded-lg border border-(--border) bg-[#fafbfc] p-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1.5 font-semibold text-(--ink-2)"><ShieldAlert className="h-3.5 w-3.5 text-(--red)" /> Without LineGuard</span>
                <span className="num font-bold text-(--red)">{sandbox(result?.leakedWithoutGuard ?? 0)} modeled edge</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#fdecec]">
                <div className="h-full rounded-full bg-(--red)" style={{ width: "100%" }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1.5 font-semibold text-(--ink-2)"><ShieldCheck className="h-3.5 w-3.5 text-(--green)" /> With LineGuard</span>
                <span className="num font-bold text-(--green)">0 sandbox units modeled</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9f7f0]">
                <div className="h-full rounded-full bg-(--green) transition-[width] duration-500" style={{ width: `${(1 - progress) * 0 + 2}%` }} />
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between">
              <p className="section-label">Bot wave</p>
              <div className="flex items-center gap-2.5 text-[9px] font-semibold text-(--ink-3)">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-(--red)" /> refunded</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-(--green)" /> allowed</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-[3px] rounded-lg border border-(--border) bg-white p-2.5" aria-hidden>
              {shown.map((scenario) => (
                <span
                  key={scenario.id}
                  title={`${scenario.side} · ${scenario.verdict}`}
                  className={`h-2 w-2 rounded-[2px] ${scenario.blocked ? "bg-(--red)" : "bg-(--green)"}`}
                />
              ))}
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-(--ink-3)">
              Avg stale window <span className="num font-semibold text-(--ink-2)">{result?.avgStaleWindow ?? 0}</span> sequences ·
              {" "}each dot is one bot evaluated by <span className="mono">evaluateLineGuard</span>.
            </p>
          </div>
        </div>

        <div className="border-t border-(--border) bg-[#f8fafc] px-4 py-2.5">
          <p className="text-[9.5px] leading-relaxed text-(--ink-3)">
            <strong className="text-(--ink-2)">Honest label:</strong> this is local simulation using the same pure guard function
            (<span className="mono">lib/lineguard/evaluate.ts</span>) that runs in the terminal and is enforced by the deployed devnet program.
            No transactions are sent from this page.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, isText = false }: { label: string; value: number | string; tone: "neutral" | "red" | "green" | "blue"; isText?: boolean }) {
  const color = tone === "red" ? "text-(--red)" : tone === "green" ? "text-(--green)" : tone === "blue" ? "text-(--blue)" : "text-(--ink)";
  return (
    <div className="rounded-lg border border-(--border) bg-white p-2.5">
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">{label}</p>
      <p className={`num mt-0.5 text-[19px] font-extrabold leading-none tracking-[-0.03em] ${color}`}>{isText ? value : Number(value).toLocaleString("en-US")}</p>
    </div>
  );
}
