import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Card, cn } from "@/components/lineguard/ui";
import type { ProofTone } from "@/lib/proof/staticProofData";

const TONE_BORDER: Record<ProofTone, string> = {
  green: "border-(--green)/25",
  red: "border-(--red)/25",
  blue: "border-(--blue)/25",
  amber: "border-(--amber)/30",
  neutral: "border-(--border)",
};

export function ProofCard({
  eyebrow,
  title,
  claim,
  tone = "neutral",
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  claim: string;
  tone?: ProofTone;
  actions?: Array<{ href: string; label: string; external?: boolean }>;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 border", TONE_BORDER[tone])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label">{eyebrow}</p>
          <h2 className="mt-1 text-[16px] font-extrabold leading-tight text-(--ink)">{title}</h2>
          <p className="mt-1 max-w-3xl text-[11.5px] leading-snug text-(--ink-2)">{claim}</p>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                target={action.external ? "_blank" : undefined}
                rel={action.external ? "noreferrer" : undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[11px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6] hover:text-(--blue)"
              >
                {action.label}
                {action.external && <ExternalLink className="h-3.5 w-3.5" />}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}
