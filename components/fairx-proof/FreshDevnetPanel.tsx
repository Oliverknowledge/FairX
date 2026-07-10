"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Copy,
  Cpu,
  ExternalLink,
  Hash,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { postOnChainAction, type OnChainActionResponse } from "@/lib/solana/lineguardProgram";
import { buildFreshDevnetReceipt } from "@/lib/proof/onchainReceipt";
import { buildProofSummary } from "@/lib/proof/proofSummary";
import { encodeReceiptForUrl } from "@/lib/receipts/create";
import type { LineGuardReceipt } from "@/lib/receipts/types";
import type { OnChainSide } from "@/lib/solana/pdas";

const PROGRAM_ID = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";

type SignerInfo = {
  configured: boolean;
  cluster?: string;
  programId: string;
  programExplorerUrl?: string;
  signerPublicKey?: string;
  signerExplorerUrl?: string;
  balanceLamports?: number;
  balanceSol?: number;
  reason?: string;
};

type RunState = {
  side: OnChainSide;
  response: OnChainActionResponse;
  receipt: LineGuardReceipt;
  at: number;
};

const EXPECTED_VERDICT: Record<OnChainSide, string> = {
  YES: "VOIDED_REFUNDED",
  NO: "STALE_ALLOWED_NO_EDGE",
};

const STEP_LABELS = ["Initialize market", "Ingest material event", "Place order into escrow", "Evaluate order"];

function short(value: string | undefined, lead = 6, tail = 6): string {
  if (!value) return "—";
  return value.length > lead + tail + 1 ? `${value.slice(0, lead)}…${value.slice(-tail)}` : value;
}

function signedMicros(value: number): string {
  return `${value > 0 ? "+" : ""}${Math.round(value / 10_000)}¢`;
}

export function FreshDevnetPanel({ compact = false }: { compact?: boolean }) {
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [loadingSigner, setLoadingSigner] = useState(true);
  const [running, setRunning] = useState<OnChainSide | null>(null);
  const [runs, setRuns] = useState<RunState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copySummary = async () => {
    const summary = buildProofSummary(runs.map((run) => run.receipt), PROGRAM_ID);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const openAllLinks = () => {
    const urls = runs.flatMap((run) => run.response.proof?.explorerUrls ?? []);
    for (const url of urls.slice(0, 8)) window.open(url, "_blank", "noopener");
  };

  const loadSigner = useCallback(async () => {
    setLoadingSigner(true);
    try {
      const res = await fetch("/api/solana/lineguard/signer", { cache: "no-store" });
      setSigner((await res.json()) as SignerInfo);
    } catch {
      setSigner({ configured: false, programId: "", reason: "Could not reach the on-chain status route." });
    } finally {
      setLoadingSigner(false);
    }
  }, []);

  useEffect(() => {
    void loadSigner();
  }, [loadSigner]);

  const run = async (side: OnChainSide) => {
    if (running) return;
    setRunning(side);
    setError(null);
    try {
      const response = await postOnChainAction(side === "YES" ? "full-yes-demo" : "full-no-demo");
      if (!response.ok || !response.proof) {
        setError(response.reason ?? "The devnet route did not return a settlement proof.");
        return;
      }
      const receipt = buildFreshDevnetReceipt(side, response.proof);
      setRuns((current) => [{ side, response, receipt, at: Date.now() }, ...current].slice(0, 4));
      void loadSigner();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fresh devnet execution failed.");
    } finally {
      setRunning(null);
    }
  };

  const configured = signer?.configured === true;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--border) bg-[#0f1729] px-4 py-3.5 text-white">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1c66d6]">
            <Cpu className="h-4 w-4" />
          </span>
          <div>
            <p className="mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#8fb0e6]">Live devnet execution</p>
            <h2 className="mt-0.5 text-[15px] font-bold leading-tight">Generate fresh on-chain proof</h2>
            <p className="mt-1 max-w-lg text-[10.5px] leading-relaxed text-[#a9bad6]">
              Each run sends four real Solana devnet transactions through the deployed LineGuard program: it binds the source event hash on-chain,
              then refunds a stale YES attack to the trader or finalizes a NO fill into the ProtocolVault.
            </p>
          </div>
        </div>
        <SignerBadge signer={signer} loading={loadingSigner} />
      </div>

      <div className="p-4">
        {!configured && !loadingSigner && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#f1d59b] bg-(--amber-bg) px-3 py-2.5 text-[11px] leading-relaxed text-[#9b650d]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Devnet operator not configured.</strong> {signer?.reason ?? "Set LINEGUARD_OPERATOR_KEYPAIR (server-side) to enable live execution."} The
              recorded canonical proof and local simulation stay fully available.
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!configured || running !== null}
            onClick={() => run("YES")}
            className="group flex items-center justify-between gap-2 rounded-lg border border-[#f0c5c5] bg-(--red-bg) px-3.5 py-3 text-left transition-colors hover:border-[#e29a9a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-(--red)">
                {running === "YES" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-[11.5px] font-bold text-(--red)">Run fresh on-chain YES attack</span>
                <span className="block text-[9.5px] text-[#a85a5a]">Stale +23¢ edge → expect refund</span>
              </span>
            </span>
            <Sparkles className="h-3.5 w-3.5 text-(--red) opacity-70 group-hover:opacity-100" />
          </button>

          <button
            type="button"
            disabled={!configured || running !== null}
            onClick={() => run("NO")}
            className="group flex items-center justify-between gap-2 rounded-lg border border-[#bfe0f4] bg-(--blue-bg) px-3.5 py-3 text-left transition-colors hover:border-[#94c2e8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-(--blue)">
                {running === "NO" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-[11.5px] font-bold text-(--blue)">Run fresh on-chain NO safe trade</span>
                <span className="block text-[9.5px] text-[#3d6ea5]">Stale −23¢ edge → expect fill</span>
              </span>
            </span>
            <Sparkles className="h-3.5 w-3.5 text-(--blue) opacity-70 group-hover:opacity-100" />
          </button>
        </div>

        {running && (
          <p className="mt-3 flex items-center gap-2 text-[10.5px] text-(--ink-2)">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-(--blue)" />
            Sending and confirming {running} settlement on devnet… this takes a few seconds.
          </p>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#f0c5c5] bg-(--red-bg) px-3 py-2 text-[10.5px] leading-relaxed text-(--red)">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {runs.length > 0 && (
          <>
            <div className={`mt-4 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
              {runs.map((run) => (
                <FreshResult key={run.receipt.receiptId} run={run} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-(--border) pt-3">
              <span className="text-[10px] font-semibold text-(--ink-3)">
                Proof points: {runs.length} · {runs.some((r) => r.side === "YES") ? "YES refund" : "—"} · {runs.some((r) => r.side === "NO") ? "NO vault" : "—"}
              </span>
              <span className="flex-1" />
              <button onClick={copySummary} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[10px] font-bold text-(--ink-2) hover:text-(--blue)">
                {copied ? <Check className="h-3.5 w-3.5 text-(--green)" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy proof summary"}
              </button>
              <button onClick={openAllLinks} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[10px] font-bold text-(--ink-2) hover:text-(--blue)">
                <ExternalLink className="h-3.5 w-3.5" /> Open all proof links
              </button>
              <button onClick={() => setRuns([])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[10px] font-bold text-(--ink-2) hover:text-(--red)">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SignerBadge({ signer, loading }: { signer: SignerInfo | null; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9.5px] font-semibold text-[#a9bad6]">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking operator…
      </span>
    );
  }
  if (!signer?.configured) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7a5a1e] bg-[#3a2c10] px-2.5 py-1 text-[9.5px] font-semibold text-[#f0cd8a]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#e0a93a]" /> Operator not configured
      </span>
    );
  }
  return (
    <div className="rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-right">
      <span className="flex items-center justify-end gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8fb0e6]">
        <Wallet className="h-3 w-3" /> Devnet operator
      </span>
      <a
        href={signer.signerExplorerUrl}
        target="_blank"
        rel="noreferrer"
        className="mono mt-0.5 block text-[10px] font-bold text-white hover:underline"
      >
        {short(signer.signerPublicKey, 5, 5)}
      </a>
      <span className="num text-[9.5px] text-[#a9bad6]">{signer.balanceSol?.toFixed(3) ?? "—"} SOL</span>
    </div>
  );
}

function FreshResult({ run }: { run: RunState }) {
  const demo = run.response.demo;
  const proof = run.response.proof!;
  const onChainVerdict = demo?.verdict ?? "UNKNOWN";
  const matches = onChainVerdict === EXPECTED_VERDICT[run.side];
  const blocked = run.side === "YES";

  return (
    <div className={`rounded-xl border p-3.5 ${blocked ? "border-[#f0c5c5] bg-[#fffafa]" : "border-[#bfe0f4] bg-[#fafcff]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${blocked ? "bg-(--red-bg) text-(--red)" : "bg-(--blue-bg) text-(--blue)"}`}>
          {run.side} · {onChainVerdict}
        </span>
        <span className="text-[9px] text-(--ink-3)">
          fresh proof · {new Date(run.at).toLocaleTimeString("en-GB")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <Metric label="On-chain edge" value={signedMicros(demo?.edgeMicros ?? proof.edgeMicros)} tone={blocked ? "red" : "blue"} />
        <Metric label="Settlement" value={demo?.settlementDestination === "FINALIZED_TO_VAULT" ? "Finalized → vault" : "Refunded → trader"} tone={demo?.refunded ? "green" : "blue"} />
        <Metric label="Market PDA" value={short(proof.marketPda)} mono />
        <Metric label="Order PDA" value={short(proof.orderEscrowPda)} mono />
      </div>

      {proof.sourceEventHash && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[#cddcf5] bg-[#f7faff] px-2.5 py-1.5">
          <Hash className="mt-0.5 h-3 w-3 shrink-0 text-(--blue)" />
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-(--blue)">Event hash attached to on-chain guard verdict</p>
            <p className="mono truncate text-[9px] text-(--ink-2)">{proof.sourceEventHash}</p>
          </div>
        </div>
      )}

      {demo?.settlementDestination === "FINALIZED_TO_VAULT" && demo?.vaultPda && (
        <a
          href={`https://explorer.solana.com/address/${demo.vaultPda}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[9.5px] font-semibold text-(--blue) hover:underline"
        >
          ProtocolVault {short(demo.vaultPda, 5, 5)} · {(demo.vaultBalanceLamports / 1_000_000_000).toFixed(4)} SOL <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}

      <div className={`mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px] font-bold ${matches ? "border-[#bce6d5] bg-(--green-bg) text-(--green)" : "border-[#f1d59b] bg-(--amber-bg) text-(--amber)"}`}>
        <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
        Frontend verdict {EXPECTED_VERDICT[run.side]} vs on-chain {onChainVerdict}: {matches ? "MATCH" : "MISMATCH"}
      </div>

      <ol className="mt-3 grid gap-1">
        {proof.txSignatures.map((sig, index) => (
          <li key={sig} className="min-w-0">
            <a
              href={proof.explorerUrls[index]}
              target="_blank"
              rel="noreferrer"
              className="group flex min-w-0 items-center justify-between gap-2 rounded-md border border-(--border) bg-white px-2.5 py-1.5 text-[10px] font-semibold text-(--ink-2) hover:border-(--blue)/40 hover:text-(--blue)"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="num flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#f1f4f8] text-[9px] text-(--ink-3)">{index + 1}</span>
                <span className="truncate">{STEP_LABELS[index]}</span>
              </span>
              <span className="mono flex shrink-0 items-center gap-1 text-[9px]">
                {short(sig, 6, 5)} <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          </li>
        ))}
      </ol>

      <Link
        href={`/verify/${run.receipt.receiptId}?r=${encodeReceiptForUrl(run.receipt)}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-(--blue) hover:underline"
      >
        Verify fresh receipt (4 txs attached) <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function Metric({ label, value, mono = false, tone = "neutral" }: { label: string; value: string; mono?: boolean; tone?: "neutral" | "red" | "blue" | "green" }) {
  const color = tone === "red" ? "text-(--red)" : tone === "blue" ? "text-(--blue)" : tone === "green" ? "text-(--green)" : "text-(--ink)";
  return (
    <div className="min-w-0 rounded-md border border-(--border) bg-white px-2.5 py-1.5">
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">{label}</p>
      <p className={`mt-0.5 truncate text-[11px] font-bold ${mono ? "mono" : "num"} ${color}`}>{value}</p>
    </div>
  );
}
