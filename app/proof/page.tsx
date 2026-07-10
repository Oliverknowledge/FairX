import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileCheck2, Play, ShieldCheck, Terminal } from "lucide-react";
import { ProofCard } from "@/components/proof/ProofCard";
import { ProofLinkList } from "@/components/proof/ProofLinkList";
import { ProofStatusBadge } from "@/components/proof/ProofStatusBadge";
import { FreshDevnetPanel } from "@/components/fairx-proof/FreshDevnetPanel";
import { FairXShell } from "@/components/fairx/FairXShell";
import { Badge } from "@/components/lineguard/ui";
import { proofData, type SettlementProofCase } from "@/lib/proof/staticProofData";

export const metadata: Metadata = {
  title: "FairX Proof",
  description: "Devnet proof that LineGuard refunds stale positive-edge trades and allows stale no-edge trades.",
};

export default function ProofPage() {
  const yesCase = proofData.cases.find((proof) => proof.id === "yes")!;
  const noCase = proofData.cases.find((proof) => proof.id === "no")!;

  return (
    <FairXShell>
      <div className="mx-auto max-w-[1180px]">
      <header className="mb-4 rounded-2xl border border-(--border) bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-(--ink-2) hover:text-(--blue)">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to FairX
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--green-bg)">
                <ShieldCheck className="h-5 w-5 text-(--green)" />
              </span>
              <div className="min-w-0">
                <p className="mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-(--ink-3)">FairX powered by LineGuard</p>
                <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight text-(--ink)">Proof, not promises.</h1>
                <p className="mt-1 max-w-2xl text-[12px] leading-snug text-(--ink-2)">
                  Four fixed artifacts show the settlement rule: stale positive-edge trades refund, stale no-edge trades can still fill, and receipts expose tampering.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/walkthrough" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              <Play className="h-3.5 w-3.5" /> Proof walkthrough
            </Link>
            <Link href="/terminal" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              <Terminal className="h-3.5 w-3.5" /> Terminal
            </Link>
            <Badge tone="green" dot className="mt-0.5">
              Devnet evidence
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ProofStatusBadge label="Program deployed" value="Verified" />
          <ProofStatusBadge label="YES stale attack" value="Refunded on-chain" tone="refunded" />
          <ProofStatusBadge label="NO stale trade" value="Filled on-chain" tone="filled" />
          <ProofStatusBadge label="Receipt" value="Tamper-evident" />
        </div>
      </header>

      <div className="mb-3">
        <FreshDevnetPanel />
      </div>

      <div className="grid gap-3">
        <ProofCard
          eyebrow="Card 1"
          title="Program deployed"
          claim="LineGuard settlement guard is deployed on Solana devnet."
          tone="green"
          actions={[
            { href: proofData.program.explorerUrl, label: "Open program", external: true },
            { href: proofData.program.deploymentTxUrl, label: "Open deployment tx", external: true },
          ]}
        >
          <div className="grid gap-2 md:grid-cols-2">
            <ProofRow label="Program ID" value={proofData.program.id} />
            <ProofRow label="Deployer" value={proofData.program.deployer} />
            <ProofRow label="Deployment tx" value={proofData.program.deploymentTx} />
            <ProofRow label="Slot" value={proofData.program.deployedSlot} />
          </div>
        </ProofCard>

        <SettlementCard proof={yesCase} />
        <SettlementCard proof={noCase} />

        <ProofCard
          eyebrow="Card 4"
          title="Receipt verifier"
          claim={proofData.receipt.claim}
          tone="green"
          actions={[
            { href: proofData.receipt.verifierHref, label: "Open verifier", external: false },
            { href: "/walkthrough", label: "Open proof walkthrough", external: false },
          ]}
        >
          <div className="grid gap-2 md:grid-cols-2">
            <ProofRow label="Receipt includes tx signatures" value={proofData.receipt.includesTxSignatures ? "yes" : "no"} tone="green" />
            <ProofRow label="Verifier tx count" value={String(proofData.receipt.verifierTxCount)} tone="blue" />
            <ProofRow label="Tamper test" value={proofData.receipt.tamperTest} tone="amber" />
            <ProofRow label="Status" value={proofData.receipt.status} tone="green" />
          </div>
          <div className="mt-3 rounded-lg border border-(--green)/25 bg-(--green-bg) px-3 py-2 text-[11px] leading-snug text-(--ink-2)">
            <div className="flex items-start gap-2">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-(--green)" />
              <p>
                The verifier recomputes the canonical sha256 receipt hash. Changing an on-chain proof field such as{" "}
                <span className="mono">onChain.verdictCode</span> changes the hash and fails verification.
              </p>
            </div>
          </div>
        </ProofCard>
      </div>

      <footer className="mt-4 rounded-xl border border-(--border) bg-white px-4 py-3 text-[11px] leading-relaxed text-(--ink-2)">
        <span className="font-bold text-(--ink)">Scope:</span> {proofData.limitations} Explorer links are provided for inspection; the receipt verifier recomputes payload integrity locally and does not make a live RPC status claim.
      </footer>
      </div>
    </FairXShell>
  );
}

function SettlementCard({ proof }: { proof: SettlementProofCase }) {
  const isYes = proof.id === "yes";

  return (
    <ProofCard eyebrow={isYes ? "Card 2" : "Card 3"} title={proof.title} claim={proof.claim} tone={proof.tone}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <ProofRow label="Market PDA" value={proof.marketPda} />
            <ProofRow label="Order PDA" value={proof.orderPda} />
            <ProofRow label="Edge" value={formatSignedMicros(proof.edgeMicros)} tone={isYes ? "red" : "blue"} />
            <ProofRow label="Verdict" value={proof.verdict} tone={isYes ? "red" : "green"} />
            {proof.status && <ProofRow label="Status" value={proof.status} tone="blue" />}
            <ProofRow label="Refunded" value={proof.refunded ? "yes" : "no"} tone={proof.refunded ? "green" : "neutral"} />
          </div>

          <div className="rounded-lg border border-(--amber)/25 bg-(--amber-bg) px-3 py-2 text-[11px] leading-snug text-(--ink-2)">
            {proof.explanation}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-(--border) bg-[#f9fafb] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="mono text-[9px] uppercase tracking-wide text-(--ink-3)">Tx timeline</p>
            <Badge tone={isYes ? "red" : "blue"}>{proof.txs.length} txs</Badge>
          </div>
          <ProofLinkList txs={proof.txs} />
        </div>
      </div>
    </ProofCard>
  );
}

function ProofRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "red" | "blue" | "amber";
}) {
  const valueTone =
    tone === "green"
      ? "text-(--green)"
      : tone === "red"
        ? "text-(--red)"
        : tone === "blue"
          ? "text-(--blue)"
          : tone === "amber"
            ? "text-(--amber)"
            : "text-(--ink)";

  return (
    <div className="min-w-0 rounded-lg border border-(--border) bg-[#f9fafb] px-3 py-2">
      <p className="text-[10.5px] font-semibold text-(--ink-3)">{label}</p>
      <p className={`mono mt-1 break-all text-[11px] font-bold leading-snug ${valueTone}`}>{value}</p>
    </div>
  );
}

function formatSignedMicros(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}
