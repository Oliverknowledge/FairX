"use client";

import { Bot, Flag, Play, Radio, RotateCcw, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/components/lineguard/ui";
import { PHASE_LABELS } from "@/hooks/useReplay";

/**
 * Drives the demo. "Run attack demo" fires the full scripted sequence on
 * timers; the phase buttons let you step one phase at a time for debugging.
 * Each phase is enabled only when it's the next valid transition.
 */

const ICONS = [Flag, Radio, Bot, ShieldCheck, TrendingUp];

export function ReplayControls({
  completed,
  playing,
  onRunFull,
  onRunPhase,
  onReset,
}: {
  completed: number;
  playing: boolean;
  onRunFull: () => void;
  onRunPhase: (phaseIndex: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRunFull}
          disabled={playing}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-(--ink) px-3.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" /> Run attack scenario
        </button>

        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {PHASE_LABELS.map((label, i) => {
            const n = i + 1;
            const done = completed >= n;
            const isNext = completed === i && !playing;
            const Icon = ICONS[i];
            return (
              <button
                key={label}
                onClick={() => onRunPhase(i)}
                disabled={!isNext}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] font-semibold transition-all",
                  done
                    ? "border-(--green)/30 bg-(--green-bg) text-(--green)"
                    : isNext
                      ? "border-(--blue) bg-(--blue) text-white shadow-sm"
                      : "border-(--border) bg-white text-(--ink-3)"
                )}
              >
                <span
                  className={cn(
                    "num flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                    done ? "bg-(--green)/15" : isNext ? "bg-white/25" : "bg-[#f3f4f6]"
                  )}
                >
                  {done ? "✓" : n}
                </span>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onReset}
          disabled={playing}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-(--border) bg-white px-3 text-[12px] font-semibold text-(--ink-2) transition-colors hover:bg-[#f3f4f6] disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
    </div>
  );
}
