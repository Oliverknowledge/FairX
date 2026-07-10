import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Boxes, ExternalLink, GitBranch, Puzzle, ShieldCheck, Terminal } from "lucide-react";
import { Badge } from "@/components/lineguard/ui";
import { FairXShell } from "@/components/fairx/FairXShell";
import { proofData } from "@/lib/proof/staticProofData";

export const metadata: Metadata = {
  title: "Integrate | FairX",
  description: "How any prediction market plugs into LineGuard settlement-integrity protection.",
};

const PROGRAM_ID = proofData.program.id;

const guardSnippet = `import { evaluateLineGuard } from "@fairx/lineguard";

// Call the guard before your market settles any order.
const verdict = evaluateLineGuard({
  side,             // "YES" | "NO"
  observedPrice,    // the quote the order actually saw
  fairYes,          // fair value incl. un-repriced events
  materialSeq,      // latest officiated event sequence
  pricedAtSeq,      // sequence your quote repriced through
  tolerance,        // e.g. 0.02 (2¢) edge noise floor
});

if (verdict.verdict === "VOIDED_REFUNDED") {
  refundToTrader(order);        // stale + captured unfair edge
} else {
  fillOrder(order);            // in-sync, or stale with no edge
}`;

const instructionSnippet = `# On-chain enforcement (Anchor, Solana devnet)
initialize_market(market_id, seqs, prices, tolerance)   # market registers
ingest_material_event(new_material_seq, new_fair_price)  # feed advances materialSeq
place_order(order_id, side, stake)                       # stake escrowed in PDA
evaluate_order()                                         # guard runs; refund or fill
#   -> emits GuardVerdictEvent { edge, verdict_code, ... }`;

export default function IntegratePage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1120px]">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to FairX
            </Link>
            <div className="mt-3">
              <p className="section-label">Protocol primitive</p>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.04em] text-(--ink)">Plug any market into LineGuard.</h1>
              <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-(--ink-2)">
                LineGuard is not a marketplace — it is a settlement-integrity check that sits between an order and its fill. FairX is one
                reference market that uses it. Any prediction market with a fair-value signal and a repricing sequence can call the same guard.
              </p>
            </div>
          </div>
          <Badge tone="amber">Devnet prototype · not production-audited</Badge>
        </header>

        {/* Architecture */}
        <section className="card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-(--blue)" />
            <p className="section-label">Architecture</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-[720px] items-stretch gap-2">
              <ArchBox tone="amber" step="Source" title="Officiated feed" body="TxLINE-style event with a monotonic sequence." />
              <ArchArrow />
              <ArchBox tone="blue" step="Normalize" title="Fair value" body="Derive fairYes + advance materialSeq." />
              <ArchArrow />
              <ArchBox tone="ink" step="Guard" title="LineGuard" body="Compare edge vs tolerance while stale." highlight />
              <ArchArrow />
              <ArchBox tone="green" step="Settle" title="Refund / fill" body="Void unfair edge, allow safe trades." />
              <ArchArrow />
              <ArchBox tone="green" step="Prove" title="Receipt + tx" body="Hash-sealed receipt, on-chain verdict." />
            </div>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-(--ink-3)">
            The guard is a single pure function. Your market keeps its own matching, pricing, and custody — LineGuard only decides whether a
            given order is exploiting an un-repriced event.
          </p>
        </section>

        {/* How a market plugs in */}
        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <PlugStep
            n="01"
            icon={<GitBranch className="h-4 w-4" />}
            title="Expose two sequences"
            body="Track materialSeq (latest event that moved fair value) and pricedAtSeq (what your quote has repriced through)."
          />
          <PlugStep
            n="02"
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Call the guard pre-settlement"
            body="Freeze the observed price, pass it with fairYes + tolerance into evaluateLineGuard, and read the verdict."
          />
          <PlugStep
            n="03"
            icon={<Puzzle className="h-4 w-4" />}
            title="Honor the verdict"
            body="Refund voided stale-edge orders; fill everything else. Optionally enforce it on-chain with the Anchor program."
          />
        </section>

        {/* Code */}
        <section className="mt-4 grid gap-3 lg:grid-cols-2">
          <CodeCard title="SDK usage (off-chain guard)" icon={<Terminal className="h-4 w-4" />} code={guardSnippet} />
          <CodeCard title="On-chain instruction flow" icon={<GitBranch className="h-4 w-4" />} code={instructionSnippet} />
        </section>

        {/* Program + proof */}
        <section className="mt-4 card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="section-label">Deployed program</p>
              <h2 className="mt-1 text-[16px] font-extrabold text-(--ink)">Solana devnet enforcement</h2>
              <p className="mono mt-1 break-all text-[11px] font-bold text-(--blue)">{PROGRAM_ID}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={proofData.program.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
                Program explorer <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Link href="/proof" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-(--ink) px-3 text-[11px] font-bold text-white hover:bg-[#273244]">
                Live devnet proof <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <RoadmapRow done label="Guard evaluation on-chain" detail="edge vs tolerance while stale" />
            <RoadmapRow done label="Escrow + refund of unfair edge" detail="stake returned to the trader" />
            <RoadmapRow label="ProtocolVault finalization" detail="filled-order destination — documented next step" />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-(--ink-3)">
            This is a devnet reference implementation. Production use still needs counterparty settlement, an audited program, and a hardened
            oracle-authority path. See <Link href="/proof" className="font-semibold text-(--blue) hover:underline">/proof</Link> for what is real today.
          </p>
        </section>
      </div>
    </FairXShell>
  );
}

function ArchBox({ step, title, body, tone, highlight = false }: { step: string; title: string; body: string; tone: "amber" | "blue" | "green" | "ink"; highlight?: boolean }) {
  const toneMap = {
    amber: "border-[#f0d39a] bg-(--amber-bg) text-(--amber)",
    blue: "border-[#cddcf5] bg-(--blue-bg) text-(--blue)",
    green: "border-[#bce6d5] bg-(--green-bg) text-(--green)",
    ink: "border-(--ink) bg-(--ink) text-white",
  } as const;
  return (
    <div className={`flex-1 rounded-lg border p-3 ${highlight ? toneMap.ink : "border-(--border) bg-white"}`}>
      <p className={`inline-flex rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] ${toneMap[tone]}`}>{step}</p>
      <p className={`mt-2 text-[12px] font-bold ${highlight ? "text-white" : "text-(--ink)"}`}>{title}</p>
      <p className={`mt-1 text-[9.5px] leading-relaxed ${highlight ? "text-white/75" : "text-(--ink-3)"}`}>{body}</p>
    </div>
  );
}

function ArchArrow() {
  return (
    <div className="flex shrink-0 items-center px-0.5 text-(--ink-3)">
      <ArrowRight className="h-3.5 w-3.5" />
    </div>
  );
}

function PlugStep({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8e5fa] bg-[#f6f9ff] text-(--blue)">{icon}</span>
        <span className="mono text-[11px] font-bold text-(--ink-3)">{n}</span>
      </div>
      <p className="mt-3 text-[12.5px] font-bold text-(--ink)">{title}</p>
      <p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">{body}</p>
    </div>
  );
}

function CodeCard({ title, icon, code }: { title: string; icon: React.ReactNode; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--border)">
      <div className="flex items-center gap-2 border-b border-(--border) bg-[#f8fafc] px-3.5 py-2.5">
        <span className="text-(--ink-2)">{icon}</span>
        <p className="text-[11px] font-bold text-(--ink)">{title}</p>
      </div>
      <div className="overflow-x-auto bg-[#0f1729] p-3.5">
        <pre className="mono text-[10.5px] leading-relaxed text-[#d7e0ee]">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function RoadmapRow({ label, detail, done = false }: { label: string; detail: string; done?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${done ? "border-[#bce6d5] bg-(--green-bg)" : "border-[#f0d39a] bg-(--amber-bg)"}`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-(--green)" : "bg-(--amber)"}`} />
        <p className={`text-[10.5px] font-bold ${done ? "text-(--green)" : "text-(--amber)"}`}>{done ? "Live on devnet" : "Planned"}</p>
      </div>
      <p className="mt-1 text-[11px] font-semibold text-(--ink)">{label}</p>
      <p className="text-[9.5px] leading-snug text-(--ink-3)">{detail}</p>
    </div>
  );
}
