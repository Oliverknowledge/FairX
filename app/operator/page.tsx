import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, RadioTower, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/lineguard/ui";
import { OperatorDashboard } from "@/components/fairx-proof/OperatorDashboard";
import { FairXShell } from "@/components/fairx/FairXShell";
import { RuntimeStatusStrip } from "@/components/fairx/RuntimeStatusStrip";
import { CanonicalV2Settlement } from "@/components/fairx-proof/CanonicalV2Settlement";

export const metadata: Metadata = {
  title: "FairX Operator",
  description: "Runtime-safe operational status for the LineGuard devnet settlement guard.",
};

export default function OperatorPage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1240px]">
      <header className="mb-5 rounded-2xl border border-(--border) bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to FairX
            </Link>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--blue-bg)">
                <RadioTower className="h-4.5 w-4.5 text-(--blue)" />
              </span>
              <div>
                <p className="mono text-[10px] font-semibold uppercase tracking-[0.15em] text-(--ink-3)">Developer / operator view</p>
                <h1 className="mt-1 text-[25px] font-extrabold tracking-[-0.03em] text-(--ink)">Devnet operational truth.</h1>
                <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-(--ink-2)">
                  Inspect the deployed v2 program, role-separated resolution, isolated MarketVault, TxLINE CPI, and proof readiness without exposing private configuration.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="amber">Devnet funds only</Badge>
            <Badge tone="green" dot><ShieldCheck className="h-3 w-3" /> Oracle authority controlled</Badge>
          </div>
        </div>
      </header>

      <RuntimeStatusStrip detailed />
      <div className="mt-4"><CanonicalV2Settlement /></div>
      <details className="mt-4 rounded-xl border border-(--border) bg-[#f8fafc] p-4"><summary className="cursor-pointer text-[11px] font-bold">Historical protocol operations</summary><div className="mt-4"><OperatorDashboard /></div></details>
      </div>
    </FairXShell>
  );
}
