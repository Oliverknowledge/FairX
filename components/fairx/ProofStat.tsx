import type { LucideIcon } from "lucide-react";

type ProofStatProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  tone: "green" | "red" | "blue";
};

const tones = {
  green: "border-[#bce9d8] bg-(--green-bg) text-[#047857]",
  red: "border-[#fecaca] bg-(--red-bg) text-[#c82525]",
  blue: "border-[#cfe0ff] bg-(--blue-bg) text-[#215fc8]",
} as const;

export function ProofStat({ icon: Icon, eyebrow, title, detail, tone }: ProofStatProps) {
  return (
    <article className="card group flex min-h-[126px] flex-col p-4 transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <span className={`mb-4 flex h-7 w-7 items-center justify-center rounded-md border ${tones[tone]}`}>
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-(--ink-3)">{eyebrow}</p>
      <h2 className="mt-1 text-[13px] font-bold tracking-[-0.015em] text-(--ink)">{title}</h2>
      <p className="mt-1 text-[10.5px] leading-snug text-(--ink-2)">{detail}</p>
    </article>
  );
}
