"use client";

import { useEffect } from "react";
import { BadgeCheck, FileCheck2, FileClock, ShieldX, SquareArrowOutUpRight } from "lucide-react";
import { Badge, Card, cn, Label, Stat } from "@/components/lineguard/ui";
import { encodeReceiptForUrl } from "@/lib/receipts/create";
import { microsToCents, signedMicrosToCents } from "@/lib/solana/priceMicros";
import { cents, usd, type TerminalState } from "@/lib/terminal/state";
import type { Action } from "@/lib/terminal/actions";

/**
 * The portable proof. Shows the sealed receipt, its sha256, and a verify
 * action that recomputes the hash. Also links to the standalone verifier page
 * with the receipt encoded in the URL — anyone can re-check it.
 */
export function ReceiptPanel({
  state,
  dispatch,
}: {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
}) {
  const { receipt, receiptVerification } = state;

  // Persist for the standalone verifier's localStorage fallback (URL param is primary).
  useEffect(() => {
    if (receipt) {
      try {
        window.localStorage.setItem("lineguard:last-receipt", JSON.stringify(receipt));
      } catch {
        /* ignore quota/availability */
      }
    }
  }, [receipt]);

  if (!receipt) {
    return (
      <Card>
        <div className="flex items-center gap-1.5">
          <FileClock className="h-4 w-4 text-(--ink-2)" />
          <Label>LineGuard receipt</Label>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-(--border) py-6 text-[12px] font-semibold text-(--ink-3)">
          <FileClock className="h-4 w-4" /> Receipt is sealed after LineGuard rules
        </div>
      </Card>
    );
  }

  const voided = receipt.verdict === "VOIDED_REFUNDED";
  const verifyHref = `/verify/${receipt.receiptId}?r=${encodeReceiptForUrl(receipt)}`;

  return (
    <Card className={cn("border", voided ? "border-(--red)/25" : "border-(--green)/25")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileCheck2 className="h-4 w-4 text-(--ink-2)" />
          <Label>LineGuard receipt</Label>
        </div>
        <Badge tone={voided ? "red" : "green"}>{receipt.verdict}</Badge>
      </div>

      <div className="mt-2.5 hairline-rows">
        <Stat label="Receipt ID" value={<span className="mono text-[10.5px]">{receipt.receiptId}</span>} />
        <Stat
          label="Sequence comparison"
          value={`materialSeq ${receipt.materialSeq} ${receipt.materialSeq > receipt.pricedAtSeq ? ">" : "≤"} pricedAtSeq ${receipt.pricedAtSeq}`}
          tone={receipt.materialSeq > receipt.pricedAtSeq ? "amber" : "neutral"}
        />
        <Stat label="Observed vs fair" value={`${cents(receipt.observedPrice)} → ${cents(receipt.fairSidePrice)}`} tone="blue" />
        <Stat label="Edge" value={`${receipt.edge > 0 ? "+" : ""}${cents(receipt.edge)}`} tone={receipt.edge > receipt.tolerance ? "red" : "neutral"} strong />
        <Stat label="Tolerance" value={cents(receipt.tolerance)} />
        <Stat label="Stake" value={usd(receipt.stake)} />
        <Stat label="TxLINE event" value={`seq ${receipt.txlineEventSeq ?? "—"} · ${receipt.txlineEventType ?? "—"}`} />
        <Stat label="Proof status" value={receipt.proofStatus} />
        <Stat label="On-chain proof" value={receipt.onChain ? `${receipt.onChain.cluster} · tx linked` : "not attached"} tone={receipt.onChain ? "blue" : "neutral"} />
      </div>

      {receipt.onChain ? (
        <div className="mt-2.5 rounded-lg border border-(--blue)/25 bg-(--blue-bg) px-2.5 py-2">
          <p className="mono text-[9px] uppercase tracking-wide text-(--blue)">On-chain verdict proof</p>
          <div className="mt-1 hairline-rows">
            <Stat label="Program" value={<span className="mono text-[10px]">{shorten(receipt.onChain.programId)}</span>} />
            <Stat label="Escrow PDA" value={<span className="mono text-[10px]">{shorten(receipt.onChain.orderEscrowPda)}</span>} />
            <Stat label="Tx count" value={receipt.onChain.txSignatures.length} tone="blue" />
            {receipt.onChain.txSignatures.map((signature, index) => (
              <Stat
                key={signature}
                label={`Tx ${index + 1}`}
                value={
                  receipt.onChain?.explorerUrls[index] ? (
                    <a href={receipt.onChain.explorerUrls[index]} target="_blank" rel="noreferrer" className="text-(--blue)">
                      {shorten(signature)}
                    </a>
                  ) : (
                    <span className="mono text-[10px]">{shorten(signature)}</span>
                  )
                }
                tone="blue"
              />
            ))}
            <Stat label="On-chain observed → fair" value={`${microsToCents(receipt.onChain.observedPriceMicros)} → ${microsToCents(receipt.onChain.fairSidePriceMicros)}`} />
            <Stat label="On-chain edge" value={signedMicrosToCents(receipt.onChain.edgeMicros)} tone={receipt.onChain.edgeMicros > 0 ? "red" : "neutral"} />
            <Stat
              label="Verdict match"
              value={receiptVerdictCode(receipt.verdict) === receipt.onChain.verdictCode ? "MATCH" : "MISMATCH"}
              tone={receiptVerdictCode(receipt.verdict) === receipt.onChain.verdictCode ? "green" : "red"}
              strong
            />
          </div>
        </div>
      ) : (
        <p className="mt-2 rounded-md bg-[#f9fafb] px-2.5 py-2 text-[10.5px] leading-snug text-(--ink-2)">
          No on-chain proof attached to this receipt.
        </p>
      )}

      <p className="mt-2 rounded-md bg-[#f9fafb] px-2.5 py-2 text-[10.5px] leading-snug text-(--ink-2)">{receipt.reason}</p>

      {/* Hash + verification */}
      <div className="mt-2.5 rounded-lg border border-(--border) bg-[#0b1020] p-2.5">
        <p className="mono text-[9px] uppercase tracking-wide text-[#6b7a99]">sha256 receiptHash</p>
        <p className="mono mt-0.5 break-all text-[10px] leading-relaxed text-[#c9d3e6]">{receipt.receiptHash}</p>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: "VERIFY_RECEIPT", at: Date.now() })}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-(--ink) px-3 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <BadgeCheck className="h-3.5 w-3.5" /> Verify receipt
        </button>
        <a
          href={verifyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-(--border) bg-white px-3 text-[11.5px] font-semibold text-(--ink-2) transition-colors hover:bg-[#f3f4f6]"
        >
          <SquareArrowOutUpRight className="h-3.5 w-3.5" /> Open verifier
        </a>
      </div>

      {receiptVerification && (
        <div
          className={cn(
            "verdict-pop mt-2.5 flex items-center gap-2 rounded-lg border p-2.5",
            receiptVerification.valid ? "border-(--green)/35 bg-(--green-bg)" : "border-(--red)/40 bg-(--red-bg)"
          )}
        >
          {receiptVerification.valid ? (
            <>
              <BadgeCheck className="h-5 w-5 shrink-0 text-(--green)" />
              <div>
                <p className="text-[12px] font-extrabold text-(--green)">VERIFIED · hash matches</p>
                <p className="text-[10px] text-(--ink-2)">Recomputed sha256 equals the sealed hash — the verdict is tamper-evident.</p>
              </div>
            </>
          ) : (
            <>
              <ShieldX className="h-5 w-5 shrink-0 text-(--red)" />
              <div>
                <p className="text-[12px] font-extrabold text-(--red)">TAMPERED · hash mismatch</p>
                <p className="text-[10px] text-(--ink-2)">Recomputed hash differs — a field was altered after sealing.</p>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function shorten(value: string): string {
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function receiptVerdictCode(verdict: string): number {
  if (verdict === "STALE_ALLOWED_NO_EDGE") return 1;
  if (verdict === "VOIDED_REFUNDED") return 2;
  return 0;
}
