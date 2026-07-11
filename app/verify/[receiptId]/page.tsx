"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronDown, FileQuestion, FileWarning, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import { Badge, cn } from "@/components/lineguard/ui";
import { ProofChainPanel } from "@/components/fairx-proof/ProofChainPanel";
import { FairXShell } from "@/components/fairx/FairXShell";
import { TxLineProvenance } from "@/components/fairx/TxLineProvenance";
import { decodeReceiptFromUrl } from "@/lib/receipts/create";
import type { LineGuardReceipt, OnChainProof, ReceiptVerification } from "@/lib/receipts/types";
import { explainReceipt, verifyReceipt } from "@/lib/receipts/verify";
import { proofData } from "@/lib/proof/staticProofData";

type ReceiptSource = "canonical devnet proof" | "shared URL payload" | "local browser receipt" | "pasted local payload";

type LoadState = {
  receipt: LineGuardReceipt | null;
  source: ReceiptSource | null;
  issue: string | null;
};

const canonicalReceipts: readonly LineGuardReceipt[] = [proofData.receipt.receipt, proofData.receipt.noReceipt];

/**
 * Browser-side receipt verifier. It verifies canonical evidence, shareable
 * receipts from ?r=, and receipts sealed by FairX's local demo store. It does
 * not query Solana RPC; explorer links are evidence links, not live status.
 */
export default function VerifyPage() {
  const params = useParams<{ receiptId?: string | string[] }>();
  const routeReceiptId = firstParam(params.receiptId);
  const [load, setLoad] = useState<LoadState>({ receipt: null, source: null, issue: null });
  const [showPaste, setShowPaste] = useState(false);
  const [payload, setPayload] = useState("");

  useEffect(() => {
    setLoad(loadReceipt(routeReceiptId));
    setShowPaste(false);
    setPayload("");
  }, [routeReceiptId]);

  const verification: ReceiptVerification | null = useMemo(
    () => (load.receipt ? verifyReceipt(load.receipt, Date.now()) : null),
    [load.receipt]
  );
  const idMatchesRoute = Boolean(load.receipt && routeReceiptId && load.receipt.receiptId === routeReceiptId);
  const verdictMatchesProof = Boolean(
    load.receipt?.onChain && receiptVerdictCode(load.receipt.verdict) === load.receipt.onChain.verdictCode
  );
  const marketConfigAttached = Boolean(load.receipt?.marketConfigProof);
  const materialityHashMatches = Boolean(
    load.receipt?.marketConfigProof
      && load.receipt.onChain?.materialityConfigHash === load.receipt.marketConfigProof.materialityConfigHash
      && load.receipt.onChain?.orderMaterialityConfigHash === load.receipt.marketConfigProof.materialityConfigHash
  );
  const settlementHashMatches = Boolean(
    load.receipt?.marketConfigProof
      && load.receipt.onChain?.settlementConfigHash === load.receipt.marketConfigProof.settlementConfigHash
  );
  const eventHashMatches = Boolean(
    load.receipt?.normalizedEventHash
      && load.receipt.onChain?.sourceEventHash === load.receipt.normalizedEventHash
  );
  const orderEventHashMatches = Boolean(load.receipt?.normalizedEventHash && load.receipt.onChain?.orderSourceEventHash === load.receipt.normalizedEventHash);
  const verdict = !load.receipt
    ? "missing"
    : !verification?.valid
      ? "tampered"
      : !idMatchesRoute
        ? "wrong-route"
        : "verified";

  const importPayload = () => {
    const parsed = parsePastedPayload(payload);
    if (!parsed) {
      setLoad({ receipt: null, source: null, issue: "That payload could not be decoded as a complete LineGuard receipt." });
      return;
    }
    setLoad({ receipt: parsed, source: "pasted local payload", issue: null });
  };

  return (
    <FairXShell>
      <section className="mx-auto max-w-[820px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/proof" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to proof hub
        </Link>
        <Link href="/terminal" className="text-[11px] font-bold text-(--blue) hover:underline">Open technical terminal</Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-(--border) bg-white shadow-[0_12px_42px_rgba(15,23,42,0.06)]">
        <header className="border-b border-(--border) px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--green-bg)">
                <ShieldCheck className="h-4.5 w-4.5 text-(--green)" />
              </span>
              <div className="min-w-0">
                <p className="mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-(--ink-3)">FairX / LineGuard</p>
                <h1 className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] text-(--ink)">Receipt integrity verifier</h1>
                <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-(--ink-2)">
                  Recomputes the canonical sha256 seal in this browser. A matching hash proves the loaded payload was not changed after it was sealed; it is not a live Solana RPC check.
                </p>
              </div>
            </div>
            {load.source && <Badge tone={load.source === "canonical devnet proof" ? "green" : "blue"}>{load.source}</Badge>}
          </div>
        </header>

        <div className="p-4 sm:p-5">
          {verdict === "missing" && <MissingState issue={load.issue} routeReceiptId={routeReceiptId} onShowPaste={() => setShowPaste((value) => !value)} />}

          {showPaste && (
            <div className="mt-4 rounded-xl border border-(--blue)/25 bg-(--blue-bg) p-3">
              <label htmlFor="receipt-payload" className="text-[11px] font-bold text-(--ink)">Paste a local receipt</label>
              <p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">Paste full receipt JSON or the encoded value from a shared <span className="mono">?r=</span> URL. The payload remains in this browser.</p>
              <textarea
                id="receipt-payload"
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                spellCheck={false}
                placeholder='{"receiptId":"rcpt-…", …}'
                className="mono mt-2 min-h-28 w-full resize-y rounded-lg border border-(--border) bg-white p-2.5 text-[10.5px] leading-relaxed text-(--ink) outline-none focus:border-(--blue)"
              />
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={importPayload} className="h-8 rounded-lg bg-(--ink) px-3 text-[11px] font-bold text-white hover:opacity-90">
                  Verify pasted payload
                </button>
              </div>
            </div>
          )}

          {load.receipt && verification && (
            <>
              <VerificationBanner status={verdict} source={load.source} />

              <div className="mt-4">
                <TxLineProvenance
                  mode={load.receipt.sourceMode ?? "guided"}
                  connected={load.receipt.sourceMode === "live"}
                  endpoint={load.receipt.txlineProof?.endpoint ?? load.receipt.sourceEndpoint ?? "Provenance not recorded by this receipt version"}
                  fixtureId={load.receipt.fixtureId}
                  eventType={load.receipt.txlineEventType}
                  sequence={load.receipt.txlineEventSeq}
                  receivedAt={load.receipt.txlineProof?.receivedAt ?? load.receipt.txlineTimestamp}
                  rawEventHash={load.receipt.rawEventHash}
                  normalizedEventHash={load.receipt.normalizedEventHash}
                  proofState={load.receipt.proofStatus}
                />
              </div>

              {load.receipt.txlineProof?.validation && <ValidationMetadata receipt={load.receipt} />}

              {verdict === "verified" && !verdictMatchesProof && load.receipt.onChain && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-(--amber)/30 bg-(--amber-bg) px-3 py-2.5 text-[11px] leading-relaxed text-(--amber)">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    The hash is intact, but the receipt verdict does not match its attached <span className="mono">verdictCode</span>. Integrity does not make internally inconsistent claims correct.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-(--border) bg-[#f8fafc] px-3.5 py-3">
                <p className="section-label">What the sealed payload says</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-(--ink)">{explainReceipt(load.receipt)}</p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
                <section className="rounded-xl border border-(--border) bg-white px-3.5">
                  <p className="section-label border-b border-(--border) py-3">Guard inputs and outcome</p>
                  <div className="hairline-rows">
                    <Row label="Receipt ID" value={load.receipt.receiptId} mono />
                    <Row label="Market" value={load.receipt.marketTitle} />
                    <Row label="Fixture" value={load.receipt.fixtureId} mono />
                    <Row label="Side / stake" value={`${load.receipt.side} · ${formatStake(load.receipt.stake, load.receipt.stakeUnit)}`} />
                    <Row label="materialSeq vs pricedAtSeq" value={`${load.receipt.materialSeq} vs ${load.receipt.pricedAtSeq}`} mono />
                    <Row label="Observed → fair" value={`${formatCents(load.receipt.observedPrice)} → ${formatCents(load.receipt.fairSidePrice)}`} />
                    <Row label="Edge / tolerance" value={`${signedCents(load.receipt.edge)} / ${formatCents(load.receipt.tolerance)}`} />
                    <Row label="Verdict" value={load.receipt.verdict} tone={load.receipt.verdict === "VOIDED_REFUNDED" ? "red" : "green"} />
                    <Row label="Source event" value={`seq ${load.receipt.txlineEventSeq ?? "—"} · ${load.receipt.txlineEventType ?? "—"}`} />
                    <Row label="Receipt proof status" value={load.receipt.proofStatus} />
                  </div>
                </section>

                <section className="rounded-xl border border-(--border) bg-[#f8fafc] p-3.5">
                  <p className="section-label">Verification scope</p>
                  <div className="mt-3 space-y-2">
                    <ScopeCheck ok={verification.valid} label="sha256 seal recomputed" />
                    {verification.payloadIntegrityVerified !== null && <ScopeCheck ok={verification.payloadIntegrityVerified} label="Genuine TxLINE payload integrity verified" />}
                    {verification.normalizedEventVerified !== null && <ScopeCheck ok={verification.normalizedEventVerified} label="Normalized event verified" />}
                    {verification.onChainSourceEventHashMatches !== null && <ScopeCheck ok={verification.onChainSourceEventHashMatches} label="On-chain source event hash matches" />}
                    {verification.fixtureCommitmentMatches !== null && <ScopeCheck ok={verification.fixtureCommitmentMatches} label="Fixture commitment matches" />}
                    <ScopeCheck ok={idMatchesRoute} label="Receipt ID matches page URL" />
                    <ScopeCheck ok={Boolean(load.receipt.onChain)} label="On-chain proof attached" muted={!load.receipt.onChain} />
                    {load.receipt.onChain && <ScopeCheck ok={verdictMatchesProof} label="Verdict agrees with proof code" />}
                    <ScopeCheck ok={marketConfigAttached} label={marketConfigAttached ? "Market config committed on-chain" : "No on-chain market config attached"} muted={!marketConfigAttached} />
                    {marketConfigAttached && <ScopeCheck ok={materialityHashMatches} label="Materiality rules hash matches receipt" />}
                    {marketConfigAttached && <ScopeCheck ok={settlementHashMatches} label="Settlement config hash matches receipt" />}
                    {load.receipt.onChain?.sourceEventHash && <ScopeCheck ok={eventHashMatches} label="Source event hash matches on-chain market" />}
                    {load.receipt.onChain?.orderSourceEventHash && <ScopeCheck ok={orderEventHashMatches} label="Order evaluated against source event hash" />}
                  </div>
                  <p className="mt-4 border-t border-(--border) pt-3 text-[10.5px] leading-relaxed text-(--ink-3)">
                    Explorer links below are not fetched or independently confirmed here. Use the proof hub or Solana Explorer for transaction-level inspection.
                  </p>
                </section>
              </div>

              <div className="mt-4">
                <ProofChainPanel receipt={load.receipt} />
              </div>

              <OnChainEvidence proof={load.receipt.onChain} />

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <HashBlock label="Sealed receipt hash" value={verification.expectedHash} />
                <HashBlock label="Recomputed hash" value={verification.recomputedHash} match={verification.valid} />
              </div>
            </>
          )}
        </div>
      </section>
      </section>
    </FairXShell>
  );
}

function MissingState({ issue, routeReceiptId, onShowPaste }: { issue: string | null; routeReceiptId: string; onShowPaste: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-(--border) px-4 py-10 text-center">
      <FileQuestion className="h-7 w-7 text-(--ink-3)" />
      <h2 className="mt-3 text-[14px] font-extrabold text-(--ink)">{issue ? "Receipt payload unavailable" : "No receipt found for this URL"}</h2>
      <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-(--ink-2)">
        {issue ?? `Open a verifier link from FairX, use the canonical receipt, or load a local receipt sealed by this browser. Requested ID: ${routeReceiptId || "—"}.`}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href={proofData.receipt.verifierHref} className="inline-flex h-8 items-center rounded-lg bg-(--ink) px-3 text-[11px] font-bold text-white hover:opacity-90">
          Open canonical YES receipt
        </Link>
        <Link href={proofData.receipt.noVerifierHref} className="inline-flex h-8 items-center rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
          Open canonical NO receipt
        </Link>
        <button type="button" onClick={onShowPaste} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
          Paste a local receipt <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function VerificationBanner({ status, source }: { status: "verified" | "tampered" | "wrong-route" | "missing"; source: ReceiptSource | null }) {
  const isVerified = status === "verified";
  const copy = status === "wrong-route"
    ? ["RECEIPT ID MISMATCH", "The payload may be intact, but its receipt ID does not match this page URL. Do not treat it as verification for this route."]
    : isVerified
      ? ["INTEGRITY VERIFIED", source === "canonical devnet proof" ? "The canonical receipt hash matches. Its attached proof links point to the recorded devnet transaction sequence." : "The payload’s sha256 seal matches. This proves integrity of the sealed local/shared payload, not an external settlement lookup."]
      : ["TAMPER DETECTED", "The recomputed hash differs from the sealed hash. One or more fields changed after sealing; do not rely on this receipt."];

  return (
    <div className={cn("verdict-pop flex items-start gap-3 rounded-xl border p-3.5", isVerified ? "border-(--green)/35 bg-(--green-bg)" : "border-(--red)/40 bg-(--red-bg)")}>
      {isVerified ? <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-(--green)" /> : <ShieldX className="mt-0.5 h-6 w-6 shrink-0 text-(--red)" />}
      <div>
        <p className={cn("text-[13px] font-extrabold", isVerified ? "text-(--green)" : "text-(--red)")}>{copy[0]}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-(--ink-2)">{copy[1]}</p>
      </div>
    </div>
  );
}

function OnChainEvidence({ proof }: { proof?: OnChainProof }) {
  if (!proof) {
    return (
      <section className="mt-4 rounded-xl border border-(--border) bg-[#f8fafc] p-3.5">
        <p className="section-label">On-chain evidence</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-(--ink-2)">No on-chain proof is attached. This can still be a valid local-simulation receipt; it must not be presented as a devnet-settled order.</p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-(--blue)/20 bg-(--blue-bg) p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="section-label">Attached on-chain evidence</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-(--ink-2)">Static proof fields sealed into this receipt. The verifier does not query the network.</p>
        </div>
        <Badge tone="blue">{proof.cluster}</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Evidence label="Program ID" value={proof.programId} />
        <Evidence label="Market PDA" value={proof.marketPda} />
        <Evidence label="Order escrow PDA" value={proof.orderEscrowPda} />
        <Evidence label="On-chain registers" value={`${proof.materialSeq} vs ${proof.pricedAtSeq}`} />
        <Evidence label="Observed → fair" value={`${microsToCents(proof.observedPriceMicros)} → ${microsToCents(proof.fairSidePriceMicros)}`} />
        <Evidence label="On-chain edge" value={signedMicrosToCents(proof.edgeMicros)} />
        {proof.sourceEventHash && <Evidence label="Market source event hash" value={proof.sourceEventHash} />}
        {proof.orderSourceEventHash && <Evidence label="Order source event hash" value={proof.orderSourceEventHash} />}
        {proof.oracleAuthority && <Evidence label="Oracle authority" value={proof.oracleAuthority} />}
        {proof.marketConfigPda && <Evidence label="Market config PDA" value={proof.marketConfigPda} />}
      </div>
      {proof.materialityConfigHash ? (
        <div className="mt-3 rounded-lg border border-(--green)/25 bg-(--green-bg) p-2.5 text-[10.5px] leading-relaxed text-(--ink-2)">
          <p className="font-bold text-(--green)">Market config committed on-chain</p>
          <p className="mt-1 mono break-all">materiality {proof.materialityConfigHash}</p>
          <p className="mt-1 mono break-all">settlement {proof.settlementConfigHash}</p>
          {proof.orderMaterialityConfigHash === proof.materialityConfigHash && <p className="mt-2 font-bold text-(--green)">Order evaluated against committed market config</p>}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-(--border) bg-white p-2.5 text-[10.5px] text-(--ink-3)">No on-chain market config attached</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {proof.explorerUrls.map((url, index) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center rounded-md border border-(--blue)/25 bg-white px-2.5 text-[10.5px] font-bold text-(--blue) hover:opacity-80">
            Open tx {index + 1}
          </a>
        ))}
      </div>
    </section>
  );
}

function ScopeCheck({ ok, label, muted = false }: { ok: boolean; label: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[10.5px]">
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", ok ? "bg-(--green-bg) text-(--green)" : muted ? "bg-[#eef0f3] text-(--ink-3)" : "bg-(--red-bg) text-(--red)")}>
        {ok ? <BadgeCheck className="h-3 w-3" /> : <FileWarning className="h-3 w-3" />}
      </span>
      <span className={cn("font-semibold", muted ? "text-(--ink-3)" : "text-(--ink-2)")}>{label}</span>
    </div>
  );
}

function Row({ label, value, mono = false, tone = "neutral" }: { label: string; value: string; mono?: boolean; tone?: "neutral" | "green" | "red" }) {
  const color = tone === "red" ? "text-(--red)" : tone === "green" ? "text-(--green)" : "text-(--ink)";
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-[11px] text-(--ink-2)">{label}</span>
      <span className={cn("max-w-[62%] break-all text-right text-[11.5px] font-bold", mono && "mono text-[10.5px]", color)}>{value}</span>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-(--blue)/15 bg-white px-2.5 py-2">
      <p className="text-[9.5px] font-bold text-(--ink-3)">{label}</p>
      <p className="mono mt-1 break-all text-[10.5px] font-bold text-(--ink)">{value}</p>
    </div>
  );
}

function HashBlock({ label, value, match }: { label: string; value: string; match?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-(--border) bg-[#101828] p-3", match === false && "border-(--red)/45")}>
      <p className="mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8091ae]">{label}</p>
      <p className={cn("mono mt-1 break-all text-[10.5px] leading-relaxed", match === false ? "text-[#ff9b9b]" : "text-[#d7e0ee]")}>{value}</p>
    </div>
  );
}

function ValidationMetadata({ receipt }: { receipt: LineGuardReceipt }) {
  const validation = receipt.txlineProof?.validation;
  if (!validation) return null;
  return (
    <section className="mt-3 rounded-xl border border-(--green)/25 bg-(--green-bg) p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="section-label text-(--green)">TxLINE validation metadata</p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">Validated separately against the TxLINE devnet program before LineGuard ingestion; direct CPI is not claimed.</p>
        </div>
        <Badge tone={validation.passed ? "green" : "red"}>{validation.passed ? "VALIDATION PASSED" : "VALIDATION FAILED"}</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Evidence label="Method / endpoint" value={`${validation.method} · ${validation.endpoint}`} />
        <Evidence label="Stat keys" value={validation.statKeys.join(", ")} />
        <Evidence label="Daily scores root PDA" value={validation.dailyScoresRootPda} />
        <Evidence label="Validation payload hash" value={validation.validationPayloadHash} />
      </div>
    </section>
  );
}

function loadReceipt(routeReceiptId: string): LoadState {
  if (!routeReceiptId) return { receipt: null, source: null, issue: "The verifier URL is missing a receipt ID." };
  const query = new URLSearchParams(window.location.search).get("r");
  if (query) {
    const candidate = decodeReceiptFromUrl(query);
    return isReceipt(candidate)
      ? { receipt: candidate, source: isCanonicalReceipt(candidate) ? "canonical devnet proof" : "shared URL payload", issue: null }
      : { receipt: null, source: null, issue: "The shared receipt payload could not be decoded or is incomplete." };
  }

  const canonicalReceipt = canonicalReceipts.find((receipt) => receipt.receiptId === routeReceiptId);
  if (canonicalReceipt) {
    return { receipt: canonicalReceipt, source: "canonical devnet proof", issue: null };
  }

  const local = readLocalReceipt(routeReceiptId);
  return local
    ? { receipt: local, source: "local browser receipt", issue: null }
    : { receipt: null, source: null, issue: null };
}

function readLocalReceipt(receiptId: string): LineGuardReceipt | null {
  try {
    const directKeys = [
      `fairx:receipt:${receiptId}`,
      "fairx:last-receipt",
      "lineguard:last-receipt",
    ];
    for (const key of directKeys) {
      const parsed = parseJson(window.localStorage.getItem(key));
      if (isReceipt(parsed) && parsed.receiptId === receiptId) return parsed;
    }

    for (const key of ["fairx:receipts:v1", "fairx:market-state:v1"]) {
      const parsed = parseJson(window.localStorage.getItem(key));
      const candidate = findReceipt(parsed, receiptId);
      if (candidate) return candidate;
    }
  } catch {
    // Storage can be unavailable in privacy modes; the verifier still supports URL payloads.
  }
  return null;
}

function findReceipt(value: unknown, receiptId: string): LineGuardReceipt | null {
  if (Array.isArray(value)) {
    const found = value.find((candidate) => isReceipt(candidate) && candidate.receiptId === receiptId);
    return isReceipt(found) ? found : null;
  }
  if (!isRecord(value)) return null;
  if (isReceipt(value) && value.receiptId === receiptId) return value;
  if (Array.isArray(value.receipts)) return findReceipt(value.receipts, receiptId);
  if (isRecord(value.receipts)) return findReceipt(value.receipts[receiptId], receiptId);
  return null;
}

function parsePastedPayload(payload: string): LineGuardReceipt | null {
  const text = payload.trim();
  if (!text) return null;
  const raw = text.includes("?r=") ? text.split("?r=").at(-1)?.split("&")[0] ?? "" : text;
  const fromUrl = decodeReceiptFromUrl(raw);
  if (isReceipt(fromUrl)) return fromUrl;
  return isReceipt(parseJson(text)) ? parseJson(text) as LineGuardReceipt : null;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isReceipt(value: unknown): value is LineGuardReceipt {
  if (!isRecord(value)) return false;
  const stringFields = ["receiptId", "marketId", "marketTitle", "fixtureId", "orderId", "actor", "side", "verdict", "reason", "proofStatus", "receiptHash"];
  const numberFields = ["stake", "observedPrice", "fairSidePrice", "fairYes", "materialSeq", "pricedAtSeq", "staleness", "edge", "tolerance", "createdAt"];
  if (!stringFields.every((field) => typeof value[field] === "string") || !numberFields.every((field) => isFiniteNumber(value[field]))) return false;
  if (value.actor !== "bot" && value.actor !== "user") return false;
  if (value.onChain !== undefined && !isOnChainProof(value.onChain)) return false;
  return true;
}

function isOnChainProof(value: unknown): value is OnChainProof {
  if (!isRecord(value)) return false;
  const strings = ["cluster", "programId", "marketPda", "orderEscrowPda"];
  const numbers = ["materialSeq", "pricedAtSeq", "observedPriceMicros", "fairSidePriceMicros", "toleranceMicros", "edgeMicros", "verdictCode", "statusCode"];
  return strings.every((field) => typeof value[field] === "string")
    && numbers.every((field) => isFiniteNumber(value[field]))
    && Array.isArray(value.txSignatures) && value.txSignatures.every((item) => typeof item === "string")
    && Array.isArray(value.explorerUrls) && value.explorerUrls.every(isSafeHttpUrl)
    && (value.cluster === "devnet" || value.cluster === "localnet");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isCanonicalReceipt(receipt: LineGuardReceipt): boolean {
  return canonicalReceipts.some((canonical) => receipt.receiptId === canonical.receiptId && receipt.receiptHash === canonical.receiptHash);
}

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : value?.[0] ?? "";
}

function receiptVerdictCode(verdict: string): number {
  if (verdict === "STALE_ALLOWED_NO_EDGE") return 1;
  if (verdict === "VOIDED_REFUNDED") return 2;
  return 0;
}

function formatCents(value: number): string {
  return `${(value * 100).toFixed(3)}¢`;
}

function signedCents(value: number): string {
  return `${value > 0 ? "+" : ""}${formatCents(value)}`;
}

function formatStake(value: number, unit?: LineGuardReceipt["stakeUnit"]): string {
  if (unit === "SOL") return `◎ ${value.toLocaleString("en-US", { maximumFractionDigits: 6 })} devnet SOL`;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} sandbox units`;
}

function microsToCents(value: number): string {
  return `${(value / 10_000).toFixed(3)}¢`;
}

function signedMicrosToCents(value: number): string {
  return `${value > 0 ? "+" : ""}${microsToCents(value)}`;
}
