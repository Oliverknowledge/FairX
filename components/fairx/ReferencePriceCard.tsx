"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ArrowUpRight } from "lucide-react";

/** Mirror of lib/polymarket/service.ts ReferenceQuoteView (kept local so this client file never imports the server module). */
interface ReferenceQuoteView {
  mappingId: string;
  freshness: "LIVE" | "RECENTLY_CACHED" | "HISTORICAL_CAPTURE" | "UNAVAILABLE";
  source: string;
  disclaimer: string;
  fetchedAt: string;
  capturedAt?: string;
  unavailableReason?: string;
  market?: {
    question: string;
    slug: string;
    eventId: string;
    conditionId: string;
    yesTokenId: string;
    noTokenId: string;
    closeTime?: string;
    closed: boolean;
  };
  mapping?: { fixture: string; yesMeaning: string; resolutionScope: string; mappingHash: string };
  quote?: {
    method: string;
    quoteValid: boolean;
    rejectionReasons: string[];
    midpointMicros: number;
    midpointCents: string;
    bestBidCents: string;
    bestAskCents: string;
    spreadCents: string;
    spreadMicros: number;
    bidDepth: number;
    askDepth: number;
    quoteTimestamp: number;
    quoteAgeMs: number;
    orderBookHash?: string;
    depthWeightedMidpointMicros?: number;
  };
}

const FRESHNESS: Record<ReferenceQuoteView["freshness"], { label: string; className: string; dot: string }> = {
  LIVE: { label: "Live Polymarket reference", className: "border-[#bfe6cf] bg-[#eefaf1] text-[#1a7f45]", dot: "bg-[#22a35a]" },
  RECENTLY_CACHED: { label: "Recently cached Polymarket reference", className: "border-[#cfe0ff] bg-[#f1f6ff] text-[#245db8]", dot: "bg-[#2563eb]" },
  HISTORICAL_CAPTURE: { label: "Historical Polymarket capture", className: "border-[#f0d9a8] bg-[#fdf6e7] text-[#a76d12]", dot: "bg-[#e0912f]" },
  UNAVAILABLE: { label: "Reference unavailable", className: "border-[#e6cccc] bg-[#fbeeee] text-[#a53535]", dot: "bg-[#c14747]" },
};

function ago(iso?: string): string {
  if (!iso) return "—";
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

type PricePoint = { t: number; m: number };

export function ReferencePriceCard({ mappingId }: { mappingId: string }) {
  const [view, setView] = useState<ReferenceQuoteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTech, setShowTech] = useState(false);
  const [history, setHistory] = useState<PricePoint[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reference-quotes/${encodeURIComponent(mappingId)}`, { cache: "no-store" });
      const body = (await res.json()) as ReferenceQuoteView & { reason?: string };
      if (!res.ok) {
        setError(body.reason ?? "Reference data unavailable.");
        setView(null);
      } else {
        setView(body);
        setError(null);
        const mid = body.quote?.quoteValid ? body.quote.midpointMicros : null;
        if (mid != null) {
          // Record every poll so the line is a true time series (flat while the
          // midpoint is stable; it bends the moment the reference reprices).
          setHistory((h) => [...h, { t: Date.now(), m: mid }].slice(-48));
        }
      }
    } catch {
      setError("Reference data unavailable.");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [mappingId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const fresh = view ? FRESHNESS[view.freshness] : FRESHNESS.UNAVAILABLE;
  const q = view?.quote;
  const priceValid = q?.quoteValid && view?.freshness !== "UNAVAILABLE";

  return (
    <section className="rounded-2xl border border-(--border) bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-3)">Reference price</p>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${fresh.className}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${fresh.dot}`} />
          {view ? fresh.label : loading ? "Loading…" : "Reference unavailable"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[46px] font-extrabold leading-none tracking-[-0.04em] text-(--ink)">
            {priceValid ? q!.midpointCents : "—"}
          </p>
          <p className="mt-2 text-[12px] text-(--ink-2)">
            Source: <span className="font-semibold text-(--ink)">Polymarket order book</span>
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) px-2.5 text-[11px] font-semibold text-(--ink-2) hover:bg-[#f6f7f9]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {view?.market && (
        <p className="mt-3 text-[12px] font-semibold text-(--ink)">{view.market.question}</p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">Live reference price</p>
          <span className="text-[10px] text-(--ink-3)">Polymarket midpoint · updates every 10s</span>
        </div>
        <Sparkline points={history} />
      </div>

      {priceValid ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          <Metric label="Best bid" value={q!.bestBidCents} />
          <Metric label="Best ask" value={q!.bestAskCents} />
          <Metric label="Spread" value={q!.spreadCents} />
          <Metric label="Updated" value={ago(view?.capturedAt ?? view?.fetchedAt)} />
          <Metric label="Bid depth" value={`${Math.round(q!.bidDepth).toLocaleString()} sh`} />
          <Metric label="Ask depth" value={`${Math.round(q!.askDepth).toLocaleString()} sh`} />
          <Metric label="Method" value={q!.method === "ORDERBOOK_MIDPOINT" ? "Book midpoint" : q!.method} />
          <Metric label="Depth status" value={q!.bidDepth > 0 && q!.askDepth > 0 ? "Two-sided" : "Thin"} />
        </dl>
      ) : (
        <div className="mt-4 rounded-lg border border-[#e6cccc] bg-[#fbeeee] p-3 text-[11.5px] text-[#8f3232]">
          {error ?? view?.unavailableReason ?? "FairX does not invent a price when the reference book is unusable."}
          {q?.rejectionReasons?.length ? <span className="mono"> ({q.rejectionReasons.join(", ")})</span> : null}
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-(--ink-2)">
        FairX does not invent this opening price. It uses the public order book for the equivalent Polymarket market as an
        external reference. <span className="font-semibold text-(--ink)">TxLINE</span> reports what happens in the match; if a
        match event arrives before the reference market reprices, <span className="font-semibold text-(--ink)">LineGuard</span>{" "}
        protects the Solana order.
      </p>

      <button
        onClick={() => setShowTech((s) => !s)}
        className="mt-4 text-[11px] font-semibold text-(--blue) hover:underline"
      >
        {showTech ? "Hide technical details" : "Technical details"}
      </button>
      {showTech && view && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-(--border) bg-[#fbfcfe] p-3 text-[10.5px] text-(--ink-2)">
          <TechRow label="Mapping" value={view.mapping?.fixture} />
          <TechRow label="YES means" value={view.mapping?.yesMeaning} />
          <TechRow label="Resolution" value={view.mapping?.resolutionScope} />
          <TechRow label="Condition id" value={view.market?.conditionId} mono />
          <TechRow label="YES token" value={view.market?.yesTokenId} mono />
          <TechRow label="Order-book hash" value={q?.orderBookHash} mono />
          <TechRow label="Mapping hash" value={view.mapping?.mappingHash} mono />
          {view.market?.closeTime && <TechRow label="Market close" value={new Date(view.market.closeTime).toUTCString()} />}
        </div>
      )}

      <p className="mt-4 border-t border-(--border) pt-3 text-[10px] leading-relaxed text-(--ink-3)">{view?.disclaimer ??
        "FairX is not affiliated with Polymarket. Public Polymarket market data is used only as an external reference source."}</p>
    </section>
  );
}

function Sparkline({ points }: { points: PricePoint[] }) {
  const W = 620;
  const H = 120;
  const PAD = 14;
  if (points.length < 2) {
    return (
      <div className="mt-2 flex h-[120px] items-center justify-center rounded-lg border border-(--border) bg-[#f8faff] text-[11px] text-(--ink-3)">
        Building live price history… (a new point every 10s; the line appears once the reference moves)
      </div>
    );
  }
  const cents = (m: number) => (m / 10_000).toFixed(1) + "¢";
  const ms = points.map((p) => p.m);
  const min = Math.min(...ms);
  const max = Math.max(...ms);
  const span = Math.max(max - min, 2_000); // keep a floor so a flat line isn't a razor edge
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (m: number) => PAD + (1 - (m - min) / span) * (H - 2 * PAD);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.m).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const rising = last.m >= points[0].m;
  const stroke = rising ? "#2563eb" : "#dc2626";
  return (
    <div className="mt-2 rounded-lg border border-(--border) bg-[#f8faff] p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" role="img" aria-label="Live Polymarket reference midpoint">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.m)} r="4" fill={stroke} />
        <text x={PAD} y={H - 3} fontSize="11" fill="#94a3b8">{cents(min)}</text>
        <text x={W - PAD} y={16} fontSize="11" fill={stroke} textAnchor="end">{cents(last.m)}</text>
      </svg>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-bold text-(--ink)">{value}</dd>
    </div>
  );
}

function TechRow({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-x-2">
      <span className="shrink-0 font-semibold text-(--ink-2)">{label}:</span>
      <span className={`min-w-0 ${mono ? "mono break-all text-(--ink)" : "text-(--ink)"}`}>{value}</span>
    </div>
  );
}

export { ArrowUpRight };
