"use client";

import { useMemo, useState } from "react";
import { Activity, CircleCheckBig, Filter, ShieldAlert, Store, TimerReset, type LucideIcon } from "lucide-react";
import type { FairXMarket } from "@/lib/markets/catalog";
import { isCreatorMarket } from "@/lib/markets/catalog";
import { useFairXMarkets } from "@/lib/markets/store";
import { MarketCard } from "./MarketCard";
import { useRuntimeStatus } from "@/hooks/useRuntimeStatus";

type DiscoveryFilter = "ALL" | "LIVE" | "STALE" | "PROTECTED" | "SETTLED" | "CREATOR";

const filters: Array<{ id: DiscoveryFilter; label: string }> = [
  { id: "ALL", label: "All markets" },
  { id: "LIVE", label: "Live" },
  { id: "STALE", label: "Stale" },
  { id: "PROTECTED", label: "Protected" },
  { id: "SETTLED", label: "Settled" },
  { id: "CREATOR", label: "Creator markets" },
];

function matchesFilter(market: FairXMarket, filter: DiscoveryFilter, liveConnected: boolean) {
  switch (filter) {
    case "LIVE":
      return liveConnected && market.source === "live";
    case "STALE":
      return market.status === "STALE";
    case "PROTECTED":
      return market.status === "TRADING";
    case "SETTLED":
      return market.status === "SETTLED";
    case "CREATOR":
      return isCreatorMarket(market);
    default:
      return true;
  }
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "neutral";
  onClick?: () => void;
}) {
  const styles = {
    blue: "border-[#d7e5fc] bg-[#f8fbff] text-(--blue)",
    green: "border-[#c7e9dc] bg-[#f8fdfa] text-(--green)",
    amber: "border-[#f4dfb4] bg-[#fffdf7] text-(--amber)",
    neutral: "border-(--border) bg-white text-(--ink-2)",
  } as const;

  const body = (
    <>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-white ${styles[tone]}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block text-[9.5px] font-bold uppercase tracking-[0.1em] text-(--ink-3)">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <strong className="text-[18px] leading-none tracking-[-0.04em] text-(--ink)">{value}</strong>
          <span className="truncate text-[10px] text-(--ink-2)">{detail}</span>
        </span>
      </span>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[64px] items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-white ${styles[tone]}`}
    >
      {body}
    </button>
  ) : (
    <div className={`flex min-h-[64px] items-center gap-3 rounded-lg border p-3 ${styles[tone]}`}>{body}</div>
  );
}

export function MarketsDiscovery() {
  const { markets, hydrated } = useFairXMarkets();
  const { status } = useRuntimeStatus();
  const liveConnected = status?.txline.connected === true;
  const [activeFilter, setActiveFilter] = useState<DiscoveryFilter>("ALL");
  const filteredMarkets = useMemo(() => markets.filter((market) => matchesFilter(market, activeFilter, liveConnected)), [activeFilter, liveConnected, markets]);
  const summary = useMemo(
    () => ({
      live: liveConnected ? markets.filter((market) => market.source === "live").length : 0,
      protected: markets.filter((market) => market.status === "TRADING").length,
      stale: markets.filter((market) => market.status === "STALE" || market.status === "REPRICING").length,
      creator: markets.filter((market) => isCreatorMarket(market)).length,
    }),
    [liveConnected, markets]
  );

  return (
    <section>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Live TxLINE" value={summary.live} detail={liveConnected ? "connected markets" : "not connected"} icon={Activity} tone="blue" onClick={() => setActiveFilter("LIVE")} />
        <SummaryCard
          label="Protected"
          value={summary.protected}
          detail="in sync"
          icon={CircleCheckBig}
          tone="green"
          onClick={() => setActiveFilter("PROTECTED")}
        />
        <SummaryCard
          label="Attention"
          value={summary.stale}
          detail="stale or repricing"
          icon={ShieldAlert}
          tone="amber"
          onClick={() => setActiveFilter("STALE")}
        />
        <SummaryCard label="Creator" value={summary.creator} detail="sandbox markets" icon={Store} tone="neutral" onClick={() => setActiveFilter("CREATOR")} />
      </div>

      <div className="mt-6 flex flex-col gap-3 border-y border-(--border) py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-(--border) bg-white text-(--ink-2)">
            <Filter className="h-3.5 w-3.5" strokeWidth={2.1} />
          </span>
          <div>
            <p className="text-[11px] font-bold text-(--ink)">Market discovery</p>
            <p className="text-[10px] text-(--ink-3)">Filter by the guard state that matters to you.</p>
          </div>
        </div>
        <span className="text-[10.5px] font-medium text-(--ink-3)">
          Showing <span className="num font-semibold text-(--ink-2)">{filteredMarkets.length}</span> of <span className="num font-semibold text-(--ink-2)">{markets.length}</span>
          {hydrated ? " · local catalog" : " · loading catalog"}
        </span>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 thin-scroll" role="tablist" aria-label="Market filters">
        {filters.map((filter) => {
          const active = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFilter(filter.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition-colors ${
                active
                  ? "border-[#bed2f8] bg-[#eef4ff] text-(--blue)"
                  : "border-(--border) bg-white text-(--ink-2) hover:border-[#cbd5e1] hover:text-(--ink)"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredMarkets.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredMarkets.map((market) => <MarketCard key={market.id} market={market} liveConnected={liveConnected} />)}</div>
      ) : (
        <div className="card mt-4 flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-[#fafbfc] text-(--ink-3)">
            <TimerReset className="h-4 w-4" />
          </span>
          <p className="mt-3 text-[12px] font-bold text-(--ink)">No markets match this view</p>
          <p className="mt-1 max-w-xs text-[10.5px] leading-relaxed text-(--ink-2)">Try another guard state or create a sandbox market.</p>
          <button
            type="button"
            className="mt-3 text-[10.5px] font-semibold text-(--blue) hover:underline"
            onClick={() => setActiveFilter("ALL")}
          >
            Show every market
          </button>
        </div>
      )}
    </section>
  );
}
