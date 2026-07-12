import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { Badge } from "@/components/lineguard/ui";
import { AttackLab } from "@/components/fairx-proof/AttackLab";
import { FairXShell } from "@/components/fairx/FairXShell";

export const metadata: Metadata = {
  title: "Attack Lab",
  description: "Stress-test LineGuard against a wave of stale-price latency bots — local simulation using the same guard function.",
};

export default function AttackLabPage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to FairX
            </Link>
            <div className="mt-3">
              <p className="section-label">LineGuard at scale</p>
              <h1 className="mt-1 text-[27px] font-extrabold tracking-[-0.04em] text-(--ink)">Attack Lab</h1>
              <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-(--ink-2)">
                One market and one bot proves the mechanism. This runs hundreds of latency bots through the exact same guard so you can
                inspect the deterministic local guard decision at scale. Values are sandbox units, never volume, liquidity, or user profit.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">Local simulation</Badge>
            <Link href="/proof" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              <FileCheck2 className="h-3.5 w-3.5" /> Devnet proof
            </Link>
          </div>
        </header>

        <AttackLab />
      </div>
    </FairXShell>
  );
}
