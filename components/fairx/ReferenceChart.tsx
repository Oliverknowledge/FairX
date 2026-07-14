"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * A Polymarket-style price-history chart for the approved reference market.
 * Fetches the real CLOB price series (via our allowlisted route) and draws a
 * gradient area line with 1D / 1W / MAX range tabs — the same shape a trader
 * sees on Polymarket, clearly labelled as an external reference.
 */

type Point = { t: number; priceMicros: number };
type Range = "1d" | "1w" | "max";

const RANGES: { id: Range; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "max", label: "MAX" },
];

const cents = (micros: number) => `${(micros / 10_000).toFixed(1)}¢`;

export function ReferenceChart({ mappingId }: { mappingId: string }) {
  const [range, setRange] = useState<Range>("1w");
  const [points, setPoints] = useState<Point[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reference-quotes/${encodeURIComponent(mappingId)}/price-history?interval=${range}`, { cache: "no-store" });
      const body = (await res.json()) as { ok?: boolean; points?: Point[] };
      if (!res.ok || !body.ok || !body.points) {
        setStatus("error");
        return;
      }
      setPoints(body.points);
      setStatus(body.points.length >= 2 ? "ready" : "empty");
    } catch {
      setStatus("error");
    }
  }, [mappingId, range]);

  useEffect(() => {
    setStatus("loading");
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const W = 680;
    const H = 200;
    const PAD_X = 8;
    const PAD_TOP = 16;
    const PAD_BOT = 24;
    const ms = points.map((p) => p.priceMicros);
    const min = Math.min(...ms);
    const max = Math.max(...ms);
    const span = Math.max(max - min, 5_000); // floor so a nearly-flat series still reads as a line
    const mid = (min + max) / 2;
    const lo = mid - span / 2;
    const x = (i: number) => PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X);
    const y = (m: number) => PAD_TOP + (1 - (m - lo) / span) * (H - PAD_TOP - PAD_BOT);
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.priceMicros).toFixed(1)}`).join(" ");
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - PAD_BOT} L${x(0).toFixed(1)} ${H - PAD_BOT} Z`;
    const first = points[0].priceMicros;
    const last = points[points.length - 1].priceMicros;
    const up = last >= first;
    return { W, H, PAD_BOT, x, y, line, area, up, last, lastX: x(points.length - 1), lastY: y(last), first, min, max };
  }, [points]);

  const changePct = geom ? ((geom.last - geom.first) / geom.first) * 100 : 0;
  const color = geom?.up ? "#16a34a" : "#dc2626";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">Price history</p>
          {geom && (
            <span className="text-[11px] font-bold" style={{ color }}>
              {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex rounded-lg bg-[#eef2f7] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${range === r.id ? "bg-white text-(--ink) shadow-sm" : "text-(--ink-3) hover:text-(--ink-2)"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-(--border) bg-white p-2">
        {geom ? (
          <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="h-[200px] w-full" role="img" aria-label="Polymarket reference price history">
            <defs>
              <linearGradient id={`reffill-${mappingId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={geom.W} y1={16 + f * (geom.H - 40)} y2={16 + f * (geom.H - 40)} stroke="#eef1f5" strokeWidth="1" />
            ))}
            <path d={geom.area} fill={`url(#reffill-${mappingId})`} />
            <path d={geom.line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={geom.lastX} cy={geom.lastY} r="4" fill={color} />
            <text x={geom.W - 6} y={12} fontSize="12" fontWeight="700" fill={color} textAnchor="end">{cents(geom.last)}</text>
            <text x="6" y={geom.H - 6} fontSize="10" fill="#94a3b8">{cents(geom.min)}–{cents(geom.max)}</text>
          </svg>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[11px] text-(--ink-3)">
            {status === "error" ? "Price history unavailable right now." : "Loading price history…"}
          </div>
        )}
      </div>
    </div>
  );
}
