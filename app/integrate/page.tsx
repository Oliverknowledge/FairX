import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, GitBranch, Radio, ShieldCheck, Timer, Wrench } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { RuntimeStatusStrip } from "@/components/fairx/RuntimeStatusStrip";
import { proofData } from "@/lib/proof/staticProofData";

export const metadata: Metadata = {
  title: "Integrate LineGuard",
  description: "The current LineGuard integration flow, deployed devnet capabilities, and honest production gaps.",
};

const instructions = `// Current Anchor instruction names in programs/lineguard/src/lib.rs
initialize_vault()
initialize_market(market_id, material_seq, priced_at_seq,
                  displayed_price_micros, fair_price_micros, tolerance_micros)
initialize_market_config(market_type, fixture_id_hash, market_title_hash,
                         materiality_config_hash, settlement_config_hash)
attach_market_config()
ingest_material_event(new_material_seq, new_fair_price_micros,
                      source_event_hash)
reprice_market(new_priced_at_seq, new_displayed_price_micros)
place_order(order_id, side, stake)
evaluate_order()

// evaluate_order emits GuardVerdict and transfers escrow to either:
// REFUNDED_TO_TRADER | FINALIZED_TO_VAULT`;

const liveNow = [
  "Market freshness registers and displayed/fair price state",
  "Non-zero source event hash commitment by an operator-controlled authority",
  "OrderEscrow PDA creation and deterministic stale-edge calculation",
  "Positive-edge stale-order refund to the trader",
  "Safe/no-edge finalization to ProtocolVault",
  "GuardVerdict event data and tamper-evident receipts",
  "Custom-market initialization and guarded devnet order execution",
];

const planned = [
  "Production oracle decentralization",
  "Direct TxLINE validate_stat CPI",
  "Complete counterparty matching or AMM/order book",
  "Per-market vault accounting beyond the current aggregate vault",
  "Mainnet deployment, independent security audit, and real-money operation",
];

const flow = [
  ["1", "Register market", "Create MarketState with freshness, prices, tolerance, and authority."],
  ["2", "Commit configuration", "Hash type, fixture, title, materiality, and settlement rules; attach MarketConfig."],
  ["3", "Ingest event", "Normalize a material event and commit its source hash through the authority."],
  ["4", "Reprice", "Advance pricedAtSeq when the displayed quote catches up."],
  ["5", "Escrow order", "Freeze side, stake, and observed quote in an OrderEscrow PDA."],
  ["6", "Evaluate", "Calculate fair side price and stale edge deterministically."],
  ["7", "Refund or finalize", "Return exploitative stake to the trader or transfer safe stake to ProtocolVault."],
  ["8", "Build receipt", "Render the on-chain accounts, event hash, config hashes, and transactions for verification."],
];

export default function IntegratePage() {
  return (
    <FairXShell>
      <div className="mx-auto max-w-[1120px] space-y-4">
        <header className="flex flex-col gap-4 border-b border-(--border) pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-label">LineGuard protocol integration</p>
            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.05em] text-(--ink)">Add selective stale-order protection.</h1>
            <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-(--ink-2)">FairX demonstrates LineGuard. A prediction market can integrate the same settlement guard while keeping its own discovery, pricing, and matching layer.</p>
          </div>
          <Link href="/walkthrough" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-(--ink) px-4 text-[11px] font-bold text-white hover:bg-[#273244]">Run the proof walkthrough <ArrowRight className="h-3.5 w-3.5" /></Link>
        </header>

        <RuntimeStatusStrip detailed />

        <section className="grid gap-3 lg:grid-cols-2">
          <CapabilityCard title="Deployed on devnet now" tone="green" items={liveNow} />
          <CapabilityCard title="Still required for production" tone="amber" items={planned} />
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-(--blue)" /><p className="section-label">Integration flow</p></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {flow.map(([n, title, body]) => <div key={n} className="rounded-lg border border-(--border) bg-[#fbfcfe] p-3"><span className="mono text-[9px] font-bold text-(--blue)">{n.padStart(2, "0")}</span><h2 className="mt-1 text-[11.5px] font-bold text-(--ink)">{title}</h2><p className="mt-1 text-[9.5px] leading-relaxed text-(--ink-3)">{body}</p></div>)}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
          <div className="overflow-hidden rounded-xl border border-(--border)">
            <div className="flex items-center justify-between border-b border-(--border) bg-[#f8fafc] px-3.5 py-2.5"><p className="text-[11px] font-bold text-(--ink)">Current repository instruction flow</p><span className="rounded-full bg-(--amber-bg) px-2 py-0.5 text-[9px] font-bold text-(--amber)">not an SDK</span></div>
            <pre className="thin-scroll overflow-x-auto bg-[#0f1729] p-3.5 text-[10px] leading-relaxed text-[#d7e0ee]"><code>{instructions}</code></pre>
          </div>
          <div className="card p-4">
            <p className="section-label">Deployed program</p>
            <p className="mono mt-2 break-all text-[11px] font-bold text-(--blue)">{proofData.program.id}</p>
            <p className="mt-3 text-[10px] leading-relaxed text-(--ink-2)">The status strip checks the executable ProgramData account and whether the deployed binary supports the repository&rsquo;s MarketConfig schema. Configuration instructions must not be treated as available until that runtime check passes.</p>
            <a href={proofData.program.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-(--blue) hover:underline">Open devnet program <ExternalLink className="h-3.5 w-3.5" /></a>
            <Link href="/proof" className="mt-2 flex items-center gap-1.5 text-[10.5px] font-bold text-(--blue) hover:underline">Inspect on-chain proof <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="rounded-xl border border-[#d9e6fc] bg-[#f7faff] p-4 text-[10.5px] leading-relaxed text-[#3d5e95]">
          <p className="flex items-center gap-2 font-bold"><Radio className="h-4 w-4" />TxLINE boundary</p>
          <p className="mt-1.5">TxLINE HTTP/SSE transport and normalization remain off-chain. The authority commits the normalized event evidence hash on-chain. FairX does not claim a decentralized production oracle or a direct TxLINE CPI today.</p>
        </section>
      </div>
    </FairXShell>
  );
}

function CapabilityCard({ title, tone, items }: { title: string; tone: "green" | "amber"; items: string[] }) {
  const live = tone === "green";
  return <section className={`rounded-xl border p-4 ${live ? "border-[#bce6d5] bg-(--green-bg)" : "border-[#f0d39a] bg-(--amber-bg)"}`}><div className="flex items-center gap-2">{live ? <ShieldCheck className="h-4 w-4 text-(--green)" /> : <Wrench className="h-4 w-4 text-(--amber)" />}<h2 className={`text-[12px] font-bold ${live ? "text-(--green)" : "text-(--amber)"}`}>{title}</h2></div><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex items-start gap-2 text-[10px] leading-relaxed text-(--ink-2)">{live ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--green)" /> : <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--amber)" />}{item}</li>)}</ul></section>;
}
