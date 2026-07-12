import { ArrowUpRight, Coins, Gavel, HandCoins, Layers, ShieldCheck, Trophy, XCircle } from "lucide-react";
import { proofData } from "@/lib/proof/staticProofData";

const s = proofData.settlement;
const sol = (lamports: number) => `${(lamports / 1_000_000_000).toFixed(3)} SOL`;

export function SettlementProofPanel() {
  return (
    <section className="rounded-2xl border border-(--green)/25 bg-[#f7fdfa] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label text-(--green)">Unified lifecycle · one market</p>
          <h2 className="mt-1 text-[18px] font-extrabold tracking-[-0.03em] text-(--ink)">Protection → reprice → fill → root-bound resolution → payout.</h2>
          <p className="mt-1 max-w-2xl text-[10.5px] leading-relaxed text-(--ink-2)">
            One market, {s.txs.length} finalized devnet transactions: LineGuard refunds a stale exploit, the market
            reprices, valid orders fill both pools, and the outcome is deterministically derived on-chain from submitted
            scores bound to a genuine TxLINE root account. The winner is paid parimutuel from the ProtocolVault.
          </p>
        </div>
        <span className="rounded-full border border-(--green)/25 bg-white px-2.5 py-1 text-[9px] font-bold text-(--green)">DEVNET · {s.payoutMultiple.toFixed(0)}× WINNER PAYOUT</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Layers} label="YES pool filled" value={sol(s.yesPoolLamports)} tone="neutral" />
        <Metric icon={Layers} label="NO pool filled" value={sol(s.noPoolLamports)} tone="neutral" />
        <Metric icon={Coins} label="Total pool" value={sol(s.totalPoolLamports)} tone="blue" />
        <Metric icon={HandCoins} label={`Winner payout (${s.winnerSide})`} value={sol(s.winnerPayoutLamports)} tone="green" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-(--green)/20 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-(--green)"><Trophy className="h-3.5 w-3.5" /> Winner · {s.winnerSide}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-(--ink-2)">Staked {sol(s.winnerStakeLamports)}, collected {sol(s.winnerPayoutLamports)} ({s.payoutMultiple.toFixed(0)}×). OrderEscrow status is now <span className="mono font-bold text-(--green)">{s.winnerOrderStatus}</span>.</p>
          <a href={s.winnerOrderExplorerUrl} target="_blank" rel="noreferrer" className="mono mt-2 inline-flex items-center gap-1 truncate text-[9px] font-bold text-(--blue) hover:underline">{s.winnerOrderPda} <ArrowUpRight className="h-3 w-3 shrink-0" /></a>
        </div>
        <div className="rounded-xl border border-(--red)/20 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-(--red)"><XCircle className="h-3.5 w-3.5" /> Loser forfeits</p>
          <p className="mt-1 text-[10px] leading-relaxed text-(--ink-2)">The losing filled order keeps status <span className="mono font-bold text-(--ink)">{s.loserOrderStatus}</span> and cannot settle — its stake stays in the vault and funds the winner&rsquo;s payout.</p>
          <p className="mono mt-2 truncate text-[9px] font-bold text-(--ink-3)">{s.loserOrderPda}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Evidence label="Protection — stale exploit refunded" value={`${s.protectionVerdict} · +${(s.protectionEdgeMicros / 10_000).toFixed(3)}¢ edge`} href={s.protectionTx.explorerUrl} icon={ShieldCheck} />
        <Evidence label="Root-bound, operator-submitted scores" value={`${s.homeScore}–${s.awayScore} ⇒ ${s.derivedOutcome === 1 ? "YES" : s.derivedOutcome === 2 ? "NO" : "VOID"} · genuine root`} href={s.validationRootExplorerUrl} icon={Gavel} />
        <Evidence label="Parimutuel payout tx" value={s.settleTx.signature} href={s.settleTx.explorerUrl} icon={HandCoins} />
      </div>

      <div className="mt-3 rounded-xl border border-(--border) bg-white p-3 text-[10px] leading-relaxed text-(--ink-2)">
        <p className="font-extrabold text-(--ink)">Settlement-v5 machine-readable semantics · {s.ruleBindingDeployment === "DEPLOYED" ? "committed on-chain" : "upgrade pending"}</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <p><span className="font-bold">YES meaning:</span> {s.yesMeaning}</p>
          <p><span className="font-bold">Market type:</span> {s.marketType}</p>
          <p><span className="font-bold">Resolution rule:</span> {s.resolutionRule} ({s.resolutionRuleCode})</p>
          <p><span className="font-bold">Home:</span> {s.homeTeam} · stat key {s.homeStatKey}</p>
          <p><span className="font-bold">Away:</span> {s.awayTeam} · stat key {s.awayStatKey}</p>
          <p><span className="font-bold">Submitted score:</span> {s.homeScore}–{s.awayScore}</p>
          <p><span className="font-bold">TxLINE proof validated separately:</span> {s.validateStatV2Passed ? "validateStatV2 passed" : "not validated"}</p>
        </div>
        <p className="mt-2 rounded-md border border-[#f0d39a] bg-(--amber-bg) p-2 font-semibold text-(--amber)">Scores are operator-submitted; the TxLINE Merkle proof is not re-verified inside LineGuard.</p>
        {s.ruleBindingDeployment !== "DEPLOYED" && <p className="mt-2 text-[9.5px] text-(--ink-3)">The 13-transaction record below is historical settlement-v4 evidence. It predates the deployed v2 direct-CPI, Position, isolated-vault, and threshold-resolution accounts.</p>}
      </div>

      <div className="mt-3 rounded-xl border border-(--border) bg-white p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-(--ink)"><Coins className="h-3.5 w-3.5 text-(--blue)" /> Per-market accounting (solvency invariant)</p>
        <p className="mt-1 text-[10px] leading-relaxed text-(--ink-2)">
          Accepted <span className="mono font-bold text-(--ink)">{sol(s.marketTotalInLamports)}</span> = paid{" "}
          <span className="mono font-bold text-(--green)">{sol(s.marketTotalPaidLamports)}</span> + refunded{" "}
          <span className="mono font-bold text-(--ink)">{sol(s.marketTotalRefundedLamports)}</span> + remaining{" "}
          <span className="mono font-bold text-(--ink)">{sol(s.marketTotalInLamports - s.marketTotalPaidLamports - s.marketTotalRefundedLamports)}</span>. One market can never draw on another&rsquo;s pool.
        </p>
      </div>

      <div className="mt-4">
        <p className="section-label">{s.txs.length} finalized transactions</p>
        <ol className="mt-2 grid gap-1.5">
          {s.txs.map((tx, index) => (
            <li key={tx.signature}>
              <a href={tx.explorerUrl} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-lg border border-(--border) bg-white px-3 py-2 hover:border-(--green)/35">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--green-bg) text-[9px] font-bold text-(--green)">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10.5px] font-bold text-(--ink)">{tx.label}</span>
                    <span className="mono block truncate text-[9px] text-(--ink-3)">{tx.signature}</span>
                  </span>
                </span>
                <span className="shrink-0 text-[8.5px] font-semibold text-(--ink-3)">slot {tx.slot} <ArrowUpRight className="ml-0.5 inline h-3 w-3 text-(--blue)" /></span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-3 text-[9px] leading-relaxed text-(--ink-3)">
        Market <span className="mono">{s.marketPda}</span> · vault <a href={s.vaultExplorerUrl} target="_blank" rel="noreferrer" className="mono text-(--blue) hover:underline">{s.vaultPda}</a> · recorded {new Date(s.recordedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · devnet funds only.
      </p>
    </section>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone: "neutral" | "blue" | "green" }) {
  const color = tone === "green" ? "text-(--green)" : tone === "blue" ? "text-(--blue)" : "text-(--ink)";
  return (
    <div className="rounded-xl border border-(--border) bg-white p-3">
      <p className="flex items-center gap-1.5 text-[9px] font-bold text-(--ink-3)"><Icon className="h-3 w-3" /> {label}</p>
      <p className={`num mt-1 text-[16px] font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function Evidence({ label, value, href, icon: Icon }: { label: string; value: string; href: string; icon: typeof Coins }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group min-w-0 rounded-xl border border-(--border) bg-white p-3 hover:border-(--green)/35">
      <p className="flex items-center gap-1.5 text-[9px] font-bold text-(--ink-3)"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mono mt-1 truncate text-[10px] font-bold text-(--ink)">{value}</p>
      <p className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-(--blue)">Open on explorer <ArrowUpRight className="h-3 w-3" /></p>
    </a>
  );
}
