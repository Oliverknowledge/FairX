import type { ReactNode } from "react";

/** Minimal shared primitives for the LineGuard demo. */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "blue" | "amber" | "red" | "green";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-[#f3f4f6] text-(--ink-2) border-(--border)",
  blue: "bg-(--blue-bg) text-(--blue) border-(--blue)/25",
  amber: "bg-(--amber-bg) text-(--amber) border-(--amber)/30",
  red: "bg-(--red-bg) text-(--red) border-(--red)/25",
  green: "bg-(--green-bg) text-(--green) border-(--green)/25",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "num inline-flex h-[19px] items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-semibold leading-none",
        TONE_BADGE[tone],
        className
      )}
    >
      {dot && <span className={cn("inline-block h-1.5 w-1.5 rounded-full bg-current", pulse && "dot-pulse")} />}
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("card p-4", className)}>{children}</section>;
}

export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("section-label", className)}>{children}</p>;
}

/** Key/value row used across the guard + market panels. */
export function Stat({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  strong?: boolean;
}) {
  const valueTone =
    tone === "amber" ? "text-(--amber)" : tone === "red" ? "text-(--red)" : tone === "green" ? "text-(--green)" : tone === "blue" ? "text-(--blue)" : "text-(--ink)";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11.5px] text-(--ink-2)">{label}</span>
      <span className={cn("num text-right text-[12.5px]", strong ? "font-bold" : "font-semibold", valueTone)}>
        {value}
      </span>
    </div>
  );
}
