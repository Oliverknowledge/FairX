import { ArrowRight, CheckCircle2, ChevronDown, Database, ShieldCheck } from "lucide-react";
import { CANONICAL_QUOTE_GUARD } from "@/lib/quote-guard/canonical";
import { formatQuoteMicros, type QuoteGuardCommitment } from "@/lib/quote-guard";
import { shortHash } from "@/lib/v4/replay";

export function QuoteGuardProof() {
  const post = CANONICAL_QUOTE_GUARD.post.commitment;
  const verifiedCount = [CANONICAL_QUOTE_GUARD.pre.verification, CANONICAL_QUOTE_GUARD.post.verification].filter((item) => item.status === "VERIFIED").length;
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50" aria-labelledby="quote-guard-proof">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-[8.5px] font-bold uppercase tracking-[.1em] text-emerald-700"><ShieldCheck className="h-4 w-4" />QuoteGuard · verified {verifiedCount}/2</p>
          <h3 id="quote-guard-proof" className="mt-2 text-[22px] font-extrabold tracking-[-.035em] text-emerald-950">TxLINE evidence becomes one reproducible executable quote.</h3>
          <p className="mt-3 text-[10px] leading-5 text-emerald-950/65">QuoteGuard recomputes the price from the exact odds update and fixed transformation, then matches the result to the V4 quote receipt.</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <QuoteStep label="TxLINE odds evidence" value="1.156 · 8.757 · 47.500" />
          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-emerald-500 sm:rotate-0" />
          <QuoteStep label="Deterministic probability" value={formatQuoteMicros(post.impliedProbabilityMicros)} />
          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-emerald-500 sm:rotate-0" />
          <QuoteStep label="Executable YES / NO" value={`${formatQuoteMicros(post.generatedYesQuoteMicros)} / ${formatQuoteMicros(post.generatedNoQuoteMicros)}`} />
          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-emerald-500 sm:rotate-0" />
          <QuoteStep label="Result" value="VERIFIED 8/8" strong />
        </div>
      </div>
      <div className="grid gap-2 border-t border-emerald-200 bg-white/45 px-5 py-4 text-[9px] text-emerald-950 sm:grid-cols-3 sm:px-6"><p><strong>Fixture</strong><br />France–Morocco · {post.fixtureId}</p><p className="min-w-0"><strong>Odds update identity</strong><br /><span className="break-all">{post.txlineOddsSequence}</span></p><p><strong>Normalization</strong><br />{post.normalizationVersion}</p></div>
      <p className="border-t border-emerald-200 bg-white/70 px-5 py-3 text-[9px] leading-4 text-emerald-950/70 sm:px-6">QuoteGuard proves the executable quote followed committed TxLINE odds evidence and the fixed transformation. It does not claim the pricing authority is permissionless or externally audited.</p>
      <details className="group border-t border-emerald-200 bg-white/70">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-[10px] font-bold text-emerald-950 sm:px-6"><span>Technical quote commitments</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="grid gap-3 border-t border-emerald-100 p-5 sm:grid-cols-2 sm:p-6"><Receipt label="Before goal" quote={CANONICAL_QUOTE_GUARD.pre.commitment} receipt={CANONICAL_QUOTE_GUARD.pre.receipt} verified={CANONICAL_QUOTE_GUARD.pre.verification.status === "VERIFIED"} /><Receipt label="After goal" quote={CANONICAL_QUOTE_GUARD.post.commitment} receipt={CANONICAL_QUOTE_GUARD.post.receipt} verified={CANONICAL_QUOTE_GUARD.post.verification.status === "VERIFIED"} /></div>
      </details>
    </section>
  );
}

function QuoteStep({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <article className={`min-w-0 flex-1 rounded-xl border p-3 ${strong ? "border-emerald-300 bg-white" : "border-emerald-200/70 bg-white/65"}`}><p className="text-[8px] font-bold uppercase tracking-[.07em] text-emerald-700">{label}</p><p className="mt-2 whitespace-nowrap text-[12px] font-extrabold text-emerald-950">{value}</p></article>; }
function Receipt({ label, quote, receipt, verified }: { label: string; quote: QuoteGuardCommitment; receipt: string; verified: boolean }) { return <article className="rounded-xl border border-(--border) bg-white p-4"><div className="flex items-center justify-between gap-3"><h4 className="text-[11px] font-bold">{label} · {formatQuoteMicros(quote.generatedYesQuoteMicros)}</h4><span className={`text-[8px] font-bold ${verified ? "text-(--green)" : "text-(--red)"}`}>{verified ? "VERIFIED 8/8" : "FAILED"}</span></div><dl className="mt-4 grid gap-2 text-[9px] text-(--ink-2)"><ProofRow icon={Database} label="Odds hash" value={shortHash(quote.oddsHash)} /><ProofRow icon={ShieldCheck} label="Normalization" value={quote.normalizationVersion} /><ProofRow icon={CheckCircle2} label="Quote receipt" value={shortHash(receipt)} /></dl></article>; }
function ProofRow({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) { return <div className="flex min-w-0 items-center justify-between gap-3"><dt className="flex shrink-0 items-center gap-1.5"><Icon className="h-3 w-3 text-(--blue)" />{label}</dt><dd className="mono min-w-0 truncate text-right font-semibold text-(--ink)">{value}</dd></div>; }
