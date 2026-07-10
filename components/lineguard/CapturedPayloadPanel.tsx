"use client";

import { useEffect, useState } from "react";
import { ClipboardPaste, Download, History, PlayCircle, Trash2, TriangleAlert } from "lucide-react";
import { Badge, Card, cn, Label } from "@/components/lineguard/ui";
import { eventImpactsMarket } from "@/lib/markets/materiality";
import {
  addCapturedSample,
  clearCapturedSamples,
  listCapturedSamples,
  removeCapturedSample,
  toReplayEvent,
  type CapturedSample,
} from "@/lib/txline/capturedSamples";
import { normalizeTxLineEvent } from "@/lib/txline/normalize";
import { safeJsonParse } from "@/lib/txline/sse";
import type { NormalizedTxLineEvent } from "@/lib/txline/types";
import type { Action } from "@/lib/terminal/actions";
import type { TerminalState } from "@/lib/terminal/state";

/**
 * Real TxLINE evidence, captured and replayable. Two ways in:
 *   1. Save a payload the live SSE stream actually received this session.
 *   2. Paste raw TxLINE JSON by hand (the fallback when the live feed is
 *      quiet during judging).
 * Both replay through the exact same normalizeTxLineEvent → INGEST_TXLINE_EVENT
 * path a live tick uses — only the resulting event.source ("captured") differs,
 * and every label in the panel says so. Nothing here is ever presented as live.
 */
export function CapturedPayloadPanel({
  state,
  dispatch,
}: {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
}) {
  const [samples, setSamples] = useState<CapturedSample[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<NormalizedTxLineEvent | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setSamples(listCapturedSamples());
  }, []);

  const { txline, market } = state;
  const canSaveLast = txline.lastEvent?.source === "live" && txline.lastRaw != null;

  const saveLastPayload = () => {
    if (!txline.lastEvent || txline.lastRaw == null) return;
    const updated = addCapturedSample({
      raw: txline.lastRaw,
      event: txline.lastEvent,
      streamType: txline.lastPayloadStream ?? "scores",
      origin: "live-stream",
    });
    setSamples(updated);
  };

  const replaySample = (sample: CapturedSample) => {
    const event = toReplayEvent(sample, market.fixtureId, market.materialSeq + 1);
    dispatch({ type: "INGEST_TXLINE_EVENT", event, at: Date.now() });
  };

  const deleteSample = (id: string) => setSamples(removeCapturedSample(id));
  const clearAll = () => setSamples(clearCapturedSamples());

  const parsePaste = () => {
    const value = safeJsonParse(pasteText);
    if (value === null && pasteText.trim() !== "null") {
      setParsed(null);
      setParseError("Not valid JSON — paste a raw TxLINE payload object.");
      return;
    }
    setParseError(null);
    setParsed(
      normalizeTxLineEvent(value, {
        source: "captured",
        fallbackFixtureId: market.fixtureId,
        fallbackSeq: market.materialSeq + 1,
      })
    );
  };

  const ingestParsed = () => {
    if (!parsed) return;
    dispatch({ type: "INGEST_TXLINE_EVENT", event: parsed, at: Date.now() });
  };

  const saveParsedAsSample = () => {
    if (!parsed) return;
    const value = safeJsonParse(pasteText);
    const updated = addCapturedSample({ raw: value, event: parsed, streamType: "manual", origin: "manual-import" });
    setSamples(updated);
  };

  const parsedMaterial = parsed ? eventImpactsMarket(parsed, market) : false;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-(--ink-2)" />
          <Label>Captured payloads</Label>
        </div>
        <button
          onClick={saveLastPayload}
          disabled={!canSaveLast}
          title={canSaveLast ? "Save the most recent live payload" : "Only enabled right after a live SSE payload arrives"}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-semibold text-(--ink-2) transition-colors hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3 w-3" /> Save last live payload
        </button>
      </div>

      <p className="mt-1.5 text-[10.5px] leading-snug text-(--ink-2)">
        Same reducer path: live SSE → normalized event → materiality engine → stale-window guard. Replaying a captured payload runs that
        exact pipeline again — labelled <span className="mono font-semibold">captured</span>, never live.
      </p>

      {/* Sample list */}
      <div className="mt-2.5 space-y-1.5">
        {samples.length === 0 ? (
          <div className="rounded-lg border border-dashed border-(--border) px-2.5 py-3 text-center text-[11px] text-(--ink-3)">
            No payloads captured yet. Connect Live mode and save one, or paste a raw TxLINE JSON payload below.
          </div>
        ) : (
          samples.map((sample) => (
            <div key={sample.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-(--border) bg-[#f9fafb] px-2.5 py-1.5">
              <Badge tone={sample.origin === "live-stream" ? "green" : "blue"} className="shrink-0">
                {sample.origin === "live-stream" ? "captured live" : "manual"}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-(--ink)">
                  seq {sample.seq} · {sample.event.eventType}
                </p>
                <p className="mono truncate text-[9.5px] text-(--ink-3)">
                  {new Date(sample.capturedAt).toLocaleTimeString([], { hour12: false })} · {sample.streamType} · {sample.fixtureId}
                </p>
              </div>
              <button
                onClick={() => replaySample(sample)}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-(--ink) px-2 text-[10px] font-semibold text-white hover:opacity-90"
              >
                <PlayCircle className="h-3 w-3" /> Replay
              </button>
              <button
                onClick={() => deleteSample(sample.id)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-(--border) bg-white text-(--ink-3) hover:bg-[#f3f4f6]"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
        {samples.length > 0 && (
          <button onClick={clearAll} className="text-[10px] font-semibold text-(--ink-3) hover:text-(--red)">
            Clear all captured samples
          </button>
        )}
      </div>

      {/* Manual import */}
      <div className="mt-3 border-t border-(--border) pt-2.5">
        <div className="flex items-center gap-1.5">
          <ClipboardPaste className="h-3.5 w-3.5 text-(--ink-3)" />
          <p className="mono text-[9.5px] uppercase tracking-wide text-(--ink-3)">Manual payload import</p>
        </div>
        <textarea
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setParsed(null);
            setParseError(null);
          }}
          placeholder={'Paste raw TxLINE JSON, e.g. {"eventType":"GOAL","fixtureId":"...","seq":7,"team":"England",...}'}
          rows={3}
          className="mono mt-1.5 w-full resize-none rounded-md border border-(--border) bg-white px-2.5 py-2 text-[10.5px] leading-relaxed text-(--ink) placeholder:text-(--ink-3) focus:border-(--blue) focus:outline-none"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            onClick={parsePaste}
            disabled={pasteText.trim() === ""}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-(--ink) px-2.5 text-[10.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Parse
          </button>
          {parsed && (
            <>
              <button
                onClick={ingestParsed}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-(--blue) bg-(--blue-bg) px-2.5 text-[10.5px] font-semibold text-(--blue) hover:opacity-90"
              >
                Ingest into sandbox
              </button>
              <button
                onClick={saveParsedAsSample}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6]"
              >
                <Download className="h-3 w-3" /> Save as sample
              </button>
            </>
          )}
        </div>

        {parseError && (
          <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-medium text-(--red)">
            <TriangleAlert className="h-3 w-3 shrink-0" /> {parseError}
          </p>
        )}

        {parsed && (
          <div className="mt-2 rounded-md border border-(--border) bg-[#f9fafb] px-2.5 py-2 text-[10.5px] leading-relaxed text-(--ink-2)">
            <p>
              Parsed: <span className="mono font-semibold text-(--ink)">{parsed.eventType}</span> · seq{" "}
              <span className="mono font-semibold text-(--ink)">{parsed.seq}</span> · fixture{" "}
              <span className="mono">{parsed.fixtureId}</span>
              {parsed.team && (
                <>
                  {" "}
                  · team <span className="mono">{parsed.team}</span>
                </>
              )}
            </p>
            <p className="mt-1">
              seq ← <span className="mono">{parsed.trace.seqField ?? "fallback"}</span> · type ←{" "}
              <span className="mono">
                {parsed.trace.eventTypeMethod}
                {parsed.trace.eventTypeField ? ` (${parsed.trace.eventTypeField})` : ""}
              </span>
            </p>
            <p className={cn("mt-1 font-semibold", parsedMaterial ? "text-(--amber)" : "text-(--ink-3)")}>
              {parsedMaterial ? "Material to the selected market — will open a stale window." : "Not material to the selected market."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
