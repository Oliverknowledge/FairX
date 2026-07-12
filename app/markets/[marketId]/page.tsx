"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { MarketWorkspace } from "@/components/fairx/MarketWorkspace";
import { DevnetMarket } from "@/components/fairx/DevnetMarket";
import { getMarketById } from "@/lib/markets/catalog";
import { useFairXStore } from "@/lib/markets/store";

export default function MarketDetailPage() {
  const params = useParams<{ marketId: string }>();
  const marketId = Array.isArray(params.marketId) ? params.marketId[0] : params.marketId;
  const { markets, orders, upsertMarket, addOrder, addReceipt, hydrated } = useFairXStore();
  const market = markets.find((candidate) => candidate.id === marketId) ?? getMarketById(marketId);

  if (!market) {
    return (
      <FairXShell compact>
        <section className="card mx-auto max-w-xl p-6 text-center">
          <p className="section-label">Market not found</p>
          <h1 className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-(--ink)">This protected market is not in the local catalog.</h1>
          <p className="mt-3 text-[11.5px] leading-relaxed text-(--ink-2)">It may have been cleared from browser storage, or its share link is incomplete.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/markets" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-(--border) bg-white px-3 text-[10.5px] font-semibold text-(--ink-2)"><ArrowLeft className="h-3.5 w-3.5" />All markets</Link>
            <Link href="/create" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-(--blue) px-3 text-[10.5px] font-semibold text-white"><PlusCircle className="h-3.5 w-3.5" />Create market</Link>
          </div>
        </section>
      </FairXShell>
    );
  }

  const marketOrders = orders.filter((order) => order.marketId === market.id);

  if (market.id === "france-morocco-france-win") {
    return <FairXShell><DevnetMarket /></FairXShell>;
  }

  return (
    <FairXShell>
      {!hydrated && <p className="mb-3 text-[9.5px] text-(--ink-3)">Loading local FairX catalog…</p>}
      <MarketWorkspace
        initialMarket={market}
        initialOrders={marketOrders}
        onMarketUpdate={upsertMarket}
        onOrderCreated={addOrder}
        onReceiptCreated={addReceipt}
      />
    </FairXShell>
  );
}
