"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileWarning, FolderCheck, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { TxLineProvenance } from "@/components/fairx/TxLineProvenance";
import { proofData } from "@/lib/proof/staticProofData";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";

type Tone = "blue" | "amber" | "red" | "green";
type Step = {
  title: string;
  copy: string;
  tone: Tone;
  fields: Array<[string, string]>;
  links?: Array<{ label: string; href: string }>;
  provenance?: boolean;
  tamper?: boolean;
};

const yes = proofData.cases.find((item) => item.id === "yes")!;
const no = proofData.cases.find((item) => item.id === "no")!;
const displayed = canonicalCapture.odds.displayedPricingInput.impliedProbability;
const fair = canonicalCapture.odds.normalizedPricingInput.impliedProbability;
const edge = fair - displayed;
const cents = (value: number) => `${(value * 100).toFixed(3)}¢`;
const percent = (value: number) => `${(value * 100).toFixed(3)}%`;

const STEPS: Step[] = [
  {
    title: "TxLINE reports a material match event.",
    copy: "This canonical flow starts with a genuine record returned by TxLINE's historical scores endpoint. The exact raw record is preserved before normalization.",
    tone: "blue",
    provenance: true,
    fields: [["Source mode", "TxLINE historical"], ["Fixture", `France vs Morocco · ${canonicalCapture.fixtureId}`], ["Endpoint", canonicalCapture.endpoint], ["Event", `GOAL · seq ${canonicalCapture.normalizedEvent.seq}`], ["Raw hash", canonicalCapture.rawPayloadHash], ["Normalized hash", canonicalCapture.normalizedEventHash], ["Validation", "validateStatV2 PASSED"]],
  },
  {
    title: "The event is known, but the displayed price has not repriced.",
    copy: "Market freshness is now an on-chain fact. The quote stays visible; LineGuard waits for an order before deciding whether anything is unfair.",
    tone: "amber",
    fields: [["Pre-event France probability", percent(displayed)], ["Post-event France probability", percent(fair)], ["Market still displays", percent(displayed)], ["materialSeq", String(canonicalCapture.normalizedEvent.seq)], ["pricedAtSeq", String(canonicalCapture.normalizedEvent.seq - 1)], ["Condition", `${canonicalCapture.normalizedEvent.seq} > ${canonicalCapture.normalizedEvent.seq - 1}`]],
    links: [{ label: "Open event-ingest transaction", href: yes.txs[1].explorerUrl }],
  },
  {
    title: "The YES order benefits from information the market has not priced in.",
    copy: "The order freezes the genuine pre-event StablePrice quote and enters its OrderEscrow PDA. The genuine post-event fair input creates positive stale edge.",
    tone: "red",
    fields: [["Side", "YES"], ["Observed price", cents(displayed)], ["Fair side price", cents(fair)], ["Edge", `+${cents(edge)}`], ["OrderEscrow PDA", yes.orderPda], ["Escrow stake", "0.02 SOL"]],
    links: [{ label: "Open place-order transaction", href: yes.txs[2].explorerUrl }],
  },
  {
    title: "LineGuard refunds the exploitative order on Solana.",
    copy: "The on-chain verdict matches the frontend calculation. The escrowed stake returns to the trader; the market itself is not frozen.",
    tone: "red",
    fields: [["Program ID", proofData.program.id], ["Market PDA", yes.marketPda], ["MarketConfig PDA", yes.marketConfigPda], ["OrderEscrow PDA", yes.orderPda], ["Verdict", "VOIDED_REFUNDED"], ["Edge", `+${cents(edge)}`], ["Destination", "REFUNDED_TO_TRADER"], ["Event hash", yes.sourceEventHash]],
    links: [{ label: "Open YES evaluation transaction", href: yes.txs[3].explorerUrl }],
  },
  {
    title: "The receipt verifies the event, order, and verdict.",
    copy: "The browser recomputes the canonical receipt hash. Change one sealed proof field and verification fails immediately.",
    tone: "green",
    tamper: true,
    fields: [["Payload integrity", "VERIFIED"], ["Normalized event", "VERIFIED"], ["TxLINE validation", canonicalValidation.simulationPassed ? "validateStatV2 PASSED" : "UNAVAILABLE"], ["Destination", "REFUNDED_TO_TRADER"], ["Tamper test", "Change any TxLINE field"]],
    links: [{ label: "Open canonical YES receipt verifier", href: proofData.receipt.verifierHref }],
  },
  {
    title: "LineGuard blocked only the exploitative side.",
    copy: "NO has negative edge, so it gains nothing from the stale quote. LineGuard allows it and moves the stake to ProtocolVault instead of pausing the whole market.",
    tone: "blue",
    fields: [["Side", "NO"], ["Observed / fair", `${cents(1 - displayed)} / ${cents(1 - fair)}`], ["Edge", `−${cents(edge)}`], ["Verdict", "STALE_ALLOWED_NO_EDGE"], ["Destination", "FINALIZED_TO_VAULT"], ["Vault PDA", proofData.vault.pda]],
    links: [{ label: "Open canonical NO receipt verifier", href: proofData.receipt.noVerifierHref }, { label: "Open NO finalization transaction", href: no.txs[3].explorerUrl }, { label: "Open ProtocolVault", href: proofData.vault.explorerUrl }],
  },
];

const SUMMARY = `FairX / LineGuard canonical devnet proof\nProgram: ${proofData.program.id}\nEvent: genuine TxLINE historical GOAL seq ${canonicalCapture.normalizedEvent.seq}, hash ${canonicalCapture.normalizedEventHash}\nYES: +${cents(edge)} edge → VOIDED_REFUNDED → trader\nNO: −${cents(edge)} edge → STALE_ALLOWED_NO_EDGE → ProtocolVault ${proofData.vault.pda}\nTxLINE validateStatV2: passed.`;

export function DemoSequence() {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tampered, setTampered] = useState(false);
  const step = STEPS[active];

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setActive((current) => {
      if (current >= STEPS.length - 1) { setRunning(false); return current; }
      return current + 1;
    }), 1_700);
    return () => window.clearTimeout(timer);
  }, [active, running]);

  const reset = () => { setRunning(false); setActive(0); setTampered(false); setCopied(false); };
  const start = () => { reset(); setRunning(true); };
  const copy = async () => { try { await navigator.clipboard.writeText(SUMMARY); setCopied(true); window.setTimeout(() => setCopied(false), 1_800); } catch { setCopied(false); } };
  const openAll = () => [...yes.txs, ...no.txs].forEach((tx) => window.open(tx.explorerUrl, "_blank", "noopener"));

  return (
    <section className="overflow-hidden rounded-2xl border border-(--border) bg-white shadow-[0_16px_55px_rgba(15,23,42,0.07)]">
      <div className="border-b border-white/10 bg-[#0b1220] px-4 py-3.5 text-white sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--blue)"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8fa7cc]">Locked proof sequence</p><p className="text-[13px] font-bold">From event evidence to selective settlement</p></div></div>
          <span className="mono text-[10px] text-[#b8c4d7]">STAGE {active + 1} / {STEPS.length}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#65d6aa] transition-[width] duration-500" style={{ width: `${((active + 1) / STEPS.length) * 100}%` }} /></div>
      </div>

      <div className="grid min-h-[470px] lg:grid-cols-[minmax(0,1.2fr)_390px]">
        <div className="flex min-w-0 flex-col p-5 sm:p-7">
          <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${toneText(step.tone)}`}>Stage {active + 1}</p>
          <div key={active} className="slide-in mt-4">
            <h2 className="max-w-3xl text-[28px] font-extrabold leading-[1.04] tracking-[-0.04em] text-(--ink) sm:text-[38px]">{step.title}</h2>
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">{step.copy}</p>
          </div>

          {step.provenance && <div className="mt-5 max-w-2xl"><TxLineProvenance compact mode="historical" endpoint={canonicalCapture.endpoint} fixtureId={canonicalCapture.fixtureId} eventType={canonicalCapture.normalizedEvent.eventType} sequence={canonicalCapture.normalizedEvent.seq} receivedAt={canonicalCapture.receivedAt} rawEventHash={canonicalCapture.rawPayloadHash} normalizedEventHash={canonicalCapture.normalizedEventHash} proofState="TxLINE validation passed; normalized hash committed through LineGuard" trace={canonicalCapture.normalizedEvent.trace} /></div>}

          {step.tamper && (
            <div className={`mt-5 max-w-xl rounded-xl border p-3.5 ${tampered ? "border-(--red)/35 bg-(--red-bg)" : "border-(--green)/30 bg-(--green-bg)"}`}>
              <div className="flex items-start gap-2">{tampered ? <FileWarning className="mt-0.5 h-5 w-5 text-(--red)" /> : <FolderCheck className="mt-0.5 h-5 w-5 text-(--green)" />}<div><p className={`text-[12px] font-extrabold ${tampered ? "text-(--red)" : "text-(--green)"}`}>{tampered ? "TAMPER DETECTED" : "INTEGRITY VERIFIED"}</p><p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">{tampered ? "The recomputed receipt hash no longer matches the sealed value." : "Every sealed proof field recomputes to the recorded receipt hash."}</p></div></div>
              <button type="button" onClick={() => setTampered((value) => !value)} className="mt-3 h-8 rounded-md border border-current/20 bg-white px-3 text-[10px] font-bold text-(--ink-2)">{tampered ? "Restore proof" : "Tamper with proof"}</button>
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-8">
            <button type="button" onClick={start} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--ink) px-3 text-[11px] font-bold text-white"><Play className="h-3.5 w-3.5" />{running ? "Running…" : "Start proof flow"}</button>
            <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--border) px-3 text-[11px] font-bold text-(--ink-2)"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
            <button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--border) px-3 text-[11px] font-bold text-(--ink-2)">{copied ? <Check className="h-3.5 w-3.5 text-(--green)" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy proof summary"}</button>
            <button type="button" onClick={openAll} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--border) px-3 text-[11px] font-bold text-(--ink-2)"><ExternalLink className="h-3.5 w-3.5" />Open all explorer links</button>
          </div>
        </div>

        <aside className="border-t border-(--border) bg-[#f8fafc] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <p className="section-label">Evidence at this stage</p>
          <dl className="mt-3 rounded-xl border border-(--border) bg-white px-3">
            {step.fields.map(([label, value]) => <div key={label} className="border-b border-(--border) py-2.5 last:border-0"><dt className="text-[9.5px] font-semibold text-(--ink-3)">{label}</dt><dd className="mono mt-1 break-all text-[10.5px] font-bold leading-relaxed text-(--ink)">{value}</dd></div>)}
          </dl>
          {step.links?.map((link) => link.href.startsWith("/") ? <Link key={link.href} href={link.href} className="mt-2 flex items-center justify-between rounded-lg border border-(--blue)/20 bg-(--blue-bg) px-3 py-2.5 text-[10.5px] font-bold text-(--blue)">{link.label}<ChevronRight className="h-3.5 w-3.5" /></Link> : <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-between rounded-lg border border-(--blue)/20 bg-(--blue-bg) px-3 py-2.5 text-[10.5px] font-bold text-(--blue)">{link.label}<ExternalLink className="h-3.5 w-3.5" /></a>)}
          <div className="mt-4 flex justify-between gap-2"><button type="button" disabled={active === 0} onClick={() => { setRunning(false); setActive((value) => Math.max(0, value - 1)); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-bold text-(--ink-2) disabled:opacity-35"><ChevronLeft className="h-3.5 w-3.5" />Back</button><button type="button" disabled={active === STEPS.length - 1} onClick={() => { setRunning(false); setActive((value) => Math.min(STEPS.length - 1, value + 1)); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-bold text-(--ink-2) disabled:opacity-35">Next stage<ChevronRight className="h-3.5 w-3.5" /></button></div>
          <p className="mt-5 border-t border-(--border) pt-3 text-[9.5px] leading-relaxed text-(--ink-3)">This is a historical TxLINE replay, not a live stream. The offline guided scenario is a separately labelled fallback.</p>
        </aside>
      </div>
    </section>
  );
}

function toneText(tone: Tone): string {
  return tone === "red" ? "text-(--red)" : tone === "amber" ? "text-(--amber)" : tone === "green" ? "text-(--green)" : "text-(--blue)";
}
