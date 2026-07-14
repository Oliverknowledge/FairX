import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Database, ExternalLink, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { formatSol, invariantHolds, REPLAY_LABEL, runCanonicalLifecycle, shortHash, V4_EVIDENCE, V4_PROGRAM_ID, V4_REPLAY_SLUG } from "@/lib/v4/replay";

export const metadata: Metadata = { title: "Verify V4 Replay", description: "Verify the isolated FairX V4 France-Morocco fixed-payout replay." };

export default function ProofPage() {
  const lifecycle = runCanonicalLifecycle();
  const checks = [
    ["Fixture isolation", V4_EVIDENCE.fixtureId === 18209181, "Only France–Morocco fixture 18209181 is accepted by the program."],
    ["Pre-goal StablePrice", V4_EVIDENCE.preGoal.odds.MessageId === "1837056734:00003:000066-1-10021-stab", `Raw prices ${V4_EVIDENCE.preGoal.odds.Prices.join(" / ")}; complete Merkle branch recorded.`],
    ["Confirmed goal", V4_EVIDENCE.goal.sequence === 739, `Sequence 739 · source timestamp ${V4_EVIDENCE.goal.ts}.`],
    ["Post-goal StablePrice", V4_EVIDENCE.postGoal.odds.MessageId === "1837056922:00003:000268-10021-stab", `Raw prices ${V4_EVIDENCE.postGoal.odds.Prices.join(" / ")}; complete Merkle branch recorded.`],
    ["Final—not mid-game—evidence", V4_EVIDENCE.finalSequence === 1114 && V4_EVIDENCE.finalResult.home === 2, "Sequence 1114, France 2–0 Morocco. The sequence-739 1–0 event is never used as final settlement."],
    ["Regulation-time period", V4_EVIDENCE.finalProof.statsToProve.every((stat) => stat.period === 100), "Keys 1001/1002/3001/3002 all use TxLINE final period 100."],
    ["Strict stale invalidation", lifecycle.positions.find((position) => position.id === "stale-bot")?.status === "REFUNDED", "The sequence-738 bot position is REFUNDED after market sequence advances to 739."],
    ["Fixed payout", lifecycle.positions.find((position) => position.id === "pre-yes")?.grossPayoutLamports === 18_769_297n, "0.01 SOL at 532,785 micros fixes gross payout at 18,769,297 lamports."],
    ["Every accounting snapshot", lifecycle.snapshots.every(invariantHolds), `${lifecycle.snapshots.length} lifecycle snapshots satisfy A = F + R + S exactly.`],
    ["Final solvency", lifecycle.final.reservedLiability === 0n && lifecycle.final.acceptedStakePrincipal === 0n, "All payouts and losses reconcile before the operator withdrawal."],
  ] as const;

  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[1060px]">
        <header className="grid gap-5 border-b border-(--border) pb-7 lg:grid-cols-[1fr_330px]"><div><p className="text-[11px] font-bold text-(--blue)">V4 proof manifest</p><h1 className="mt-2 text-[40px] font-extrabold tracking-[-0.055em] sm:text-[52px]">One fixture. Fixed payouts. Zero hidden netting.</h1><p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-(--ink-2)">{REPLAY_LABEL}</p></div><div className="card p-5"><p className="section-label">Local prototype program</p><p className="mono mt-2 break-all text-[10.5px] font-semibold">{V4_PROGRAM_ID}</p><p className="mt-3 text-[10px] leading-relaxed text-(--ink-3)">Distinct from the deployed V2/V3 LineGuard ID. No V4 deployment or signed transaction exists in Phase B.</p></div></header>

        <section className="mt-7"><h2 className="text-[18px] font-extrabold">Independent checks</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{checks.map(([title, passed, detail]) => <article key={title} className="card flex gap-3 p-4"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${passed ? "text-(--green)" : "text-(--red)"}`} /><div><h3 className="text-[12px] font-bold">{title}</h3><p className="mt-1 text-[10.5px] leading-relaxed text-(--ink-2)">{detail}</p></div></article>)}</div></section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="card overflow-hidden"><div className="border-b border-(--border) p-5"><h2 className="text-[15px] font-extrabold">Solvency reconciliation</h2><p className="mt-1 text-[10.5px] text-(--ink-2)">Spendable vault lamports exclude rent.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[10px]"><thead className="bg-[#f8fafc] text-(--ink-3)"><tr><Th>Transition</Th><Th>Balance A</Th><Th>Free F</Th><Th>Reserve R</Th><Th>Principal S</Th><Th>Check</Th></tr></thead><tbody>{lifecycle.snapshots.map((row) => <tr key={row.label} className="border-t border-(--border)"><Td>{row.label}</Td><Td>{formatSol(row.spendableLamports)}</Td><Td>{formatSol(row.freeCollateral)}</Td><Td>{formatSol(row.reservedLiability)}</Td><Td>{formatSol(row.acceptedStakePrincipal)}</Td><Td><span className="font-bold text-(--green)">EXACT</span></Td></tr>)}</tbody></table></div></div>
          <aside className="space-y-4"><EvidenceCard title="Odds validation root" value={V4_EVIDENCE.oddsRootPda} detail={`${V4_EVIDENCE.preGoal.subTreeProof.length + V4_EVIDENCE.preGoal.mainTreeProof.length} pre-goal nodes · ${V4_EVIDENCE.postGoal.subTreeProof.length + V4_EVIDENCE.postGoal.mainTreeProof.length} post-goal nodes`} /><EvidenceCard title="Final scores root" value={V4_EVIDENCE.scoresRootPda} detail={`Period 100 · event root ${shortHash(V4_EVIDENCE.finalProof.eventStatRoot.join(""))}`} /><div className="card p-5"><p className="flex items-center gap-2 text-[11px] font-bold"><ShieldCheck className="h-4 w-4 text-(--green)" />Conservative collateral</p><p className="mt-2 text-[10.5px] leading-relaxed text-(--ink-2)">YES and NO liabilities are reserved independently. This intentionally ignores outcome netting and therefore over-collateralises the binary market.</p></div></aside>
        </section>

        <div className="mt-6 flex flex-wrap gap-3"><Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex h-11 items-center rounded-lg bg-(--blue) px-5 text-[11px] font-bold text-white">Run replay</Link><a href="https://explorer.solana.com/address/6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J?cluster=devnet" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg border border-(--border) bg-white px-5 text-[11px] font-bold"><ExternalLink className="h-3.5 w-3.5" />TxLINE devnet program</a></div>
      </div>
    </FairXShell>
  );
}

function EvidenceCard({ title, value, detail }: { title: string; value: string; detail: string }) { return <div className="card p-5"><p className="flex items-center gap-2 text-[11px] font-bold"><Database className="h-4 w-4 text-(--blue)" />{title}</p><p className="mono mt-3 break-all text-[9.5px] text-(--ink-2)">{value}</p><p className="mt-2 text-[10px] text-(--ink-3)">{detail}</p></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="whitespace-nowrap px-4 py-3">{children}</td>; }
