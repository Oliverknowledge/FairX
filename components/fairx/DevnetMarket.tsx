"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ArrowUpRight, CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert, WalletCards } from "lucide-react";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import { CanonicalV2Settlement } from "@/components/fairx-proof/CanonicalV2Settlement";
import { canonicalV2Lifecycle } from "@/lib/proof/v2Lifecycle";
import {
  CANONICAL_V2_MARKET_LABEL,
  buildOrderTransaction,
  deriveMarketV2Pda,
  explorerTransaction,
  fetchTraderPositions,
  fetchV2MarketSnapshot,
  parsePosition,
  prepareAndSimulate,
  type PositionV2State,
  type V2MarketSnapshot,
  type V2Side,
} from "@/lib/solana/lineguardV2";

type SubmissionState = "IDLE" | "SIMULATING" | "AWAITING_SIGNATURE" | "CONFIRMING" | "POSITION_OPENED" | "REFUNDED" | "ERROR";

const FALLBACK_FAIR = canonicalCapture.odds.normalizedPricingInput.fairPriceMicros;

function sol(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toLocaleString("en-GB", { maximumFractionDigits: 5 })} SOL`;
}

function pct(micros: number): string {
  return `${(micros / 10_000).toFixed(2)}%`;
}

function short(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function DevnetMarket() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [snapshot, setSnapshot] = useState<V2MarketSnapshot | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionV2State[]>([]);
  const [side, setSide] = useState<V2Side>("YES");
  const [stake, setStake] = useState("0.01");
  const [state, setState] = useState<SubmissionState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchV2MarketSnapshot(connection);
    setSnapshot(next);
    if (wallet.publicKey) {
      const [nextBalance, nextPositions] = await Promise.all([
        connection.getBalance(wallet.publicKey, "confirmed"),
        fetchTraderPositions(connection, wallet.publicKey),
      ]);
      setBalance(nextBalance);
      setPositions(nextPositions.filter((position) => position.market === next.marketPda));
    } else {
      setBalance(null);
      setPositions([]);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [refresh]);

  const market = snapshot?.market;
  const vault = snapshot?.vault;
  const displayedYes = market?.displayedPriceMicros ?? canonicalCapture.odds.normalizedPricingInput.fairPriceMicros;
  const fairYes = market?.fairPriceMicros ?? FALLBACK_FAIR;
  const sidePrice = side === "YES" ? displayedYes : 1_000_000 - displayedYes;
  const fairSide = side === "YES" ? fairYes : 1_000_000 - fairYes;
  const edge = fairSide - sidePrice;
  const stakeLamports = Math.round(Number(stake) * LAMPORTS_PER_SOL);
  const sideShares = side === "YES" ? (market?.yesShares ?? 0) : (market?.noShares ?? 0);
  const totalPool = (market?.yesPoolLamports ?? 0) + (market?.noPoolLamports ?? 0);
  const newShares = sidePrice > 0 ? Math.floor((stakeLamports * 1_000_000) / sidePrice) : 0;
  const estimatedPayout = stakeLamports > 0 && newShares > 0
    ? (newShares * (totalPool + stakeLamports)) / (sideShares + newShares)
    : 0;
  const currentPosition = positions.find((position) => position.side === side);
  const stale = market ? market.materialSeq > market.pricedAtSeq : false;
  const wouldRefund = stale && edge > (market?.toleranceMicros ?? 20_000);
  const ready = Boolean(wallet.publicKey && snapshot?.deployed && market && !market.tradingClosed && !market.resolved && stakeLamports > 0);

  const submit = async () => {
    if (!wallet.publicKey || !wallet.sendTransaction || !market || !snapshot?.deployed) return;
    setError(null);
    setSignature(null);
    try {
      if (!Number.isSafeInteger(stakeLamports) || stakeLamports <= 0) throw new Error("Enter a positive Devnet SOL stake.");
      if (balance !== null && stakeLamports >= balance) throw new Error("Insufficient Devnet SOL for stake, rent, and transaction fee.");
      const marketKey = new PublicKey(market.address);
      const currentSlot = await connection.getSlot("confirmed");
      const previousAccepted = currentPosition?.acceptedLamports ?? 0;
      const built = buildOrderTransaction({
        trader: wallet.publicKey,
        market: marketKey,
        side,
        stakeLamports: BigInt(stakeLamports),
        maxAcceptedEdgeMicros: BigInt(market.toleranceMicros),
        expectedExecutionPriceMicros: BigInt(sidePrice),
        maxSlippageMicros: 5_000n,
        expectedPricingSequence: BigInt(market.pricedAtSeq),
        expectedOddsSequence: BigInt(market.oddsSequence),
        expirySlot: BigInt(currentSlot + 150),
      });
      setState("SIMULATING");
      await prepareAndSimulate(connection, built.transaction, wallet.publicKey);
      setState("AWAITING_SIGNATURE");
      const tx = await wallet.sendTransaction(built.transaction, connection, { skipPreflight: false, preflightCommitment: "confirmed" });
      setSignature(tx);
      setState("CONFIRMING");
      const confirmation = await connection.confirmTransaction(tx, "finalized");
      if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      const positionInfo = await connection.getAccountInfo(built.positionPda, "finalized");
      if (!positionInfo) throw new Error("Position account was not readable after finalization.");
      const finalizedPosition = parsePosition(built.positionPda, Buffer.from(positionInfo.data));
      setState(finalizedPosition.acceptedLamports > previousAccepted ? "POSITION_OPENED" : "REFUNDED");
      await refresh();
    } catch (cause) {
      setState("ERROR");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="border-b border-(--border) bg-[#0d1b35] px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-200">
                <span>Football</span><span>•</span><span>TxLINE historical</span><span>•</span><span>Devnet SOL only</span>
              </div>
              <p className="mt-3 text-[14px] font-semibold text-blue-100">France vs Morocco</p>
              <h1 className="mt-1 text-[30px] font-bold tracking-[-0.045em] sm:text-[40px]">Will France win?</h1>
              <p className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-blue-200"><ShieldCheck className="h-4 w-4" />Archived settled v2 market</p>
            </div>
            <WalletMultiButton className="!h-10 !rounded-md !bg-[#2563eb] !px-4 !text-[11px] !font-semibold" />
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="YES probability" value={pct(displayedYes)} accent />
              <Metric label="NO probability" value={pct(1_000_000 - displayedYes)} />
              <Metric label="Accepted collateral" value={vault ? sol(vault.totalAccepted) : sol(canonicalV2Lifecycle.market.acceptedCollateralLamports)} />
              <Metric label="Market state" value={!market || market.resolved ? "Resolved · YES" : stale ? "Price update pending" : "Synchronized"} good={Boolean(!market || market.resolved || !stale)} />
            </div>

            <section>
              <div className="flex items-center justify-between">
                <p className="section-label">Genuine TxLINE odds history</p>
                <span className="text-[10px] text-(--ink-3)">StablePrice de-margined · part1</span>
              </div>
              <div className="mt-3 rounded-lg border border-(--border) bg-[#f8faff] p-4">
                <svg viewBox="0 0 620 170" className="h-[180px] w-full" role="img" aria-label="France implied probability changed from 52.274 percent to 86.505 percent">
                  {[30, 70, 110, 150].map((y) => <line key={y} x1="40" x2="600" y1={y} y2={y} stroke="#dbe4f3" strokeWidth="1" />)}
                  <path d="M60 112 C180 112 250 108 310 106 S390 42 560 35" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="60" cy="112" r="6" fill="#2563eb" /><circle cx="560" cy="35" r="6" fill="#2563eb" />
                  <text x="48" y="135" fontSize="12" fill="#64748b">52.274%</text><text x="515" y="25" fontSize="12" fill="#2563eb">86.505%</text>
                  <line x1="310" x2="310" y1="20" y2="150" stroke="#d97706" strokeDasharray="4 4" />
                  <text x="320" y="92" fontSize="11" fill="#92400e">France goal</text>
                </svg>
              </div>
            </section>

            <section className="rounded-xl border border-(--border) bg-white p-4"><p className="section-label">Match state</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label="Source" value="TxLINE historical" /><Metric label="Final score" value="France 1–0 Morocco" /><Metric label="LineGuard" value="Market synchronized" good /></div></section>

            <details className="rounded-xl border border-(--border) bg-white p-4"><summary className="cursor-pointer text-[11px] font-bold">Technical details</summary><section className="mt-4 grid gap-3 sm:grid-cols-2"><EvidenceRow title="Pricing evidence" detail={`Raw payload ${canonicalCapture.odds.rawPayloadHash.slice(0, 12)}… → 86.505% using txline-demargined-pct-v1.`} /><EvidenceRow title="Resolution template" detail="MATCH_WINNER_HOME_V1 · stat keys 1/2 · outcome derived inside LineGuard." /><EvidenceRow title="Vault isolation" detail={snapshot?.vault ? `${short(snapshot.vault.address)} · ${sol(snapshot.vault.lamports)}` : `Expected PDA ${short(snapshot?.vaultPda ?? deriveMarketV2Pda().toBase58())}`} /><EvidenceRow title="Resolution assurance" detail="v2 requires TxLINE ValidateStatV2 success plus threshold approval before execution." /></section></details>

            {!snapshot?.deployed && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900"><strong>Canonical settled evidence loaded.</strong> Devnet RPC hydration is still loading or unavailable; the durable public receipt remains visible below.</div>}
          </div>

          <aside className="border-t border-(--border) bg-[#fbfcfe] p-5 lg:border-l lg:border-t-0">
            <div className="flex rounded-lg bg-[#eef2f7] p-1">
              {(["YES", "NO"] as const).map((choice) => (
                <button key={choice} disabled={Boolean(market?.resolved)} onClick={() => setSide(choice)} className={`h-10 flex-1 rounded-md text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-60 ${side === choice ? choice === "YES" ? "bg-[#167d5a] text-white shadow-sm" : "bg-[#c2413b] text-white shadow-sm" : "text-(--ink-2)"}`}>{market?.resolved ? choice : `Buy ${choice}`}</button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[10px] font-semibold text-(--ink-2)">Stake · Devnet SOL</span>
                <div className="mt-1 flex h-12 items-center rounded-lg border border-(--border) bg-white px-3">
                  <input disabled={Boolean(market?.resolved)} value={stake} onChange={(event) => setStake(event.target.value)} inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-[20px] font-bold outline-none disabled:text-slate-400" aria-label="Stake in Devnet SOL" />
                  <span className="text-[11px] font-semibold text-(--ink-3)">SOL</span>
                </div>
              </label>
              <TicketLine label="Current probability" value={pct(sidePrice)} />
              <TicketLine label="Pool payout estimate" value={market?.resolved ? "Market settled" : snapshot?.deployed ? sol(Math.round(estimatedPayout)) : "RPC loading"} />
              <TicketLine label="LineGuard" value={market?.resolved || !market ? "Market settled" : wouldRefund ? "Stale-price exploit detected" : "Market synchronized"} good={!wouldRefund} warning={wouldRefund} />
              <TicketLine label="Network" value="Solana Devnet" warning />
            </div>

              <details className="mt-4 rounded-lg border border-(--border) bg-white p-3"><summary className="cursor-pointer text-[10.5px] font-bold">Technical order details</summary><div className="mt-3 space-y-2"><TicketLine label="Fair probability" value={pct(fairSide)} /><TicketLine label="Signed execution quote" value={pct(sidePrice)} /><TicketLine label="Maximum slippage" value="0.50%" /><TicketLine label="Pool shares" value={newShares.toLocaleString("en-GB")} /><TicketLine label="Maximum accepted edge" value={pct(market?.toleranceMicros ?? 20_000)} /><TicketLine label="Market PDA" value={short(snapshot?.marketPda ?? deriveMarketV2Pda().toBase58())} mono /><TicketLine label="Expected destination" value={market?.resolved ? "Settled · no new orders" : snapshot?.deployed ? (wouldRefund ? "Connected wallet" : "Market vault + position") : "RPC loading"} /></div></details>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[10.5px] leading-relaxed text-blue-900">
              <div className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>The app builds transactions with a Devnet blockhash. Confirm “Devnet” in your wallet preview; reconnect if the wallet warns about another network.</span></div>
            </div>

            {wallet.publicKey ? (
              <div className="mt-3 rounded-lg border border-(--border) bg-white p-3 text-[10.5px]">
                <div className="flex items-center justify-between"><span className="text-(--ink-3)">Transaction signed by</span><span className="mono font-semibold">{short(wallet.publicKey.toBase58())}</span></div>
                <div className="mt-1 flex items-center justify-between"><span className="text-(--ink-3)">Wallet balance</span><span className="font-semibold">{balance === null ? "Loading…" : sol(balance)}</span></div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-(--border) bg-white p-3 text-[10.5px] text-(--ink-2)"><WalletCards className="h-4 w-4" />Connect Phantom, Solflare, or another compatible wallet.</div>
            )}

            <button disabled={!ready || state === "SIMULATING" || state === "AWAITING_SIGNATURE" || state === "CONFIRMING"} onClick={() => void submit()} className="mt-4 h-11 w-full rounded-lg bg-(--blue) text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {market?.resolved ? "MARKET RESOLVED" : state === "SIMULATING" ? "SIMULATING SAFETY CHECK…" : state === "AWAITING_SIGNATURE" ? "CONFIRM IN WALLET…" : state === "CONFIRMING" ? "CHECKING FAIRNESS…" : `Buy ${side} with Devnet SOL`}
            </button>

            {(state === "POSITION_OPENED" || state === "REFUNDED") && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 className="mr-1.5 inline h-4 w-4" />{state === "REFUNDED" ? "STALE EDGE DETECTED → REFUNDED" : "POSITION OPENED ON-CHAIN"}
              </div>
            )}
            {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[10.5px] leading-relaxed text-red-800">{error}</p>}
            {signature && <a href={explorerTransaction(signature)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-(--blue)">View user-signed transaction <ArrowUpRight className="h-3.5 w-3.5" /></a>}

            {currentPosition && (
              <div className="mt-4 border-t border-(--border) pt-4">
                <p className="section-label">Your on-chain {side} position</p>
                <div className="mt-2 space-y-1.5"><TicketLine label="Accepted" value={sol(currentPosition.acceptedLamports)} /><TicketLine label="Average entry" value={pct(currentPosition.entryPriceMicros)} /><TicketLine label="Claimed" value={currentPosition.claimed ? "Yes" : "No"} /></div>
                <Link href="/portfolio" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-(--blue)">Open portfolio <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
          </aside>
        </div>

        <div className="border-t border-(--border) p-4 sm:p-6">
          <CanonicalV2Settlement connectedWallet={wallet.publicKey?.toBase58()} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-(--ink-3)">
        <span>FairX is designed to prevent stale-price exploitation and make every market decision independently auditable.</span>
        <button onClick={() => void refresh()} className="inline-flex items-center gap-1 font-semibold text-(--blue)"><RefreshCw className="h-3.5 w-3.5" />Refresh on-chain state</button>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false, good = false }: { label: string; value: string; accent?: boolean; good?: boolean }) {
  return <div className="rounded-lg border border-(--border) bg-white p-3"><p className="text-[9.5px] text-(--ink-3)">{label}</p><p className={`mt-1 text-[17px] font-bold ${accent ? "text-(--blue)" : good ? "text-(--green)" : "text-(--ink)"}`}>{value}</p></div>;
}

function TicketLine({ label, value, good = false, warning = false, mono = false }: { label: string; value: string; good?: boolean; warning?: boolean; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-4 text-[10.5px]"><span className="text-(--ink-3)">{label}</span><span className={`${mono ? "mono " : ""}font-semibold ${good ? "text-(--green)" : warning ? "text-(--amber)" : "text-(--ink)"}`}>{value}</span></div>;
}

function EvidenceRow({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-(--border) p-3"><div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-(--ink)"><ShieldCheck className="h-3.5 w-3.5 text-(--green)" />{title}</div><p className="mt-1.5 text-[10px] leading-relaxed text-(--ink-2)">{detail}</p></div>;
}
