import { Fingerprint, Link2 } from "lucide-react";
import { Card, cn, Label, Stat } from "@/components/lineguard/ui";
import { ONCHAIN_ENFORCEMENT_TARGET, summarizeProof } from "@/lib/proof/txlineValidation";
import { DATA_SOURCE_LABEL, DATA_SOURCE_TONE, type TerminalState } from "@/lib/terminal/state";

/**
 * The bridge between TxLINE's data integrity and LineGuard's guard rule. It is
 * scrupulously honest: it summarizes exactly what proof material an event
 * carries and never claims on-chain verification that didn't happen. The Rust
 * snippet is labelled as the guard rule; the separate on-chain settlement panel
 * shows whether a real configured program transaction exists.
 */
export function ProofPanel({ state }: { state: TerminalState }) {
  const { txline, market, mode } = state;
  const event = txline.lastEvent ?? market.lastMaterialEvent;
  const liveConnected = txline.scores === "live";
  const proof = summarizeProof(event, liveConnected);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Fingerprint className="h-4 w-4 text-(--ink-2)" />
          <Label>TxLINE proof validated separately</Label>
        </div>
        <span
          className={cn(
            "num rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            proof.tone === "green" && "border-(--green)/30 bg-(--green-bg) text-(--green)",
            proof.tone === "amber" && "border-(--amber)/30 bg-(--amber-bg) text-(--amber)",
            proof.tone === "neutral" && "border-(--border) bg-[#f9fafb] text-(--ink-3)"
          )}
        >
          {proof.label}
        </span>
      </div>

      <div className="mt-2.5 hairline-rows">
        <Stat label="Event seq" value={event ? event.seq : "—"} tone="blue" />
        <Stat label="Fixture ID" value={<span className="mono text-[10.5px]">{market.fixtureId}</span>} />
        <Stat label="Source" value={event ? DATA_SOURCE_LABEL[event.source] : mode === "live" ? "Live" : "Guided scenario"} tone={event ? DATA_SOURCE_TONE[event.source] : "amber"} />
        <Stat label="Proof status" value={proof.status} />
        <Stat label="Merkle root" value={<span className="mono text-[10.5px]">{event?.merkleRoot ? shorten(event.merkleRoot) : "not present"}</span>} />
        <Stat label="Signature" value={<span className="mono text-[10.5px]">{event?.signature ? shorten(event.signature) : "not present"}</span>} />
      </div>

      <p className="mt-2 rounded-md bg-[#f9fafb] px-2.5 py-2 text-[10.5px] leading-snug text-(--ink-2)">{proof.detail}</p>

      {/* On-chain enforcement rule */}
      <div className="mt-2.5">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-(--ink-3)" />
          <p className="mono text-[9.5px] uppercase tracking-wide text-(--ink-3)">On-chain enforcement rule</p>
        </div>
        <pre className="mono mt-1.5 overflow-x-auto rounded-md border border-(--border) bg-[#0b1020] p-2.5 text-[10px] leading-relaxed text-[#c9d3e6]">
          <span className="text-[#7aa2f7]">{"// LineGuard Solana program rule\n"}</span>
          {ONCHAIN_ENFORCEMENT_TARGET}
        </pre>
        <p className="mt-1.5 text-[9.5px] text-(--ink-3)">
          The app runs this condition off-chain in <span className="mono">lib/lineguard/evaluate.ts</span>. The Anchor program in{" "}
          <span className="mono">programs/lineguard</span> enforces the same rule against escrowed lamports when on-chain mode is configured.
        </p>
      </div>
    </Card>
  );
}

function shorten(s: string): string {
  return s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
}
