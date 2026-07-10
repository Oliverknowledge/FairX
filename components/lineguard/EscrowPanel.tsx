import { ArrowRight, Landmark, Lock } from "lucide-react";
import { Badge, Card, cn, Label } from "@/components/lineguard/ui";
import { ledgerBalances, type OrderStatus } from "@/lib/escrow/types";
import { cents, orderProgress, usd, type TerminalState } from "@/lib/terminal/state";

/**
 * The escrow ledger, modelled — not labelled. Every dollar is shown moving
 * between available balance, escrow, and either back to the bot (refund) or
 * into protocol collateral (fill). Money is conserved at every step.
 */
export function EscrowPanel({ state }: { state: TerminalState }) {
  const { order, ledger, verdict } = state;
  const voided = verdict?.verdict === "VOIDED_REFUNDED";
  const refunded = order?.status === "refunded";
  const filled = order?.status === "filled";

  const flow: Array<{ label: string; reached: number }> = voided || refunded
    ? [
        { label: "Submitted", reached: 1 },
        { label: "Escrowed", reached: 2 },
        { label: "Evaluating", reached: 3 },
        { label: "Voided", reached: 4 },
        { label: "Refunded", reached: 5 },
      ]
    : [
        { label: "Submitted", reached: 1 },
        { label: "Escrowed", reached: 2 },
        { label: "Evaluating", reached: 3 },
        { label: "Filled", reached: 4 },
      ];
  const progress = orderProgress(order);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-(--ink-2)" />
          <Label>Escrow ledger</Label>
        </div>
        {order ? (
          <StatusBadge status={order.status} />
        ) : (
          <Badge tone="neutral" dot>
            idle
          </Badge>
        )}
      </div>

      {/* Lifecycle flow */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {flow.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-1">
            <span
              className={cn(
                "num rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors",
                progress >= stage.reached
                  ? stage.label === "Refunded"
                    ? "border-(--green)/40 bg-(--green-bg) text-(--green)"
                    : stage.label === "Voided"
                      ? "border-(--red)/40 bg-(--red-bg) text-(--red)"
                      : stage.label === "Filled"
                        ? "border-(--green)/40 bg-(--green-bg) text-(--green)"
                        : "border-(--blue)/30 bg-(--blue-bg) text-(--blue)"
                  : "border-(--border) bg-white text-(--ink-3)"
              )}
            >
              {stage.label}
            </span>
            {i < flow.length - 1 && <ArrowRight className="h-3 w-3 text-(--ink-3)" />}
          </div>
        ))}
      </div>

      {/* Ledger balances */}
      <div className="mt-3 hairline-rows">
        <LedgerRow label="Bot starting balance" value={usd(ledger.botStartingBalance)} />
        <LedgerRow label="Bot available balance" value={usd(ledger.botAvailableBalance)} tone={refunded ? "green" : undefined} />
        <LedgerRow
          label="Escrowed (locked)"
          value={usd(ledger.escrowedAmount)}
          tone={ledger.escrowedAmount > 0 ? "amber" : undefined}
          icon={ledger.escrowedAmount > 0 ? Lock : undefined}
        />
        <LedgerRow label="Refunded" value={usd(ledger.refundedAmount)} tone={ledger.refundedAmount > 0 ? "green" : undefined} strong={refunded} />
        <LedgerRow label="Filled (consumed)" value={usd(ledger.filledAmount)} tone={ledger.filledAmount > 0 ? "green" : undefined} strong={filled} />
        <LedgerRow label="Protocol collateral" value={usd(ledger.protocolBalance)} />
      </div>

      {/* Final balance callout */}
      <div
        className={cn(
          "mt-3 flex items-center justify-between rounded-lg border px-3 py-2",
          refunded ? "border-(--green)/35 bg-(--green-bg)" : filled ? "border-(--border) bg-[#f9fafb]" : "border-(--border) bg-[#f9fafb]"
        )}
      >
        <span className="text-[11px] font-semibold text-(--ink-2)">Bot final balance</span>
        <span className={cn("num text-[16px] font-extrabold", refunded ? "text-(--green)" : "text-(--ink)")}>
          {usd(ledger.botAvailableBalance)}
        </span>
      </div>

      {order && (
        <p className="mt-2 text-center text-[10px] text-(--ink-3)">
          {refunded
            ? `Stake ${usd(order.stakeUsd)} returned in full · money conserved: ${ledgerBalances(ledger) ? "✓" : "✗"}`
            : filled
              ? `Stake ${usd(order.stakeUsd)} consumed at ${cents(order.observedPrice)} · money conserved: ${ledgerBalances(ledger) ? "✓" : "✗"}`
              : `${usd(order.stakeUsd)} held in escrow while LineGuard evaluates`}
        </p>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { tone: "neutral" | "blue" | "amber" | "red" | "green"; label: string }> = {
    draft: { tone: "neutral", label: "draft" },
    submitted: { tone: "blue", label: "submitted" },
    escrowed: { tone: "amber", label: "escrowed" },
    evaluating: { tone: "blue", label: "evaluating" },
    voided: { tone: "red", label: "voided" },
    refunded: { tone: "green", label: "refunded" },
    filled: { tone: "green", label: "filled" },
  };
  const { tone, label } = map[status];
  return (
    <Badge tone={tone} dot pulse={status === "evaluating" || status === "escrowed"}>
      {label}
    </Badge>
  );
}

function LedgerRow({
  label,
  value,
  tone,
  strong,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "amber" | "green";
  strong?: boolean;
  icon?: typeof Lock;
}) {
  const ink = tone === "amber" ? "text-(--amber)" : tone === "green" ? "text-(--green)" : "text-(--ink)";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-1.5 text-[11.5px] text-(--ink-2)">
        {Icon && <Icon className="h-3 w-3 text-(--amber)" />}
        {label}
      </span>
      <span className={cn("num text-right text-[12.5px]", strong ? "font-extrabold" : "font-semibold", ink)}>{value}</span>
    </div>
  );
}
