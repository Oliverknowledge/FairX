import { ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { canonicalV2Lifecycle } from "@/lib/proof/v2Lifecycle";

const proof = canonicalV2Lifecycle;

function sol(lamports: number): string {
  return `${(lamports / 1_000_000_000).toFixed(2)} SOL`;
}

function short(value: string): string {
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

export function CanonicalV2Settlement({ connectedWallet }: { connectedWallet?: string | null }) {
  const ownerConnected = connectedWallet === proof.lifecycle.positionOwner;
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" aria-label="Canonical v2 settled lifecycle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label text-emerald-700">Archived v2 devnet record</p>
          <h2 className="mt-1 text-[21px] font-extrabold tracking-[-0.035em] text-(--ink)">Resolved: France won</h2>
          <p className="mt-1 text-[10.5px] text-(--ink-2)">Real devnet transactions using historical TxLINE evidence. Retained for audit history, not presented as the economically complete v3 lifecycle.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />v2 record verified</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="TxLINE CPI" value="ValidateStatV2 passed" />
        <Fact label="Resolution threshold" value="2 of 3" />
        <Fact label="Position status" value="Claimed" />
        <Fact label="Payout" value={sol(proof.lifecycle.claimedPayoutLamports)} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-(--border) bg-white p-3">
          <p className="section-label">Orders and position</p>
          <dl className="mt-2 space-y-2 text-[10.5px]">
            <Row label="Accepted position owner" value={short(proof.lifecycle.positionOwner)} />
            <Row label="Accepted stake" value={sol(proof.lifecycle.acceptedStakeLamports)} />
            <Row label="Refunded stale order" value={sol(proof.lifecycle.refundedStakeLamports)} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-3">
            <EvidenceLink label="Refund transaction" href={proof.transactions.staleRefund.explorerUrl} />
            <EvidenceLink label="Accepted-position transaction" href={proof.transactions.acceptedPosition.explorerUrl} />
            <EvidenceLink label="Claim transaction" href={proof.transactions.claim.explorerUrl} />
          </div>
        </div>
        <div className="rounded-lg border border-(--border) bg-white p-3">
          <p className="section-label">Isolated market vault</p>
          <dl className="mt-2 space-y-2 text-[10.5px]">
            <Row label="Deposited" value={sol(proof.vault.totalDepositedLamports)} />
            <Row label="Refunded" value={sol(proof.vault.totalRefundedLamports)} />
            <Row label="Paid" value={sol(proof.vault.totalPaidLamports)} />
            <Row label="Claimable / dust" value="0 / 0" />
          </dl>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[10.5px] text-blue-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{connectedWallet ? (ownerConnected ? "Connected wallet owns the canonical position; it is already claimed." : "This wallet does not own the canonical position. Public settlement proof remains visible.") : "No wallet is required to inspect this settled lifecycle. Connect only to inspect wallet-specific positions."}</p>
      </div>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10.5px] font-semibold leading-relaxed text-amber-900">Economic limitation: this v2 record had no losing counterparty collateral, so the winner claimed only the winner&rsquo;s own 0.01 SOL principal. Use the v3 verifier for the required A-wins-B settlement claim.</p>
      <details className="mt-3 rounded-lg border border-(--border) bg-white p-3"><summary className="cursor-pointer text-[10.5px] font-bold">Technical details</summary><dl className="mt-3 space-y-2 text-[10.5px]"><Row label="Position PDA" value={short(proof.lifecycle.positionPda)} mono /><Row label="Market vault PDA" value={short(proof.market.marketVaultPda)} mono /><Row label="Rent reserve" value={`${proof.vault.rentReserveLamports.toLocaleString("en-GB")} lamports`} /></dl></details>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-(--border) bg-white p-3"><p className="text-[9.5px] text-(--ink-3)">{label}</p><p className="mt-1 text-[12px] font-bold text-(--ink)">{value}</p></div>;
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-(--ink-3)">{label}</dt><dd className={`${mono ? "mono " : ""}text-right font-semibold text-(--ink)`}>{value}</dd></div>;
}

function EvidenceLink({ label, href }: { label: string; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-(--blue)">{label}<ArrowUpRight className="h-3 w-3" /></a>;
}
