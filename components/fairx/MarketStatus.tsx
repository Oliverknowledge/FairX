import { CheckCircle2, CircleDotDashed, RotateCw, ShieldAlert, type LucideIcon } from "lucide-react";
import type { FairXMarket } from "@/lib/markets/catalog";

export type GuardLabel = "Protected" | "Stale window" | "Repricing" | "Settled";

type StatusLike = FairXMarket["status"];

const statusConfig: Record<StatusLike, { label: string; className: string; icon: LucideIcon }> = {
  TRADING: {
    label: "Trading",
    className: "border-[#b7ead6] bg-(--green-bg) text-[#067657]",
    icon: CheckCircle2,
  },
  STALE: {
    label: "Stale window",
    className: "border-[#f3d59a] bg-(--amber-bg) text-[#ad6402]",
    icon: ShieldAlert,
  },
  REPRICING: {
    label: "Repricing",
    className: "border-[#c9dafe] bg-(--blue-bg) text-[#215fc8]",
    icon: RotateCw,
  },
  SETTLED: {
    label: "Settled",
    className: "border-[#d9dee7] bg-[#f7f8fa] text-[#687385]",
    icon: CircleDotDashed,
  },
};

export function guardLabelForStatus(status: StatusLike): GuardLabel {
  if (status === "STALE") return "Stale window";
  if (status === "REPRICING") return "Repricing";
  if (status === "SETTLED") return "Settled";
  return "Protected";
}

export function MarketStatus({ status, compact = false }: { status: StatusLike; compact?: boolean }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${config.className} ${
        compact ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-1 text-[10px]"
      }`}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.3} />
      {config.label}
    </span>
  );
}

export function SourceBadge({ source, liveConnected = false }: { source: FairXMarket["source"]; liveConnected?: boolean }) {
  const labels = {
    live: liveConnected ? "Live TxLINE" : "Live TxLINE unavailable",
    captured: "Captured TxLINE event",
    demo: "Guided scenario",
  } as const;

  return (
    <span className="inline-flex items-center gap-1.5 text-[9.5px] font-medium text-(--ink-3)">
      <span className={`h-1.5 w-1.5 rounded-full ${source === "live" && liveConnected ? "bg-(--green)" : source === "captured" ? "bg-(--blue)" : "bg-(--amber)"}`} />
      {labels[source]}
    </span>
  );
}
