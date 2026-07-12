"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { canonicalV2Lifecycle, cloneV2Lifecycle, verifyV2Lifecycle, type V2LifecycleProof } from "@/lib/proof/v2Lifecycle";

type TamperField = "fixture" | "sequence" | "borsh" | "score" | "outcome" | "mask" | "refund" | "paid" | "claim" | "vault";

const chain = [
  "TxLINE evidence loaded",
  "CPI payload reconstructed",
  "Borsh payload hash verified",
  "TxLINE CPI succeeded",
  "Fixture and sequence match",
  "Market configuration matches",
  "Stale order refunded",
  "Position opened",
  "Threshold reached",
  "Outcome resolved",
  "User payout claimed",
  "Vault conservation verified",
];

export function V2LifecycleVerifier() {
  const [proof, setProof] = useState<V2LifecycleProof>(() => cloneV2Lifecycle());
  const [field, setField] = useState<TamperField>("fixture");
  const verification = useMemo(() => verifyV2Lifecycle(proof), [proof]);

  const tamper = () => {
    const next = structuredClone(proof);
    if (field === "fixture") next.txline.fixtureId = "999";
    if (field === "sequence") next.txline.sequence += 1;
    if (field === "borsh") next.txline.borshPayloadHash = "00".repeat(32);
    if (field === "score") next.txline.homeScore += 1;
    if (field === "outcome") next.txline.derivedOutcome = "NO";
    if (field === "mask") next.authorities.approvalMask = "001";
    if (field === "refund") next.lifecycle.refundedStakeLamports -= 1;
    if (field === "paid") next.vault.totalPaidLamports -= 1;
    if (field === "claim") next.transactions.claim.signature = "tampered-claim";
    if (field === "vault") next.vault.totalDepositedLamports += 1;
    setProof(next);
  };

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl border p-5 ${verification.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${verification.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{verification.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}</span>
            <div><p className="section-label">FairX canonical receipt v2</p><h1 className="mt-1 text-[25px] font-extrabold tracking-[-0.04em]">{verification.valid ? "V2 LIFECYCLE VERIFIED" : "TAMPER DETECTED"}</h1><p className="mt-1 text-[10.5px] text-(--ink-2)">Devnet-only evidence fixture. Explorer links are recorded evidence, not a live RPC query.</p></div>
          </div>
          <span className="mono text-[10px] font-semibold">{canonicalV2Lifecycle.receiptId}</span>
        </div>
        {!verification.valid && <ul className="mt-3 list-disc space-y-1 pl-5 text-[10.5px] text-red-800">{verification.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      </section>

      <section className="rounded-xl border border-(--border) bg-white p-4">
        <p className="section-label">Tamper laboratory</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select aria-label="Tamper field" value={field} onChange={(event) => setField(event.target.value as TamperField)} className="h-10 flex-1 rounded-lg border border-(--border) bg-white px-3 text-[11px]">
            <option value="fixture">Fixture ID</option><option value="sequence">Sequence</option><option value="borsh">Borsh payload hash</option><option value="score">Score</option><option value="outcome">Derived outcome</option><option value="mask">Approval mask</option><option value="refund">Refunded amount</option><option value="paid">Paid amount</option><option value="claim">Claim transaction</option><option value="vault">Vault totals</option>
          </select>
          <button onClick={tamper} className="h-10 rounded-lg bg-(--red) px-4 text-[11px] font-bold text-white">Apply tamper</button>
          <button onClick={() => setProof(cloneV2Lifecycle())} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-(--border) px-4 text-[11px] font-bold"><RotateCcw className="h-3.5 w-3.5" />Reset proof</button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-(--border) bg-white p-4">
          <p className="section-label">Linear verification chain</p>
          <ol className="mt-3 space-y-2">{chain.map((label, index) => <li key={label} className="flex items-center gap-2 rounded-lg bg-[#f8fafc] p-2.5 text-[10.5px] font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-(--green-bg) text-[9px] font-bold text-(--green)">{index + 1}</span><CheckCircle2 className={`h-3.5 w-3.5 ${verification.valid ? "text-(--green)" : "text-(--ink-3)"}`} />{label}</li>)}</ol>
        </section>
        <section className="space-y-4">
          <div className="rounded-xl border border-(--border) bg-white p-4">
            <p className="section-label">Independent sub-statuses</p>
            <div className="mt-3 space-y-2"><Status label="TxLINE CPI verified" ok={verification.checks.borshPayloadHash && verification.checks.fixtureAndSequence} /><Status label="Market configuration verified" ok={verification.checks.marketConfiguration} /><Status label="Protection verdict verified" ok={verification.checks.protectionVerdict} /><Status label="Position ownership verified" ok={verification.checks.positionOwnership} /><Status label="Threshold resolution verified" ok={verification.checks.thresholdResolution} /><Status label="Payout verified" ok={verification.checks.payout && verification.checks.claimTransaction} /><Status label="Vault conservation verified" ok={verification.checks.vaultConservation} /></div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-[10.5px] leading-relaxed text-blue-950">
            <p className="font-bold">Two correct hashing domains</p>
            <p className="mt-2">TxLINE capture hash — canonical JSON domain</p><code className="mt-1 block break-all">{verification.recomputedCaptureHash}</code>
            <p className="mt-3">TxLINE CPI payload hash — Borsh domain</p><code className="mt-1 block break-all">{verification.recomputedBorshPayloadHash}</code>
            <p className="mt-3">The hashes differ because they commit different serializations of the same underlying TxLINE evidence.</p>
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-(--border) bg-white p-4">
        <p className="section-label">Finalized devnet transaction chain</p>
        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(proof.transactions).map(([key, transaction]) => <a key={key} href={transaction.explorerUrl} target="_blank" rel="noreferrer" className="min-w-0 overflow-hidden rounded-lg border border-(--border) bg-[#f8fafc] p-3 text-[10px] hover:border-blue-300"><span className="block font-bold capitalize text-(--ink)">{key.replace(/([A-Z])/g, " $1")}</span><span className="mono mt-1 block max-w-full truncate text-(--blue)">{transaction.signature}</span></a>)}</div>
      </section>
    </div>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex items-center gap-2 text-[10.5px] font-semibold"><CheckCircle2 className={`h-4 w-4 ${ok ? "text-(--green)" : "text-(--red)"}`} />{label}</div>;
}
