"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, CircleAlert, ExternalLink, Loader2, Rocket, ShieldAlert, ShieldCheck } from "lucide-react";
import type { FairXMarket } from "@/lib/markets/fairx";
import { cloneFairXMarket } from "@/lib/markets/fairx";
import { buildOnChainOrderReceipt } from "@/lib/proof/onchainReceipt";
import { encodeReceiptForUrl } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof } from "@/lib/receipts/types";

type InitResponse = {
  ok: boolean;
  configured: boolean;
  programId: string;
  marketPda?: string;
  marketConfigPda?: string;
  marketType?: FairXMarket["type"];
  fixtureIdHash?: string;
  marketTitleHash?: string;
  materialityConfigHash?: string;
  settlementConfigHash?: string;
  oracleAuthority?: string;
  signature?: string;
  reason?: string;
};

type OrderResponse = {
  ok: boolean;
  configured: boolean;
  programId: string;
  marketPda?: string;
  orderPda?: string;
  vaultPda?: string;
  signatures: string[];
  explorerUrls: string[];
  verdict?: string;
  edgeMicros?: number;
  settlementDestination?: "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT";
  sourceEventHash?: string;
  proof?: OnChainProof;
  reason?: string;
};

type CustomMode = "local_simulation" | "devnet_initialized" | "devnet_settled";

type PlacedOrder = { side: "YES" | "NO"; response: OrderResponse; receipt: LineGuardReceipt };

const PROGRAM_ID = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";

export function CustomMarketDevnetInit({ market, onMarketUpdate }: { market: FairXMarket; onMarketUpdate?: (market: FairXMarket) => void }) {
  const [busy, setBusy] = useState(false);
  const [placing, setPlacing] = useState<"YES" | "NO" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const initialized = market.onChain?.initialized === true && market.onChain.cluster === "devnet" && Boolean(market.onChain.marketConfigPda);
  const mode: CustomMode = orders.length > 0 ? "devnet_settled" : initialized ? "devnet_initialized" : "local_simulation";

  const initialize = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/solana/lineguard/initialize-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          marketType: market.type,
          marketTitle: market.title,
          fixtureId: market.fixtureId ?? `custom:${market.id}`,
          materialityRules: market.materialityRules,
          backedTeam: market.backedTeam,
          targetSide: market.targetSide,
          displayedPriceMicros: Math.round(market.displayedPrice * 1_000_000),
          fairPriceMicros: Math.round(market.fairPrice * 1_000_000),
          toleranceMicros: Math.round(market.tolerance * 1_000_000),
        }),
      });
      const data = (await res.json()) as InitResponse;
      if (!data.ok || !data.marketPda) {
        setError(data.reason ?? "Devnet operator not configured.");
        return;
      }
      const next = cloneFairXMarket(market);
      next.onChain = {
        initialized: true,
        marketPda: data.marketPda,
        marketConfigPda: data.marketConfigPda,
        marketType: data.marketType,
        fixtureIdHash: data.fixtureIdHash,
        marketTitleHash: data.marketTitleHash,
        materialityConfigHash: data.materialityConfigHash,
        settlementConfigHash: data.settlementConfigHash,
        oracleAuthority: data.oracleAuthority,
        cluster: "devnet",
        programId: data.programId || PROGRAM_ID,
        txSignatures: data.signature ? [data.signature] : next.onChain?.txSignatures,
      };
      onMarketUpdate?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Devnet initialization failed.");
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async (side: "YES" | "NO") => {
    if (placing) return;
    setPlacing(side);
    setError(null);
    try {
      const res = await fetch("/api/solana/lineguard/custom-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          side,
          marketType: market.type,
          marketTitle: market.title,
          fixtureId: market.fixtureId ?? `custom:${market.id}`,
          materialityRules: market.materialityRules,
          backedTeam: market.backedTeam,
          targetSide: market.targetSide,
          displayedPriceMicros: Math.round(market.displayedPrice * 1_000_000),
          toleranceMicros: Math.round(market.tolerance * 1_000_000),
        }),
      });
      const data = (await res.json()) as OrderResponse;
      if (!data.ok || !data.proof) {
        setError(data.reason ?? "Devnet order failed.");
        return;
      }
      const receipt = buildOnChainOrderReceipt({
        marketId: market.id,
        marketTitle: market.title,
        fixtureId: market.fixtureId ?? `custom:${market.id}`,
        side,
        proof: data.proof,
      });
      setOrders((current) => [{ side, response: data, receipt }, ...current].slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Devnet order failed.");
    } finally {
      setPlacing(null);
    }
  };

  return (
    <section className="card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-(--blue)" />
          <span className="section-label">Devnet execution</span>
        </div>
        <ModeBadge mode={mode} />
      </div>

      {!initialized ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-[10.5px] leading-relaxed text-(--ink-2)">
            Create this market&rsquo;s <span className="mono">MarketState</span> and config commitment on Solana devnet. The title, fixture,
            materiality rules, settlement rules, tolerance, and allowed sides are committed without storing long strings.
          </p>
          <button
            type="button"
            onClick={initialize}
            disabled={busy}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-(--ink) px-3 text-[11px] font-bold text-white transition-colors hover:bg-[#273244] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {busy ? "Initializing on devnet…" : "Initialize on devnet"}
          </button>
          <p className="text-[9px] leading-relaxed text-(--ink-3)">Modes: <span className="mono">local_simulation</span> → <span className="mono">devnet_initialized</span> → <span className="mono">devnet_settled</span>.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 text-[10.5px]">
          <div className="rounded-md border border-[#bce6d5] bg-(--green-bg) p-2.5 leading-relaxed text-(--green)">
            <p className="flex items-center gap-1.5 font-bold"><ShieldCheck className="h-3.5 w-3.5" /> Market config committed on-chain</p>
            <p className="mt-1 text-[10px] text-[#337e68]">
              {orders.length > 0
                ? "This market is devnet-settled — the order below sent real place + evaluate transactions to the on-chain guard."
                : "Place a real devnet order to route it through the on-chain guard (init market → ingest → place → evaluate)."}
            </p>
          </div>
          <InfoRow label="Market PDA" value={market.onChain?.marketPda ?? "—"} />
          <InfoRow label="Config PDA" value={market.onChain?.marketConfigPda ?? "—"} />
          <InfoRow label="Title hash" value={market.onChain?.marketTitleHash ?? "—"} />
          <InfoRow label="Materiality config hash" value={market.onChain?.materialityConfigHash ?? "—"} />
          <InfoRow label="Settlement config hash" value={market.onChain?.settlementConfigHash ?? "—"} />
          <InfoRow label="Oracle authority" value={market.onChain?.oracleAuthority ?? "operator-controlled"} />
          <p className="rounded-md border border-(--blue)/20 bg-(--blue-bg) px-2.5 py-2 text-[9.5px] text-(--ink-2)">Event hash committed by authority. This is oracle authority controlled, not a production decentralized oracle.</p>
          {market.onChain?.txSignatures?.[0] && (
            <a href={`https://explorer.solana.com/tx/${market.onChain.txSignatures[0]}?cluster=devnet`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-(--blue) hover:underline">
              Open initialize tx <ArrowUpRight className="h-3 w-3" />
            </a>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => placeOrder("YES")}
              disabled={placing !== null}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#f0c5c5] bg-(--red-bg) px-2 text-[10.5px] font-bold text-(--red) hover:border-[#e29a9a] disabled:opacity-50"
            >
              {placing === "YES" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              Place YES on devnet
            </button>
            <button
              type="button"
              onClick={() => placeOrder("NO")}
              disabled={placing !== null}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#bfe0f4] bg-(--blue-bg) px-2 text-[10.5px] font-bold text-(--blue) hover:border-[#94c2e8] disabled:opacity-50"
            >
              {placing === "NO" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Place NO on devnet
            </button>
          </div>
          {placing && <p className="flex items-center gap-1.5 text-[10px] text-(--ink-2)"><Loader2 className="h-3 w-3 animate-spin" /> Sending devnet order… a few seconds.</p>}

          {orders.map((order) => (
            <OrderResult key={order.receipt.receiptId} order={order} />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-md border border-[#f1d59b] bg-(--amber-bg) px-2.5 py-2 text-[10px] leading-relaxed text-[#9b650d]">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}

function OrderResult({ order }: { order: PlacedOrder }) {
  const r = order.response;
  const refunded = r.settlementDestination === "REFUNDED_TO_TRADER";
  return (
    <div className={`rounded-md border p-2.5 ${refunded ? "border-[#f0c5c5] bg-[#fffafa]" : "border-[#bfe0f4] bg-[#fafcff]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${refunded ? "bg-(--red-bg) text-(--red)" : "bg-(--blue-bg) text-(--blue)"}`}>{order.side} · {r.verdict}</span>
        <span className="mono text-[9px] text-(--ink-3)">{r.settlementDestination}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {r.explorerUrls.map((url, index) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-(--blue)/25 bg-white px-1.5 py-0.5 text-[9px] font-bold text-(--blue) hover:opacity-80">
            tx {index + 1} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ))}
      </div>
      <Link href={`/verify/${order.receipt.receiptId}?r=${encodeReceiptForUrl(order.receipt)}`} className="mt-1.5 inline-flex items-center gap-1 text-[9.5px] font-bold text-(--blue) hover:underline">
        Verify devnet receipt <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function ModeBadge({ mode }: { mode: CustomMode }) {
  const map = {
    local_simulation: { label: "local_simulation", cls: "border-[#f0d39a] bg-(--amber-bg) text-(--amber)" },
    devnet_initialized: { label: "devnet_initialized", cls: "border-[#bce6d5] bg-(--green-bg) text-(--green)" },
    devnet_settled: { label: "devnet_settled", cls: "border-[#cddcf5] bg-(--blue-bg) text-(--blue)" },
  } as const;
  const m = map[mode];
  return <span className={`mono rounded-full border px-2 py-0.5 text-[9px] font-bold ${m.cls}`}>{m.label}</span>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-(--ink-3)">{label}</span>
      <span className="mono min-w-0 break-all text-right text-(--ink-2)">{value}</span>
    </div>
  );
}
