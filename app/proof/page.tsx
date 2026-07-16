import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ExternalLink, Eye, Settings2, ShieldCheck, Vault } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { JudgeProofSummary } from "@/components/proof/JudgeProofSummary";
import { ProtectionMoment } from "@/components/fairx-proof/ProtectionMoment";
import { QuoteGuardProof } from "@/components/quote-guard/QuoteGuardProof";
import { V4DeploymentStatus } from "@/components/v4/V4DeploymentStatus";
import type { PublicV4DeploymentStatus } from "@/components/v4/V4DeploymentStatus";
import { V4LifecycleEvidence } from "@/components/v4/V4LifecycleEvidence";
import { formatSol, invariantHolds, runCanonicalLifecycle, shortHash, V4_EVIDENCE, V4_PROGRAM_ID } from "@/lib/v4/replay";
import manifest from "@/fixtures/txline/v4-build-manifest.json";
import { initialV4VerificationResponse, V4_LAST_VERIFIED_SNAPSHOT } from "@/lib/proof/v4VerificationSnapshot";
import { privateRpcConfigured } from "@/lib/proof/serverRpc";
import { V4_BOOTSTRAP_ADMIN } from "@/lib/v4/program";
import { V4_BUFFER_ID, V4_PROGRAM_DATA_ID } from "@/lib/v4/deploymentStatus";
import { getBuildProvenance } from "@/lib/provenance";

const TXLINE_PROGRAM = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const explorerAddress = (address: string) => `https://explorer.solana.com/address/${address}?cluster=devnet`;

export const metadata: Metadata = { title: "What FairX enforces and verifies", description: "The honest trust boundary and independent settlement proof for the deployed FairX Vault V4 lifecycle." };

export default function ProofPage() {
  const lifecycle = runCanonicalLifecycle();
  const provenance = getBuildProvenance();
  const rpcPrivate = privateRpcConfigured();
  const initialVerification = initialV4VerificationResponse(rpcPrivate);
  const initialDeployment: PublicV4DeploymentStatus = {
    phase: "DEPLOYED",
    programId: V4_PROGRAM_ID,
    bufferId: V4_BUFFER_ID,
    programDataId: V4_PROGRAM_DATA_ID,
    bootstrapAdmin: V4_BOOTSTRAP_ADMIN,
    deployed: true,
    bufferFunded: false,
    bufferLamports: 0,
    headline: "Program deployed on devnet",
    detail: "The last complete verification confirmed the executable program, ProgramData account and binary hash. Use Re-check devnet for a fresh deployment-only read.",
    checkedAt: V4_LAST_VERIFIED_SNAPSHOT.checkedAt,
    privateRpcConfigured: rpcPrivate,
    explorer: {
      program: explorerAddress(V4_PROGRAM_ID),
      buffer: explorerAddress(V4_BUFFER_ID),
      programData: explorerAddress(V4_PROGRAM_DATA_ID),
    },
  };
  const proofChecks = [
    ["Genuine historical source", "TxLINE odds, goal sequence 739 and final sequence 1114 are bound to fixture 18209181."],
    ["Objective stale-sequence return", "The sequence-738 order returns its principal after the market advances to sequence 739; intent is irrelevant."],
    ["Fixed payouts", "Pre-goal and post-goal YES positions retain their execution-time gross payouts."],
    ["Final—not mid-game—result", "Period-100 evidence resolves France 2–0 Morocco; the goal event is never used as the final score."],
    ["Conservative collateral", "YES and NO liabilities are reserved independently without outcome netting."],
    ["Exact final state", "All recorded accounting snapshots satisfy balance = free + reserve + principal."],
  ] as const;

  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1100px]">
        <header className="border-b border-(--border) pb-8">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-(--blue)"><ShieldCheck className="h-4 w-4" />Proof</p>
          <h1 className="mt-4 max-w-full text-[40px] font-extrabold leading-[.98] tracking-[-0.05em] sm:max-w-[900px] sm:text-[64px]">Canonical proof, in plain English.</h1>
          <p className="mt-5 max-w-3xl text-[14px] leading-6 text-(--ink-2)">The runtime demo is deterministic. This page proves the separate canonical V4 lifecycle: deployed program identity, TxLINE CPI validation, stale-order principal return, fixed payouts and exact final accounting.</p>
        </header>

        <JudgeProofSummary provenance={provenance} />

        <details id="technical-evidence" className="group mt-5 overflow-hidden rounded-2xl border border-(--border) bg-white">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 text-[12px] font-extrabold sm:px-6"><span><span className="block">View full technical evidence</span><span className="mt-1 block text-[9px] font-normal text-(--ink-3)">Transactions, binary identity, QuoteGuard internals, reconciliation, RPC checks and trust boundaries</span></span><ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
          <div className="border-t border-(--border) bg-(--surface) p-3 sm:p-5">

        <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50" aria-labelledby="proof-first-paint"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 px-5 py-4"><div><p className="text-[8.5px] font-bold uppercase tracking-[.1em] text-emerald-700">Last complete independent read</p><h2 id="proof-first-paint" className="mt-1 text-[18px] font-extrabold text-emerald-950">V4 deployed · lifecycle verified 20/20</h2></div><span className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-[9px] font-bold text-emerald-700">VERIFIED · {new Date(V4_LAST_VERIFIED_SNAPSHOT.checkedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</span></div><dl className="grid gap-px bg-emerald-200 sm:grid-cols-2 lg:grid-cols-4"><FirstPaintFact label="Deployment" value="Executable V4 · binary hash matched" /><FirstPaintFact label="Transactions" value="24 finalized successful devnet transactions" /><FirstPaintFact label="Protection" value="0.010000000 SOL principal returned · liability 0" /><FirstPaintFact label="Settlement" value="0.030200572 SOL payouts · all final fields 0" /><FirstPaintFact label="QuoteGuard" value="Pre and post quotes VERIFIED 8/8" /><FirstPaintFact label="Resolution" value="France 2–0 · final sequence 1114" /><FirstPaintFact label="Withdrawal" value="0.199799428 SOL genuinely free liquidity" /><FirstPaintFact label="Program hash" value={shortHash(manifest.sbfSha256)} mono /></dl><p className="border-t border-emerald-200 bg-white/60 px-5 py-3 text-[9px] leading-4 text-emerald-950/65">This cached last-known-good snapshot prevents RPC latency from hiding the proof. “Re-check devnet” performs a fresh read; a failed refresh never becomes a false VERIFIED result.</p></section>

        <ProtectionMoment />

        <section className="mt-10 grid gap-4 lg:grid-cols-2" aria-label="FairX trust boundary">
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[8.5px] font-bold uppercase tracking-[.09em] text-emerald-700">Enforced and publicly verified</p><h2 className="mt-1 text-[18px] font-extrabold">What the Solana program guarantees</h2></div></div><ul className="mt-5 grid gap-2 sm:grid-cols-2"><BoundaryItem text="Order quote sequence is compared with the market event sequence" /><BoundaryItem text="Returned principal creates no durable position liability" /><BoundaryItem text="Accepted positions reserve fixed payout liabilities" /><BoundaryItem text="Claims and operator withdrawal obey the vault boundary" /></ul></article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-700"><Settings2 className="h-5 w-5" /></span><div><p className="text-[8.5px] font-bold uppercase tracking-[.09em] text-amber-700">Trusted or configurable</p><h2 className="mt-1 text-[18px] font-extrabold">What FairX does not make trustless</h2></div></div><ul className="mt-5 grid gap-2 sm:grid-cols-2"><BoundaryItem text="TxLINE supplies source evidence for fixture events, odds and final result" muted /><BoundaryItem text="The pricing authority must stay available and secure; it cannot choose an arbitrary V4 quote" muted /><BoundaryItem text="Two of three configured resolution authorities approve settlement" muted /><BoundaryItem text="The deployed program currently retains an upgrade authority" muted /></ul></article>
        </section>

        <section className="mt-4 rounded-2xl border border-(--border) bg-white p-5 sm:p-6" aria-labelledby="decentralization-path">
          <p className="text-[8.5px] font-bold uppercase tracking-[.09em] text-(--blue)">Implemented versus planned</p>
          <h2 id="decentralization-path" className="mt-2 text-[18px] font-extrabold">Decentralization path</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <RoadmapStep label="Today" state="IMPLEMENTED" text="Configured pricing and operator roles, 2-of-3 resolution, and a single upgrade authority." />
            <RoadmapStep label="Next" state="PLANNED" text="Multisig and timelocked upgrades with independently operated pricing signers." />
            <RoadmapStep label="Later" state="PLANNED" text="Audited immutable deployments and more permissionless evidence ingestion." />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="deployment-layer">
          <LayerHeading number="01" title="Deployment" description="The last verified V4 deployment identity renders immediately; a separate read-only account re-check is available on demand." />
          <div className="mt-4"><V4DeploymentStatus initialStatus={initialDeployment} /></div>
          <details className="group mt-3 overflow-hidden rounded-xl border border-(--border) bg-white">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[10.5px] font-bold">Program ID and reproducible binary <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
            <div className="grid gap-4 border-t border-(--border) p-4 text-[10px] sm:grid-cols-3"><TechnicalFact label="Program ID" value={V4_PROGRAM_ID} mono /><TechnicalFact label="SBF SHA-256" value={manifest.sbfSha256} mono /><TechnicalFact label="SBF size" value={`${manifest.sbfSizeBytes.toLocaleString()} bytes`} /></div>
          </details>
        </section>

        <section className="mt-12" aria-labelledby="v4-layer">
          <LayerHeading number="02" title="Current V4 evidence" description="The primary proof: the latest complete verified result renders immediately, with explicit fresh Solana re-verification on demand." />
          <div className="mt-4"><V4LifecycleEvidence initialResponse={initialVerification} /></div>
          <QuoteGuardProof />

          <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6" aria-labelledby="operator-scale-illustration">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[8.5px] font-bold uppercase tracking-[.09em] text-blue-700">Recorded devnet lifecycle</p><h3 id="operator-scale-illustration" className="mt-2 max-w-2xl text-[18px] font-extrabold text-blue-950">The stale quote would have created 6.13× the liability of the synchronized quote.</h3></div><span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[9px] font-bold text-blue-800">OPERATOR-SCALE ILLUSTRATION</span></div>
            <dl className="mt-4 grid gap-2 sm:grid-cols-3"><EconomicFact label="Stale liability" value="0.008769297 SOL" /><EconomicFact label="Synchronized liability" value="0.001431275 SOL" /><EconomicFact label="Liability ratio" value="6.13×" /></dl>
            <p className="mt-4 text-[10px] leading-5 text-blue-950/70"><strong>Operator-scale illustration.</strong> The absolute devnet amount is intentionally small. The same liability ratio applies proportionally to larger market notional, subject to liquidity and market assumptions. It is not measured loss, saved revenue, volume, or traction.</p>
          </section>

          <div
            className="fx-dark-panel mt-5 overflow-hidden rounded-2xl border border-emerald-900 text-white"
            style={{ backgroundColor: "#0c1425", color: "#fff" }}
          >
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-emerald-300">Final reconciliation</p><h3 className="mt-3 text-[28px] font-extrabold tracking-[-.04em]">Every lamport reconciled.</h3><div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold sm:text-[14px]"><span>0.200000000</span><span className="text-slate-500">+</span><span>0.030000000</span><span className="text-slate-500">−</span><span>0.030200572</span><span className="text-slate-500">=</span><span className="text-emerald-300">0.199799428 SOL withdrawn</span></div></div>
              <div className="grid grid-cols-2 gap-2"><ZeroFact label="Free collateral" /><ZeroFact label="Reserved liability" /><ZeroFact label="Pending refunds" /><ZeroFact label="Open positions" /></div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Disclosure title="How V4 proves the outcome" subtitle="Six product-level guarantees">
              <div className="grid gap-2 sm:grid-cols-2">{proofChecks.map(([title, detail]) => <article key={title} className="flex items-start gap-3 rounded-xl bg-slate-50 p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--green)" /><div><h3 className="text-[10.5px] font-bold">{title}</h3><p className="mt-1 text-[9.5px] leading-4 text-(--ink-2)">{detail}</p></div></article>)}</div>
            </Disclosure>
            <Disclosure title="Full solvency transition table" subtitle={`${lifecycle.snapshots.length} accounting snapshots · collapsed by default`}>
              <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-[9.5px]"><thead className="bg-slate-50 text-(--ink-3)"><tr><Th>Transition</Th><Th>Balance</Th><Th>Free</Th><Th>Reserve</Th><Th>Principal</Th><Th>Check</Th></tr></thead><tbody>{lifecycle.snapshots.map((row) => <tr key={row.label} className="border-t border-(--border)"><Td>{row.label}</Td><Td>{formatSol(row.spendableLamports)}</Td><Td>{formatSol(row.freeCollateral)}</Td><Td>{formatSol(row.reservedLiability)}</Td><Td>{formatSol(row.acceptedStakePrincipal)}</Td><Td><span className={`font-bold ${invariantHolds(row) ? "text-(--green)" : "text-(--red)"}`}>{invariantHolds(row) ? "EXACT" : "FAILED"}</span></Td></tr>)}</tbody></table></div>
            </Disclosure>
            <Disclosure title="TxLINE provenance and validation roots" subtitle="Technical source evidence">
              <div className="grid gap-3 sm:grid-cols-2"><EvidenceLink label="TxLINE devnet program" value={TXLINE_PROGRAM} href={explorerAddress(TXLINE_PROGRAM)} /><EvidenceLink label="Odds validation root" value={V4_EVIDENCE.oddsRootPda} href={explorerAddress(V4_EVIDENCE.oddsRootPda)} /><EvidenceLink label="Final scores root" value={V4_EVIDENCE.scoresRootPda} href={explorerAddress(V4_EVIDENCE.scoresRootPda)} /><TechnicalFact label="Recorded source mode" value="Genuine TxLINE historical evidence; live read-only devnet proof validation" /></div>
            </Disclosure>
          </div>
        </section>

          </div>
        </details>

        <div className="mt-10 flex flex-col gap-3 border-t border-(--border) pt-7 sm:flex-row"><Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-(--blue) px-6 text-[11px] font-bold text-white">Run the Demo</Link><Link href="/portfolio" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-(--border) bg-white px-6 text-[11px] font-bold">See every canonical position</Link></div>
      </div>
    </FairXShell>
  );
}

function LayerHeading({ number, title, description }: { number: string; title: string; description: string }) { return <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-(--blue)">Layer {number}</p><h2 className="mt-2 text-[24px] font-extrabold tracking-[-.035em]">{title}</h2><p className="mt-2 max-w-3xl text-[11px] leading-5 text-(--ink-2)">{description}</p></div>; }
function BoundaryItem({ text, muted = false }: { text: string; muted?: boolean }) { return <li className={`flex items-start gap-2 rounded-xl bg-white/70 p-3 text-[9.5px] font-semibold leading-4 ${muted ? "text-amber-950/75" : "text-emerald-950/75"}`}>{muted ? <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />}{text}</li>; }
function RoadmapStep({ label, state, text }: { label: string; state: "IMPLEMENTED" | "PLANNED"; text: string }) { return <article className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-extrabold">{label}</h3><span className={`text-[8px] font-bold tracking-[.08em] ${state === "IMPLEMENTED" ? "text-(--green)" : "text-(--ink-3)"}`}>{state}</span></div><p className="mt-2 text-[9.5px] leading-4 text-(--ink-2)">{text}</p></article>; }
function EconomicFact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-blue-100 bg-white p-3"><dt className="text-[8.5px] font-bold uppercase tracking-[.06em] text-blue-700">{label}</dt><dd className="mt-2 text-[16px] font-extrabold text-blue-950">{value}</dd></div>; }
function FirstPaintFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0 bg-white p-4"><dt className="text-[8px] font-bold uppercase tracking-[.07em] text-emerald-700">{label}</dt><dd className={`mt-2 break-words text-[10px] font-semibold leading-4 text-emerald-950 ${mono ? "mono" : ""}`}>{value}</dd></div>; }
function ZeroFact({ label }: { label: string }) { return <div className="min-w-32 rounded-xl bg-white/5 p-3"><p className="text-[8.5px] text-emerald-200">{label}</p><p className="mt-1 text-[16px] font-extrabold">0</p></div>; }
function Disclosure({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <details className="group overflow-hidden rounded-xl border border-(--border) bg-white"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4"><span><span className="block text-[10.5px] font-bold">{title}</span><span className="mt-0.5 block text-[9px] text-(--ink-3)">{subtitle}</span></span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary><div className="border-t border-(--border) p-3 sm:p-4">{children}</div></details>; }
function TechnicalFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-[8.5px] font-bold uppercase tracking-[.06em] text-(--ink-3)">{label}</p><p className={`mt-2 break-all text-[9.5px] font-semibold leading-4 ${mono ? "mono" : ""}`}>{value}</p></div>; }
function EvidenceLink({ label, value, href }: { label: string; value: string; href: string }) { return <a href={href} target="_blank" rel="noreferrer" className="group rounded-xl bg-slate-50 p-3"><p className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[.06em] text-(--ink-3)">{label}<ExternalLink className="h-3 w-3" /></p><p className="mono mt-2 break-all text-[9.5px] font-semibold group-hover:text-(--blue)">{shortHash(value)}</p></a>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="whitespace-nowrap px-4 py-3">{children}</td>; }
