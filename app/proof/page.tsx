import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Play, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { RuntimeStatusStrip } from "@/components/fairx/RuntimeStatusStrip";
import { FreshDevnetPanel } from "@/components/fairx-proof/FreshDevnetPanel";
import { CanonicalReferenceGrid, ProofAuditGrid, ProtocolVaultStatus } from "@/components/fairx-proof/ProofAuditGrid";
import { SettlementProofPanel } from "@/components/fairx-proof/SettlementProofPanel";

export const metadata: Metadata = {
  title: "On-chain Proof",
  description: "Audit FairX program, event-hash, OrderEscrow, refund, ProtocolVault, and receipt evidence on Solana devnet.",
};

export default function ProofPage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div><Link href="/" className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-(--ink-2) hover:text-(--blue)"><ArrowLeft className="h-3.5 w-3.5" />Back to FairX</Link><div className="mt-3 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--green-bg) text-(--green)"><ShieldCheck className="h-4.5 w-4.5" /></span><div><p className="section-label">Audit surface</p><h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.04em] text-(--ink)">Every claim links to evidence.</h1><p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-(--ink-2)">Runtime checks and canonical evidence are separated. The canonical source is genuine TxLINE historical data and is never labelled fresh or live.</p></div></div></div>
          <Link href="/walkthrough" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--ink) px-3 text-[10.5px] font-bold text-white"><Play className="h-3.5 w-3.5" />Run proof walkthrough</Link>
        </header>

        <RuntimeStatusStrip detailed />
        <section className="mt-4"><CanonicalReferenceGrid /></section>
        <section className="mt-4"><ProofAuditGrid /></section>
        <section id="settlement" className="mt-4 scroll-mt-4"><SettlementProofPanel /></section>
        <section className="mt-4"><ProtocolVaultStatus /></section>
        <section id="fresh-proof" className="mt-4 scroll-mt-4"><FreshDevnetPanel /></section>
      </div>
    </FairXShell>
  );
}
