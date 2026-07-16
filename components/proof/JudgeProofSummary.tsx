import { ArrowRight, CheckCircle2, ExternalLink, Radio, ShieldCheck, Vault } from "lucide-react";
import type { BuildProvenance } from "@/lib/provenance";
import { shortHash, V4_PROGRAM_ID } from "@/lib/v4/replay";
import { V4_LAST_VERIFIED_SNAPSHOT } from "@/lib/proof/v4VerificationSnapshot";

const explorerAddress = (address: string) => `https://explorer.solana.com/address/${address}?cluster=devnet`;

/** The genuine TxLINE devnet validation program (TxLINE's published address). */
const TXLINE_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

/** Finalized pre-goal VerifyTxlineQuote -> TxLINE ValidateOdds CPI (slot 476,416,729). */
const QUOTE_CPI_TX = "https://explorer.solana.com/tx/2nfmf3RUWAta4DyfBSt17oYrmXPLtg2u8BAuZU3KNyYtcUC4aHwEKat6LtzYZE3rACNPbCWqXwNd6WG3KEKnAhHN?cluster=devnet";

const PROTECTION_TX = "https://explorer.solana.com/tx/2huKk3NeYgkqXuQMUjkksi3dxnSrQubFQqiQw7GwAJBiHKt3mbwBRjHLj5a2KR812WTg3NomYhjiSPcsia3PpaCj?cluster=devnet";
const RESOLUTION_TX = "https://explorer.solana.com/tx/5Qua7sbaufHDXeMsDYyyHVdPQVhwCRwE9KqbxaR9vtGpZ1WczWNyzDtJfUYdWQT8NGxBcarG5HQhySzWRFWuBz7r?cluster=devnet";
const WITHDRAWAL_TX = "https://explorer.solana.com/tx/576yRsHMSVGrJnpyNMVenZf2b6P6YYQsQiaYCth4DuGazDtpUGweoh9LSaKQwkTrLhc4NdppfxfHheQjg3tioggL?cluster=devnet";

export function JudgeProofSummary({ provenance, testTotal = 330 }: { provenance: BuildProvenance; testTotal?: number }) {
  const verifiedAt = new Date(V4_LAST_VERIFIED_SNAPSHOT.checkedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="mt-6" aria-labelledby="judge-proof-summary">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 px-5 py-4 sm:px-6">
          <div><p className="text-[8px] font-extrabold uppercase tracking-[.11em] text-emerald-700">Canonical V4 proof status</p><h2 id="judge-proof-summary" className="mt-1 text-[20px] font-extrabold text-emerald-950">Verified 20/20 · every recorded liability reconciled</h2></div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-[9px] font-extrabold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> PASS · {verifiedAt} UTC</span>
        </div>
        <dl className="grid gap-px bg-emerald-200 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryFact label="Program ID" value={shortHash(V4_PROGRAM_ID)} mono href={explorerAddress(V4_PROGRAM_ID)} />
          <SummaryFact label="Network" value="Solana devnet" />
          <SummaryFact label="Canonical fixture" value="France–Morocco · 18209181" />
          <SummaryFact label="Lifecycle" value="24 finalized transactions" />
          <SummaryFact label="TxLINE CPI" value="Odds 2/2 · result verified" />
          <SummaryFact label="Accounting invariant" value="PASS · final fields zero" />
          <SummaryFact label="Tests" value={`${testTotal} app tests · 13 Rust`} />
          <SummaryFact label={provenance.commitLabel} value={shortHash(provenance.commitSha)} mono />
          <SummaryFact label="Build timestamp" value={formatTimestamp(provenance.buildTimestamp)} />
          <SummaryFact label="Deployment" value={`${formatTimestamp(provenance.deploymentTimestamp)} · slot ${provenance.deploymentSlot.toLocaleString()}`} />
        </dl>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/60" aria-labelledby="txline-cpi-chain">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[8px] font-extrabold uppercase tracking-[.11em] text-(--blue)">How TxLINE powers the backend</p>
            <h2 id="txline-cpi-chain" className="mt-1 text-[20px] font-extrabold text-slate-950">Direct CPI into TxLINE&rsquo;s official program</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white px-3 py-1.5 text-[9px] font-extrabold text-(--blue)"><CheckCircle2 className="h-3.5 w-3.5" /> Odds 2/2 · result verified</span>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-xl border border-(--border) bg-white p-4">
            <p className="text-[7.5px] font-extrabold uppercase tracking-[.08em] text-(--ink-3)">Caller · FairX Vault V4</p>
            <a href={explorerAddress(V4_PROGRAM_ID)} target="_blank" rel="noreferrer" className="mono mt-2 block break-all text-[10px] font-bold text-(--blue) hover:underline">{V4_PROGRAM_ID}</a>
            <p className="mt-2 text-[9px] leading-4 text-(--ink-3)">Our deployed settlement engine · invoke depth [1]</p>
          </div>
          <div className="flex items-center justify-center px-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-white px-3 py-1.5 text-[9px] font-extrabold text-(--blue)">CPI <ArrowRight className="h-3.5 w-3.5" /></span>
          </div>
          <div className="rounded-xl border border-(--border) bg-white p-4">
            <p className="text-[7.5px] font-extrabold uppercase tracking-[.08em] text-(--ink-3)">Callee · Official TxLINE program</p>
            <a href={explorerAddress(TXLINE_PROGRAM_ID)} target="_blank" rel="noreferrer" className="mono mt-2 block break-all text-[10px] font-bold text-(--blue) hover:underline">{TXLINE_PROGRAM_ID}</a>
            <p className="mt-2 text-[9px] leading-4 text-(--ink-3)">TxLINE&rsquo;s published devnet address · invoke depth [2]</p>
          </div>
        </div>

        <dl className="grid gap-px border-t border-blue-200 bg-blue-200 sm:grid-cols-3">
          <CpiFact instruction="VerifyTxlineQuote → ValidateOdds" detail="Pre-goal odds proof · sequence 738" status="2 of 2 verified" href={QUOTE_CPI_TX} />
          <CpiFact instruction="VerifyTxlineQuote → ValidateOdds" detail="Post-goal odds proof · sequence 739" status="2 of 2 verified" />
          <CpiFact instruction="ProveResolutionWithTxlineV4 → ValidateStatV2" detail="Final result proof · France 2–0 · sequence 1114" status="Result verified" href={RESOLUTION_TX} />
        </dl>

        <p className="border-t border-blue-200 bg-white/70 px-5 py-3 text-[9.5px] leading-5 text-slate-700 sm:px-6">
          <strong className="font-extrabold">Settlement cannot execute without TxLINE.</strong> <span className="mono">execute_resolution_v4</span> requires <span className="mono">resolution_receipt.direct_cpi_verified</span>, and V4 only writes that receipt after the official TxLINE program returns successfully. TxLINE is not a display source here — it is the gate on the money.
        </p>
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ProofCard icon={ShieldCheck} eyebrow="01 · ORDER PROTECTION PROOF" title="The stale order left. The market stayed open." explanation="Sequence 738 arrived after the market reached 739. The full 0.01 SOL principal returned and no position liability was created." value="0.010000000 SOL returned" href={PROTECTION_TX} linkLabel="Open refund transaction" />
        <ProofCard icon={Vault} eyebrow="02 · SETTLEMENT + ACCOUNTING" title="Every accepted liability was paid or released." explanation="Both valid YES positions settled, the losing NO reconciled, all positions closed and only genuinely free liquidity was withdrawn." value="Final liabilities: 0" href={WITHDRAWAL_TX} linkLabel="Open final withdrawal" />
        <ProofCard icon={Radio} eyebrow="03 · TXLINE VERIFICATION" title="The quote and result proofs reached TxLINE by CPI." explanation="Both executable quotes validate against the odds root. Final period-100 evidence proves France won 2–0 before threshold settlement." value="Direct CPI verified" href={RESOLUTION_TX} linkLabel="Open resolution proof" />
      </div>
    </section>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
}

function SummaryFact({ label, value, mono = false, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const body = <><dt className="text-[7.5px] font-extrabold uppercase tracking-[.08em] text-emerald-700">{label}</dt><dd className={`mt-2 break-words text-[10px] font-bold leading-4 text-emerald-950 ${mono ? "mono" : ""}`}>{value}</dd></>;
  return href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 bg-white p-4 hover:bg-emerald-50/70">{body}</a> : <div className="min-w-0 bg-white p-4">{body}</div>;
}

function CpiFact({ instruction, detail, status, href }: { instruction: string; detail: string; status: string; href?: string }) {
  const body = (
    <>
      <dt className="mono break-words text-[9.5px] font-bold leading-4 text-slate-950">{instruction}</dt>
      <dd className="mt-1.5 text-[9px] leading-4 text-(--ink-3)">{detail}</dd>
      <dd className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-700"><CheckCircle2 className="h-3 w-3" />{status}</dd>
      {href ? <span className="mt-2 inline-flex items-center gap-1 text-[8.5px] font-bold text-(--blue)">Open transaction<ExternalLink className="h-3 w-3" /></span> : null}
    </>
  );
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-col bg-white p-4 hover:bg-blue-50/60">{body}</a>
    : <div className="flex min-w-0 flex-col bg-white p-4">{body}</div>;
}

function ProofCard({ icon: Icon, eyebrow, title, explanation, value, href, linkLabel }: { icon: typeof ShieldCheck; eyebrow: string; title: string; explanation: string; value: string; href: string; linkLabel: string }) {
  return <article className="flex min-h-[260px] flex-col rounded-2xl border border-(--border) bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.04)] sm:p-6"><div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-(--blue)"><Icon className="h-5 w-5" /></span><span className="text-[7.5px] font-extrabold tracking-[.09em] text-(--ink-3)">{eyebrow}</span></div><h3 className="mt-5 text-[18px] font-extrabold leading-tight tracking-[-.025em]">{title}</h3><p className="mt-3 text-[10px] leading-5 text-(--ink-2)">{explanation}</p><div className="mt-auto pt-5"><p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] font-extrabold text-emerald-800">{value}</p><a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[9.5px] font-bold text-(--blue) hover:underline">{linkLabel}<ExternalLink className="h-3.5 w-3.5" /></a></div></article>;
}
