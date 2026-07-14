"use client";

import { useEffect, useState } from "react";
import { Check, X, ShieldCheck } from "lucide-react";

interface HistoryResponse {
  verification: {
    valid: boolean;
    mode: string;
    statuses: {
      mappingVerified: boolean;
      fixtureOrientationVerified: boolean;
      orderbookIntegrityVerified: boolean;
      referenceQuoteVerified: boolean;
    };
    recomputed: {
      rawPayloadHash: string;
      mappingHash: string;
      normalizedQuoteHash: string;
      pricingPolicyHash: string;
      midpointMicros: number;
    };
    errors: string[];
  };
  capture: { capturedAt: string; market: { question: string }; derived: { midpointMicros: number } };
}

const STATUS_LABELS: Record<string, string> = {
  mappingVerified: "Polymarket mapping verified",
  fixtureOrientationVerified: "Fixture / YES-orientation verified",
  orderbookIntegrityVerified: "Order-book integrity verified",
  referenceQuoteVerified: "Reference quote verified",
};

export function ReferenceProofPanel({ mappingId }: { mappingId: string }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/reference-quotes/${encodeURIComponent(mappingId)}/history`, { cache: "no-store" });
        if (!res.ok) {
          setError("No bundled reference capture available.");
          return;
        }
        setData((await res.json()) as HistoryResponse);
      } catch {
        setError("Verification data unavailable.");
      }
    })();
  }, [mappingId]);

  return (
    <section className="rounded-2xl border border-(--border) bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-(--blue)" />
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-3)">Reference-price proof</p>
        <span className="rounded-full border border-[#f0d9a8] bg-[#fdf6e7] px-2 py-0.5 text-[9.5px] font-semibold text-[#a76d12]">
          RECORDED EVIDENCE
        </span>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">
        The bundled capture is re-hashed and the quote is re-derived from the stored raw book. This proves the recorded
        evidence is untampered — it does not re-fetch Polymarket, so it never claims <em>live verified</em>.
      </p>

      {error && !data ? (
        <p className="mt-4 rounded-lg border border-(--border) bg-[#fbfcfe] p-3 text-[11.5px] text-(--ink-2)">{error}</p>
      ) : data ? (
        <>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(data.verification.statuses).map(([key, ok]) => (
              <li key={key} className="flex items-center gap-2 rounded-lg border border-(--border) bg-[#fbfcfe] px-3 py-2">
                {ok ? (
                  <Check className="h-4 w-4 shrink-0 text-[#1a7f45]" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-[#a53535]" />
                )}
                <span className="text-[11.5px] font-semibold text-(--ink)">{STATUS_LABELS[key] ?? key}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 rounded-lg border border-(--border) bg-[#fbfcfe] p-3 text-[10.5px] text-(--ink-2)">
            <HashRow label="Raw order-book hash" value={data.verification.recomputed.rawPayloadHash} />
            <HashRow label="Normalized quote hash" value={data.verification.recomputed.normalizedQuoteHash} />
            <HashRow label="Mapping hash" value={data.verification.recomputed.mappingHash} />
            <HashRow label="Pricing-policy hash" value={data.verification.recomputed.pricingPolicyHash} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-[11.5px] text-(--ink-3)">Loading verification…</p>
      )}

      <div className="mt-5 border-t border-(--border) pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-3)">On-chain vs off-chain</p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">
          The reference quote is committed through the deployed LineGuard V2 slot{" "}
          <span className="mono text-(--ink)">commit_txline_odds_v2</span> — <span className="font-semibold">no program
          upgrade</span>. The <span className="mono text-(--ink)">odds_payload_hash</span> commits the capture and{" "}
          <span className="mono text-(--ink)">fair_price_micros</span> the midpoint. The trader signs{" "}
          <span className="mono text-(--ink)">expected_odds_sequence</span>,{" "}
          <span className="mono text-(--ink)">expected_execution_price</span>,{" "}
          <span className="mono text-(--ink)">max_slippage</span> and <span className="mono text-(--ink)">expiry_slot</span>;
          the chain rejects a stale or repriced quote. Independent derivation of the midpoint from the book is enforced{" "}
          <span className="font-semibold">off-chain</span> in this receipt.
        </p>
      </div>
    </section>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <span className="shrink-0 font-semibold text-(--ink-2)">{label}:</span>
      <span className="mono min-w-0 break-all text-(--ink)">{value}</span>
    </div>
  );
}
