import type { Metadata } from "next";
import Link from "next/link";
import { FairXShell } from "@/components/fairx/FairXShell";
import { V2LifecycleVerifier } from "@/components/fairx-proof/V2LifecycleVerifier";
import { V3LifecycleVerifier } from "@/components/fairx-proof/V3LifecycleVerifier";

export const metadata: Metadata = { title: "Verify FairX Proof", description: "Independently verify the FairX three-wallet devnet lifecycle." };

const story = [
  ["Quote captured", "The opening YES price of 52.3¢ was recorded from genuine TxLINE match evidence."],
  ["Committed on-chain", "That price and its resolution rules were committed to the FairX Solana devnet program."],
  ["Event occurred", "France scored. The real match state moved ahead of the still-displayed price."],
  ["Exploit attempted", "Wallet C signed a stale-price order to buy the side the event had already made cheap."],
  ["Trade refunded", "LineGuard refunded only Wallet C. Wallets A and B's fair orders were accepted."],
  ["Result verified", "A direct TxLINE check plus a 2-of-3 approval confirmed the final score: France won."],
  ["Winner paid", "Wallet A claimed the full A+B pool from the isolated market vault. Every account closed."],
] as const;

export default function ProofPage() {
  return (
    <FairXShell compact>
      <div className="mx-auto max-w-[900px]">
        <header className="py-5 sm:py-8">
          <p className="text-[11px] font-bold text-(--blue)">The proof, end to end</p>
          <h1 className="mt-2 text-[36px] font-extrabold tracking-[-0.05em] sm:text-[48px]">One event. One exploit blocked. One winner paid.</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">Seven things happened. Every one of them is re-read live from Solana devnet below &mdash; 18 independent checks. Missing evidence stays <span className="font-semibold">UNKNOWN</span>, never green.</p>
        </header>

        <ol className="grid gap-2.5 sm:grid-cols-2">
          {story.map(([title, text], index) => (
            <li key={title} className="flex gap-3 rounded-xl border border-(--border) bg-white p-4">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${index === 4 ? "bg-(--green-bg) text-(--green)" : "bg-(--blue-bg) text-(--blue)"}`}>{index + 1}</span>
              <div>
                <h2 className="text-[13px] font-bold text-(--ink)">{title}</h2>
                <p className="mt-1 text-[11.5px] leading-relaxed text-(--ink-2)">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-8">
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em]">Verify it live</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-(--ink-2)">The verifier below independently re-reads every fact above from devnet. Technical evidence is expandable inside each check.</p>
          <div className="mt-4"><V3LifecycleVerifier /></div>
        </section>

        <details id="historical" className="mt-6 rounded-xl border border-(--border) bg-[#f8fafc] p-4">
          <summary className="cursor-pointer text-[12px] font-bold">Show more: earlier settled market &amp; developer view</summary>
          <p className="mt-3 text-[11px] leading-relaxed text-(--ink-2)">The older v2 devnet record is retained as audit history. Its sole winning position recovered only its own accepted principal, so it is not evidence of economically complete counterparty settlement.</p>
          <div className="mt-4"><V2LifecycleVerifier /></div>
          <Link href="/operator" className="mt-3 inline-flex text-[11px] font-bold text-(--blue)">Open developer / operator status →</Link>
        </details>
      </div>
    </FairXShell>
  );
}
