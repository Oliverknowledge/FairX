import { TrendingUp, TriangleAlert } from "lucide-react";
import { Badge, Card, cn, Label } from "@/components/lineguard/ui";
import { isStale } from "@/lib/markets/types";
import { cents, pct, type TerminalState } from "@/lib/terminal/state";

/**
 * The market as a trader sees it. The whole point lives in the gap between the
 * big blue displayed price and the amber "fair" ghost when the market is stale.
 */
export function MarketPanel({ state }: { state: TerminalState }) {
  const { market, goalOnPitch } = state;
  const stale = isStale(market);
  const repriced = market.status === "trading" && market.lastReprice !== null;
  const isOver = market.kind === "OVER_UNDER";
  const sideWord = isOver ? "OVER" : "YES";

  return (
    <Card className={cn(stale && "stale-glow border-(--amber)/40")}>
      <div className="flex items-center justify-between">
        <Label>Market</Label>
        {stale ? (
          <Badge tone="amber" dot pulse>
            STALE
          </Badge>
        ) : repriced ? (
          <Badge tone="blue">REPRICED</Badge>
        ) : (
          <Badge tone="green" dot>
            IN SYNC
          </Badge>
        )}
      </div>

      <h2 className="mt-2 text-[15px] font-bold text-(--ink)">{market.title}</h2>
      <p className="text-[11px] text-(--ink-2)">{market.resolutionNote}</p>

      {/* Displayed price — the hero number */}
      <div className="mt-3 flex items-end gap-2">
        <span
          key={market.yes}
          className={cn(
            "num text-[40px] font-bold leading-none tracking-tight",
            repriced ? "price-flash text-(--blue)" : stale ? "text-(--ink)" : "text-(--blue)"
          )}
        >
          {pct(market.yes)}
        </span>
        <span className="pb-1 text-[11px] font-medium text-(--ink-3)">displayed {sideWord}</span>
      </div>

      {/* Fair-price ghost — only diverges while stale */}
      {stale && (
        <div className="slide-in mt-2 flex items-center gap-2 rounded-lg border border-(--amber)/30 bg-(--amber-bg) px-2.5 py-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-(--amber)" />
          <span className="text-[11.5px] text-(--ink-2)">
            Fair value is <b className="num text-(--amber)">{cents(market.fairYes)}</b> — displayed price hasn&apos;t caught up
          </span>
          <span className="num ml-auto rounded bg-(--amber)/15 px-1.5 py-0.5 text-[11px] font-bold text-(--amber)">
            +{cents(market.fairYes - market.yes)}
          </span>
        </div>
      )}

      {/* Sequence registers */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SeqChip label="materialSeq" value={market.materialSeq} tone={stale ? "amber" : "neutral"} />
        <SeqChip label="pricedAtSeq" value={market.pricedAtSeq} tone={stale ? "red" : "neutral"} />
      </div>

      {/* Stale warning bar */}
      {stale && (
        <div className="slide-in mt-2 flex items-center gap-1.5 rounded-md bg-(--amber-bg) px-2.5 py-1.5 text-[11px] font-semibold text-(--amber)">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          materialSeq {market.materialSeq} &gt; pricedAtSeq {market.pricedAtSeq} — trades checked by LineGuard
        </div>
      )}

      {goalOnPitch && market.materialSeq === 1 && (
        <div className="slide-in mt-2 rounded-md bg-(--amber-bg) px-2.5 py-1.5 text-[11px] font-medium text-(--amber)">
          ⚽ Goal on the pitch — market still fairly priced until the feed publishes.
        </div>
      )}
    </Card>
  );
}

function SeqChip({ label, value, tone }: { label: string; value: number; tone: "neutral" | "amber" | "red" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5",
        tone === "neutral" && "border-(--border) bg-[#f9fafb]",
        tone === "amber" && "border-(--amber)/40 bg-(--amber-bg)",
        tone === "red" && "border-(--red)/30 bg-(--red-bg)"
      )}
    >
      <p className="mono text-[9.5px] uppercase tracking-wide text-(--ink-3)">{label}</p>
      <p
        className={cn(
          "num text-[20px] font-bold leading-tight",
          tone === "amber" ? "text-(--amber)" : tone === "red" ? "text-(--red)" : "text-(--ink)"
        )}
      >
        {value}
      </p>
    </div>
  );
}
