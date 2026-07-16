"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { FairXLiveDemo } from "@/components/runtime/FairXLiveDemo";
import { V4_REPLAY_SLUG } from "@/lib/v4/replay";

export default function MarketDetailPage() {
  const params = useParams<{ marketId: string }>();
  const marketId = Array.isArray(params.marketId) ? params.marketId[0] : params.marketId;
  if (marketId === V4_REPLAY_SLUG || marketId === "france-morocco") return <FairXShell><FairXLiveDemo /></FairXShell>;
  if (marketId === "argentina-brazil") return <FairXShell><FairXLiveDemo initialScenarioId="argentina-brazil" /></FairXShell>;
  return <FairXShell compact><section className="mx-auto max-w-xl rounded-2xl border border-(--border) bg-white p-8 text-center"><p className="section-label">Runtime scenario not found</p><h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em]">FairX exposes two deterministic judge scenarios.</h1><p className="mt-3 text-[12px] leading-relaxed text-(--ink-2)">The reusable runtime path is intentionally separate from public market creation and from the frozen canonical V4 deployment.</p><Link href="/" className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-(--ink) px-5 text-[12px] font-bold text-white"><ArrowLeft className="h-4 w-4" />Open Demo</Link></section></FairXShell>;
}
