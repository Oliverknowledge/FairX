import type { Metadata } from "next";
import { FairXShell } from "@/components/fairx/FairXShell";
import { MarketCard } from "@/components/fairx/MarketCard";
import { getMarketById } from "@/lib/markets/catalog";

export const metadata: Metadata = {
  title: "Markets",
  description: "Genuine TxLINE-backed prediction markets protected by LineGuard.",
};

export default function MarketsPage() {
  const market = getMarketById("france-morocco-france-win");
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[980px]">
        <header className="py-5 sm:py-9">
          <p className="text-[11px] font-bold text-(--blue)">Devnet markets</p>
          <h1 className="mt-2 text-[38px] font-extrabold tracking-[-0.055em] sm:text-[52px]">Markets</h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-(--ink-2)">Inspect the archived resolved football market. New orders are unavailable because trading is closed.</p>
        </header>
        {market && <div className="max-w-xl"><MarketCard market={market} /></div>}
        <p className="mt-5 text-[11px] text-(--ink-3)">Only the audited MATCH_WINNER_HOME_V1 market is shown. No seeded or unsupported markets appear here.</p>
      </div>
    </FairXShell>
  );
}
