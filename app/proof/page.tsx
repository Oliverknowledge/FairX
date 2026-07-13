import type { Metadata } from "next";
import Link from "next/link";
import { FairXShell } from "@/components/fairx/FairXShell";
import { V2LifecycleVerifier } from "@/components/fairx-proof/V2LifecycleVerifier";
import { V3LifecycleVerifier } from "@/components/fairx-proof/V3LifecycleVerifier";

export const metadata: Metadata = { title: "Verify FairX Proof", description: "Independently verify the FairX three-wallet devnet lifecycle." };

export default function ProofPage() {
  return <FairXShell compact><div className="mx-auto max-w-[900px]"><header className="py-5 sm:py-8"><p className="text-[11px] font-bold text-(--blue)">Canonical proof</p><h1 className="mt-2 text-[36px] font-extrabold tracking-[-0.05em] sm:text-[48px]">Three wallets. One economic truth.</h1><p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">Wallet A wins Wallet B&rsquo;s accepted collateral. Wallet C&rsquo;s stale exploit alone is refunded. Every required fact is re-read from devnet; missing evidence stays UNKNOWN.</p></header><V3LifecycleVerifier /><details id="historical" className="mt-6 rounded-xl border border-(--border) bg-[#f8fafc] p-4"><summary className="cursor-pointer text-[12px] font-bold">Archived v2 lifecycle</summary><p className="mt-3 text-[11px] leading-relaxed text-(--ink-2)">The older v2 devnet record is retained as audit history. Its sole winning position recovered only its own accepted principal, so it is not evidence of economically complete counterparty settlement.</p><div className="mt-4"><V2LifecycleVerifier /></div><Link href="/operator" className="mt-3 inline-flex text-[11px] font-bold text-(--blue)">Open developer status →</Link></details></div></FairXShell>;
}
