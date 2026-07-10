"use client";

import { useEffect, useRef } from "react";
import { useTxLineStream } from "@/hooks/useTxLineStream";
import { fetchTxLineHealth } from "@/lib/txline/client";
import type { Action } from "@/lib/terminal/actions";
import type { TerminalState } from "@/lib/terminal/state";

/**
 * Headless controller: fetches sanitized TxLINE health once, then delegates the
 * live SSE lifecycle to useTxLineStream. Renders nothing — it only dispatches
 * actions, keeping all network concerns out of the reducer and the panels.
 */
export function TxLineProvider({
  state,
  dispatch,
  connectOdds = true,
}: {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
  connectOdds?: boolean;
}) {
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    fetchTxLineHealth().then((health) => {
      if (!cancelled && health) dispatch({ type: "SET_HEALTH", health });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useTxLineStream(state, dispatch, { connectOdds });

  return null;
}
