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

const instructions = `// Deployed FairX v2 instruction path
initialize_authorities(feed, pricing, [resolutionA, B, C], emergency, 2)
initialize_market_v2(MATCH_WINNER_HOME_V1, fixture commitments,
                     odds payload + pricing model hashes)
place_order_v2(order_id, side, stake, max_edge,
               expected_price, max_slippage,
               pricing_seq, odds_seq, expiry_slot)
evaluate_order_v2() // exact refund or price-weighted Position; Order closes
cancel_order_v2()   // trader timeout recovery; Order closes
reprice_market_v2()
close_market_v2()
prove_resolution_with_txline_v2(borsh_payload_hash, payload)
  // CPI → fixed TxLINE ValidateStatV2; derives outcome internally
approve_resolution_v2() // second distinct authority
execute_resolution_v2() // requires 2-of-3
claim_position_v2()     // winner signs; MarketVault pays; Position closes
close_losing_position_v2() / close_empty_position_v2()`;

const liveNow = [
  "MATCH_WINNER_HOME_V1 template and deterministic TxLINE price commitments",
  "Wallet-signed price, slippage, pricing sequence, odds sequence, and expiry constraints",
  "Positive-edge stale-order refund to the trader",
  "Price-weighted pool shares and isolated per-market MarketVault accounting",
  "Direct TxLINE ValidateStatV2 CPI and internally derived outcome",
  "2-of-3 resolution approval, owner-signed claims, and explicit account-rent recovery",
];

const planned = [
  "Production oracle decentralization",
  "Complete counterparty matching or AMM/order book",
  "Mainnet deployment, independent security audit, and real-money operation",
];

const flow = [
  ["1", "Initialize template", "Commit fixture, teams, stat keys, pricing and materiality hashes."],
  ["2", "Escrow user order", "The trader signs and owns its OrderEscrowV2 and Position PDA."],
  ["3", "Evaluate", "Refund stale positive edge or accept into the isolated MarketVault."],
  ["4", "Reprice and close", "Synchronize the quote, then the feed authority closes trading."],
  ["5", "Validate through CPI", "Invoke TxLINE ValidateStatV2 with the exact Borsh payload."],
  ["6", "Approve", "Two distinct resolution authorities approve the derived outcome."],
  ["7", "Resolve", "Execute only the CPI-derived result after threshold."],
  ["8", "Claim and verify", "The Position owner claims; verify market-vault conservation."],
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
          <CapabilityCard title="Implemented in this repository — confirm deployment above" tone="green" items={liveNow} />
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
            <p className="mt-3 text-[10px] leading-relaxed text-(--ink-2)">The status strip checks the executable ProgramData account. Repository instructions are not evidence of deployment; use the independent verifier and explorer links before treating v3 as live.</p>
            <a href={proofData.program.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] font-bold text-(--blue) hover:underline">Open devnet program <ExternalLink className="h-3.5 w-3.5" /></a>
            <Link href="/proof" className="mt-2 flex items-center gap-1.5 text-[10.5px] font-bold text-(--blue) hover:underline">Inspect on-chain proof <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="rounded-xl border border-[#d9e6fc] bg-[#f7faff] p-4 text-[10.5px] leading-relaxed text-[#3d5e95]">
          <p className="flex items-center gap-2 font-bold"><Radio className="h-4 w-4" />TxLINE boundary</p>
          <p className="mt-1.5">Only <span className="mono">MATCH_WINNER_HOME_V1</span> is settlement-enabled. <span className="mono">TOTAL_GOALS</span>, <span className="mono">NEXT_GOAL</span>, and custom propositions are rejected. The deployed v2 resolver CPIs into the fixed TxLINE devnet program, requires <span className="mono">ValidateStatV2</span> success, and derives the outcome inside LineGuard.</p>
        </section>
      </div>
    </FairXShell>
  );
}

function CapabilityCard({ title, tone, items }: { title: string; tone: "green" | "amber"; items: string[] }) {
  const live = tone === "green";
  return <section className={`rounded-xl border p-4 ${live ? "border-[#bce6d5] bg-(--green-bg)" : "border-[#f0d39a] bg-(--amber-bg)"}`}><div className="flex items-center gap-2">{live ? <ShieldCheck className="h-4 w-4 text-(--green)" /> : <Wrench className="h-4 w-4 text-(--amber)" />}<h2 className={`text-[12px] font-bold ${live ? "text-(--green)" : "text-(--amber)"}`}>{title}</h2></div><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex items-start gap-2 text-[10px] leading-relaxed text-(--ink-2)">{live ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--green)" /> : <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--amber)" />}{item}</li>)}</ul></section>;
}
