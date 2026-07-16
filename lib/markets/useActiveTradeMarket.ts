"use client";

import { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { fetchV2MarketSnapshot } from "@/lib/solana/lineguardV2";
import {
  DEFAULT_TRADE_MARKET,
  FRANCE_SPAIN_MARKET,
  selectActiveTradeMarket,
  type SupportedMarket,
} from "@/lib/markets/supportedMarkets";

// This client hook must never receive a keyed/private RPC URL.
const RPC_URL = "https://api.devnet.solana.com";

/**
 * Resolve the primary Trade destination from verified on-chain state.
 *
 * Renders the resolved France–Morocco proof market immediately (so SSR and the
 * first paint are deterministic), then — in the browser only — reads the
 * France–Spain market account and switches Trade there ONLY if it is verifiably
 * open (`selectActiveTradeMarket`). The decision is derived from the chain, not
 * from an environment variable; the RPC endpoint merely says *where* to look.
 * Uses its own read-only Connection so the hook has no wallet-context dependency
 * (safe to render in tests without a provider). Never sends a transaction.
 */
export function useActiveTradeMarket(): SupportedMarket {
  const [market, setMarket] = useState<SupportedMarket>(DEFAULT_TRADE_MARKET);

  useEffect(() => {
    let cancelled = false;
    const connection = new Connection(RPC_URL, "confirmed");
    fetchV2MarketSnapshot(connection, FRANCE_SPAIN_MARKET.label)
      .then((snapshot) => {
        if (!cancelled) setMarket(selectActiveTradeMarket(snapshot));
      })
      .catch(() => {
        if (!cancelled) setMarket(DEFAULT_TRADE_MARKET);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return market;
}
