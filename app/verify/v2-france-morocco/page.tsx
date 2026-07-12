import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { V2LifecycleVerifier } from "@/components/fairx-proof/V2LifecycleVerifier";

export const metadata: Metadata = {
  title: "V2 Lifecycle Verifier",
  description: "Verify the canonical France–Morocco FairX v2 lifecycle and its domain-separated TxLINE hashes.",
};

export default function V2LifecycleVerifyPage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1100px]">
        <Link href="/proof" className="mb-4 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-(--ink-2)"><ArrowLeft className="h-3.5 w-3.5" />Back to proof hub</Link>
        <V2LifecycleVerifier />
      </div>
    </FairXShell>
  );
}
