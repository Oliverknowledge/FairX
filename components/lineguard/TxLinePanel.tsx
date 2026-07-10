"use client";

import { useState } from "react";
import { ChevronDown, Radio, TriangleAlert, Wifi, WifiOff } from "lucide-react";
import { Badge, Card, cn, Label, Stat } from "@/components/lineguard/ui";
import { eventImpactsMarket } from "@/lib/markets/materiality";
import type { StreamStatus } from "@/lib/txline/types";
import type { Action } from "@/lib/terminal/actions";
import { activeDataSource, DATA_SOURCE_LABEL, DATA_SOURCE_TONE, type Mode, type TerminalState } from "@/lib/terminal/state";

/**
 * The TxLINE integration surface: mode, network, origin, fixture, credential
 * presence (never values), both stream statuses, connection/payload/error
 * timestamps, the latest sequence/type and how it was inferred, proof status,
 * materiality of the last event, and a raw-payload drawer. Honest about
 * live/captured/demo at all times — never claims demo or captured data is live.
 */
export function TxLinePanel({
  state,
  dispatch,
}: {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const { txline, mode, market } = state;
  const health = txline.health;
  const liveCapable = health?.liveCapable ?? false;
  const credentialsPresent = Boolean(health?.hasJwt || health?.hasApiToken);
  const lastEvent = txline.lastEvent;
  const material = lastEvent ? eventImpactsMarket(lastEvent, market) : false;
  const source = activeDataSource(state);

  const network = mode === "demo" ? "sandbox" : health?.network ?? "devnet";
  const origin = mode === "demo" ? "scripted replay (no network)" : health?.apiOrigin ?? "—";
  const fixture = health?.fixtureId ?? market.fixtureId;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-(--ink-2)" />
          <Label>TxLINE integration</Label>
        </div>
        <ModeToggle mode={mode} liveCapable={liveCapable} onSet={(m) => dispatch({ type: "SET_MODE", mode: m })} />
      </div>

      {/* Credential / mode honesty banner */}
      {!liveCapable && (
        <div className="mt-2.5 rounded-md border border-(--amber)/30 bg-(--amber-bg) px-2.5 py-1.5 text-[10.5px] font-medium text-(--amber)">
          TxLINE credentials missing — running in sandbox mode. Set TXLINE_JWT / TXLINE_API_TOKEN to attempt a live SSE connection.
        </div>
      )}
      {liveCapable && mode === "live" && (
        <div className="mt-2.5 rounded-md border border-(--green)/30 bg-(--green-bg) px-2.5 py-1.5 text-[10.5px] font-medium text-(--green)">
          Credentials detected — attempting live TxLINE SSE via internal proxy.
        </div>
      )}
      {liveCapable && mode === "live" && txline.scores === "live" && !lastEvent && (
        <div className="mt-2.5 rounded-md border border-(--blue)/25 bg-(--blue-bg) px-2.5 py-1.5 text-[10.5px] font-medium text-(--blue)">
          Stream connected, no material event yet — the feed is quiet. Try the captured/manual replay below.
        </div>
      )}

      <div className="mt-2.5 hairline-rows">
        <Stat label="Connection mode" value={<ModePill mode={mode} />} />
        <Stat label="Data source (last event)" value={<Badge tone={DATA_SOURCE_TONE[source]}>{DATA_SOURCE_LABEL[source]}</Badge>} />
        <Stat label="Network" value={network} />
        <Stat label="API origin" value={<span className="mono text-[10.5px]">{origin}</span>} />
        <Stat label="Fixture" value={<span className="mono text-[10.5px]">{fixture}</span>} />
        <Stat label="Credentials present" value={health ? (credentialsPresent ? "yes" : "no") : "—"} tone={credentialsPresent ? "green" : "neutral"} />
        <Stat label="Scores stream" value={<StreamPill status={mode === "demo" ? "demo" : txline.scores} />} />
        <Stat label="Odds stream" value={<StreamPill status={mode === "demo" ? "demo" : txline.odds} />} />
        <Stat label="Last connection attempt" value={formatTime(txline.lastConnectionAttemptAt)} />
        <Stat label="Last payload received" value={formatTime(txline.lastPayloadAt)} tone={txline.lastPayloadAt ? "blue" : "neutral"} />
        <Stat label="Last error" value={txline.error ?? "none"} tone={txline.error ? "red" : "neutral"} />
        <Stat label="Latest sequence" value={lastEvent ? lastEvent.seq : market.materialSeq} tone="blue" strong />
        <Stat label="Latest event type" value={lastEvent?.eventType ?? "—"} tone={material ? "amber" : "neutral"} />
        <Stat label="Proof status" value={lastEvent?.proofStatus ?? (mode === "demo" ? "simulated" : "unverified")} />
        <Stat
          label="Material to selected market?"
          value={lastEvent ? (material ? "YES — moves fair value" : "no") : "—"}
          tone={material ? "amber" : "neutral"}
          strong={material}
        />
      </div>

      {/* Normalizer trace — what was inferred vs. explicit, never a black box */}
      {lastEvent && (
        <div className="mt-2.5 rounded-md border border-(--border) bg-[#f9fafb] px-2.5 py-2">
          <p className="mono text-[9px] uppercase tracking-wide text-(--ink-3)">Normalizer trace</p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">
            seq ← <span className="mono font-semibold text-(--ink)">{lastEvent.trace.seqField ?? "fallback (no field matched)"}</span> · ts ←{" "}
            <span className="mono font-semibold text-(--ink)">{lastEvent.trace.tsField ?? "fallback (no field matched)"}</span> · type ←{" "}
            <span className="mono font-semibold text-(--ink)">
              {lastEvent.trace.eventTypeMethod}
              {lastEvent.trace.eventTypeField ? ` (${lastEvent.trace.eventTypeField})` : ""}
            </span>
          </p>
          {lastEvent.trace.eventTypeMethod === "default" && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-(--ink-3)">
              <TriangleAlert className="h-3 w-3" /> No recognizable type field — defaulted to UNKNOWN, never stale-locks a market.
            </p>
          )}
        </div>
      )}

      {/* Raw payload drawer */}
      <button
        onClick={() => setRawOpen((v) => !v)}
        className="mt-2.5 flex w-full items-center justify-between rounded-md border border-(--border) bg-[#f9fafb] px-2.5 py-1.5 text-[10.5px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6]"
      >
        <span>Raw payload preview</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", rawOpen && "rotate-180")} />
      </button>
      {rawOpen && (
        <pre className="thin-scroll mono mt-1.5 max-h-44 overflow-auto rounded-md border border-(--border) bg-[#0b1020] p-2.5 text-[10px] leading-relaxed text-[#c9d3e6]">
          {txline.lastRaw ? JSON.stringify(txline.lastRaw, null, 2) : "// no payload yet — ingest an event"}
        </pre>
      )}
    </Card>
  );
}

/** Absolute local time, not a ticking relative clock — honest and doesn't need a timer in a panel component. */
function formatTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ModeToggle({ mode, liveCapable, onSet }: { mode: Mode; liveCapable: boolean; onSet: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-(--border) bg-[#f9fafb] p-0.5">
      <button
        onClick={() => onSet("demo")}
        className={cn("rounded px-2 py-0.5 text-[10.5px] font-semibold transition-colors", mode === "demo" ? "bg-(--ink) text-white" : "text-(--ink-3)")}
      >
        Sandbox
      </button>
      <button
        onClick={() => onSet("live")}
        disabled={!liveCapable}
        title={liveCapable ? "Attempt live TxLINE connection" : "No credentials — live disabled"}
        className={cn(
          "rounded px-2 py-0.5 text-[10.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          mode === "live" ? "bg-(--green) text-white" : "text-(--ink-3)"
        )}
      >
        Live
      </button>
    </div>
  );
}

function ModePill({ mode }: { mode: Mode }) {
  return mode === "live" ? (
    <Badge tone="green" dot>
      LIVE
    </Badge>
  ) : (
    <Badge tone="amber" dot>
      SANDBOX
    </Badge>
  );
}

function StreamPill({ status }: { status: StreamStatus }) {
  const map: Record<StreamStatus, { tone: "neutral" | "blue" | "amber" | "red" | "green"; label: string; pulse?: boolean }> = {
    disconnected: { tone: "neutral", label: "disconnected" },
    connecting: { tone: "blue", label: "connecting", pulse: true },
    live: { tone: "green", label: "live", pulse: true },
    error: { tone: "red", label: "error" },
    demo: { tone: "amber", label: "sandbox" },
  };
  const { tone, label, pulse } = map[status];
  const Icon = status === "error" || status === "disconnected" ? WifiOff : Wifi;
  return (
    <Badge tone={tone} pulse={pulse} dot={status === "live" || status === "connecting"}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
