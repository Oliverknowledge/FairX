import { ExternalLink } from "lucide-react";
import type { ProofTx } from "@/lib/proof/staticProofData";

export function ProofLinkList({ txs }: { txs: readonly ProofTx[] }) {
  return (
    <ol className="grid gap-1.5">
      {txs.map((tx, index) => (
        <li key={tx.signature} className="min-w-0">
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 items-center justify-between gap-3 rounded-md border border-(--border) bg-white px-2.5 py-2 text-[11px] font-semibold text-(--ink-2) hover:border-(--blue)/35 hover:text-(--blue)"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#f3f4f6] text-[10px] text-(--ink-3)">
                {index + 1}
              </span>
              <span className="truncate">{tx.label}</span>
            </span>
            <span className="flex min-w-0 shrink items-center gap-1 text-right">
              <span className="mono truncate text-[10px]">{shorten(tx.signature)}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function shorten(value: string): string {
  return value.length > 24 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}
