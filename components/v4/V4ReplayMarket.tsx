"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import {
  formatPrice,
  formatSol,
  invariantHolds,
  REPLAY_LABEL,
  runCanonicalLifecycle,
  shortHash,
  V4_EVIDENCE,
} from "@/lib/v4/replay";

const scenes = [
  { title: "Vault funded", copy: "The operator deposits 0.20 SOL. No user position can execute without its complete incremental liability already free." },
  { title: "Pre-goal quote verified", copy: "Raw StablePrice [1913, 2691, 9473] produces 53.28¢ YES and 48.72¢ NO after the fixed 1% per-side spread." },
  { title: "Honest positions accepted", copy: "A 0.01 SOL YES and a 0.01 SOL NO each receive an immutable gross payout. No pool shares exist." },
  { title: "France goal · sequence 739", copy: "The genuine confirmed goal advances the market sequence from 738 to 739 and immediately invalidates quote sequence 1." },
  { title: "Old quote atomically refunded", copy: "The bot stake enters and leaves within one instruction. Its durable position is REFUNDED and can never claim." },
  { title: "Post-goal quote verified", copy: "Raw StablePrice [1156, 8757, 47500] produces an 87.48¢ executable YES price bound to material sequence 739." },
  { title: "Final proof · France 2–0 Morocco", copy: "Sequence 1114 proves period-100 keys 1001, 1002, 3001 and 3002. Two of three resolution authorities approve YES." },
  { title: "Payouts and vault reconciled", copy: "Both YES positions claim their fixed payout, the NO position is reconciled, every reserve reaches zero, and free collateral is withdrawable." },
] as const;

export function V4ReplayMarket() {
  const lifecycle = useMemo(runCanonicalLifecycle, []);
  const [scene, setScene] = useState(0);
  const current = scenes[scene];
  const vaultSnapshot = scene < 2
    ? lifecycle.snapshots[0]
    : scene === 2
      ? lifecycle.snapshots[2]
      : scene < 6
        ? lifecycle.snapshots[4]
        : scene === 6
          ? lifecycle.snapshots[5]
          : lifecycle.snapshots.at(-2)!;

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[11px] font-semibold text-blue-900">
        {REPLAY_LABEL} No transaction is sent from this Phase B interface.
      </div>

      <header className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="section-label">World Cup · fixture {V4_EVIDENCE.fixtureId}</p>
          <h1 className="mt-2 text-[40px] font-extrabold tracking-[-0.055em] sm:text-[52px]">Will France win?</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">A fixed-payout operator vault protected by strict LineGuard event-sequence invalidation. France won 2–0 in the recorded fixture.</p>
          <div className="mt-5 flex gap-3">
            <PriceCard label="PRE-GOAL YES" price={lifecycle.pre.yesPriceMicros} />
            <PriceCard label="POST-GOAL YES" price={lifecycle.post.yesPriceMicros} active />
          </div>
        </div>
        <aside className="card p-5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-(--green)"><ShieldCheck className="h-4 w-4" />TxLINE proof material recorded</div>
          <dl className="mt-4 space-y-3 text-[11px]">
            <DataRow label="Goal sequence" value="739" />
            <DataRow label="Final sequence" value="1114" />
            <DataRow label="Final-period keys" value="1001 · 1002 · 3001 · 3002" />
            <DataRow label="Odds root" value={shortHash(V4_EVIDENCE.oddsRootPda)} mono />
          </dl>
        </aside>
      </header>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="card overflow-hidden">
          <div className="border-b border-(--border) p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="section-label">Scene {scene + 1} of {scenes.length}</p><h2 className="mt-2 text-[22px] font-extrabold">{current.title}</h2></div>
              <span className="rounded-full bg-(--blue-bg) px-2.5 py-1 text-[9px] font-bold text-(--blue)">DETERMINISTIC</span>
            </div>
            <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-(--ink-2)">{current.copy}</p>
          </div>
          <ol className="grid gap-px bg-(--border) sm:grid-cols-2">
            {scenes.map((item, index) => (
              <li key={item.title} className={`flex min-h-20 gap-3 bg-white p-4 ${index === scene ? "ring-2 ring-inset ring-blue-500" : ""}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${index <= scene ? "bg-(--green-bg) text-(--green)" : "bg-slate-100 text-slate-400"}`}>{index < scene ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span>
                <div><p className="text-[11px] font-bold">{item.title}</p><p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-(--ink-3)">{item.copy}</p></div>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-3 border-t border-(--border) p-4">
            <button type="button" onClick={() => setScene(0)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-(--border) bg-white px-4 text-[11px] font-bold"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
            <button type="button" onClick={() => setScene((value) => Math.min(value + 1, scenes.length - 1))} disabled={scene === scenes.length - 1} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-(--blue) px-5 text-[11px] font-bold text-white disabled:opacity-40">Advance replay <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <p className="flex items-center gap-2 text-[11px] font-bold"><Zap className="h-4 w-4 text-(--blue)" />Vault solvency</p>
            <dl className="mt-4 space-y-3 text-[11px]">
              <DataRow label="Spendable balance" value={formatSol(vaultSnapshot.spendableLamports)} />
              <DataRow label="Free collateral" value={formatSol(vaultSnapshot.freeCollateral)} />
              <DataRow label="Reserved liability" value={formatSol(vaultSnapshot.reservedLiability)} />
              <DataRow label="Accepted principal" value={formatSol(vaultSnapshot.acceptedStakePrincipal)} />
            </dl>
            <div className={`mt-4 rounded-lg px-3 py-2 text-[10px] font-bold ${invariantHolds(vaultSnapshot) ? "bg-(--green-bg) text-(--green)" : "bg-(--red-bg) text-(--red)"}`}>A = F + R + S · {invariantHolds(vaultSnapshot) ? "EXACT" : "FAILED"}</div>
          </div>
          <div className="card p-5">
            <p className="section-label">Fixed-payout example</p>
            <p className="mt-2 text-[12px] font-bold">Honest pre-goal YES</p>
            <dl className="mt-3 space-y-2 text-[11px]"><DataRow label="Stake" value="0.010000 SOL" /><DataRow label="Execution" value={formatPrice(lifecycle.pre.yesPriceMicros)} /><DataRow label="Gross payout" value={formatSol(18_769_297n)} /><DataRow label="Reserved liability" value={formatSol(8_769_297n)} /></dl>
          </div>
          <Link href="/proof" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-(--ink) text-[11px] font-bold text-white"><ShieldCheck className="h-4 w-4" />Verify all evidence</Link>
        </aside>
      </section>
    </div>
  );
}

function PriceCard({ label, price, active = false }: { label: string; price: bigint; active?: boolean }) {
  return <div className={`min-w-36 rounded-xl border px-4 py-3 ${active ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}><p className="text-[9px] font-bold">{label}</p><p className="mt-1 text-[24px] font-extrabold">{formatPrice(price)}</p></div>;
}

function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><dt className="text-(--ink-3)">{label}</dt><dd className={`text-right font-semibold text-(--ink) ${mono ? "mono" : ""}`}>{value}</dd></div>;
}
