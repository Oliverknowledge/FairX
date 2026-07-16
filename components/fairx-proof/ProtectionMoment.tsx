import Link from "next/link";
import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { V4_REPLAY_SLUG } from "@/lib/v4/replay";

const moments = [
  {
    step: "01",
    label: "Goal",
    value: "FRANCE 1–0",
    detail: "TxLINE sequence 739",
    tone: "amber",
  },
  {
    step: "02",
    label: "Old quote",
    value: "53.28% YES",
    detail: "Sequence 738 · now stale",
    tone: "rose",
  },
  {
    step: "03",
    label: "Principal returned",
    value: "0.010000000 SOL",
    detail: "Full stake returned on-chain",
    tone: "emerald",
  },
  {
    step: "04",
    label: "Market stays open",
    value: "SYNCHRONIZED YES FILLS",
    detail: "Accepted at the verified 87.48% quote",
    tone: "sky",
  },
] as const;

export function ProtectionMoment() {
  return (
    <section
      className="fx-dark-panel relative mt-7 overflow-hidden rounded-[24px] border border-slate-700 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]"
      style={{ backgroundColor: "#08111f", color: "#fff" }}
      aria-labelledby="fairx-one-picture"
    >
      <div className="pointer-events-none absolute -right-28 -top-36 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.17em] text-sky-300">FairX in one picture</p>
            <h2 id="fairx-one-picture" className="mt-2 text-[23px] font-extrabold tracking-[-.035em] sm:text-[30px]">
              A stale price should not become somebody else&apos;s loss.
            </h2>
          </div>
          <p className="max-w-[310px] text-[10px] leading-5 text-slate-300">
            One real France–Morocco moment. Four finalized consequences. No blanket market pause.
          </p>
        </div>
      </div>

      <div className="relative p-4 sm:p-6">
        <ol className="flex flex-col items-stretch gap-2 lg:flex-row" aria-label="Goal, old quote, principal returned, market stays open">
          {moments.map((moment, index) => (
            <li key={moment.label} className="contents">
              <MomentCard {...moment} />
              {index < moments.length - 1 ? (
                <div className="flex shrink-0 items-center justify-center px-1 py-1 text-slate-500" aria-hidden="true">
                  <span className="text-[20px] font-light leading-none text-slate-400">→</span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 sm:flex-row sm:items-center sm:px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-300 text-emerald-950 shadow-[0_0_28px_rgba(110,231,183,0.28)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold text-emerald-200 sm:text-[17px]">The trader keeps the money. Everyone else keeps the market.</p>
            <p className="mt-1 text-[9.5px] leading-4 text-emerald-50/65">The stale sequence-738 YES principal returned; the synchronized sequence-739 YES order was accepted with its exact liability reserved.</p>
          </div>
          <Link href={`/markets/${V4_REPLAY_SLUG}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[10px] font-extrabold transition hover:bg-emerald-50" style={{ color: "#08111f" }}>
            Watch the replay <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">
          <ProofPoint text="Recorded on devnet" />
          <ProofPoint text="24 finalized transactions" />
          <ProofPoint text="Independently verified 20/20" />
        </div>
      </div>
    </section>
  );
}

function MomentCard({ step, label, value, detail, tone }: (typeof moments)[number]) {
  const styles = {
    amber: { backgroundColor: "rgba(245, 158, 11, 0.11)", borderColor: "rgba(252, 211, 77, 0.32)", color: "#fde68a" },
    rose: { backgroundColor: "rgba(244, 63, 94, 0.11)", borderColor: "rgba(253, 164, 175, 0.32)", color: "#fecdd3" },
    emerald: { backgroundColor: "rgba(16, 185, 129, 0.13)", borderColor: "rgba(110, 231, 183, 0.36)", color: "#a7f3d0" },
    sky: { backgroundColor: "rgba(14, 165, 233, 0.13)", borderColor: "rgba(125, 211, 252, 0.36)", color: "#bae6fd" },
  } as const;

  return (
    <article className="min-w-0 flex-1 rounded-2xl border p-4" style={styles[tone]}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-extrabold uppercase tracking-[.12em]">{label}</p>
        <span className="mono text-[8px] text-white/35">{step}</span>
      </div>
      <p className="mt-6 whitespace-nowrap text-[18px] font-black leading-none tracking-[-.035em] text-white lg:text-[16px] xl:text-[18px]">{value}</p>
      <p className="mt-3 text-[9px] leading-4 text-slate-400">{detail}</p>
    </article>
  );
}

function ProofPoint({ text }: { text: string }) {
  return <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-300" />{text}</span>;
}
