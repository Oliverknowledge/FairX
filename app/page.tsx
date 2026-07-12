import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, CheckCircle2, CircleDollarSign, Coins, FileCheck2, Gavel, HandCoins, Hash, Radio, ShieldCheck, Target, Vault, Workflow } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { RuntimeStatusStrip } from "@/components/fairx/RuntimeStatusStrip";
import { TxLineProvenance } from "@/components/fairx/TxLineProvenance";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";
import { canonicalV2Lifecycle } from "@/lib/proof/v2Lifecycle";

export const metadata: Metadata = {
  title: "Fair settlement for live prediction markets",
  description: "FairX uses LineGuard and TxLINE event evidence to refund stale-price exploits and finalize safe trades on Solana devnet.",
};

const displayed = canonicalCapture.odds.displayedPricingInput.impliedProbability;
const fair = canonicalCapture.odds.normalizedPricingInput.impliedProbability;
const edge = fair - displayed;
const price = (value: number) => `${(value * 100).toFixed(3)}¢`;
const probability = (value: number) => `${(value * 100).toFixed(3)}%`;
const v2 = canonicalV2Lifecycle;

export default function HomePage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1180px]">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_380px] lg:items-stretch">
          <div className="rounded-2xl border border-(--border) bg-white p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-(--blue)/20 bg-(--blue-bg) px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-(--blue)">FairX · powered by LineGuard</span>
              <span className="rounded-full border border-(--green)/20 bg-(--green-bg) px-2.5 py-1 text-[9.5px] font-bold text-(--green)">Solana devnet</span>
            </div>
            <h1 className="mt-6 max-w-4xl text-[38px] font-extrabold leading-[0.98] tracking-[-0.065em] text-(--ink) sm:text-[58px]">Polymarket for live football, with LineGuard protection on every order.</h1>
            <p className="mt-5 max-w-3xl text-[15px] font-medium leading-relaxed text-(--ink-2) sm:text-[17px]">When genuine TxLINE evidence moves before the market reprices, LineGuard refunds only the orders exploiting the stale price.</p>
            <p className="mt-3 max-w-2xl text-[11.5px] leading-relaxed text-(--ink-3)">FairX is designed to prevent stale-price exploitation and make every market decision independently auditable. Devnet SOL only.</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/walkthrough" className="inline-flex h-11 items-center gap-2 rounded-lg bg-(--ink) px-4 text-[11.5px] font-bold text-white hover:bg-[#273244]">Run the proof walkthrough <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/markets/france-morocco-france-win" className="inline-flex h-11 items-center gap-2 rounded-lg bg-(--blue) px-4 text-[11.5px] font-bold text-white">Open the market <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/proof" className="inline-flex h-11 items-center gap-2 rounded-lg border border-(--blue)/25 bg-(--blue-bg) px-4 text-[11.5px] font-bold text-(--blue) hover:border-(--blue)/45">Inspect on-chain proof <FileCheck2 className="h-4 w-4" /></Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-[#283448] bg-[#0b1220] p-5 text-white sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fa7cc]">Product truth</p>
            <ul className="mt-4 space-y-3">
              {[
                "FairX v2 deployed on Solana devnet · slot 475831626",
                "Direct TxLINE ValidateStatV2 CPI verified",
                "2-of-3 threshold resolution executed",
                "Wallet-owned Position and isolated market vault verified",
                "User-owned devnet wallet lifecycle · refund, position and claim",
              ].map((item) => <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#d5deeb]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#65d6aa]" />{item}</li>)}
            </ul>
            <div className="mt-6 border-t border-white/10 pt-4 text-[10px] leading-relaxed text-[#9fb0c9]">Canonical v2 used a secure test-user devnet keypair, not Phantom. Phantom and Solflare remain available for public user transactions. Devnet only; no real-money settlement.</div>
          </aside>
        </section>

        <div className="mt-3"><RuntimeStatusStrip detailed /></div>

        <section className="mt-10" aria-labelledby="selective-question">
          <div className="max-w-3xl">
            <p className="section-label">The problem in one view</p>
            <h2 id="selective-question" className="mt-2 text-[27px] font-extrabold tracking-[-0.045em] text-(--ink) sm:text-[36px]">Should every stale trade be cancelled?</h2>
            <p className="mt-2 text-[16px] font-bold text-(--blue)">No. Only the trade exploiting the stale information.</p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Canonical France probability movement">
            <CanonicalMetric label="France probability before event" value={probability(displayed)} />
            <CanonicalMetric label="France probability after event" value={probability(fair)} tone="blue" />
            <CanonicalMetric label="Stale-price edge" value={price(edge)} tone="red" />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl border border-(--border) bg-white p-4">
              {[
                ["Goal occurs", "The match changes."],
                ["TxLINE publishes event", "materialSeq advances."],
                ["Old price still displayed", "pricedAtSeq stays behind."],
                ["Bot submits favourable order", "The stale edge is frozen."],
              ].map(([title, detail], index) => <div key={title} className="relative pb-5 last:pb-0"><div className="flex gap-3"><span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--blue-bg) text-[10px] font-bold text-(--blue)">{index + 1}</span><div><p className="text-[11.5px] font-bold text-(--ink)">{title}</p><p className="mt-0.5 text-[9.5px] text-(--ink-3)">{detail}</p></div></div>{index < 3 && <ArrowDown className="absolute bottom-1.5 left-2 h-3 w-3 text-(--ink-3)" />}</div>)}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <VerdictCard side="YES attack" observed={price(displayed)} fair={price(fair)} edge={`+${price(edge)}`} verdict="VOIDED_REFUNDED" destination="Refunded to trader" tone="red" />
              <VerdictCard side="Repriced YES" observed={price(fair)} fair={price(fair)} edge="0.000¢" verdict="POSITION_OPENED" destination="Isolated market vault" tone="blue" />
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-(--border) bg-white p-4 sm:p-6">
          <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-(--blue)" /><p className="section-label">How LineGuard works</p></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["01", "TxLINE event arrives", "A material match event reaches the ingestion layer."],
              ["02", "Event hash committed", "The authority commits normalized evidence on-chain."],
              ["03", "Market becomes stale", "materialSeq moves ahead of pricedAtSeq."],
              ["04", "Order enters escrow", "The observed side price and stake are frozen."],
              ["05", "LineGuard calculates edge", "Fair side price minus observed price is evaluated."],
              ["06", "Refund or position", "Exploitative orders refund; safe orders update a wallet-owned Position."],
            ].map(([n, title, body]) => <article key={n} className="rounded-xl border border-(--border) bg-[#fafbfc] p-3.5"><span className="mono text-[9px] font-bold text-(--blue)">{n}</span><h3 className="mt-2 text-[11.5px] font-bold text-(--ink)">{title}</h3><p className="mt-1 text-[9.5px] leading-relaxed text-(--ink-3)">{body}</p></article>)}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-(--green)/25 bg-[#f7fdfa] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-label text-(--green)">A complete market, not just a guard</p>
              <h2 className="mt-2 text-[27px] font-extrabold tracking-[-0.045em] text-(--ink) sm:text-[32px]">Fill → protect → resolve → pay.</h2>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-(--ink-2)">The canonical v2 devnet run proves an exact stale refund, a wallet-owned accepted Position, direct TxLINE CPI, 2-of-3 resolution, owner-signed claim and isolated-vault conservation in one market.</p>
            </div>
            <Link href="/proof#settlement" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-(--green)/30 bg-white px-4 text-[11px] font-bold text-(--green) hover:border-(--green)/50">See the settlement proof <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <LifecycleStep n="01" icon={Coins} title="Both sides fill" body="YES and NO stakes escrow into their on-chain parimutuel pools." />
            <LifecycleStep n="02" icon={ShieldCheck} title="LineGuard protects" body="Stale positive-edge orders are refunded; safe orders finalize to the vault." />
            <LifecycleStep n="03" icon={Gavel} title="Outcome resolved" body="A confirmed score receipt maps deterministically through the committed home-win rule; draws void." />
            <LifecycleStep n="04" icon={HandCoins} title="Winner paid" body="The canonical winning Position claimed exactly 0.01 Devnet SOL from its isolated market vault." />
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_400px]">
          <div>
            <p className="section-label">Verifiable evidence</p>
            <h2 className="mt-2 text-[27px] font-extrabold tracking-[-0.045em] text-(--ink)">Canonical devnet proof, not a simulated claim.</h2>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-(--ink-2)">These artifacts were re-checked against current devnet accounts. Fresh execution is exposed only when runtime status confirms the deployed schema and operator are ready.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Evidence label="Program ID" value={v2.program.programId} href={`https://explorer.solana.com/address/${v2.program.programId}?cluster=devnet`} />
              <Evidence label="Current v2 upgrade" value={`slot ${v2.program.slot}`} href={v2.transactions.upgrade.explorerUrl} />
              <Evidence label="Direct TxLINE CPI" value="ValidateStatV2 verified" href={v2.transactions.txlineCpiProof.explorerUrl} />
              <Evidence label="Stale protection" value="0.01 SOL refunded" href={v2.transactions.staleRefund.explorerUrl} />
              <Evidence label="Wallet-owned Position" value={v2.lifecycle.positionPda} href={`https://explorer.solana.com/address/${v2.lifecycle.positionPda}?cluster=devnet`} />
              <Evidence label="Market vault" value={v2.market.marketVaultPda} href={`https://explorer.solana.com/address/${v2.market.marketVaultPda}?cluster=devnet`} />
            </div>
          </div>
          <div className="self-start">
            <TxLineProvenance
              mode="historical"
              endpoint={canonicalCapture.endpoint}
              fixtureId={canonicalCapture.fixtureId}
              eventType={canonicalCapture.normalizedEvent.eventType}
              sequence={canonicalCapture.normalizedEvent.seq}
              receivedAt={canonicalCapture.receivedAt}
              rawEventHash={canonicalCapture.rawPayloadHash}
              normalizedEventHash={canonicalCapture.normalizedEventHash}
              proofState={canonicalValidation.simulationPassed ? "TxLINE validation passed" : "TxLINE validation unavailable"}
              trace={canonicalCapture.normalizedEvent.trace}
            />
          </div>
        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-2">
          <article className="rounded-2xl border border-(--border) bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--blue-bg) text-(--blue)"><Radio className="h-4 w-4" /></div>
            <h2 className="mt-4 text-[20px] font-extrabold tracking-[-0.035em] text-(--ink)">Why TxLINE matters</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">LineGuard needs an authoritative, low-latency signal that a material event occurred. TxLINE supplies the match event and odds data that opens, updates, and resolves protected market state.</p>
            <p className="mt-3 rounded-lg border border-(--blue)/25 bg-(--blue-bg) p-2.5 text-[10px] text-(--blue)">Canonical source: genuine TxLINE historical score and StablePrice payloads. Stream connectivity is reported separately and is not used to label this replay live.</p>
          </article>
          <article className="rounded-2xl border border-(--border) bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--green-bg) text-(--green)"><Target className="h-4 w-4" /></div>
            <h2 className="mt-4 text-[20px] font-extrabold tracking-[-0.035em] text-(--ink)">FairX demonstrates LineGuard.</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">Prediction markets can integrate the same settlement guard while keeping their own pricing, matching, and product experience.</p>
            <Link href="/integrate" className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-(--blue) hover:underline">Inspect the integration flow <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </article>
        </section>

        <section className="mt-10 rounded-2xl border border-(--ink) bg-(--ink) p-5 text-white sm:flex sm:items-center sm:justify-between sm:p-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98a9c2]">The decisive proof</p><h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.04em]">Watch an unfair trade get refunded on-chain.</h2></div>
          <Link href="/walkthrough" className="mt-4 inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-[11.5px] font-bold text-(--ink) sm:mt-0">Start proof walkthrough <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </FairXShell>
  );
}

function VerdictCard({ side, observed, fair, edge, verdict, destination, tone }: { side: string; observed: string; fair: string; edge: string; verdict: string; destination: string; tone: "red" | "blue" }) {
  const red = tone === "red";
  return <article className={`rounded-xl border p-4 sm:p-5 ${red ? "border-(--red)/30 bg-(--red-bg)" : "border-(--blue)/25 bg-(--blue-bg)"}`}><div className="flex items-center justify-between"><p className={`text-[11px] font-extrabold uppercase tracking-[0.1em] ${red ? "text-(--red)" : "text-(--blue)"}`}>{side}</p>{red ? <ShieldCheck className="h-4 w-4 text-(--red)" /> : <Vault className="h-4 w-4 text-(--blue)" />}</div><dl className="mt-5 space-y-2.5 text-[11px]"><Value label="Displayed" value={observed} /><Value label="Fair side" value={fair} /><Value label="Stale edge" value={edge} strong tone={red ? "red" : "blue"} /></dl><div className="mt-5 border-t border-current/10 pt-4"><p className={`mono break-all text-[10px] font-bold ${red ? "text-(--red)" : "text-(--blue)"}`}>{verdict}</p><p className="mt-1 text-[10.5px] font-semibold text-(--ink-2)">{destination}</p></div></article>;
}

function Value({ label, value, strong = false, tone }: { label: string; value: string; strong?: boolean; tone?: "red" | "blue" }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-(--ink-2)">{label}</dt><dd className={`num ${strong ? "text-[18px] font-extrabold" : "font-bold text-(--ink)"} ${tone === "red" ? "text-(--red)" : tone === "blue" ? "text-(--blue)" : ""}`}>{value}</dd></div>;
}

function Evidence({ label, value, href }: { label: string; value: string; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="group min-w-0 rounded-xl border border-(--border) bg-white p-3 hover:border-(--blue)/35"><p className="text-[9.5px] font-bold text-(--ink-3)">{label}</p><p className="mono mt-1 truncate text-[10px] font-bold text-(--ink)">{value}</p><p className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-bold text-(--blue)">Open evidence <ArrowUpRight className="h-3 w-3" /></p></a>;
}

function CanonicalMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "blue" | "red" }) {
  const color = tone === "red" ? "text-(--red)" : tone === "blue" ? "text-(--blue)" : "text-(--ink)";
  return <div className="rounded-xl border border-(--border) bg-white px-3.5 py-3"><p className="text-[9.5px] font-bold text-(--ink-3)">{label}</p><p className={`num mt-1 text-[20px] font-extrabold ${color}`}>{value}</p></div>;
}

function LifecycleStep({ n, icon: Icon, title, body }: { n: string; icon: typeof Coins; title: string; body: string }) {
  return (
    <article className="rounded-xl border border-(--green)/20 bg-white p-3.5">
      <div className="flex items-center justify-between"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--green-bg) text-(--green)"><Icon className="h-3.5 w-3.5" /></span><span className="mono text-[9px] font-bold text-(--green)">{n}</span></div>
      <h3 className="mt-2.5 text-[11.5px] font-bold text-(--ink)">{title}</h3>
      <p className="mt-1 text-[9.5px] leading-relaxed text-(--ink-3)">{body}</p>
    </article>
  );
}
