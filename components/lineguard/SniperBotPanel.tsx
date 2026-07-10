"use client";

import { Bot, Check, Crosshair, Eye, Target, X, Zap } from "lucide-react";
import { Badge, Card, cn, Label } from "@/components/lineguard/ui";
import { beneficialSide, readMarket, sniperEconomics } from "@/lib/bot/sniper";
import { displayedSidePrice, fairSidePrice, isStale, type Side } from "@/lib/markets/types";
import { BOT_STAKE_USD, cents, usd, type TerminalState } from "@/lib/terminal/state";
import type { Action } from "@/lib/terminal/actions";

/**
 * The adversary — a real actor with a side toggle. Attacking the side that
 * benefits from the un-repriced event gets voided; the losing side passes
 * with no edge. This is what proves LineGuard blocks exploitation, not trading.
 */
export function SniperBotPanel({
  state,
  dispatch,
}: {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
}) {
  const { market, order, verdict, botSide, tolerance } = state;
  const stale = isStale(market);
  const voided = verdict?.verdict === "VOIDED_REFUNDED";
  const filled = order?.status === "filled";
  const locked = order !== null; // side can't change once an order is live

  const isOver = market.kind === "OVER_UNDER";
  const benefits: Side = beneficialSide(market);
  const attackSide: Side = isOver ? "OVER" : "YES";
  const loseSide: Side = isOver ? "UNDER" : "NO";

  // The bot's read of the CHOSEN side, at the frozen observed price.
  const frozenObserved = order?.observedPrice ?? displayedSidePrice(market.yes, botSide);
  const fairChosen = fairSidePrice(market.fairYes, botSide);
  const reading = readMarket(market, botSide, tolerance, BOT_STAKE_USD);
  const econ = sniperEconomics(BOT_STAKE_USD, frozenObserved, fairChosen);
  const sideBenefits = botSide === benefits;

  return (
    <Card className={cn(order && !voided && !filled && "shake", voided && "border-(--red)/30")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-(--red)" />
          <span className="text-[13px] font-bold text-(--ink)">Adversary</span>
          <span className="text-[10.5px] text-(--ink-3)">latency sniper bot</span>
        </div>
        {order ? (
          voided ? (
            <Badge tone="red">NEUTRALISED</Badge>
          ) : filled ? (
            <Badge tone="green" dot>
              FILLED
            </Badge>
          ) : (
            <Badge tone="red" dot pulse>
              ATTACKING
            </Badge>
          )
        ) : reading.attackReady ? (
          <Badge tone="red" dot pulse>
            ATTACK READY
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            watching
          </Badge>
        )}
      </div>

      {/* Side toggle */}
      <div className="mt-3">
        <Label>Attack side</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <SideButton
            active={botSide === attackSide}
            disabled={locked}
            onClick={() => dispatch({ type: "SET_BOT_SIDE", side: attackSide })}
            tone="red"
            label={`Attack ${attackSide}`}
            sub="benefits from goal"
            flagged={benefits === attackSide}
          />
          <SideButton
            active={botSide === loseSide}
            disabled={locked}
            onClick={() => dispatch({ type: "SET_BOT_SIDE", side: loseSide })}
            tone="neutral"
            label={`Try ${loseSide}`}
            sub="trades against goal"
            flagged={benefits === loseSide}
          />
        </div>
      </div>

      {/* Three moves */}
      <div className="mt-3 space-y-1.5">
        <Move icon={Eye} on text="Monitors every market for a stale window" />
        <Move
          icon={Target}
          on={stale}
          text={`Detects ${reading.edge >= 0 ? "+" : ""}${cents(reading.edge)} edge on ${botSide} @ ${cents(reading.observedPrice)}`}
          highlight={reading.attackReady ? "red" : "amber"}
        />
        <Move
          icon={Zap}
          on={!!order}
          text={`Fires ${order?.side ?? botSide} ${usd(BOT_STAKE_USD)} @ ${cents(frozenObserved)} into the stale price`}
          highlight="red"
        />
      </div>

      {/* Live economics readout */}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-(--border) bg-[#f9fafb] p-2.5">
        <Metric label="Observed price" value={cents(frozenObserved)} tone="blue" />
        <Metric label="Fair price" value={cents(fairChosen)} tone={stale ? "amber" : "neutral"} />
        <Metric label="Stake" value={usd(BOT_STAKE_USD)} />
        <Metric label="Contracts" value={`${econ.shares.toFixed(0)} sh`} />
      </div>

      {/* Without / With split */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Outcome
          on={!!order}
          settled={!!verdict}
          tone={sideBenefits ? "red" : "neutral"}
          title="Without LineGuard"
          headline={`${econ.withoutLineGuardProfit >= 0 ? "+" : "−"}${usd(Math.abs(econ.withoutLineGuardProfit))}`}
          sub={sideBenefits ? `sniped ${cents(frozenObserved)}, marks to ${cents(fairChosen)}` : "no edge to capture on this side"}
          verdictLabel={sideBenefits ? "bot profits" : "no free money"}
          Icon={X}
        />
        <Outcome
          on={!!order}
          settled={!!verdict}
          tone="green"
          title="With LineGuard"
          headline={voided ? usd(0) : filled ? `${econ.withoutLineGuardProfit >= 0 ? "+" : "−"}${usd(Math.abs(econ.withoutLineGuardProfit))}` : usd(0)}
          sub={voided ? "order voided, stake refunded" : filled ? "allowed — no unfair edge taken" : "pending verdict"}
          verdictLabel={voided ? "attack blocked" : filled ? "fair trade filled" : "—"}
          Icon={Check}
        />
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-(--ink-2)">
        <Crosshair className="mt-0.5 h-3 w-3 shrink-0 text-(--ink-3)" />
        LineGuard does not freeze the market. It only blocks the side that benefits from stale information.
      </p>
    </Card>
  );
}

function SideButton({
  active,
  disabled,
  onClick,
  tone,
  label,
  sub,
  flagged,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: "red" | "neutral";
  label: string;
  sub: string;
  flagged: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-left transition-all disabled:cursor-not-allowed",
        active
          ? tone === "red"
            ? "border-(--red) bg-(--red-bg) ring-1 ring-(--red)/30"
            : "border-(--ink-2) bg-white ring-1 ring-(--ink-2)/20"
          : "border-(--border) bg-white hover:border-(--border-strong)",
        disabled && !active && "opacity-45"
      )}
    >
      <span className={cn("flex items-center gap-1 text-[12px] font-bold", active && tone === "red" ? "text-(--red)" : "text-(--ink)")}>
        {label}
        {flagged && <span className="num rounded bg-(--amber)/15 px-1 text-[8.5px] font-bold text-(--amber)">EDGE</span>}
      </span>
      <span className="block text-[9.5px] text-(--ink-3)">{sub}</span>
    </button>
  );
}

function Move({
  icon: Icon,
  on,
  text,
  highlight,
}: {
  icon: typeof Eye;
  on: boolean;
  text: string;
  highlight?: "amber" | "red";
}) {
  const color = !on ? "text-(--ink-3)" : highlight === "red" ? "text-(--red)" : highlight === "amber" ? "text-(--amber)" : "text-(--ink-2)";
  return (
    <div className={cn("flex items-center gap-2 transition-opacity", on ? "opacity-100" : "opacity-45")}>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
          on && highlight === "red" && "border-(--red)/30 bg-(--red-bg)",
          on && highlight === "amber" && "border-(--amber)/30 bg-(--amber-bg)",
          (!on || !highlight) && "border-(--border) bg-[#f9fafb]"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </span>
      <span className={cn("text-[11.5px] font-medium", on ? "text-(--ink)" : "text-(--ink-3)")}>{text}</span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "blue" | "amber" | "neutral" }) {
  const ink = tone === "blue" ? "text-(--blue)" : tone === "amber" ? "text-(--amber)" : "text-(--ink)";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10.5px] text-(--ink-2)">{label}</span>
      <span className={cn("num text-[12px] font-bold", ink)}>{value}</span>
    </div>
  );
}

function Outcome({
  on,
  settled,
  tone,
  title,
  headline,
  sub,
  verdictLabel,
  Icon,
}: {
  on: boolean;
  settled: boolean;
  tone: "red" | "green" | "neutral";
  title: string;
  headline: string;
  sub: string;
  verdictLabel: string;
  Icon: typeof Check;
}) {
  const ink = tone === "red" ? "text-(--red)" : tone === "green" ? "text-(--green)" : "text-(--ink-2)";
  const settledBg =
    tone === "red" ? "border-(--red)/35 bg-(--red-bg)" : tone === "green" ? "border-(--green)/35 bg-(--green-bg)" : "border-(--border) bg-[#f9fafb]";
  return (
    <div className={cn("rounded-lg border p-2.5 transition-all", settled ? settledBg : "border-(--border) bg-[#f9fafb]", !on && "opacity-50")}>
      <Label className={settled ? ink : undefined}>{title}</Label>
      <p className={cn("num mt-1 text-[22px] font-extrabold leading-none", settled ? ink : "text-(--ink-3)")}>{on ? headline : "—"}</p>
      <p className="mt-1 text-[10px] leading-snug text-(--ink-2)">{on ? sub : "awaiting bot order"}</p>
      {settled && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-[10.5px] font-bold", ink)}>
          <Icon className="h-3 w-3" /> {verdictLabel}
        </p>
      )}
    </div>
  );
}
