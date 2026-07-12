"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ArrowUpRight, CheckCircle2, ShieldCheck, WalletCards } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import {
  buildClaimTransaction,
  explorerAddress,
  explorerTransaction,
  fetchTraderPositions,
  fetchV2MarketSnapshot,
  prepareAndSimulate,
  type MarketV2State,
  type PositionV2State,
} from "@/lib/solana/lineguardV2";

function sol(value: number): string {
  return `${(value / LAMPORTS_PER_SOL).toLocaleString("en-GB", { maximumFractionDigits: 6 })} SOL`;
}

export default function PortfolioPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [positions, setPositions] = useState<PositionV2State[]>([]);
  const [markets, setMarkets] = useState<Record<string, MarketV2State>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) {
      setPositions([]);
      setMarkets({});
      return;
    }
    const [nextPositions, canonical] = await Promise.all([
      fetchTraderPositions(connection, wallet.publicKey),
      fetchV2MarketSnapshot(connection),
    ]);
    setPositions(nextPositions);
    setMarkets(canonical.market ? { [canonical.market.address]: canonical.market } : {});
  }, [connection, wallet.publicKey]);

  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : String(error))); }, [refresh]);

  const claim = async (position: PositionV2State) => {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setClaiming(position.address);
    setMessage(null);
    try {
      const transaction = buildClaimTransaction({ trader: wallet.publicKey, market: new PublicKey(position.market), position: new PublicKey(position.address) });
      await prepareAndSimulate(connection, transaction, wallet.publicKey);
      const signature = await wallet.sendTransaction(transaction, connection, { skipPreflight: false, preflightCommitment: "confirmed" });
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) throw new Error(JSON.stringify(confirmation.value.err));
      setMessage(`Claim confirmed: ${explorerTransaction(signature)}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <FairXShell>
      <section className="flex flex-col gap-4 border-b border-(--border) pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-label">Wallet-owned on-chain state</p><h1 className="mt-2 text-[30px] font-bold tracking-[-0.05em]">Portfolio</h1><p className="mt-2 text-[11.5px] text-(--ink-2)">Only Position PDAs owned by the connected wallet are shown. No seeded positions.</p></div>
        <WalletMultiButton className="!h-10 !rounded-md !bg-[#2563eb] !px-4 !text-[11px] !font-semibold" />
      </section>

      {!wallet.publicKey ? (
        <div className="card mt-5 flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center"><WalletCards className="h-8 w-8 text-(--blue)" /><p className="font-semibold">Connect a wallet to read its devnet positions.</p><p className="text-[10.5px] text-(--ink-3)">Phantom, Solflare, and compatible Wallet Standard wallets are supported.</p></div>
      ) : positions.length === 0 ? (
        <div className="card mt-5 p-6 text-center"><p className="font-semibold">No LineGuard v2 positions found for this wallet.</p><p className="mt-2 text-[10.5px] text-(--ink-3)">Refunded-only position shells may appear after the v2 market is deployed and used.</p></div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {positions.map((position) => {
            const market = markets[position.market];
            const refunded = position.depositedLamports - position.acceptedLamports;
            const won = market?.resolution === 3 || (market?.resolution === 1 && position.side === "YES") || (market?.resolution === 2 && position.side === "NO");
            const claimable = Boolean(market?.resolved && won && !position.claimed && position.acceptedLamports > 0);
            return (
              <article key={position.address} className="card p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="section-label">France vs Morocco · {position.side}</p><h2 className="mt-1 text-[17px] font-bold">{position.acceptedLamports > 0 ? "On-chain position" : "Refunded order record"}</h2></div><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${position.claimed ? "bg-slate-100 text-slate-600" : claimable ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{position.claimed ? "CLAIMED" : claimable ? "CLAIMABLE" : market?.resolved ? "SETTLED" : "OPEN"}</span></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[10.5px]"><Stat label="Deposited" value={sol(position.depositedLamports)} /><Stat label="Accepted" value={sol(position.acceptedLamports)} /><Stat label="Refunded" value={sol(refunded)} /><Stat label="Average entry" value={`${(position.entryPriceMicros / 10_000).toFixed(2)}%`} /></dl>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-(--border) pt-3">
                  <a href={explorerAddress(position.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-(--blue)">Position PDA <ArrowUpRight className="h-3 w-3" /></a>
                  {claimable && <button disabled={claiming === position.address} onClick={() => void claim(position)} className="ml-auto h-8 rounded-md bg-(--green) px-3 text-[10px] font-semibold text-white disabled:opacity-50">{claiming === position.address ? "Simulating…" : "Claim Devnet SOL"}</button>}
                  {position.claimed && <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-(--green)"><CheckCircle2 className="h-3.5 w-3.5" />Payout claimed</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {message && <p className="mt-4 break-all rounded-lg border border-(--border) bg-white p-3 text-[10.5px] text-(--ink-2)">{message}</p>}
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[10.5px] text-blue-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Claims are signed by the position owner. A market vault can pay only positions whose PDA is bound to that same market and trader.</div>
    </FairXShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-[#f7f8fa] p-2.5"><dt className="text-(--ink-3)">{label}</dt><dd className="mt-1 font-semibold text-(--ink)">{value}</dd></div>;
}
