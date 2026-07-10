"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Copy,
  FileCheck2,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Waves,
} from "lucide-react";
import { sha256 } from "js-sha256";
import { MarketStatus, SourceBadge } from "@/components/fairx/MarketStatus";
import { CustomMarketDevnetInit } from "@/components/fairx/CustomMarketDevnetInit";
import { FreshDevnetPanel } from "@/components/fairx-proof/FreshDevnetPanel";
import { encodeReceiptForUrl } from "@/lib/receipts/create";
import type { LineGuardReceipt } from "@/lib/receipts/types";
import type { FairXMarket, GuardedOrder, GuardedOrderPreview } from "@/lib/markets/fairx";
import { applyMarketEvent, createGuardedOrder, previewGuardedOrder, repriceFairXMarket, type MaterialEventInput } from "@/lib/markets/routes";

type EventLog = {
  id: string;
  kind: "source" | "market" | "order" | "settlement";
  title: string;
  detail: string;
  hash?: string;
  at: number;
};

type MarketWorkspaceProps = {
  initialMarket: FairXMarket;
  initialOrders?: GuardedOrder[];
  onMarketUpdate?: (market: FairXMarket) => void;
  onOrderCreated?: (order: GuardedOrder) => void;
  onReceiptCreated?: (receipt: LineGuardReceipt) => void;
};

const PROGRAM_ID = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
}

function cents(value: number): string {
  return `${Math.round(value * 100)}¢`;
}

function signedCents(value: number): string {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? "+" : ""}${rounded}¢`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(timestamp);
}

function modeForMarket(market: FairXMarket): "devnet_verified" | "local_simulation" | "demo_replay" {
  // `initialized` records a market setup, not a proof for a newly-created
  // browser order.  Never label a fresh local order devnet-verified unless an
  // actual OnChainProof is attached to that order by the server flow.
  if (market.source === "demo" || market.source === "captured") return "demo_replay";
  return "local_simulation";
}

function modeLabel(mode: ReturnType<typeof modeForMarket>): string {
  if (mode === "devnet_verified") return "Devnet verified";
  if (mode === "demo_replay") return "Guided scenario";
  return "Local simulation";
}

function preferredEvent(market: FairXMarket): MaterialEventInput["eventType"] {
  if (market.materialityRules.goals) return "GOAL";
  if (market.materialityRules.redCards) return "RED_CARD";
  if (market.materialityRules.penalties) return "PENALTY";
  return "ODDS_UPDATE";
}

function eventLabel(type: MaterialEventInput["eventType"]): string {
  switch (type) {
    case "GOAL":
      return "Goal confirmed";
    case "RED_CARD":
      return "Red card confirmed";
    case "PENALTY":
      return "Penalty awarded";
    case "ODDS_UPDATE":
      return "Odds update received";
    default:
      return "Material update";
  }
}

/**
 * The interactive market surface deliberately uses the same pure routes
 * layer as the rest of FairX. Its browser state is presentation only: every
 * preview and receipt is made from the frozen quote supplied at submit time.
 */
export function MarketWorkspace({ initialMarket, initialOrders = [], onMarketUpdate, onOrderCreated, onReceiptCreated }: MarketWorkspaceProps) {
  const [market, setMarket] = useState(initialMarket);
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [stakeText, setStakeText] = useState("50");
  const [orders, setOrders] = useState(initialOrders);
  const [latestReceipt, setLatestReceipt] = useState<LineGuardReceipt | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [repricing, setRepricing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMarket(initialMarket);
    setOrders(initialOrders);
    setLatestReceipt(null);
    setEvents([]);
    // The detail route intentionally keeps newly-created local orders visible
    // without resetting this workspace every time the persistence callback
    // causes its parent to rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMarket.id]);

  const stake = Math.max(1, Number(stakeText) || 0);
  const executionMode = modeForMarket(market);
  const preview = useMemo(
    () => previewGuardedOrder(market, { side, stake, actor: "user", executionMode }),
    [executionMode, market, side, stake]
  );
  const currentPrice = preview.observedPrice;
  const payout = currentPrice > 0 ? stake / currentPrice : 0;
  const stale = market.materialSeq > market.pricedAtSeq;

  const updateMarket = (next: FairXMarket) => {
    setMarket(next);
    onMarketUpdate?.(next);
  };

  const pushEvent = (entry: Omit<EventLog, "id" | "at">) => {
    setEvents((current) => [{ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }, ...current].slice(0, 6));
  };

  const emitMaterialEvent = () => {
    const eventType = preferredEvent(market);
    const raw = {
      provider: "FAIRX_SANDBOX",
      fixtureId: market.fixtureId ?? market.id,
      seq: market.materialSeq + 1,
      type: eventType,
      materiality: "operator-defined",
      emittedAt: Date.now(),
    };
    const rawPayloadHash = sha256(JSON.stringify(raw));
    const result = applyMarketEvent(market, {
      eventType,
      fixtureId: market.fixtureId,
      source: market.source,
      seq: market.materialSeq + 1,
      raw,
      rawPayloadHash,
      proofStatus: market.source === "live" ? "api_verified" : "simulated",
    });
    updateMarket(result.market);
    pushEvent({
      kind: "source",
      title: eventLabel(eventType),
      detail: result.material ? "Materiality rule matched; fair value moved while the observed quote stayed frozen." : "The configured rules did not mark this source event material.",
      hash: rawPayloadHash,
    });
    if (result.material) {
      pushEvent({ kind: "market", title: "Stale window opened", detail: `materialSeq advanced to ${result.market.materialSeq}; pricedAtSeq remains ${result.market.pricedAtSeq}.` });
    }
  };

  const reprice = () => {
    if (!stale || repricing) return;
    setRepricing(true);
    const interim = { ...market, status: "REPRICING" as const };
    updateMarket(interim);
    window.setTimeout(() => {
      const next = repriceFairXMarket(interim);
      updateMarket(next);
      setRepricing(false);
      pushEvent({ kind: "market", title: "Market repriced", detail: `The displayed quote caught up through sequence ${next.pricedAtSeq}; stale window closed.` });
    }, 450);
  };

  const submit = (submissionSide = side, actor: "user" | "bot" = "user") => {
    const result = createGuardedOrder(market, { side: submissionSide, stake, actor, executionMode });
    setOrders((current) => [result.order, ...current]);
    setLatestReceipt(result.receipt);
    onOrderCreated?.(result.order);
    onReceiptCreated?.(result.receipt);
    pushEvent({
      kind: "order",
      title: `${submissionSide} order submitted`,
      detail: `Observed ${cents(result.order.observedPrice)} frozen at submission; ${modeLabel(executionMode).toLowerCase()} route selected.`,
    });
    pushEvent({
      kind: "settlement",
      title: result.order.verdict === "VOIDED_REFUNDED" ? "Guard refunded stale edge" : "Guard allowed order",
      detail: result.guard.reason,
    });
  };

  const copyProofSummary = async () => {
    const text = [
      `FairX / LineGuard — ${market.title}`,
      `materialSeq ${market.materialSeq} · pricedAtSeq ${market.pricedAtSeq}`,
      `displayed ${cents(market.displayedPrice)} · fair ${cents(market.fairPrice)}`,
      latestReceipt ? `latest verdict ${latestReceipt.verdict} · receipt ${latestReceipt.receiptHash}` : "No order receipt generated yet.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 border-b border-(--border) pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/markets" className="text-[10.5px] font-semibold text-(--blue) hover:underline">Markets</Link>
            <span className="text-(--ink-3)">/</span>
            <SourceBadge source={market.source} />
            <MarketStatus status={market.status} compact />
          </div>
          <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.05em] text-(--ink) sm:text-[34px]">{market.title}</h1>
          <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-(--ink-2)">
            Protected market prototype. Each order freezes the quote it observed, then LineGuard evaluates stale-edge exposure before it can settle.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${executionMode === "devnet_verified" ? "border-[#b9ead8] bg-(--green-bg) text-(--green)" : "border-[#dce3ed] bg-white text-(--ink-2)"}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {modeLabel(executionMode)}
          </span>
          <button onClick={copyProofSummary} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border) bg-white px-2.5 text-[10.5px] font-semibold text-(--ink-2) hover:text-(--blue)">
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy proof summary"}
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-(--border) px-3.5 py-3">
              <span className="section-label">TxLINE / provenance</span>
              <SourceBadge source={market.source} />
            </div>
            <div className="space-y-3 p-3.5 text-[10.5px]">
              <InfoRow label="Fixture" value={market.fixtureId ?? "Sandbox market"} mono />
              <InfoRow label="Feed mode" value={market.source === "live" ? "TxLINE live (when configured)" : market.source === "captured" ? "Captured TxLINE replay" : "Guided scenario payload"} />
              <InfoRow label="Materiality" value={materialitySummary(market)} />
              <InfoRow label="Latest impact" value={stale ? "A material event is ahead of the quote." : "No outstanding source-to-price gap."} />
              <div className="rounded-md border border-[#dce6f7] bg-[#f8fbff] p-2.5 leading-relaxed text-[#3d5e95]">
                Raw payloads are normalized before the guard reads them. Custom market events remain clearly labelled as simulation or replay.
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-(--border) px-3.5 py-3">
              <span className="section-label">Event → market trace</span>
              <Activity className="h-3.5 w-3.5 text-(--blue)" />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-3.5">
              {events.length === 0 ? (
                <p className="text-[10.5px] leading-relaxed text-(--ink-3)">Emit a material event to record normalized source data, a stale-window transition, and the guard’s exact decision path.</p>
              ) : (
                <ol className="space-y-3 border-l border-(--border) pl-3.5">
                  {events.map((event) => (
                    <li key={event.id} className="relative">
                      <span className={`absolute -left-[18px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${event.kind === "settlement" ? "bg-(--green)" : event.kind === "order" ? "bg-(--blue)" : "bg-(--amber)"}`} />
                      <p className="text-[10.5px] font-semibold text-(--ink)">{event.title}</p>
                      <p className="mt-0.5 text-[9.5px] leading-relaxed text-(--ink-2)">{event.detail}</p>
                      {event.hash && <p className="mono mt-1 truncate text-[8.5px] text-(--ink-3)">sha256 {event.hash}</p>}
                      <p className="mt-1 text-[8.5px] text-(--ink-3)">{formatTime(event.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-3">
          <section className={`card overflow-hidden ${stale ? "border-[#f2d199]" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--border) px-3.5 py-3">
              <div>
                <p className="section-label">Quote / fair value</p>
                <p className="mt-1 text-[10.5px] text-(--ink-2)">The visible blue quote is frozen until repricing; the dashed fair line reacts to the source sequence.</p>
              </div>
              <MarketStatus status={market.status} />
            </div>
            <div className="grid gap-3 p-3.5 sm:grid-cols-[minmax(0,1fr)_180px]">
              <PriceChart displayed={market.displayedPrice} fair={market.fairPrice} stale={stale} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <Metric title="Displayed YES" value={cents(market.displayedPrice)} tone="blue" />
                <Metric title="Fair YES" value={cents(market.fairPrice)} tone={stale ? "amber" : "green"} />
                <Metric title="Market liquidity" value="Sandbox escrow" />
              </div>
            </div>
          </section>

          <section className="card p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="section-label">Stale-window simulator</p>
                <p className="mt-1 text-[10.5px] text-(--ink-2)">Uses this market’s materiality rules and the same guard function as a submitted order.</p>
              </div>
              {stale && <span className="inline-flex items-center gap-1.5 rounded-full bg-(--amber-bg) px-2 py-1 text-[9.5px] font-bold text-(--amber)"><span className="h-1.5 w-1.5 rounded-full bg-(--amber)" />STALE WINDOW OPEN</span>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SimulatorButton icon={Sparkles} onClick={emitMaterialEvent}>Emit material event</SimulatorButton>
              <SimulatorButton icon={RefreshCw} onClick={reprice} disabled={!stale || repricing}>{repricing ? "Repricing…" : "Reprice market"}</SimulatorButton>
              <SimulatorButton icon={Bot} tone="danger" onClick={() => submit("YES", "bot")}>Run bot attack</SimulatorButton>
              <SimulatorButton icon={TicketCheck} onClick={() => submit("NO", "user")}>Try losing side</SimulatorButton>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-(--border) px-3.5 py-3">
              <span className="section-label">Order flow & receipts</span>
              <span className="text-[10px] text-(--ink-3)">{orders.length} order{orders.length === 1 ? "" : "s"}</span>
            </div>
            <div className="p-3.5">
              {orders.length === 0 ? (
                <p className="text-[10.5px] leading-relaxed text-(--ink-3)">Each submitted order will show its frozen quote, deterministic verdict, receipt hash, and any real on-chain proof link available for its execution mode.</p>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 5).map((order) => <OrderRow key={order.id} order={order} receipt={latestReceipt?.orderId === order.id ? latestReceipt : undefined} />)}
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <section className="card overflow-hidden border-[#cddcf5]">
            <div className="flex items-center justify-between bg-[#f8fbff] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-(--blue)" />
                <span className="section-label text-[#4772ba]">Guarded order ticket</span>
              </div>
              <span className="rounded-full border border-[#d6e4fd] bg-white px-2 py-0.5 text-[9px] font-bold text-(--blue)">{modeLabel(executionMode)}</span>
            </div>
            <div className="p-3.5">
              <div className="grid grid-cols-2 gap-1 rounded-md border border-(--border) bg-[#f7f8fa] p-1">
                {(["YES", "NO"] as const).map((option) => (
                  <button key={option} onClick={() => setSide(option)} className={`h-8 rounded text-[11px] font-bold ${side === option ? "bg-(--ink) text-white" : "text-(--ink-2) hover:bg-white"}`}>
                    Buy {option}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-[10px] font-semibold text-(--ink-2)">
                Sandbox stake
                <div className="mt-1 flex overflow-hidden rounded-md border border-(--border) bg-white focus-within:border-[#9fbcf2]">
                  <span className="flex items-center px-2.5 text-[11px] text-(--ink-3)">◎</span>
                  <input value={stakeText} onChange={(event) => setStakeText(event.target.value)} inputMode="decimal" aria-label="Sandbox stake" className="h-9 min-w-0 flex-1 bg-transparent pr-2 text-[12px] font-semibold outline-none" />
                </div>
              </label>

              <div className="mt-3 rounded-lg border border-(--border) bg-[#fafbfc] p-3">
                <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-(--ink-2)">Observed {side}</span><span className="num text-[13px] font-bold text-(--blue)">{cents(currentPrice)}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-(--ink-2)">Fair side price</span><span className="num text-[12px] font-semibold text-(--ink)">{cents(preview.fairSidePrice)}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-(--ink-2)">Stale edge</span><span className={`num text-[12px] font-bold ${preview.edge > market.tolerance ? "text-(--red)" : "text-(--green)"}`}>{signedCents(preview.edge)}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-(--ink-2)">Estimated payout</span><span className="num text-[11px] font-semibold text-(--ink)">◎ {money(payout)}</span></div>
              </div>

              <GuardPreview preview={preview} tolerance={market.tolerance} stale={stale} />
              <button onClick={() => submit()} className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-[11px] font-bold text-white ${preview.verdict === "VOIDED_REFUNDED" ? "bg-[#c63636] hover:bg-[#ab2d2d]" : "bg-(--ink) hover:bg-[#273244]"}`}>
                <ShieldCheck className="h-4 w-4" />
                Submit guarded order
              </button>
              <p className="mt-2 text-center text-[9px] leading-relaxed text-(--ink-3)">Sandbox funds only · local simulation. The frozen observed price is shown before submission.</p>
            </div>
          </section>

          <section className="card p-3.5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-(--green)" /><span className="section-label">On-chain mode</span></div>
            <div className="mt-3 space-y-2 text-[10.5px]">
              <InfoRow label="Program" value={`${PROGRAM_ID.slice(0, 8)}…${PROGRAM_ID.slice(-6)}`} mono />
              <InfoRow label="Route" value={market.onChain?.initialized ? "Canonical devnet proof available" : executionMode === "demo_replay" ? "Replay / local decision" : "Local decision"} />
              {market.onChain?.marketPda && <InfoRow label="Market PDA" value={market.onChain.marketPda} mono />}
            </div>
            {market.onChain?.initialized ? (
              <p className="mt-3 rounded-md border border-[#bde9d8] bg-(--green-bg) p-2 text-[9.5px] leading-relaxed text-(--green)">The canonical market has fixed devnet evidence. New browser orders remain replay/local receipts until a real transaction proof is attached.</p>
            ) : (
              <p className="mt-3 rounded-md border border-[#f1d59b] bg-(--amber-bg) p-2 text-[9.5px] leading-relaxed text-(--amber)">Custom markets are intentionally local simulation unless their contract actually calls the configured devnet program. FairX does not claim devnet settlement for them.</p>
            )}
            <a href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-(--blue) hover:underline">Open program on devnet <ArrowUpRight className="h-3 w-3" /></a>
          </section>

          {market.createdBy === "user" && <CustomMarketDevnetInit market={market} onMarketUpdate={updateMarket} />}
        </aside>
      </div>

      {market.id === "eng-win" && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="section-label">Live devnet settlement for this market</span>
            <span className="h-px flex-1 bg-(--border)" />
          </div>
          <FreshDevnetPanel />
        </section>
      )}

      {latestReceipt && (
        <section className="card flex flex-col gap-3 border-[#bde9d8] bg-[#fbfffd] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-(--green)" /><div><p className="text-[11px] font-bold text-(--ink)">Receipt sealed — {latestReceipt.verdict}</p><p className="mono mt-1 truncate text-[9px] text-(--ink-3)">{latestReceipt.receiptHash}</p></div></div>
          <Link href={`/verify/${latestReceipt.receiptId}?r=${encodeReceiptForUrl(latestReceipt)}`} className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#bde9d8] bg-white px-3 text-[10px] font-semibold text-(--green) hover:bg-(--green-bg)"><CheckCircle2 className="h-3.5 w-3.5" />Verify receipt</Link>
        </section>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><span className="shrink-0 text-(--ink-3)">{label}</span><span className={`${mono ? "mono break-all" : "break-words"} min-w-0 text-right text-(--ink-2)`}>{value}</span></div>;
}

function Metric({ title, value, tone = "neutral" }: { title: string; value: string; tone?: "blue" | "amber" | "green" | "neutral" }) {
  const color = tone === "blue" ? "text-(--blue)" : tone === "amber" ? "text-(--amber)" : tone === "green" ? "text-(--green)" : "text-(--ink)";
  return <div className="rounded-md border border-(--border) bg-[#fafbfc] p-2.5"><p className="text-[9px] font-medium text-(--ink-3)">{title}</p><p className={`num mt-1 text-[15px] font-bold ${color}`}>{value}</p></div>;
}

function SimulatorButton({ icon: Icon, children, tone = "normal", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: typeof Sparkles; tone?: "normal" | "danger" }) {
  return <button {...props} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${tone === "danger" ? "border-[#f1c5c5] bg-(--red-bg) text-(--red) hover:bg-[#fee8e8]" : "border-(--border) bg-white text-(--ink-2) hover:border-[#c5d7f5] hover:text-(--blue)"} ${props.className ?? ""}`}><Icon className="h-3.5 w-3.5" />{children}</button>;
}

function GuardPreview({ preview, tolerance, stale }: { preview: GuardedOrderPreview; tolerance: number; stale: boolean }) {
  const blocked = preview.verdict === "VOIDED_REFUNDED";
  return <div className={`mt-3 rounded-md border p-2.5 ${blocked ? "border-[#f5c6c6] bg-(--red-bg)" : "border-[#bfead9] bg-(--green-bg)"}`}><div className="flex items-start gap-2"><span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full ${blocked ? "bg-[#e45a5a] text-white" : "bg-(--green) text-white"}`}>{blocked ? <ShieldAlert className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}</span><div><p className={`text-[10px] font-bold ${blocked ? "text-(--red)" : "text-(--green)"}`}>{blocked ? "This order would be refunded" : "This order would fill"}</p><p className={`mt-0.5 text-[9.5px] leading-relaxed ${blocked ? "text-[#a54b4b]" : "text-[#337e68]"}`}>{stale ? `Edge ${signedCents(preview.edge)} vs ${cents(tolerance)} tolerance. ${preview.reason}` : preview.reason}</p></div></div></div>;
}

function PriceChart({ displayed, fair, stale }: { displayed: number; fair: number; stale: boolean }) {
  const y = (value: number) => Math.round(104 - value * 84);
  return <div className="relative min-h-[160px] overflow-hidden rounded-md border border-(--border) bg-[#fbfcfe] p-3"><div className="absolute inset-x-3 top-3 flex justify-between text-[8px] text-(--ink-3)"><span>100¢</span><span>Fair value moves on source event</span></div><svg viewBox="0 0 520 128" className="mt-4 h-[130px] w-full" role="img" aria-label="Displayed versus fair price chart"><path d="M 12 104 H 508 M 12 62 H 508 M 12 20 H 508" stroke="#e7ebf1" strokeWidth="1" /><path d={`M 12 ${y(displayed)} L 274 ${y(displayed)} L 508 ${y(displayed)}`} fill="none" stroke="#2563eb" strokeWidth="3" /><path d={`M 12 ${y(displayed)} L 250 ${y(displayed)} L 330 ${y(fair)} L 508 ${y(fair)}`} fill="none" stroke={stale ? "#d97706" : "#059669"} strokeDasharray="5 5" strokeWidth="2.5" /><circle cx="508" cy={y(displayed)} r="4" fill="#2563eb" /><circle cx="508" cy={y(fair)} r="4" fill={stale ? "#d97706" : "#059669"} />{stale && <><path d={`M 420 ${y(displayed)} V ${y(fair)}`} stroke="#dc2626" strokeWidth="1.5" /><text x="429" y={(y(displayed) + y(fair)) / 2} fill="#dc2626" fontSize="9">stale gap</text></>}</svg><div className="absolute bottom-3 left-3 flex gap-3 text-[8.5px] text-(--ink-3)"><span className="inline-flex items-center gap-1"><i className="h-1.5 w-4 bg-(--blue)" />Displayed</span><span className="inline-flex items-center gap-1"><i className={`h-0 w-4 border-t border-dashed ${stale ? "border-(--amber)" : "border-(--green)"}`} />Fair</span></div></div>;
}

function OrderRow({ order, receipt }: { order: GuardedOrder; receipt?: LineGuardReceipt }) {
  const blocked = order.verdict === "VOIDED_REFUNDED";
  return <div className="rounded-md border border-(--border) bg-[#fbfcfe] p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10.5px] font-bold text-(--ink)">{order.side} · ◎ {money(order.stake)}</span><span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold ${blocked ? "bg-(--red-bg) text-(--red)" : "bg-(--green-bg) text-(--green)"}`}>{order.status}</span></div><div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-(--ink-2)"><span>observed {cents(order.observedPrice)}</span><span>fair {cents(order.fairSidePrice)}</span><span className={order.edge > 0 ? "text-(--red)" : "text-(--green)"}>edge {signedCents(order.edge)}</span><span>{order.executionMode.replaceAll("_", " ")}</span></div>{receipt && <Link href={`/verify/${receipt.receiptId}?r=${encodeReceiptForUrl(receipt)}`} className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-semibold text-(--blue) hover:underline">Verify receipt <ArrowUpRight className="h-3 w-3" /></Link>}</div>;
}

function materialitySummary(market: FairXMarket): string {
  const active = [market.materialityRules.goals && "goals", market.materialityRules.redCards && "red cards", market.materialityRules.penalties && "penalties", market.materialityRules.oddsUpdates && "odds"].filter(Boolean);
  return active.length ? active.join(", ") : "No material rules";
}
