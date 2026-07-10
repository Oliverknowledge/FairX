"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge, cn } from "@/components/lineguard/ui";
import { proofData } from "@/lib/proof/staticProofData";

type DemoTone = "neutral" | "blue" | "amber" | "red" | "green";

type DemoStep = {
  eyebrow: string;
  title: string;
  body: string;
  tone: DemoTone;
  registerLabel: string;
  registers: Array<{ label: string; value: string; tone?: DemoTone }>;
  proof?: { href: string; label: string };
};

const yesCase = proofData.cases.find((proof) => proof.id === "yes")!;
const noCase = proofData.cases.find((proof) => proof.id === "no")!;

const STEPS: DemoStep[] = [
  {
    eyebrow: "01 · MARKET SYNCHRONIZED",
    title: "England wins is trading at 40¢.",
    body: "The displayed price and fair price both reflect material sequence 1. A normal order can proceed because the market is in sync.",
    tone: "green",
    registerLabel: "Freshness registers",
    registers: [
      { label: "materialSeq", value: "1", tone: "blue" },
      { label: "pricedAtSeq", value: "1", tone: "blue" },
      { label: "Displayed YES", value: "40¢" },
      { label: "Fair YES", value: "40¢", tone: "green" },
    ],
  },
  {
    eyebrow: "02 · MATERIAL EVENT",
    title: "A material match event is ingested.",
    body: "The source event advances the market’s material sequence. The quote has not repriced yet, so the guard has a freshness fact to evaluate.",
    tone: "amber",
    registerLabel: "Event impact",
    registers: [
      { label: "Source event", value: "GOAL" },
      { label: "materialSeq", value: "2", tone: "amber" },
      { label: "pricedAtSeq", value: "1", tone: "blue" },
      { label: "Source mode", value: "canonical replay" },
    ],
  },
  {
    eyebrow: "03 · STALE WINDOW",
    title: "The price is now stale — trading is not frozen.",
    body: "LineGuard does not blanket-pause the market. It checks whether each individual order benefits from the quote lag.",
    tone: "amber",
    registerLabel: "Guard condition",
    registers: [
      { label: "Stale window", value: "OPEN", tone: "amber" },
      { label: "Sequence gap", value: "2 > 1", tone: "amber" },
      { label: "Tolerance", value: "2¢" },
      { label: "Next action", value: "Evaluate order" },
    ],
  },
  {
    eyebrow: "04 · YES BOT ATTACK",
    title: "A bot tries to buy YES at a stale 40¢.",
    body: "The fair YES side is 63¢ after the event. The frozen 40¢ observed price creates a +23¢ stale edge, above the 2¢ tolerance.",
    tone: "red",
    registerLabel: "Frozen order inputs",
    registers: [
      { label: "Side", value: "YES" },
      { label: "Observed price", value: "40¢" },
      { label: "Fair side price", value: "63¢", tone: "green" },
      { label: "Edge", value: "+23¢", tone: "red" },
    ],
  },
  {
    eyebrow: "05 · ON-CHAIN REFUND",
    title: "The stale-edge YES order is refunded to the trader on-chain.",
    body: "The program binds the source event hash into market state, computes the edge, and refunds the escrowed stake to the trader. Use the panel below to generate a fresh run — or open this canonical evidence.",
    tone: "red",
    registerLabel: "Verdict",
    registers: [
      { label: "Verdict", value: "VOIDED_REFUNDED", tone: "red" },
      { label: "Destination", value: "Refunded → trader", tone: "green" },
      { label: "Event hash", value: "bound on-chain", tone: "blue" },
      { label: "Proof txs", value: `${yesCase.txs.length}` },
    ],
    proof: { href: yesCase.txs.at(-1)!.explorerUrl, label: "Open refund evaluation tx" },
  },
  {
    eyebrow: "06 · RECEIPT INTEGRITY",
    title: "The receipt seals why the verdict happened.",
    body: "The receipt includes the sequences, observed and fair prices, verdict, and attached on-chain proof. Changing any sealed field makes the hash fail.",
    tone: "green",
    registerLabel: "Portable proof",
    registers: [
      { label: "Hash", value: "sha256 sealed", tone: "green" },
      { label: "Tamper test", value: "hash mismatch" },
      { label: "Receipt mode", value: "canonical proof" },
      { label: "Verifier", value: "browser-side" },
    ],
    proof: { href: proofData.receipt.verifierHref, label: "Verify canonical receipt" },
  },
  {
    eyebrow: "07 · NO STALE TRADE",
    title: "A stale NO order does not capture the event edge.",
    body: "The market is still stale, but buying NO at 60¢ against a 37¢ fair NO price has -23¢ edge. It is not an exploit, so the guard allows it.",
    tone: "blue",
    registerLabel: "Frozen order inputs",
    registers: [
      { label: "Side", value: "NO" },
      { label: "Observed price", value: "60¢" },
      { label: "Fair side price", value: "37¢", tone: "green" },
      { label: "Edge", value: "-23¢", tone: "blue" },
    ],
  },
  {
    eyebrow: "08 · ON-CHAIN FILL → VAULT",
    title: "The no-edge NO order fills and finalizes into the ProtocolVault.",
    body: "The program records STALE_ALLOWED_NO_EDGE and moves the stake to the ProtocolVault instead of refunding it. Block exploitation, keep fair liquidity — with an explicit on-chain destination.",
    tone: "blue",
    registerLabel: "Verdict",
    registers: [
      { label: "Verdict", value: "STALE_ALLOWED_NO_EDGE", tone: "blue" },
      { label: "Destination", value: "Finalized → vault", tone: "green" },
      { label: "Program", value: "Solana devnet" },
      { label: "Proof txs", value: `${noCase.txs.length}` },
    ],
    proof: { href: noCase.txs.at(-1)!.explorerUrl, label: "Open fill evaluation tx" },
  },
  {
    eyebrow: "09 · PROOF SUMMARY",
    title: "FairX protects settlement at the trade level.",
    body: "The same stale window produced two different outcomes: the beneficial stale YES trade was refunded; the no-edge NO trade was allowed. Both outcomes have fixed devnet evidence.",
    tone: "green",
    registerLabel: "What this proves",
    registers: [
      { label: "Program", value: "deployed on devnet", tone: "green" },
      { label: "YES stale edge", value: "refunded", tone: "red" },
      { label: "NO no-edge", value: "filled", tone: "blue" },
      { label: "Product", value: "devnet-backed prototype" },
    ],
  },
];

const SUMMARY = [
  "FairX / LineGuard devnet proof summary",
  `Program: ${proofData.program.id} (Solana devnet)`,
  "YES stale attack: +23¢ edge → VOIDED_REFUNDED, stake refunded to trader on-chain.",
  "NO stale trade: -23¢ edge → STALE_ALLOWED_NO_EDGE, stake finalized into the ProtocolVault on-chain.",
  "Source event hash is bound into on-chain market state and emitted in the guard verdict.",
  "Receipt integrity: canonical sha256 payload detects sealed-field tampering.",
  "Scope: devnet-backed prototype; not a real-money product, not mainnet.",
].join("\n");

export function DemoSequence() {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const step = STEPS[active];

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setActive((current) => {
        if (current >= STEPS.length - 1) {
          setRunning(false);
          return current;
        }
        return current + 1;
      });
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [active, running]);

  const proofCount = useMemo(() => active + 1, [active]);

  const start = () => {
    setCopied(false);
    setActive(0);
    setRunning(true);
  };

  const copySummary = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SUMMARY);
      } else {
        const input = document.createElement("textarea");
        input.value = SUMMARY;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(input);
        if (!copied) throw new Error("Clipboard copy unavailable");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-(--ink)/10 bg-white shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
      <div className="border-b border-(--border) bg-[#101828] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--green)">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="mono text-[9px] uppercase tracking-[0.16em] text-[#93a4bf]">Proof walkthrough</p>
              <p className="text-[13px] font-bold">LineGuard decision trail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] text-[#b9c5d9]">PROOF POINT {proofCount} / {STEPS.length}</span>
            <Badge tone="green" dot>fixed devnet evidence</Badge>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-(--green) transition-[width] duration-500" style={{ width: `${(proofCount / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="grid min-h-[380px] lg:grid-cols-[minmax(0,1.15fr)_370px]">
        <div className="flex min-w-0 flex-col p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", toneDot(step.tone))} />
            <p className="mono text-[10px] font-semibold tracking-[0.14em] text-(--ink-3)">{step.eyebrow}</p>
          </div>

          <div key={active} className="slide-in mt-5 max-w-2xl">
            <h2 className="text-[29px] font-extrabold leading-[1.04] tracking-[-0.035em] text-(--ink) sm:text-[38px]">{step.title}</h2>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-(--ink-2)">{step.body}</p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-9">
            <button
              type="button"
              onClick={start}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--ink) px-3 text-[11.5px] font-bold text-white hover:opacity-90"
            >
              <Play className="h-3.5 w-3.5" /> {running ? "Running…" : "Run proof flow"}
            </button>
            <button
              type="button"
              onClick={() => { setRunning(false); setActive(0); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11.5px] font-bold text-(--ink-2) hover:bg-[#f8fafc]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            {active === STEPS.length - 1 && (
              <button
                type="button"
                onClick={copySummary}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--green)/30 bg-(--green-bg) px-3 text-[11.5px] font-bold text-(--green) hover:opacity-85"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy proof summary"}
              </button>
            )}
          </div>
        </div>

        <aside className="border-t border-(--border) bg-[#f8fafc] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <p className="section-label">{step.registerLabel}</p>
          <div className="mt-2 rounded-xl border border-(--border) bg-white px-3">
            {step.registers.map((register) => (
              <div key={register.label} className="flex items-center justify-between gap-3 border-b border-(--border) py-3 last:border-b-0">
                <span className="text-[11.5px] text-(--ink-2)">{register.label}</span>
                <span className={cn("mono text-right text-[11px] font-bold", toneText(register.tone))}>{register.value}</span>
              </div>
            ))}
          </div>

          {step.proof && (
            step.proof.href.startsWith("/") ? (
              <Link href={step.proof.href} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-(--blue)/25 bg-(--blue-bg) px-3 py-2.5 text-[11.5px] font-bold text-(--blue) hover:opacity-85">
                {step.proof.label} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <a href={step.proof.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-(--blue)/25 bg-(--blue-bg) px-3 py-2.5 text-[11.5px] font-bold text-(--blue) hover:opacity-85">
                {step.proof.label} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setRunning(false); setActive((current) => Math.max(0, current - 1)); }}
              disabled={active === 0}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-bold text-(--ink-2) disabled:opacity-35"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => { setRunning(false); setActive((current) => Math.min(STEPS.length - 1, current + 1)); }}
              disabled={active === STEPS.length - 1}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-bold text-(--ink-2) disabled:opacity-35"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-5 border-t border-(--border) pt-4 text-[10.5px] leading-relaxed text-(--ink-3)">
            This replay is presentation-only. It links to existing devnet transactions but does not submit orders, connect a wallet, or claim live feed status.
          </p>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) bg-white px-4 py-3 sm:px-5">
        <p className="text-[10.5px] text-(--ink-3)">Want the underlying reducer, feeds, escrow, and on-chain controls?</p>
        <Link href="/terminal" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--blue) hover:underline">
          Open technical terminal <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

function toneDot(tone: DemoTone): string {
  if (tone === "green") return "bg-(--green)";
  if (tone === "red") return "bg-(--red)";
  if (tone === "amber") return "bg-(--amber)";
  if (tone === "blue") return "bg-(--blue)";
  return "bg-(--ink-3)";
}

function toneText(tone?: DemoTone): string {
  if (tone === "green") return "text-(--green)";
  if (tone === "red") return "text-(--red)";
  if (tone === "amber") return "text-(--amber)";
  if (tone === "blue") return "text-(--blue)";
  return "text-(--ink)";
}
