import { Flag, Radio, Zap } from "lucide-react";
import { Card, cn, Label } from "@/components/lineguard/ui";
import { isStale } from "@/lib/markets/types";
import { isMaterialEventType } from "@/lib/txline/materiality";
import type { NormalizedTxLineEvent } from "@/lib/txline/types";
import { cents, type TerminalState } from "@/lib/terminal/state";

/** Officiated feed timeline — the sequence numbers LineGuard keys off of. */
export function EventTimeline({ state }: { state: TerminalState }) {
  const { market, events } = state;
  const stale = isStale(market);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>TxLINE feed</Label>
        <span className="mono text-[10px] text-(--ink-3)">{market.fixtureId} · officiated</span>
      </div>

      <div className="mt-2.5 space-y-2">
        {events.map((ev) => (
          <EventRow key={`${ev.seq}-${ev.ts}`} event={ev} priced={market.pricedAtSeq >= ev.seq} />
        ))}
        {events.length <= 1 && (
          <div className="rounded-lg border border-dashed border-(--border) px-2.5 py-2 text-[11px] text-(--ink-3) opacity-70">
            Awaiting next event… feed idle
          </div>
        )}
      </div>

      <p className="mono mt-2.5 border-t border-(--border) pt-2 text-[10px] text-(--ink-3)">
        latest event seq <b className={cn(stale && "text-(--amber)")}>{market.materialSeq}</b> · priced through seq{" "}
        <b>{market.pricedAtSeq}</b>
      </p>
    </Card>
  );
}

function EventRow({ event, priced }: { event: NormalizedTxLineEvent; priced: boolean }) {
  const material = isMaterialEventType(event.eventType) && event.seq > 1;
  const Icon = event.eventType === "GOAL" ? Zap : event.seq === 1 ? Flag : Radio;
  const tone: "amber" | "neutral" = material && !priced ? "amber" : "neutral";
  const title =
    event.seq === 1
      ? "Market open"
      : `${event.eventType}${event.player ? ` — ${event.player}` : event.team ? ` — ${event.team}` : ""}`;
  const sub =
    event.seq === 1
      ? "market listed · in sync"
      : material
        ? `officiated · ${event.minute ? `${event.minute}' · ` : ""}fair value moved`
        : `${event.eventType.toLowerCase()} · not material`;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
        tone === "amber" && "slide-in border-(--amber)/30 bg-(--amber-bg)",
        tone === "neutral" && "border-(--border) bg-[#f9fafb]"
      )}
    >
      <span className="mono flex h-6 w-9 shrink-0 items-center justify-center rounded border border-(--border) bg-white text-[10px] font-semibold text-(--ink-2)">
        {event.seq}
      </span>
      <Icon className={cn("h-4 w-4 shrink-0", tone === "amber" ? "text-(--amber)" : "text-(--ink-3)", material && !priced && "dot-pulse")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-(--ink)">{title}</p>
        <p className="truncate text-[10.5px] text-(--ink-2)">{sub}</p>
      </div>
      {event.seq > 1 && (
        <span
          className={cn(
            "num shrink-0 rounded px-1 py-0.5 text-[8.5px] font-bold uppercase",
            event.source === "live" && "bg-(--green)/15 text-(--green)",
            event.source === "captured" && "bg-(--blue)/15 text-(--blue)",
            event.source === "demo" && "bg-(--amber)/15 text-(--amber)"
          )}
        >
          {event.source === "demo" ? "sandbox" : event.source}
        </span>
      )}
      {material && !priced ? (
        <span className="num shrink-0 rounded bg-(--amber)/15 px-1.5 py-0.5 text-[10px] font-bold text-(--amber)">STALE</span>
      ) : (
        <span className="num shrink-0 text-[10px] font-semibold text-(--ink-3)">{priced ? "priced" : ""}</span>
      )}
    </div>
  );
}
