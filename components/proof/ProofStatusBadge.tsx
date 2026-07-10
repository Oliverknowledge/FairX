import type { ReactNode } from "react";
import { Badge, cn, type Tone } from "@/components/lineguard/ui";

const TONE_MAP: Record<string, Tone> = {
  verified: "green",
  refunded: "red",
  filled: "blue",
  amber: "amber",
  neutral: "neutral",
};

export function ProofStatusBadge({
  label,
  value,
  tone = "verified",
}: {
  label: string;
  value: ReactNode;
  tone?: keyof typeof TONE_MAP;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-(--border) bg-white px-2.5 py-2">
      <span className="truncate text-[10.5px] font-semibold text-(--ink-2)">{label}</span>
      <Badge tone={TONE_MAP[tone]} dot={tone !== "neutral"} className={cn("shrink-0", tone === "verified" && "border-(--green)/35")}>
        {value}
      </Badge>
    </div>
  );
}
