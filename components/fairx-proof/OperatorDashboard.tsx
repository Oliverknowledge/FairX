import Link from "next/link";
import { Activity, ArrowUpRight, CircleAlert, DatabaseZap, FileCheck2, ShieldCheck, WalletCards } from "lucide-react";
import { Badge, cn } from "@/components/lineguard/ui";
import { proofData, type SettlementProofCase } from "@/lib/proof/staticProofData";

const yesCase = proofData.cases.find((proof) => proof.id === "yes")!;
const noCase = proofData.cases.find((proof) => proof.id === "no")!;

export function OperatorDashboard() {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={<DatabaseZap className="h-4 w-4" />} label="Feed status" value="Replay evidence" detail="No live TxLINE health check on this page" tone="amber" />
        <Metric icon={<Activity className="h-4 w-4" />} label="Stale windows" value="2" detail="Two fixed canonical proof cases" tone="amber" />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Orders refunded" value="1" detail="YES positive-edge order" tone="red" />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Orders filled" value="1" detail="NO stale, no-edge order" tone="blue" />
        <Metric icon={<WalletCards className="h-4 w-4" />} label="Protected volume" value="Not aggregated" detail="Canonical receipt records a $500 sandbox stake" tone="neutral" />
        <Metric icon={<FileCheck2 className="h-4 w-4" />} label="Program status" value="Devnet deployed" detail="Recorded explorer links below" tone="green" />
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--border) px-4 py-3.5">
          <div>
            <p className="section-label">Integrity monitoring</p>
            <h2 className="mt-1 text-[17px] font-extrabold text-(--ink)">Canonical guarded-order outcomes</h2>
            <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-(--ink-2)">
              This operator view summarizes the two recorded devnet proof paths. It is a static evidence view, not a live operations console.
            </p>
          </div>
          <Badge tone="blue">fixed evidence</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left">
            <thead className="bg-[#f8fafc]">
              <tr className="border-b border-(--border)">
                <Head>Market / source</Head>
                <Head>Freshness</Head>
                <Head>Attempted order</Head>
                <Head>Guard verdict</Head>
                <Head>Evidence</Head>
              </tr>
            </thead>
            <tbody>
              <OrderRow proof={yesCase} />
              <OrderRow proof={noCase} />
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label">Materiality policy</p>
              <h2 className="mt-1 text-[16px] font-extrabold text-(--ink)">What can open a stale window</h2>
            </div>
            <Badge tone="amber">market-specific</Badge>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-(--ink-2)">
            LineGuard only advances freshness when an event is material to that market. Cosmetic or unknown events do not block trading.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <PolicyRow label="Goals" detail="Winner and total-goals markets" />
            <PolicyRow label="Red cards / penalties / VAR" detail="Winner markets when material" />
            <PolicyRow label="Odds updates" detail="Any quoted market" />
            <PolicyRow label="Unknown / cosmetic input" detail="Does not stale-lock a market" neutral />
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-(--red)" />
            <div>
              <p className="section-label">Suspicious attempt</p>
              <h2 className="mt-1 text-[16px] font-extrabold text-(--ink)">YES stale-edge capture</h2>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-(--red)/25 bg-(--red-bg) p-3">
            <p className="mono text-[10px] font-bold text-(--red)">+23¢ edge &gt; 2¢ tolerance</p>
            <p className="mt-1 text-[11px] leading-relaxed text-(--ink-2)">
              Observed YES price 40¢ versus fair 63¢ while materialSeq was ahead of pricedAtSeq. The recorded devnet verdict is a refund.
            </p>
            <a href={yesCase.txs.at(-1)!.explorerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-(--blue) hover:underline">
              Open evaluation transaction <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>
      </div>

      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-label">On-chain program</p>
            <h2 className="mt-1 text-[16px] font-extrabold text-(--ink)">Developer handoff</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-(--ink-2)">
              The proof hub has the full PDA and transaction sequence for each case. The technical terminal retains the configured on-chain controls and feed/replay tooling.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={proofData.program.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--border) bg-white px-3 text-[11px] font-bold text-(--ink-2) hover:text-(--blue)">
              Program explorer <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <Link href="/terminal" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-(--ink) px-3 text-[11px] font-bold text-white hover:opacity-90">
              Open terminal <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <RecordedTx label="YES evaluation · refunded" href={yesCase.txs.at(-1)!.explorerUrl} signature={yesCase.txs.at(-1)!.signature} tone="red" />
          <RecordedTx label="NO evaluation · filled" href={noCase.txs.at(-1)!.explorerUrl} signature={noCase.txs.at(-1)!.signature} tone="blue" />
          <RecordedTx label="Program deployment" href={proofData.program.deploymentTxUrl} signature={proofData.program.deploymentTx} tone="green" />
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "blue" | "amber" | "red" | "green";
}) {
  const iconTone = tone === "red" ? "text-(--red)" : tone === "blue" ? "text-(--blue)" : tone === "amber" ? "text-(--amber)" : tone === "green" ? "text-(--green)" : "text-(--ink-2)";
  return (
    <article className="card min-w-0 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold text-(--ink-2)">{label}</p>
        <span className={cn("shrink-0", iconTone)}>{icon}</span>
      </div>
      <p className="mt-3 text-[20px] font-extrabold tracking-[-0.02em] text-(--ink)">{value}</p>
      <p className="mt-1 text-[10.5px] leading-snug text-(--ink-3)">{detail}</p>
    </article>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-(--ink-3)">{children}</th>;
}

function OrderRow({ proof }: { proof: SettlementProofCase }) {
  const yes = proof.id === "yes";
  const proofTx = proof.txs.at(-1)!;
  const observed = yes ? "40¢" : "60¢";
  const fair = yes ? "63¢" : "37¢";
  const verdictTone = yes ? "red" : "blue";

  return (
    <tr className="border-b border-(--border) last:border-b-0">
      <td className="px-4 py-3 align-top">
        <p className="text-[12px] font-bold text-(--ink)">England wins</p>
        <p className="mt-0.5 text-[10.5px] text-(--ink-3)">material event sequence 2</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="mono text-[11px] font-bold text-(--amber)">2 &gt; 1</p>
        <p className="mt-0.5 text-[10.5px] text-(--ink-3)">stale window open</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="mono text-[11px] font-bold text-(--ink)">{yes ? "YES" : "NO"} @ {observed}</p>
        <p className="mt-0.5 text-[10.5px] text-(--ink-3)">fair {fair} · {yes ? "+23¢" : "-23¢"} edge</p>
      </td>
      <td className="px-4 py-3 align-top">
        <Badge tone={verdictTone}>{proof.verdict}</Badge>
        <p className="mt-1 text-[10.5px] text-(--ink-3)">{yes ? "refunded on-chain" : "filled on-chain"}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <a href={proofTx.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-(--blue) hover:underline">
          Evaluation tx <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </td>
    </tr>
  );
}

function PolicyRow({ label, detail, neutral = false }: { label: string; detail: string; neutral?: boolean }) {
  return (
    <div className="rounded-lg border border-(--border) bg-[#f9fafb] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", neutral ? "bg-(--ink-3)" : "bg-(--amber)")} />
        <p className="text-[11px] font-bold text-(--ink)">{label}</p>
      </div>
      <p className="mt-1 pl-3.5 text-[10.5px] leading-snug text-(--ink-3)">{detail}</p>
    </div>
  );
}

function RecordedTx({ label, href, signature, tone }: { label: string; href: string; signature: string; tone: "red" | "blue" | "green" }) {
  const toneClass = tone === "red" ? "border-(--red)/25 bg-(--red-bg) text-(--red)" : tone === "blue" ? "border-(--blue)/25 bg-(--blue-bg) text-(--blue)" : "border-(--green)/25 bg-(--green-bg) text-(--green)";
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("min-w-0 rounded-lg border px-3 py-2.5 hover:opacity-80", toneClass)}>
      <p className="text-[10px] font-bold">{label}</p>
      <p className="mono mt-1 truncate text-[10px] font-semibold">{shorten(signature)}</p>
    </a>
  );
}

function shorten(value: string): string {
  return value.length > 28 ? `${value.slice(0, 12)}…${value.slice(-10)}` : value;
}
