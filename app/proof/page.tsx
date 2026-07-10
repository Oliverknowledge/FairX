import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, FileCheck2, Hash, Layers3, ShieldCheck, Terminal, Undo2, Vault } from "lucide-react";
import { FreshDevnetPanel } from "@/components/fairx-proof/FreshDevnetPanel";
import { FairXShell } from "@/components/fairx/FairXShell";
import { Badge } from "@/components/lineguard/ui";
import { proofData } from "@/lib/proof/staticProofData";

export const metadata: Metadata = {
  title: "FairX Proof",
  description: "Devnet-backed proof of LineGuard market commitments, event hashes, and guarded settlement.",
};

export default function ProofPage() {
  const yesCase = proofData.cases.find((proof) => proof.id === "yes")!;
  const noCase = proofData.cases.find((proof) => proof.id === "no")!;
  const cards = [
    {
      number: 1,
      title: "Program deployed",
      detail: `Solana devnet · slot ${proofData.program.deployedSlot}`,
      href: proofData.program.explorerUrl,
      external: true,
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: "green",
    },
    {
      number: 2,
      title: "Market config committed",
      detail: "On-chain market config commitment",
      href: "#fresh-devnet",
      external: false,
      icon: <Layers3 className="h-4 w-4" />,
      tone: "blue",
    },
    {
      number: 3,
      title: "Event hash committed",
      detail: "Authority-controlled oracle event commitment",
      href: yesCase.txs[1].explorerUrl,
      external: true,
      icon: <Hash className="h-4 w-4" />,
      tone: "amber",
    },
    {
      number: 4,
      title: "YES attack refunded to trader",
      detail: "+23¢ stale edge · VOIDED_REFUNDED",
      href: yesCase.txs.at(-1)!.explorerUrl,
      external: true,
      icon: <Undo2 className="h-4 w-4" />,
      tone: "red",
    },
    {
      number: 5,
      title: "NO safe trade finalized to vault",
      detail: "No positive edge · FINALIZED_TO_VAULT",
      href: noCase.txs.at(-1)!.explorerUrl,
      external: true,
      icon: <Vault className="h-4 w-4" />,
      tone: "blue",
    },
    {
      number: 6,
      title: "Receipt verifies all hashes",
      detail: "Config + event + order + transaction proof",
      href: proofData.receipt.verifierHref,
      external: false,
      icon: <FileCheck2 className="h-4 w-4" />,
      tone: "green",
    },
  ] as const;

  return (
    <FairXShell>
      <div className="mx-auto max-w-[1080px]">
        <header className="rounded-2xl border border-(--border) bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-(--ink-2) hover:text-(--blue)">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to FairX
              </Link>
              <h1 className="mt-3 text-[24px] font-extrabold tracking-[-0.04em] text-(--ink)">Proof, not promises.</h1>
              <p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-(--ink-2)">
                Six clickable artifacts cover the devnet-backed settlement guard: market configuration, authority-committed events, custody destinations, and receipt integrity.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green" dot>Devnet-backed</Badge>
              <Link href="/terminal" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
                <Terminal className="h-3.5 w-3.5" /> Terminal
              </Link>
            </div>
          </div>
        </header>

        <section aria-label="Proof cards" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <a
              key={card.number}
              href={card.href}
              target={card.external ? "_blank" : undefined}
              rel={card.external ? "noreferrer" : undefined}
              className={`group min-w-0 rounded-xl border bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-md ${toneBorder(card.tone)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneIcon(card.tone)}`}>{card.icon}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-(--ink-3) transition group-hover:text-(--blue)" />
              </div>
              <p className="section-label mt-3">{card.number}</p>
              <h2 className="mt-1 text-[13px] font-extrabold leading-tight text-(--ink)">{card.title}</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-(--ink-3)">{card.detail}</p>
            </a>
          ))}
        </section>

        <section id="fresh-devnet" className="mt-3 scroll-mt-4">
          <FreshDevnetPanel />
        </section>

        <footer className="mt-3 rounded-xl border border-(--border) bg-white px-4 py-3 text-[10.5px] leading-relaxed text-(--ink-2)">
          <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--green)" /><span><strong>Scope:</strong> devnet-backed on-chain settlement guard, on-chain market config commitment, receipt/verifier, and oracle-authority-controlled event ingestion. The UI, charts, proof pages, operator dashboard, TxLINE-ready proxy, and walkthrough remain off-chain.</span></p>
        </footer>
      </div>
    </FairXShell>
  );
}

function toneBorder(tone: "green" | "blue" | "amber" | "red"): string {
  return tone === "green" ? "border-(--green)/25" : tone === "blue" ? "border-(--blue)/25" : tone === "amber" ? "border-(--amber)/30" : "border-(--red)/25";
}

function toneIcon(tone: "green" | "blue" | "amber" | "red"): string {
  return tone === "green" ? "bg-(--green-bg) text-(--green)" : tone === "blue" ? "bg-(--blue-bg) text-(--blue)" : tone === "amber" ? "bg-(--amber-bg) text-(--amber)" : "bg-(--red-bg) text-(--red)";
}
