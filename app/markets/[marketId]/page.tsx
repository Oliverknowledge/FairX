"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { V4ReplayMarket } from "@/components/v4/V4ReplayMarket";
import { V4_REPLAY_SLUG } from "@/lib/v4/replay";

export default function MarketDetailPage() {
  const params = useParams<{ marketId: string }>();
  const marketId = Array.isArray(params.marketId) ? params.marketId[0] : params.marketId;
  if (marketId === V4_REPLAY_SLUG) return <FairXShell><V4ReplayMarket /></FairXShell>;
  return <FairXShell compact><section className="mx-auto max-w-xl rounded-2xl border border-(--border) bg-white p-8 text-center"><p className="section-label">Outside V4 scope</p><h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em]">FairX V4 exposes one canonical replay market.</h1><p className="mt-3 text-[12px] leading-relaxed text-(--ink-2)">No generic V4 discovery, public market creation or additional fixtures are enabled.</p><Link href={`/markets/${V4_REPLAY_SLUG}`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-(--ink) px-5 text-[12px] font-bold text-white"><ArrowLeft className="h-4 w-4" />France–Morocco replay</Link></section></FairXShell>;
}
