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
import { FRANCE_MOROCCO_MARKET, type SupportedMarket } from "@/lib/markets/supportedMarkets";
import {
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

export function DevnetMarket({ config = FRANCE_MOROCCO_MARKET }: { config?: SupportedMarket } = {}) {
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
    const next = await fetchV2MarketSnapshot(connection, config.label);
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
  }, [connection, wallet.publicKey, config.label]);

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [refresh]);

  const market = snapshot?.market;
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

  // The trading ticket only renders for a genuinely open on-chain market. The
  // deployed canonical market is settled, so the resolved result card leads.
  const showTicket = Boolean(snapshot?.deployed && market && !market.resolved && !market.tradingClosed);
  // Only markets with a durable settled lifecycle fixture show the result card +
  // technical evidence. A prepared-but-undeployed market shows an honest state.
  const hasEvidence = config.hasLifecycleEvidence;
  const notDeployed = snapshot !== null && !snapshot.deployed;
  const L = canonicalV2Lifecycle;
  const scoreLine = `${L.txline.homeTeam} ${L.txline.homeScore}–${L.txline.awayScore} ${L.txline.awayTeam}`;

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
                <span>Football</span><span>•</span><span>Historical TxLINE evidence</span><span>•</span><span>Devnet SOL only</span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-blue-100"><span aria-hidden>{config.homeFlag}</span>{config.matchLabel}<span aria-hidden>{config.awayFlag}</span></p>
              <h1 className="mt-1 text-[30px] font-bold tracking-[-0.045em] sm:text-[40px]">{config.title}</h1>
              {showTicket ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Open for trading</p>
              ) : hasEvidence ? (
                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Resolved</span>
                  <span className="text-blue-100">{scoreLine}</span>
                  <span className="text-emerald-300">Winner: {config.homeTeam} (YES)</span>
                </div>
              ) : (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Pending deployment</p>
              )}
            </div>
            {showTicket && <WalletMultiButton className="!h-10 !rounded-md !bg-[#2563eb] !px-4 !text-[11px] !font-semibold" />}
          </div>
        </div>

        {!hasEvidence && !showTicket ? (
          <MarketNotDeployed config={config} marketPda={snapshot?.marketPda ?? null} loading={snapshot === null} />
        ) : (
        <>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="YES" value={pct(displayedYes)} accent />
              <Metric label="NO" value={pct(1_000_000 - displayedYes)} />
              {showTicket
                ? <Metric label="Price" value={stale ? "Update pending" : "Up to date"} good={!stale} warning={stale} />
                : <Metric label="Final score" value={scoreLine} good />}
            </div>

            {hasEvidence && (
            <section>
              <div className="flex items-center justify-between">
                <p className="section-label">Price history</p>
                <span className="text-[10px] text-(--ink-3)">France goal repriced YES 52¢ → 86¢</span>
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
            )}
          </div>

          {showTicket ? (
            <aside className="border-t border-(--border) bg-[#fbfcfe] p-5 lg:border-l lg:border-t-0">
              <div className="flex rounded-lg bg-[#eef2f7] p-1">
                {(["YES", "NO"] as const).map((choice) => (
                  <button key={choice} onClick={() => setSide(choice)} className={`h-10 flex-1 rounded-md text-[12px] font-bold ${side === choice ? choice === "YES" ? "bg-[#167d5a] text-white shadow-sm" : "bg-[#c2413b] text-white shadow-sm" : "text-(--ink-2)"}`}>{`Buy ${choice}`}</button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[10px] font-semibold text-(--ink-2)">Stake · Devnet SOL</span>
                  <div className="mt-1 flex h-12 items-center rounded-lg border border-(--border) bg-white px-3">
                    <input value={stake} onChange={(event) => setStake(event.target.value)} inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-[20px] font-bold outline-none" aria-label="Stake in Devnet SOL" />
                    <span className="text-[11px] font-semibold text-(--ink-3)">SOL</span>
                  </div>
                </label>
                <TicketLine label="Current probability" value={pct(sidePrice)} />
                <TicketLine label="Est. payout" value={sol(Math.round(estimatedPayout))} />
                <TicketLine label="Protection" value={wouldRefund ? "Stale-price exploit detected" : "Price up to date"} good={!wouldRefund} warning={wouldRefund} />
                <TicketLine label="Network" value="Solana Devnet" warning />
              </div>

              <details className="mt-4 rounded-lg border border-(--border) bg-white p-3"><summary className="cursor-pointer text-[10.5px] font-bold">Technical order details</summary><div className="mt-3 space-y-2"><TicketLine label="Fair probability" value={pct(fairSide)} /><TicketLine label="Signed execution quote" value={pct(sidePrice)} /><TicketLine label="Maximum slippage" value="0.50%" /><TicketLine label="Pool shares" value={newShares.toLocaleString("en-GB")} /><TicketLine label="Maximum accepted edge" value={pct(market?.toleranceMicros ?? 20_000)} /><TicketLine label="Market PDA" value={short(snapshot?.marketPda ?? deriveMarketV2Pda(config.label).toBase58())} mono /></div></details>

              {wallet.publicKey && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[10.5px] leading-relaxed text-blue-900">
                  <div className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>The app builds transactions with a Devnet blockhash. Confirm “Devnet” in your wallet preview; reconnect if the wallet warns about another network.</span></div>
                </div>
              )}

              {wallet.publicKey ? (
                <div className="mt-3 rounded-lg border border-(--border) bg-white p-3 text-[10.5px]">
                  <div className="flex items-center justify-between"><span className="text-(--ink-3)">Transaction signed by</span><span className="mono font-semibold">{short(wallet.publicKey.toBase58())}</span></div>
                  <div className="mt-1 flex items-center justify-between"><span className="text-(--ink-3)">Wallet balance</span><span className="font-semibold">{balance === null ? "Loading…" : sol(balance)}</span></div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-(--border) bg-white p-3 text-[10.5px] text-(--ink-2)"><WalletCards className="h-4 w-4" />Connect Phantom, Solflare, or another compatible wallet.</div>
              )}

              <button disabled={!ready || state === "SIMULATING" || state === "AWAITING_SIGNATURE" || state === "CONFIRMING"} onClick={() => void submit()} className="mt-4 h-11 w-full rounded-lg bg-(--blue) text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {state === "SIMULATING" ? "SIMULATING SAFETY CHECK…" : state === "AWAITING_SIGNATURE" ? "CONFIRM IN WALLET…" : state === "CONFIRMING" ? "CHECKING FAIRNESS…" : `Buy ${side} with Devnet SOL`}
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
          ) : (
            <aside className="border-t border-(--border) bg-[#fbfcfe] p-5 sm:p-6 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between">
                <p className="section-label">Result</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-(--green-bg) px-2 py-0.5 text-[10px] font-bold text-(--green)"><ShieldCheck className="h-3 w-3" />Resolved</span>
              </div>
              <p className="mt-2 text-[24px] font-extrabold tracking-[-0.04em] text-(--ink)">France won <span className="text-(--green)">· YES</span></p>

              <dl className="mt-5 space-y-2.5">
                <ResultRow label="Official score" value={scoreLine} />
                <ResultRow label="Accepted stake" value={sol(L.lifecycle.acceptedStakeLamports)} />
                <ResultRow label="Stale order refunded" value={sol(L.lifecycle.refundedStakeLamports)} good />
                <ResultRow label="Gross payout" value={sol(L.lifecycle.claimedPayoutLamports)} />
                <ResultRow label="Net profit" value={sol(L.lifecycle.claimedPayoutLamports - L.lifecycle.acceptedStakeLamports)} />
                <ResultRow label="Protection" value="Complete" good />
                <ResultRow label="TxLINE verification" value="Verified" good />
              </dl>

              <p className="mt-3 rounded-lg bg-[#f1f5f9] p-2.5 text-[10px] leading-relaxed text-(--ink-2)">Net profit is 0 because the exploit was refunded — there was no stale-price counterparty left to lose. That is LineGuard working as intended.</p>

              <Link href="/proof" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-(--blue) text-[12px] font-bold text-white transition-colors hover:bg-[#1d4ed8]">
                See verified lifecycle <ArrowUpRight className="h-4 w-4" />
              </Link>
            </aside>
          )}
        </div>

        {hasEvidence && (
        <details className="border-t border-(--border) p-4 sm:p-6">
          <summary className="flex cursor-pointer items-center justify-between text-[11px] font-bold text-(--ink)"><span>Technical evidence</span><button onClick={(event) => { event.preventDefault(); void refresh(); }} className="inline-flex items-center gap-1 font-semibold text-(--blue)"><RefreshCw className="h-3 w-3" />Refresh on-chain state</button></summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <EvidenceRow title="Market account (PDA)" detail={L.market.marketPda} mono />
            <EvidenceRow title="Isolated market vault" detail={`${L.market.marketVaultPda} · holds ${sol(L.vault.rentReserveLamports)} rent reserve`} mono />
            <EvidenceRow title="Winning position (PDA)" detail={`${L.lifecycle.positionPda} · owned by ${short(L.lifecycle.positionOwner)}`} mono />
            <EvidenceRow title="Refunded stale order (PDA)" detail={L.lifecycle.refundedOrderPda} mono />
            <EvidenceRow title="Quote & fixture commitment" detail={`${L.market.template} · fixture ${L.market.fixtureCommitment.slice(0, 16)}…`} mono />
            <EvidenceRow title="TxLINE evidence" detail={`Direct CPI + 2-of-3 approval confirmed ${L.txline.homeTeam} ${L.txline.homeScore}–${L.txline.awayScore} ${L.txline.awayTeam} → ${L.txline.derivedOutcome}.`} />
          </div>
          <div className="mt-3 rounded-lg border border-(--border) bg-white p-3">
            <p className="section-label">Vault accounting</p>
            <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <TicketLine label="Total deposited" value={sol(L.vault.totalDepositedLamports)} />
              <TicketLine label="Refunded" value={sol(L.vault.totalRefundedLamports)} />
              <TicketLine label="Paid to winner" value={sol(L.vault.totalPaidLamports)} />
              <TicketLine label="Rounding dust" value={sol(L.vault.roundingDustLamports)} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <TxLink label="Stale-order refund" url={L.transactions.staleRefund.explorerUrl} />
            <TxLink label="Accepted position" url={L.transactions.acceptedPosition.explorerUrl} />
            <TxLink label="Winner claim" url={L.transactions.claim.explorerUrl} />
            <Link href="/attack-lab" className="text-[10.5px] font-semibold text-(--ink-2) hover:text-(--blue)">Stress test (attack simulation) →</Link>
          </div>
          <div className="mt-4"><CanonicalV2Settlement connectedWallet={wallet.publicKey?.toBase58()} /></div>
        </details>
        )}
        </>
        )}
      </section>

      <p className="text-[10px] text-(--ink-3)">Every trade and payout on this market is independently verifiable on Solana.</p>
    </div>
  );
}

function MarketNotDeployed({ config, marketPda, loading }: { config: SupportedMarket; marketPda: string | null; loading: boolean }) {
  return (
    <div className="p-6 sm:p-10">
      <div className="mx-auto max-w-xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--amber-bg) px-3 py-1 text-[11px] font-bold text-(--amber)"><TriangleAlert className="h-3.5 w-3.5" />{loading ? "Checking on-chain state…" : "Market not deployed"}</span>
        <h2 className="mt-4 text-[24px] font-extrabold tracking-[-0.04em]">{config.matchLabel}</h2>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-(--ink-2)">
          This market is prepared but has not been initialized on-chain yet. It activates only after a single reviewed initialization transaction. No price or liquidity is shown because none exists yet.
        </p>
        <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          <TicketLine label="On-chain label" value={config.label} mono />
          <TicketLine label="Proposed market PDA" value={marketPda ? short(marketPda) : "—"} mono />
          <TicketLine label="TxLINE fixture" value={config.txlineFixtureId} />
          <TicketLine label="Purpose" value={config.purpose} />
        </dl>
        <Link href={`/markets/${FRANCE_MOROCCO_MARKET.slug}`} className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-(--ink) px-5 text-[12px] font-bold text-white">
          View the proven settled market <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false, good = false, warning = false }: { label: string; value: string; accent?: boolean; good?: boolean; warning?: boolean }) {
  return <div className="rounded-lg border border-(--border) bg-white p-3"><p className="text-[9.5px] text-(--ink-3)">{label}</p><p className={`mt-1 text-[17px] font-bold ${accent ? "text-(--blue)" : good ? "text-(--green)" : warning ? "text-(--amber)" : "text-(--ink)"}`}>{value}</p></div>;
}

function TicketLine({ label, value, good = false, warning = false, mono = false }: { label: string; value: string; good?: boolean; warning?: boolean; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-4 text-[10.5px]"><span className="text-(--ink-3)">{label}</span><span className={`${mono ? "mono " : ""}font-semibold ${good ? "text-(--green)" : warning ? "text-(--amber)" : "text-(--ink)"}`}>{value}</span></div>;
}

function EvidenceRow({ title, detail, mono = false }: { title: string; detail: string; mono?: boolean }) {
  return <div className="rounded-lg border border-(--border) p-3"><div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-(--ink)"><ShieldCheck className="h-3.5 w-3.5 text-(--green)" />{title}</div><p className={`mt-1.5 text-[10px] leading-relaxed text-(--ink-2) ${mono ? "mono break-all" : ""}`}>{detail}</p></div>;
}

function ResultRow({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-(--border) pb-2.5 text-[12px] last:border-0 last:pb-0"><dt className="text-(--ink-2)">{label}</dt><dd className={`font-bold ${good ? "text-(--green)" : "text-(--ink)"}`}>{value}</dd></div>;
}

function TxLink({ label, url }: { label: string; url: string }) {
  return <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-(--blue) hover:underline">{label}<ArrowUpRight className="h-3 w-3" /></a>;
}
