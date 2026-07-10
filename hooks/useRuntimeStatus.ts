"use client";

import { useCallback, useEffect, useState } from "react";
import type { FairXRuntimeStatus } from "@/lib/status/types";

export function useRuntimeStatus() {
  const [status, setStatus] = useState<FairXRuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`Runtime status failed (${response.status})`);
      setStatus(await response.json() as FairXRuntimeStatus);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Runtime status unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { status, loading, error, refresh };
}
