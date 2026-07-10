import { cn, Label } from "@/components/lineguard/ui";
import type { LogEntry } from "@/lib/terminal/state";

const DOT: Record<LogEntry["tone"], string> = {
  neutral: "bg-(--ink-3)",
  amber: "bg-(--amber)",
  red: "bg-(--red)",
  green: "bg-(--green)",
  blue: "bg-(--blue)",
};

const TEXT: Record<LogEntry["tone"], string> = {
  neutral: "text-(--ink-2)",
  amber: "text-(--amber)",
  red: "text-(--red)",
  green: "text-(--green)",
  blue: "text-(--blue)",
};

/** Append-only event/order log (newest first). */
export function OrderLog({ log }: { log: LogEntry[] }) {
  return (
    <div className="card flex h-full flex-col p-3">
      <Label className="mb-2">Order &amp; event log</Label>
      <div className="thin-scroll -mr-1 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {log.map((entry) => (
          <div key={entry.id} className="slide-in flex items-start gap-2">
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", DOT[entry.tone])} />
            <p className={cn("text-[11px] leading-snug", TEXT[entry.tone])}>{entry.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
