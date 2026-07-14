"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { DevnetMarket } from "@/components/fairx/DevnetMarket";
import { getSupportedMarketBySlug, FRANCE_MOROCCO_MARKET } from "@/lib/markets/supportedMarkets";

export default function MarketDetailPage() {
  const params = useParams<{ marketId: string }>();
  const marketId = Array.isArray(params.marketId) ? params.marketId[0] : params.marketId;
  const config = getSupportedMarketBySlug(marketId);

  if (config) return <FairXShell><DevnetMarket config={config} /></FairXShell>;

  return <FairXShell compact><section className="mx-auto max-w-xl rounded-2xl border border-(--border) bg-white p-8 text-center"><p className="text-[11px] font-bold text-(--ink-3)">Market unavailable</p><h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em]">This market is not supported for on-chain trading.</h1><p className="mt-3 text-[12px] leading-relaxed text-(--ink-2)">FairX only presents its allowlisted markets.</p><Link href={`/markets/${FRANCE_MOROCCO_MARKET.slug}`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-(--ink) px-5 text-[12px] font-bold text-white"><ArrowLeft className="h-4 w-4" />Back to the settled market</Link></section></FairXShell>;
}
