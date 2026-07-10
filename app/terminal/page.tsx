"use client";

import { ShieldCheck } from "lucide-react";
import { useReducer } from "react";
import { CapturedPayloadPanel } from "@/components/lineguard/CapturedPayloadPanel";
import { EscrowPanel } from "@/components/lineguard/EscrowPanel";
import { EventTimeline } from "@/components/lineguard/EventTimeline";
import { GuardPanel } from "@/components/lineguard/GuardPanel";
import { MarketPanel } from "@/components/lineguard/MarketPanel";
import { OnChainPanel } from "@/components/lineguard/OnChainPanel";
import { OrderLog } from "@/components/lineguard/OrderLog";
import { ProofPanel } from "@/components/lineguard/ProofPanel";
import { ReceiptPanel } from "@/components/lineguard/ReceiptPanel";
import { ReplayControls } from "@/components/lineguard/ReplayControls";
import { SniperBotPanel } from "@/components/lineguard/SniperBotPanel";
import { TxLinePanel } from "@/components/lineguard/TxLinePanel";
import { TxLineProvider } from "@/components/lineguard/TxLineProvider";
import { Badge } from "@/components/lineguard/ui";
import { completedPhases, useReplay } from "@/hooks/useReplay";
import { isStale } from "@/lib/markets/types";
import { reducer } from "@/lib/terminal/reducer";
import { activeDataSource, createInitialState, DATA_SOURCE_LABEL, DATA_SOURCE_TONE } from "@/lib/terminal/state";

/**
 * The original LineGuard terminal remains available as a focused technical
 * surface while FairX owns the marketplace home route.
 */
export default function TerminalPage() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState("demo"));
  const { playing, runFull, runPhase, reset } = useReplay(dispatch, state.mode);

  const stale = isStale(state.market);
  const completed = completedPhases(state);
  const scoresStatus = state.mode === "demo" ? "sandbox" : state.txline.scores;
  const source = activeDataSource(state);

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-4 py-4">
      <TxLineProvider state={state} dispatch={dispatch} />

      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--green-bg)">
          <ShieldCheck className="h-5 w-5 text-(--green)" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold leading-tight tracking-tight text-(--ink)">
            LineGuard <span className="font-medium text-(--ink-3)">— Stale-Price Protection for Live Sports Markets</span>
          </h1>
          <p className="text-[11px] text-(--ink-2)">
            Every prediction market can prove who won. LineGuard proves whether the trade that got you there was fair.
          </p>
          <p className="mt-0.5 text-[9.5px] text-(--ink-3)">
            Same reducer path: live SSE → normalized event → materiality engine → stale-window guard.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge tone={DATA_SOURCE_TONE[source]} dot>
            {DATA_SOURCE_LABEL[source]}
          </Badge>
          <Badge tone="neutral">{state.mode === "live" ? state.txline.health?.network ?? "devnet" : "sandbox"}</Badge>
          <Badge tone={scoresStatus === "live" ? "green" : scoresStatus === "error" ? "red" : "neutral"} dot pulse={scoresStatus === "live"}>
            {scoresStatus}
          </Badge>
          <Badge tone="neutral" className="hidden sm:inline-flex">
            {state.market.fixtureId}
          </Badge>
          {stale ? (
            <Badge tone="amber" dot pulse>
              STALE WINDOW OPEN
            </Badge>
          ) : completed >= 5 ? (
            <Badge tone="blue">REPRICED · IN SYNC</Badge>
          ) : (
            <Badge tone="green" dot>
              PROTECTED
            </Badge>
          )}
          <a
            href="/proof"
            className="inline-flex h-[22px] items-center rounded-md border border-(--border) bg-white px-2 text-[10.5px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6] hover:text-(--blue)"
          >
            Proof
          </a>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <MarketPanel state={state} />
        </div>
        <div className="space-y-3">
          <SniperBotPanel state={state} dispatch={dispatch} />
          <EventTimeline state={state} />
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <GuardPanel state={state} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <EscrowPanel state={state} />
        <TxLinePanel state={state} dispatch={dispatch} />
        <ReceiptPanel state={state} dispatch={dispatch} />
        <ProofPanel state={state} />
      </div>

      <div className="mt-3">
        <OnChainPanel state={state} dispatch={dispatch} />
      </div>

      <div className="mt-3">
        <CapturedPayloadPanel state={state} dispatch={dispatch} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ReplayControls completed={completed} playing={playing} onRunFull={runFull} onRunPhase={runPhase} onReset={reset} />
        <div className="lg:row-span-1">
          <OrderLog log={state.log} />
        </div>
      </div>

      <footer className="mt-5 text-center text-[10.5px] leading-relaxed text-(--ink-3)">
        We don&apos;t just use TxLINE to settle who won — we use it to prove whether each trade was fair at the moment it was placed. The guard
        decision is a single pure function (<span className="mono">lib/lineguard/evaluate.ts</span>). Not a real-money product.
      </footer>
    </main>
  );
}
