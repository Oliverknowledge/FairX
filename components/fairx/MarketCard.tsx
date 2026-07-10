import Link from "next/link";
import { ArrowUpRight, Layers3, ShieldCheck } from "lucide-react";
import type { FairXMarket } from "@/lib/markets/catalog";
import { guardLabelForStatus, MarketStatus, SourceBadge } from "./MarketStatus";

function cents(value: number) {
  return `${Math.round(value * 100)}¢`;
}

function marketKindLabel(market: FairXMarket) {
  switch (market.type) {
    case "MATCH_WINNER":
      return "Match winner";
    case "TOTAL_GOALS":
      return "Total goals";
    case "NEXT_GOAL":
      return "Next goal";
    default:
      return "Creator market";
  }
}

export function MarketCard({ market, liveConnected = false }: { market: FairXMarket; liveConnected?: boolean }) {
  const guardLabel = guardLabelForStatus(market.status);

  return (
    <article className="card relative flex min-h-[292px] flex-col overflow-hidden p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#c7d5ea] hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#dbe7fb] bg-[#f5f8ff] text-(--blue)">
              <Layers3 className="h-3.5 w-3.5" strokeWidth={2.1} />
            </span>
            <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.1em] text-(--ink-3)">{marketKindLabel(market)}</span>
          </div>
          <h2 className="pr-1 text-[14px] font-bold leading-[1.26] tracking-[-0.02em] text-(--ink)">{market.title}</h2>
        </div>
        <MarketStatus status={market.status} compact />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#dbe7fb] bg-[#f7faff] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">YES price</p>
          <p className="mt-0.5 text-[20px] font-bold leading-none tracking-[-0.045em] text-(--blue)">{cents(market.displayedPrice)}</p>
        </div>
        <div className="rounded-lg border border-(--border) bg-[#fbfcfd] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">Fair price</p>
          <p className="mt-0.5 text-[20px] font-bold leading-none tracking-[-0.045em] text-(--ink)">{cents(market.fairPrice)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-(--border) py-3 text-[10px]">
        <div>
          <p className="text-(--ink-3)">Material / priced</p>
          <p className="mt-0.5 font-semibold text-(--ink)">
            <span className="num">{market.materialSeq}</span> / <span className="num">{market.pricedAtSeq}</span>
          </p>
        </div>
        <div>
          <p className="text-(--ink-3)">Execution</p>
          <p className="mt-0.5 truncate font-semibold text-(--ink)">
            {market.onChain?.settled ? "Devnet settled" : market.onChain?.initialized ? "Devnet initialized" : "Local simulation"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold ${
            market.status === "STALE" ? "text-(--amber)" : market.status === "REPRICING" ? "text-(--blue)" : "text-(--green)"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          <span className="truncate">LineGuard · {guardLabel}</span>
        </span>
        <SourceBadge source={market.source} liveConnected={liveConnected} />
      </div>

      <Link
        href={`/markets/${market.id}`}
        className="mt-auto flex h-8 items-center justify-between rounded-md border border-(--border) px-2.5 text-[10.5px] font-semibold text-(--ink-2) transition-colors hover:border-[#bcd1f6] hover:bg-[#f7faff] hover:text-(--blue)"
      >
        Inspect protection
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
      </Link>
    </article>
  );
}
