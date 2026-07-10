import { ExternalLink, Hash, Link2, Radio, ReceiptText, ShieldCheck } from "lucide-react";
import type { LineGuardReceipt } from "@/lib/receipts/types";

/**
 * Renders the receipt-level proof chain: raw source event → normalized event →
 * sealed receipt → on-chain settlement. The event hashes are *receipt-level*
 * bindings — deterministic sha256 links, not fields inside the deployed program.
 */
export function ProofChainPanel({ receipt }: { receipt: LineGuardReceipt }) {
  const hasEvent = Boolean(receipt.rawEventHash || receipt.normalizedEventHash);
  const onChain = receipt.onChain;

  return (
    <section className="rounded-xl border border-(--border) bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-(--blue)" />
          <p className="section-label">Proof chain</p>
        </div>
        <span className="rounded-full border border-(--border) bg-[#f8fafc] px-2 py-0.5 text-[9px] font-semibold text-(--ink-3)">
          {onChain ? "event → receipt → on-chain" : "event → receipt"}
        </span>
      </div>

      <ol className="mt-3 space-y-0 border-l border-(--border) pl-4">
        <ChainStep
          icon={<Radio className="h-3 w-3" />}
          tone="amber"
          title="Source event"
          subtitle={`${receipt.txlineEventType ?? "event"} · seq ${receipt.txlineEventSeq ?? "—"}`}
        >
          <HashLine label="rawEventHash" value={receipt.rawEventHash} />
          <HashLine label="normalizedEventHash" value={receipt.normalizedEventHash} />
          {!hasEvent && <p className="text-[9.5px] text-(--ink-3)">No event hash bound to this receipt.</p>}
        </ChainStep>

        <ChainStep
          icon={<ReceiptText className="h-3 w-3" />}
          tone="blue"
          title="Sealed receipt"
          subtitle={`${receipt.verdict} · ${receipt.side}`}
        >
          <HashLine label="receiptHash" value={receipt.receiptHash} />
          {receipt.settlementDestination && (
            <p className="mt-1 text-[9.5px] text-(--ink-2)">
              Settlement destination: <span className="mono font-semibold text-(--ink)">{receipt.settlementDestination}</span>
            </p>
          )}
        </ChainStep>

        <ChainStep
          icon={<ShieldCheck className="h-3 w-3" />}
          tone={onChain ? "green" : "neutral"}
          title={onChain ? "On-chain settlement" : "On-chain settlement (not attached)"}
          subtitle={onChain ? `${onChain.cluster} · ${onChain.txSignatures.length} txs` : "local / receipt-level only"}
          last
        >
          {onChain ? (
            <div className="space-y-1">
              <HashLine label="market PDA" value={onChain.marketPda} />
              <HashLine label="order PDA" value={onChain.orderEscrowPda} />
              {onChain.sourceEventHash && (
                <>
                  <HashLine label="on-chain event hash" value={onChain.sourceEventHash} />
                  <p className={`text-[9px] font-bold ${onChain.sourceEventHash === receipt.normalizedEventHash ? "text-(--green)" : "text-(--amber)"}`}>
                    {onChain.sourceEventHash === receipt.normalizedEventHash
                      ? "✓ Event hash attached to on-chain guard verdict matches the receipt"
                      : "⚠ On-chain event hash differs from the receipt"}
                  </p>
                </>
              )}
              {onChain.settlementDestination && (
                <p className="text-[9px] text-(--ink-2)">
                  On-chain destination: <span className="mono font-semibold text-(--ink)">{onChain.settlementDestination}</span>
                  {onChain.vaultPda && onChain.settlementDestination === "FINALIZED_TO_VAULT" ? ` · vault ${onChain.vaultPda.slice(0, 6)}…` : ""}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {onChain.explorerUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-(--blue)/25 bg-(--blue-bg) px-1.5 py-0.5 text-[9px] font-bold text-(--blue) hover:opacity-80"
                  >
                    tx {index + 1} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[9.5px] leading-relaxed text-(--ink-3)">
              This is a local-simulation receipt. The event and verdict are hash-sealed, but no devnet transaction is attached.
            </p>
          )}
        </ChainStep>
      </ol>

      <p className="mt-3 border-t border-(--border) pt-2.5 text-[9.5px] leading-relaxed text-(--ink-3)">
        The normalized event hash is a deterministic sha256 anyone can recompute. For devnet receipts it is also{" "}
        <strong className="text-(--ink-2)">bound into on-chain market state and emitted in the guard verdict</strong>; the receipt reproduces it.
        Changing any field changes the receipt hash and fails verification.
      </p>
    </section>
  );
}

function ChainStep({
  icon,
  tone,
  title,
  subtitle,
  children,
  last = false,
}: {
  icon: React.ReactNode;
  tone: "amber" | "blue" | "green" | "neutral";
  title: string;
  subtitle: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const dot =
    tone === "amber" ? "bg-(--amber)" : tone === "blue" ? "bg-(--blue)" : tone === "green" ? "bg-(--green)" : "bg-(--ink-3)";
  return (
    <li className={`relative ${last ? "" : "pb-4"}`}>
      <span className={`absolute -left-[22px] top-0 flex h-4 w-4 items-center justify-center rounded-full text-white ${dot}`}>{icon}</span>
      <p className="text-[11px] font-bold text-(--ink)">{title}</p>
      <p className="text-[9.5px] text-(--ink-3)">{subtitle}</p>
      <div className="mt-1.5">{children}</div>
    </li>
  );
}

function HashLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5">
      <Hash className="mt-0.5 h-2.5 w-2.5 shrink-0 text-(--ink-3)" />
      <span className="shrink-0 text-[9px] font-semibold text-(--ink-3)">{label}</span>
      <span className="mono min-w-0 break-all text-[9px] text-(--ink-2)">{value}</span>
    </div>
  );
}
