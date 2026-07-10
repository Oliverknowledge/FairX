import { CircleDashed, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge, Card, cn, Label, Stat } from "@/components/lineguard/ui";
import type { Verdict } from "@/lib/lineguard/evaluate";
import { displayedSidePrice, fairSidePrice, isStale } from "@/lib/markets/types";
import { cents, type TerminalState } from "@/lib/terminal/state";

/**
 * The hero panel: LineGuard's decision, shown as the exact checks that produce
 * it. Registers and the stale test read live from the market; observed/fair/
 * edge use the revealed verdict once the guard has run, otherwise a live
 * preview of what the bot's chosen-side order would face.
 */
export function GuardPanel({ state }: { state: TerminalState }) {
  const { market, order, verdict, tolerance, botSide } = state;
  const stale = isStale(market);
  const side = order?.side ?? botSide;

  // Live preview before the verdict is revealed (bot buys its chosen side).
  const observed = verdict?.observedPrice ?? order?.observedPrice ?? displayedSidePrice(market.yes, side);
  const fair = verdict?.fairSidePrice ?? fairSidePrice(market.fairYes, side);
  const edge = verdict?.edge ?? Number((fair - observed).toFixed(4));
  const evaluating = order?.status === "evaluating" || order?.status === "escrowed";

  return (
    <Card className={cn("border-2", verdictBorder(verdict?.verdict, stale))}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-(--green)" />
          <span className="text-[13px] font-bold text-(--ink)">LineGuard</span>
          <span className="mono text-[9.5px] text-(--ink-3)">verdict engine</span>
        </div>
        {evaluating ? (
          <Badge tone="blue" className="dot-pulse">
            EVALUATING
          </Badge>
        ) : stale ? (
          <Badge tone="amber" dot pulse>
            STALE WINDOW
          </Badge>
        ) : (
          <Badge tone="green" dot>
            PROTECTED
          </Badge>
        )}
      </div>

      {/* Registers */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Register label="materialSeq" value={market.materialSeq} tone={stale ? "amber" : "neutral"} />
        <Register label="pricedAtSeq" value={market.pricedAtSeq} tone={stale ? "red" : "neutral"} />
      </div>

      {/* Checks */}
      <div className="hairline-rows mt-2.5">
        <Stat
          label="Stale window (materialSeq > pricedAtSeq)"
          value={stale ? `YES · staleness ${market.materialSeq - market.pricedAtSeq}` : "NO"}
          tone={stale ? "amber" : "green"}
          strong
        />
        <Stat label={`Observed price (${side} fills at)`} value={cents(observed)} tone="blue" />
        <Stat label="Fair price (given the event)" value={cents(fair)} tone={stale ? "amber" : "neutral"} />
        <Stat
          label="Unfair edge (fair − observed)"
          value={`${edge > 0 ? "+" : ""}${cents(edge)}`}
          tone={edge > tolerance ? "red" : "neutral"}
          strong
        />
        <Stat label="Tolerance" value={cents(tolerance)} />
      </div>

      {/* Rule */}
      <p className="mono mt-2.5 rounded-md bg-[#f9fafb] px-2.5 py-2 text-center text-[10px] leading-relaxed text-(--ink-2)">
        void ⇔ materialSeq &gt; pricedAtSeq&nbsp; ∧&nbsp; edge &gt; tolerance
      </p>

      {/* Verdict */}
      <VerdictBlock verdict={verdict?.verdict ?? null} evaluating={evaluating} reason={verdict?.reason} />
    </Card>
  );
}

function VerdictBlock({
  verdict,
  evaluating,
  reason,
}: {
  verdict: Verdict | null;
  evaluating: boolean;
  reason?: string;
}) {
  if (evaluating) {
    return (
      <div className="mt-2.5 flex items-center justify-center gap-2 rounded-lg border border-(--blue)/25 bg-(--blue-bg) py-3 text-[13px] font-bold text-(--blue)">
        <CircleDashed className="h-4 w-4 dot-pulse" /> Evaluating order in escrow…
      </div>
    );
  }
  if (!verdict) {
    return (
      <div className="mt-2.5 flex items-center justify-center gap-2 rounded-lg border border-dashed border-(--border) py-3 text-[12px] font-semibold text-(--ink-3)">
        <ShieldQuestion className="h-4 w-4" /> Awaiting order
      </div>
    );
  }
  if (verdict === "VOIDED_REFUNDED") {
    return (
      <div className="verdict-pop mt-2.5 rounded-lg border border-(--red)/40 bg-(--red-bg) p-3">
        <p className="flex items-center justify-center gap-2 text-[15px] font-extrabold text-(--red)">
          <ShieldAlert className="h-5 w-5" /> VOIDED &amp; REFUNDED
        </p>
        {reason && <p className="mt-1.5 text-center text-[10.5px] leading-snug text-(--ink-2)">{reason}</p>}
      </div>
    );
  }
  const green = verdict === "ALLOWED";
  return (
    <div
      className={cn(
        "verdict-pop mt-2.5 rounded-lg border p-3",
        green ? "border-(--green)/35 bg-(--green-bg)" : "border-(--amber)/35 bg-(--amber-bg)"
      )}
    >
      <p className={cn("flex items-center justify-center gap-2 text-[14px] font-extrabold", green ? "text-(--green)" : "text-(--amber)")}>
        <ShieldCheck className="h-4.5 w-4.5" /> {green ? "ALLOWED" : "STALE · ALLOWED · NO EDGE"}
      </p>
      {reason && <p className="mt-1.5 text-center text-[10.5px] leading-snug text-(--ink-2)">{reason}</p>}
    </div>
  );
}

function Register({ label, value, tone }: { label: string; value: number; tone: "neutral" | "amber" | "red" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 text-center",
        tone === "neutral" && "border-(--border) bg-[#f9fafb]",
        tone === "amber" && "border-(--amber)/40 bg-(--amber-bg)",
        tone === "red" && "border-(--red)/30 bg-(--red-bg)"
      )}
    >
      <p className="mono text-[9.5px] uppercase tracking-wide text-(--ink-3)">{label}</p>
      <p
        className={cn(
          "num text-[22px] font-bold leading-tight",
          tone === "amber" ? "text-(--amber)" : tone === "red" ? "text-(--red)" : "text-(--ink)"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function verdictBorder(verdict: Verdict | undefined, stale: boolean): string {
  if (verdict === "VOIDED_REFUNDED") return "border-(--red)/50";
  if (verdict === "ALLOWED") return "border-(--green)/40";
  if (verdict === "STALE_ALLOWED_NO_EDGE") return "border-(--amber)/50";
  if (stale) return "border-(--amber)/50";
  return "border-(--border)";
}
