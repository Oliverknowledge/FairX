"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { canonicalV2Lifecycle, cloneV2Lifecycle, verifyV2Lifecycle, type V2LifecycleProof } from "@/lib/proof/v2Lifecycle";

const lifecycle = [
  ["Genuine TxLINE evidence", "Fixture 18209181 and the France 1–0 Morocco score match the preserved evidence.", "txlineCpiProof"],
  ["Stale exploit refunded", "The exploitative 0.01 SOL order was returned to its user-owned wallet.", "staleRefund"],
  ["Fair position created", "A separate 0.01 SOL order became a wallet-owned on-chain position.", "acceptedPosition"],
  ["Direct TxLINE CPI passed", "LineGuard required TxLINE validation before accepting the final score.", "txlineCpiProof"],
  ["2-of-3 resolution reached", "Two independent resolution approvals authorized execution.", "secondApproval"],
  ["User payout claimed", "The winning wallet claimed 0.01 devnet SOL.", "claim"],
  ["Vault conservation verified", "0.02 SOL deposited equals 0.01 refunded plus 0.01 paid, with zero claimable balance and dust.", "resolution"],
] as const;

export function V2LifecycleVerifier() {
  const [proof, setProof] = useState<V2LifecycleProof>(() => cloneV2Lifecycle());
  const verification = useMemo(() => verifyV2Lifecycle(proof), [proof]);
  const tamper = () => { const next = structuredClone(proof); next.txline.fixtureId = "tampered"; setProof(next); };

  return (
    <div className="space-y-5">
      <section className={`rounded-2xl border p-6 sm:p-8 ${verification.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-start gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${verification.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{verification.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}</span><div><p className="text-[11px] font-bold text-(--ink-2)">Archived devnet evidence</p><h1 className="mt-1 text-[25px] font-extrabold tracking-[-0.04em] sm:text-[32px]">{verification.valid ? "ARCHIVED V2 RECORD VERIFIED" : "TAMPER DETECTED"}</h1><p className="mt-2 text-[12px] text-(--ink-2)">Mechanically valid, but not evidence that a winner captured losing counterparty collateral.</p></div></div>
        {!verification.valid && <ul className="mt-4 list-disc pl-5 text-[11px] text-red-800">{verification.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      </section>

      <ol className="space-y-3">{lifecycle.map(([title, sentence, transactionKey], index) => { const transaction = proof.transactions[transactionKey]; return <li key={title} className="rounded-xl border border-(--border) bg-white p-4 sm:flex sm:items-center sm:gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">{index + 1}</span><div className="mt-3 min-w-0 flex-1 sm:mt-0"><p className="flex items-center gap-2 text-[13px] font-bold"><CheckCircle2 className="h-4 w-4 text-(--green)" />{title}</p><p className="mt-1 text-[11px] leading-relaxed text-(--ink-2)">{sentence}</p></div><a href={transaction.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-bold text-(--blue) sm:mt-0">Explorer <ArrowUpRight className="h-3.5 w-3.5" /></a></li>; })}</ol>

      <div className="flex flex-col gap-2 sm:flex-row"><button onClick={tamper} className="h-11 rounded-lg bg-(--ink) px-5 text-[12px] font-bold text-white">Tamper with evidence</button>{!verification.valid && <button onClick={() => setProof(cloneV2Lifecycle())} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-(--border) bg-white px-5 text-[12px] font-bold"><RotateCcw className="h-4 w-4" />Reset evidence</button>}</div>

      <details className="rounded-xl border border-(--border) bg-white p-4"><summary className="cursor-pointer text-[12px] font-bold">Technical details</summary><div className="mt-4 space-y-4 text-[10.5px] leading-relaxed text-(--ink-2)"><div><p className="font-bold text-(--ink)">TxLINE capture hash — canonical JSON domain</p><code className="mt-1 block break-all">{verification.recomputedCaptureHash}</code></div><div><p className="font-bold text-(--ink)">TxLINE CPI payload hash — Borsh domain</p><code className="mt-1 block break-all">{verification.recomputedBorshPayloadHash}</code></div><p>The hashes differ because they commit different serializations of the same underlying TxLINE evidence.</p><dl className="grid gap-2 sm:grid-cols-2"><Technical label="Program" value={proof.program.programId} /><Technical label="Market" value={proof.market.marketPda} /><Technical label="Market vault" value={proof.market.marketVaultPda} /><Technical label="Position" value={proof.lifecycle.positionPda} /><Technical label="Approval mask" value={proof.authorities.approvalMask} /><Technical label="Receipt" value={canonicalV2Lifecycle.receiptId} /></dl></div></details>
    </div>
  );
}

function Technical({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-[#f8fafc] p-3"><dt className="font-bold text-(--ink)">{label}</dt><dd className="mt-1 break-all font-mono text-[9.5px]">{value}</dd></div>; }
