"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, PlusCircle, ShieldCheck } from "lucide-react";
import { FairXShell } from "@/components/fairx/FairXShell";
import { createFairXMarket, validateFairXMarketInput, type CreateFairXMarketInput } from "@/lib/markets/createMarket";
import { buildMarketConfigCommitment } from "@/lib/markets/marketConfig";
import type { FairXMarketType, MaterialityRules } from "@/lib/markets/fairx";
import { useFairXStore } from "@/lib/markets/store";

type FormState = {
  title: string;
  fixtureId: string;
  type: FairXMarketType;
  backedTeam: string;
  awayTeam: string;
  targetSide: string;
  displayedPrice: string;
  tolerance: string;
  materialityRules: MaterialityRules;
};

const defaultForm: FormState = {
  title: "",
  fixtureId: "",
  type: "MATCH_WINNER",
  backedTeam: "",
  awayTeam: "",
  targetSide: "",
  displayedPrice: "0.50",
  tolerance: "0.02",
  materialityRules: { goals: true, redCards: true, penalties: false, oddsUpdates: true },
};

const typeOptions: Array<{ value: FairXMarketType; label: string; detail: string; settlement: boolean }> = [
  { value: "MATCH_WINNER", label: "Match winner (home)", detail: "YES means the committed home team wins. Settlement-enabled.", settlement: true },
  { value: "TOTAL_GOALS", label: "Total goals", detail: "Local scenario only · unsupported for settlement.", settlement: false },
  { value: "NEXT_GOAL", label: "Next goal", detail: "Local scenario only · unsupported for settlement.", settlement: false },
  { value: "CUSTOM_YES_NO", label: "Custom yes/no", detail: "Local sandbox only · unsupported for settlement.", settlement: false },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { upsertMarket } = useFairXStore();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const input = useMemo<CreateFairXMarketInput>(
    () => ({
      title: form.title,
      fixtureId: form.fixtureId || undefined,
      type: form.type,
      backedTeam: form.backedTeam || undefined,
      awayTeam: form.awayTeam || undefined,
      targetSide: form.targetSide || undefined,
      displayedPrice: Number(form.displayedPrice),
      tolerance: Number(form.tolerance),
      source: "demo",
      createdBy: "user",
      materialityRules: form.materialityRules,
      liquidity: 0,
      escrow: 0,
    }),
    [form]
  );
  const validation = useMemo(() => validateFairXMarketInput(input), [input]);
  const configCommitment = useMemo(() => buildMarketConfigCommitment({
    marketType: form.type,
    fixtureId: form.fixtureId || "custom:pending",
    marketTitle: form.title || "Untitled protected market",
    materialityRules: form.materialityRules,
    backedTeam: form.backedTeam || undefined,
    awayTeam: form.awayTeam || undefined,
    targetSide: form.targetSide || undefined,
    toleranceMicros: Math.round((Number(form.tolerance) || 0) * 1_000_000),
  }), [form]);
  const yesPrice = Number(form.displayedPrice);
  const settlementSupported = form.type === "MATCH_WINNER";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.valid) {
      setErrors(validation.errors as Record<string, string>);
      return;
    }
    const market = createFairXMarket(input);
    upsertMarket(market);
    router.push(`/markets/${market.id}`);
  };

  const change = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const needsTeam = form.type === "MATCH_WINNER" || form.type === "NEXT_GOAL";
  const needsTarget = form.type === "TOTAL_GOALS" || form.type === "CUSTOM_YES_NO";

  return (
    <FairXShell>
      <div className="mx-auto max-w-[1120px]">
        <header className="mb-5 flex flex-col gap-3 border-b border-(--border) pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Custom devnet settlement</p>
            <h1 className="mt-2 text-[29px] font-bold leading-none tracking-[-0.055em] text-(--ink)">Create a protected test market.</h1>
            <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-(--ink-2)">Define the market locally, review the hashes, then initialize and submit a protected test order through LineGuard on Solana devnet.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#f0d39a] bg-(--amber-bg) px-2.5 py-1 text-[10px] font-semibold text-(--amber)"><ShieldCheck className="h-3.5 w-3.5" />No real-money settlement</span>
        </header>

        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <section className="card p-4 sm:p-5">
              <p className="section-label">1 · Define market</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Market title" error={errors.title} className="sm:col-span-2">
                  <input value={form.title} onChange={(event) => change("title", event.target.value)} placeholder="e.g. England wins" className={inputClass(errors.title)} />
                </Field>
                <Field label="Fixture ID" error={errors.fixtureId} hint={form.type === "CUSTOM_YES_NO" ? "Optional for a custom controlled market." : "Required for this market type."}>
                  <input value={form.fixtureId} onChange={(event) => change("fixtureId", event.target.value)} placeholder="ENG-FRA-2026-QF" className={inputClass(errors.fixtureId)} />
                </Field>
                <div className="rounded-md border border-[#f0d39a] bg-(--amber-bg) p-2.5 text-[9.5px] leading-relaxed text-(--amber)">New browser-created markets start as a guided scenario. This form cannot label a generated payload as live TxLINE.</div>
              </div>

              <fieldset className="mt-5">
                <legend className="text-[10px] font-semibold text-(--ink-2)">Market type</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {typeOptions.map((option) => {
                    const selected = form.type === option.value;
                    return <button key={option.value} type="button" onClick={() => change("type", option.value)} className={`rounded-md border p-3 text-left transition-colors ${selected ? "border-[#bdd2f8] bg-[#f5f9ff]" : "border-(--border) bg-white hover:border-[#cbd5e1]"}`}><span className="flex items-center justify-between gap-2"><strong className="text-[10.5px] text-(--ink)">{option.label}</strong>{selected && <Check className="h-3.5 w-3.5 text-(--blue)" />}</span><span className="mt-1 block text-[9.5px] leading-relaxed text-(--ink-3)">{option.detail}</span></button>;
                  })}
                </div>
              </fieldset>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {needsTeam && <Field label={form.type === "MATCH_WINNER" ? "Home team / YES side" : "Backed team / YES side"} error={errors.backedTeam}><input value={form.backedTeam} onChange={(event) => change("backedTeam", event.target.value)} placeholder="England" className={inputClass(errors.backedTeam)} /></Field>}
                {form.type === "MATCH_WINNER" && <Field label="Away team" error={errors.awayTeam}><input value={form.awayTeam} onChange={(event) => change("awayTeam", event.target.value)} placeholder="France" className={inputClass(errors.awayTeam)} /></Field>}
                {needsTarget && <Field label={form.type === "TOTAL_GOALS" ? "Target total" : "What YES means"} error={errors.targetSide}><input value={form.targetSide} onChange={(event) => change("targetSide", event.target.value)} placeholder={form.type === "TOTAL_GOALS" ? "Over 2.5 goals" : "Extra time occurs"} className={inputClass(errors.targetSide)} /></Field>}
                {!needsTeam && !needsTarget && <div />}
                <Field label="Initial displayed YES price" error={errors.initialDisplayedPrice} hint="0.01 to 0.99">
                  <input value={form.displayedPrice} onChange={(event) => change("displayedPrice", event.target.value)} inputMode="decimal" className={inputClass(errors.initialDisplayedPrice)} />
                </Field>
                <Field label="3 · Configure guard tolerance" error={errors.tolerance} hint="A 0.02 tolerance equals 2¢.">
                  <input value={form.tolerance} onChange={(event) => change("tolerance", event.target.value)} inputMode="decimal" className={inputClass(errors.tolerance)} />
                </Field>
              </div>
            </section>

            <section className="card p-4 sm:p-5">
              <p className="section-label">2 · Define material events</p>
              <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-(--ink-2)">Only enabled source events can advance <span className="mono">materialSeq</span> for this market. The displayed quote only moves when the market reprices.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <RuleCheckbox label="Goals affect market" checked={form.materialityRules.goals} onChange={(checked) => change("materialityRules", { ...form.materialityRules, goals: checked })} />
                <RuleCheckbox label="Red cards affect market" checked={form.materialityRules.redCards} onChange={(checked) => change("materialityRules", { ...form.materialityRules, redCards: checked })} />
                <RuleCheckbox label="Penalties affect market" checked={form.materialityRules.penalties} onChange={(checked) => change("materialityRules", { ...form.materialityRules, penalties: checked })} />
                <RuleCheckbox label="Odds updates affect market" checked={form.materialityRules.oddsUpdates} onChange={(checked) => change("materialityRules", { ...form.materialityRules, oddsUpdates: checked })} />
              </div>
              {errors.materialityRules && <p className="mt-2 text-[10px] font-semibold text-(--red)">{errors.materialityRules}</p>}
            </section>

            <section className="card p-4 sm:p-5">
              <p className="section-label">4 · Review market config commitment</p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-(--ink-2)">Long strings stay off-chain. These deterministic hashes are the values the current MarketConfig-capable program commits.</p>
              <div className="mt-3 space-y-2 text-[10px]">
                <CommitmentRow label="Market type" value={`${configCommitment.marketType} (${configCommitment.marketTypeCode})`} />
                <CommitmentRow label="Settlement support" value={settlementSupported ? "MATCH_WINNER_HOME · supported" : "UNSUPPORTED_FOR_SETTLEMENT · local scenario only"} />
                {settlementSupported && <CommitmentRow label="Resolution rule / stat keys" value={`${configCommitment.resolutionRule} · home ${configCommitment.homeStatKey} · away ${configCommitment.awayStatKey}`} />}
                {settlementSupported && <CommitmentRow label="Home / away team hashes" value={`${configCommitment.homeTeamHash} / ${configCommitment.awayTeamHash}`} />}
                <CommitmentRow label="Fixture ID hash" value={configCommitment.fixtureIdHash} />
                <CommitmentRow label="Title hash" value={configCommitment.marketTitleHash} />
                <CommitmentRow label="Materiality config hash" value={configCommitment.materialityConfigHash} />
                <CommitmentRow label="Settlement config hash" value={configCommitment.settlementConfigHash} />
              </div>
              <p className="mt-3 rounded-md border border-[#dce6f7] bg-[#f8fbff] p-2.5 text-[9.5px] leading-relaxed text-[#3d5e95]">{settlementSupported ? "MATCH_WINNER_HOME may continue to on-chain initialization after its home/away mapping is committed." : "This type remains available only as a clearly labelled local scenario; the current on-chain settlement initializer rejects it."}</p>
            </section>

            <section className="rounded-lg border border-[#f0d39a] bg-(--amber-bg) p-4 text-[10.5px] leading-relaxed text-[#9b650d]">
              <div className="flex gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Execution boundary:</strong> saving here creates a local market descriptor only. “Initialized on devnet” and “Devnet-settled” appear only after their respective transactions succeed.</p></div>
            </section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <section className="card overflow-hidden">
              <div className="border-b border-(--border) bg-[#f8fbff] px-4 py-3"><p className="section-label text-[#4c71ad]">Market preview</p></div>
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-(--ink-3)">{typeOptions.find((option) => option.value === form.type)?.label}</p>
                <h2 className="mt-2 text-[18px] font-bold leading-tight tracking-[-0.035em] text-(--ink)">{form.title || "Untitled protected market"}</h2>
                <p className="mt-2 text-[10.5px] leading-relaxed text-(--ink-2)">{form.targetSide || form.backedTeam || "Define the YES side"} · {form.fixtureId || "Sandbox context"}</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><PreviewMetric label="YES price" value={Number.isFinite(yesPrice) ? `${Math.round(yesPrice * 100)}¢` : "—"} tone="blue" /><PreviewMetric label="Tolerance" value={Number.isFinite(Number(form.tolerance)) ? `${Math.round(Number(form.tolerance) * 100)}¢` : "—"} tone="amber" /></div>
                <div className="mt-3 rounded-md border border-(--border) bg-[#fafbfc] p-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-(--ink-3)">Initial state</p><p className="mono mt-1 text-[10.5px] font-bold text-(--ink)">materialSeq 1 · pricedAtSeq 1</p><p className="mt-1 text-[9.5px] text-(--green)">Protected / in sync</p></div>
              </div>
            </section>
            <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-(--ink) px-3 text-[11px] font-bold text-white hover:bg-[#273244]"><PlusCircle className="h-4 w-4" />Save market and continue <ArrowRight className="h-3.5 w-3.5" /></button>
            <p className="text-center text-[9.5px] leading-relaxed text-(--ink-3)">Saved in this browser’s local FairX catalog. No wallet, identity, or funds are requested.</p>
          </aside>
        </form>
      </div>
    </FairXShell>
  );
}

function Field({ label, hint, error, className = "", children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="flex items-baseline justify-between gap-2 text-[10px] font-semibold text-(--ink-2)">{label}{hint && <em className="text-right text-[8.5px] font-normal not-italic text-(--ink-3)">{hint}</em>}</span><div className="mt-1.5">{children}</div>{error && <span className="mt-1 block text-[9.5px] font-semibold text-(--red)">{error}</span>}</label>;
}

function RuleCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-[10.5px] font-semibold ${checked ? "border-[#bfe8da] bg-[#f8fdfb] text-(--green)" : "border-(--border) bg-white text-(--ink-2)"}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 accent-[#059669]" />{label}</label>;
}

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" }) {
  return <div className={`rounded-md border p-2.5 ${tone === "blue" ? "border-[#d9e6fc] bg-[#f7faff]" : "border-[#f2dfb8] bg-[#fffdf7]"}`}><p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-(--ink-3)">{label}</p><p className={`num mt-1 text-[16px] font-bold ${tone === "blue" ? "text-(--blue)" : "text-(--amber)"}`}>{value}</p></div>;
}

function CommitmentRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-(--border) bg-[#fafbfc] p-2.5"><p className="font-semibold text-(--ink-3)">{label}</p><p className="mono mt-1 break-all text-(--ink)">{value}</p></div>;
}

function inputClass(error?: string): string {
  return `h-9 w-full rounded-md border bg-white px-2.5 text-[11px] font-medium text-(--ink) outline-none transition-colors placeholder:text-(--ink-3) focus:border-[#a9c3ef] ${error ? "border-[#f1b7b7]" : "border-(--border)"}`;
}
