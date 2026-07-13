import Link from "next/link";
import { ArrowLeft, CircleSlash2 } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";

export default function CreateMarketPage() {
  return (
    <FairXShell compact>
      <section className="mx-auto max-w-xl rounded-2xl border border-(--border) bg-white p-7 text-center sm:p-10">
        <CircleSlash2 className="mx-auto h-9 w-9 text-(--ink-3)" />
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-(--ink-3)">Unsupported feature removed</p>
        <h1 className="mt-2 text-[29px] font-extrabold tracking-[-0.045em]">Custom market creation is not part of FairX.</h1>
        <p className="mt-4 text-[12px] leading-relaxed text-(--ink-2)">The previous form saved local browser data but could be mistaken for a deployed market. FairX now exposes only MATCH_WINNER_HOME_V1 and only labels execution real when devnet verification succeeds.</p>
        <Link href="/markets" className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-(--ink) px-5 text-[12px] font-bold text-white"><ArrowLeft className="h-4 w-4" />Back to the supported market</Link>
      </section>
    </FairXShell>
  );
}
