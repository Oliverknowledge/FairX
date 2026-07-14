"use client";

import Link from "next/link";
import { ArrowLeft, TrendingUp, Radio, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { ReferencePriceCard } from "@/components/fairx/ReferencePriceCard";
import { ReferenceProofPanel } from "@/components/fairx/ReferenceProofPanel";

const MAPPING_ID = "fifwc-fra-esp-2026-07-14-france-win";

const SYSTEMS = [
  { icon: TrendingUp, name: "Polymarket", role: "Market reference", body: "Public order-book midpoint for the equivalent market — the external opening quote." },
  { icon: Radio, name: "TxLINE", role: "Sports-event truth", body: "Reports what actually happens in the match and supplies the final-result evidence." },
  { icon: ShieldCheck, name: "LineGuard", role: "Protected execution", body: "Rejects a Solana order that trades against information the reference quote predates." },
] as const;

export default function ReferencePricePage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1100px]">
        <Link href="/markets" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-(--ink-2) hover:text-(--blue)">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to markets
        </Link>

        <header className="mt-4">
          <span className="rounded-full border border-[#cfe0ff] bg-(--blue-bg) px-2.5 py-1 text-[10px] font-semibold text-(--blue)">
            External reference price · read-only
          </span>
          <h1 className="mt-3 text-[30px] font-extrabold leading-[1.05] tracking-[-0.04em] text-(--ink) sm:text-[36px]">
            Protected execution for live prediction markets.
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">
            FairX uses liquid external market prices as a reference, TxLINE as the sports-data layer, and LineGuard to stop
            stale-information exploitation on Solana. Orders are never routed to Polymarket; all execution stays on Solana devnet.
          </p>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {SYSTEMS.map(({ icon: Icon, name, role, body }) => (
            <div key={name} className="min-w-0 rounded-xl border border-(--border) bg-white p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-(--blue)" />
                <span className="text-[13px] font-bold text-(--ink)">{name}</span>
              </div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">{role}</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="min-w-0"><ReferencePriceCard mappingId={MAPPING_ID} /></div>
          <div className="min-w-0"><ReferenceProofPanel mappingId={MAPPING_ID} /></div>
        </div>

        <p className="mt-6 text-[10.5px] leading-relaxed text-(--ink-3)">
          The canonical France–Morocco settlement proof remains TxLINE StablePrice-priced historical evidence and is unchanged.
          This is a separate, current market whose opening quote is sourced from Polymarket. FairX is not affiliated with Polymarket.
        </p>
      </div>
    </FairXShell>
  );
}
