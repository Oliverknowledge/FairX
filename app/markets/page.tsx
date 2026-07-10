import type { Metadata } from "next";
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { FairXShell } from "@/components/fairx/FairXShell";
import { MarketsDiscovery } from "@/components/fairx/MarketsDiscovery";

export const metadata: Metadata = {
  title: "Markets | FairX",
  description: "Protected sandbox and devnet prediction markets powered by LineGuard.",
};

export default function MarketsPage() {
  return (
    <FairXShell>
      <section className="flex flex-col gap-5 border-b border-(--border) pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="section-label">Protected market discovery</p>
          <h1 className="mt-2 text-[28px] font-bold leading-[1.02] tracking-[-0.055em] text-(--ink) sm:text-[34px]">Markets that expose their fairness state.</h1>
          <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-(--ink-2)">
            Browse sandbox and devnet markets. FairX shows the observed price, fair value, and LineGuard state before an order can settle.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/proof"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-(--border) bg-white px-3 text-[10.5px] font-semibold text-(--ink-2) transition-colors hover:border-[#bed2f8] hover:text-(--blue)"
          >
            View proof
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/create" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-(--blue) px-3 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#1d55c6]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Create market
          </Link>
        </div>
      </section>

      <div className="mt-5">
        <MarketsDiscovery />
      </div>
    </FairXShell>
  );
}
