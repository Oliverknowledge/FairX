"use client";

import { ArrowUpRight, CheckCircle2, CircleAlert, DatabaseZap, FileCheck2, Hash, Layers3, LockKeyhole, Radio, ShieldCheck, Undo2, Vault } from "lucide-react";
import { useRuntimeStatus } from "@/hooks/useRuntimeStatus";
import { proofData } from "@/lib/proof/staticProofData";

const yes = proofData.cases.find((item) => item.id === "yes")!;
const no = proofData.cases.find((item) => item.id === "no")!;

export function ProofAuditGrid() {
  const cards = [
    { n: 1, title: "TxLINE subscription active", claim: `${proofData.txline.subscriptionLabel}; expiry ${new Date(proofData.txline.subscriptionExpiresAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}.`, value: proofData.txline.subscriptionTx, href: proofData.txline.subscriptionTxUrl, verified: true, source: "TxLINE devnet", icon: Radio },
    { n: 2, title: "Genuine fixture loaded", claim: "France vs Morocco was selected from the genuine TxLINE fixture snapshot.", value: `fixture ${proofData.txline.fixtureId}`, href: "/api/txline/canonical", verified: true, source: "TxLINE historical", icon: DatabaseZap },
    { n: 3, title: "TxLINE score proof validated", claim: "validateStatV2 returned true separately against the TxLINE devnet program; direct CPI is not claimed.", value: proofData.txline.rootPda, href: proofData.txline.rootExplorerUrl, verified: proofData.txline.validationPassed, source: "TxLINE devnet", icon: ShieldCheck },
    { n: 4, title: "MarketConfig committed", claim: "Fixture, title, materiality, and settlement hashes are committed in the canonical MarketConfig PDA.", value: yes.marketConfigPda, href: yes.txs[0].explorerUrl, verified: true, source: "canonical", time: yes.txs[0].blockTime, slot: yes.txs[0].slot, icon: Layers3 },
    { n: 5, title: "Source event hash committed", claim: "The normalized genuine TxLINE source hash is stored in both canonical MarketState accounts.", value: yes.sourceEventHash, href: yes.txs[1].explorerUrl, verified: true, source: "canonical", time: yes.txs[1].blockTime, slot: yes.txs[1].slot, icon: Hash },
    { n: 6, title: "YES stake escrowed", claim: "The stale YES quote and 0.02 SOL stake entered its OrderEscrow PDA before evaluation.", value: yes.orderPda, href: yes.txs[2].explorerUrl, verified: true, source: "canonical", time: yes.txs[2].blockTime, slot: yes.txs[2].slot, icon: LockKeyhole },
    { n: 7, title: "YES refunded", claim: "+34.231¢ of positive stale edge produced VOIDED_REFUNDED and returned the full stake.", value: yes.txs[3].signature, href: yes.txs[3].explorerUrl, verified: true, source: "canonical", time: yes.recordedAt, slot: yes.txs[3].slot, icon: Undo2 },
    { n: 8, title: "NO stake escrowed", claim: "The opposite 0.02 SOL order entered a distinct OrderEscrow PDA under the same event evidence.", value: no.orderPda, href: no.txs[2].explorerUrl, verified: true, source: "canonical", time: no.txs[2].blockTime, slot: no.txs[2].slot, icon: LockKeyhole },
    { n: 9, title: "NO finalized to ProtocolVault", claim: "−34.231¢ edge produced STALE_ALLOWED_NO_EDGE and exactly 0.02 SOL reached ProtocolVault.", value: no.txs[3].signature, href: no.txs[3].explorerUrl, verified: true, source: "canonical", time: no.recordedAt, slot: no.txs[3].slot, icon: Vault },
    { n: 10, title: "Receipt integrity verified", claim: "Both stable receipt routes recompute raw, normalized, config, verdict, destination, and transaction evidence.", value: proofData.receipt.receipt.receiptHash, href: proofData.receipt.verifierHref, verified: true, source: "canonical", time: yes.recordedAt, icon: FileCheck2 },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <a key={card.n} href={card.href} target={card.href.startsWith("http") ? "_blank" : undefined} rel={card.href.startsWith("http") ? "noreferrer" : undefined} className={`group min-w-0 rounded-xl border bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-md ${card.verified ? "border-(--green)/25" : "border-(--amber)/30"}`}>
            <div className="flex items-start justify-between gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.verified ? "bg-(--green-bg) text-(--green)" : "bg-(--amber-bg) text-(--amber)"}`}><Icon className="h-4 w-4" /></span><ArrowUpRight className="h-3.5 w-3.5 text-(--ink-3) group-hover:text-(--blue)" /></div>
            <p className="mono mt-3 text-[9px] font-bold text-(--ink-3)">{String(card.n).padStart(2, "0")}</p>
            <h2 className="mt-1 text-[12px] font-extrabold leading-tight text-(--ink)">{card.title}</h2>
            <p className="mt-1.5 min-h-[42px] text-[9.5px] leading-relaxed text-(--ink-2)">{card.claim}</p>
            <p className="mono mt-3 truncate text-[9px] font-bold text-(--ink)">{card.value}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[8.5px] font-bold"><span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${card.verified ? "bg-(--green-bg) text-(--green)" : "bg-(--amber-bg) text-(--amber)"}`}>{card.verified ? <CheckCircle2 className="h-2.5 w-2.5" /> : <CircleAlert className="h-2.5 w-2.5" />}{card.verified ? "VERIFIED" : "PENDING"}</span><span className="rounded-full bg-[#f1f3f6] px-1.5 py-0.5 text-(--ink-3)">{card.source}</span></div>
            {(card.slot || card.time) && <p className="mt-2 text-[8.5px] leading-relaxed text-(--ink-3)">{card.slot ? `slot ${card.slot}` : ""}{card.slot && card.time ? " · " : ""}{card.time ? new Date(card.time).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : ""}</p>}
          </a>
        );
      })}
    </div>
  );
}

export function CanonicalReferenceGrid() {
  const references = [
    ["LineGuard program", proofData.program.id, proofData.program.explorerUrl],
    ["Program schema / slot", `${proofData.program.schemaLabel} · ${proofData.program.deployedSlot}`, proofData.program.deploymentTxUrl],
    ["TxLINE program", proofData.txline.programId, proofData.txline.programExplorerUrl],
    ["Fixture / sequence", `${proofData.txline.fixtureId} · ${proofData.txline.sequence}`, "/api/txline/canonical"],
    ["Daily scores root PDA", proofData.txline.rootPda, proofData.txline.rootExplorerUrl],
    ["Source event hash", yes.sourceEventHash, yes.txs[1].explorerUrl],
    ["YES receipt hash", proofData.receipt.receipt.receiptHash, proofData.receipt.verifierHref],
    ["NO receipt hash", proofData.receipt.noReceipt.receiptHash, proofData.receipt.noVerifierHref],
  ] as const;
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="section-label">Canonical genuine TxLINE proof</p><h2 className="mt-1 text-[16px] font-extrabold text-(--ink)">Independent verification references</h2></div><span className="rounded-full bg-(--blue-bg) px-2.5 py-1 text-[9px] font-bold text-(--blue)">HISTORICAL · DEVNET</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {references.map(([label, value, href]) => <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="min-w-0 rounded-lg border border-(--border) bg-[#fafbfc] p-2.5 hover:border-(--blue)/35"><p className="text-[9px] font-bold text-(--ink-3)">{label}</p><p className="mono mt-1 truncate text-[10px] font-bold text-(--ink)">{value}</p></a>)}
      </div>
    </section>
  );
}

export function ProtocolVaultStatus() {
  const { status } = useRuntimeStatus();
  const vault = status?.vault;
  return (
    <section className="rounded-2xl border border-(--blue)/20 bg-(--blue-bg) p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-label text-(--blue)">ProtocolVault</p><h2 className="mt-1 text-[18px] font-extrabold text-(--ink)">Safe-order destination is implemented.</h2><p className="mt-1 text-[10.5px] text-(--ink-2)">Devnet funds only. Values below prefer live RPC and fall back to the verified canonical snapshot.</p></div><span className="rounded-full border border-(--blue)/20 bg-white px-2.5 py-1 text-[9px] font-bold text-(--blue)">{vault?.exists === false ? "RPC unavailable" : "DEVNET FUNDS ONLY"}</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><VaultMetric label="Vault PDA" value={proofData.vault.pda} /><VaultMetric label="Current balance" value={`${((vault?.balanceLamports ?? proofData.vault.balanceLamports) / 1_000_000_000).toFixed(6)} SOL`} /><VaultMetric label="Total finalized" value={`${((vault?.totalFinalizedLamports ?? proofData.vault.totalFinalizedLamports) / 1_000_000_000).toFixed(3)} SOL`} /><VaultMetric label="Finalized orders" value={String(vault?.fillCount ?? proofData.vault.fillCount)} /></div>
      <div className="mt-3 flex flex-wrap gap-2"><a href={proofData.vault.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--blue)/20 bg-white px-3 text-[10px] font-bold text-(--blue)">Open vault <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={proofData.vault.lastFinalizationUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--blue)/20 bg-white px-3 text-[10px] font-bold text-(--blue)">Last verified finalization <ArrowUpRight className="h-3.5 w-3.5" /></a></div>
    </section>
  );
}

function VaultMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-(--blue)/15 bg-white p-3"><p className="text-[9px] font-bold text-(--ink-3)">{label}</p><p className="mono mt-1 break-all text-[10.5px] font-extrabold text-(--ink)">{value}</p></div>;
}
