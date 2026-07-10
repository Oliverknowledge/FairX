"use client";

import { useCallback, useEffect, useRef } from "react";
import { openScoresStream, openOddsStream } from "@/lib/txline/client";
import { normalizeTxLineEvent } from "@/lib/txline/normalize";
import type { StreamHandle } from "@/lib/txline/sse";
import type { Action } from "@/lib/terminal/actions";
import type { TerminalState } from "@/lib/terminal/state";

/**
 * Live TxLINE connection manager. Owns the SSE handles and a monotonic
 * fallback sequence; it only ever dispatches actions into the reducer. When
 * mode !== "live" it stays fully disconnected so the demo is never disturbed.
 */
export function useTxLineStream(
  state: TerminalState,
  dispatch: React.Dispatch<Action>,
  opts: { connectOdds?: boolean } = {}
) {
  const { mode } = state;
  const fixtureId = state.txline.health?.fixtureId ?? state.market.fixtureId;
  const liveCapable = state.txline.health?.liveCapable ?? false;

  const scoresRef = useRef<StreamHandle | null>(null);
  const oddsRef = useRef<StreamHandle | null>(null);
  const fallbackSeq = useRef(1);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const fixtureRef = useRef(fixtureId);
  fixtureRef.current = fixtureId;

  const ingest = useCallback((payload: unknown, source: "scores" | "odds") => {
    const d = dispatchRef.current;
    d({ type: "TXLINE_RAW", raw: payload, stream: source, at: Date.now() });
    fallbackSeq.current += 1;
    const event = normalizeTxLineEvent(payload, {
      source: "live",
      fallbackFixtureId: fixtureRef.current,
      fallbackSeq: fallbackSeq.current,
    });
    // Keep the fallback counter ahead of any real sequence we observe.
    if (event.seq >= fallbackSeq.current) fallbackSeq.current = event.seq;
    d({ type: "INGEST_TXLINE_EVENT", event, at: Date.now() });
  }, []);

  useEffect(() => {
    if (mode !== "live" || !liveCapable) {
      scoresRef.current?.close();
      oddsRef.current?.close();
      scoresRef.current = null;
      oddsRef.current = null;
      return;
    }

    const d = dispatchRef.current;

    scoresRef.current = openScoresStream({
      onStatus: (status, detail) => {
        if (status === "error") d({ type: "TXLINE_ERROR", stream: "scores", error: detail ?? "stream error", at: Date.now() });
        else if (status === "live") d({ type: "TXLINE_CONNECTED", stream: "scores", at: Date.now() });
        else if (status === "connecting") d({ type: "TXLINE_CONNECTING", stream: "scores", at: Date.now() });
        else d({ type: "TXLINE_STATUS", stream: "scores", status: "disconnected" });
      },
      onPayload: (payload) => ingest(payload, "scores"),
    });

    if (opts.connectOdds) {
      oddsRef.current = openOddsStream({
        onStatus: (status, detail) => {
          if (status === "error") d({ type: "TXLINE_ERROR", stream: "odds", error: detail ?? "stream error", at: Date.now() });
          else if (status === "live") d({ type: "TXLINE_CONNECTED", stream: "odds", at: Date.now() });
          else if (status === "connecting") d({ type: "TXLINE_CONNECTING", stream: "odds", at: Date.now() });
          else d({ type: "TXLINE_STATUS", stream: "odds", status: "disconnected" });
        },
        onPayload: (payload) => ingest(payload, "odds"),
      });
    }

    return () => {
      scoresRef.current?.close();
      oddsRef.current?.close();
      scoresRef.current = null;
      oddsRef.current = null;
    };
  }, [mode, liveCapable, opts.connectOdds, ingest]);
}
