"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2, RefreshCcw, Send, ShieldX, TriangleAlert } from "lucide-react";
import { Badge, Card, cn, Label, Stat } from "@/components/lineguard/ui";
import type { Action } from "@/lib/terminal/actions";
import type { TerminalState } from "@/lib/terminal/state";
import {
  DEFAULT_ONCHAIN_STATE,
  fetchOnChainState,
  postOnChainAction,
  verdictMatchesFrontend,
  type OnChainApiState,
} from "@/lib/solana/lineguardProgram";
import { microsToCents, signedMicrosToCents } from "@/lib/solana/priceMicros";
import type { OnChainSide } from "@/lib/solana/pdas";

export function OnChainPanel({
  state,
  dispatch,
}: {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
}) {
  const [selectedSide, setSelectedSide] = useState<OnChainSide>(state.botSide === "NO" ? "NO" : "YES");
  const [chain, setChain] = useState<OnChainApiState>(DEFAULT_ONCHAIN_STATE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frontendVerdict = state.verdict?.verdict ?? null;
  const match = useMemo(() => verdictMatchesFrontend(chain.order, frontendVerdict), [chain.order, frontendVerdict]);

  const refresh = async (side = selectedSide) => {
    try {
      const next = await fetchOnChainState(side);
      setChain((current) => ({ ...next, latestSignature: current.latestSignature ?? next.latestSignature, explorerUrl: current.explorerUrl ?? next.explorerUrl }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    refresh(selectedSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSide]);

  const run = async (label: string, path: string, body: Record<string, unknown> = {}) => {
    setBusy(label);
    setError(null);
    try {
      const result = await postOnChainAction(path, body);
      setChain(result);
      if (result.proof) dispatch({ type: "ATTACH_ONCHAIN_PROOF", proof: result.proof });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const runFullDemo = async (side: OnChainSide) => {
    setSelectedSide(side);
    await run(`full-${side}`, side === "YES" ? "full-yes-demo" : "full-no-demo");
  };

  const clearProof = () => {
    dispatch({ type: "CLEAR_ONCHAIN_PROOF" });
    setChain((current) => ({
      ...current,
      latestSignature: undefined,
      explorerUrl: undefined,
      signatures: undefined,
      explorerUrls: undefined,
    }));
  };

  const active = chain.configured;
  const hasTx = Boolean(chain.signatures?.length || chain.latestSignature);
  const headline = active
    ? chain.mode === "devnet" && hasTx
      ? "Devnet settlement guard executed"
      : "On-chain active"
    : chain.localTestsAvailable
      ? "Devnet not configured"
      : "On-chain not configured";
  const statusTone = active ? "green" : "amber";
  const actionsDisabled = !active || busy !== null;

  return (
    <Card className="border-(--blue)/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-(--blue)" />
          <Label>On-chain settlement guard</Label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone} dot={active} pulse={active}>
            {headline}
          </Badge>
          <Badge tone="neutral">{chain.mode}</Badge>
          <a
            href="/proof"
            className="inline-flex h-[22px] items-center rounded-md border border-(--border) bg-white px-2 text-[10.5px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6] hover:text-(--blue)"
          >
            View proof
          </a>
        </div>
      </div>

      <p className="mt-1.5 text-[10.5px] leading-snug text-(--ink-2)">
        This section is only the settlement vertical slice: market freshness registers, escrow custody, guard evaluation, refund/fill decision, and
        verdict proof. The UI, TxLINE ingestion, replay, and charts remain off-chain.
      </p>

      {!active && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-(--amber)/25 bg-(--amber-bg) px-3 py-2 text-[11px] leading-snug text-(--amber)">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {chain.reason ?? "Devnet not configured."} Anchor program tested locally; no devnet tx attached.
          </span>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="hairline-rows">
          <Stat label="Program ID" value={<Mono value={chain.programId} />} />
          {chain.programExplorerUrl && (
            <Stat
              label="Program explorer"
              value={
                <a href={chain.programExplorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-(--blue)">
                  open <ExternalLink className="h-3 w-3" />
                </a>
              }
              tone="blue"
            />
          )}
          <Stat label="Market PDA" value={<Mono value={chain.marketPda ?? "—"} />} />
          <Stat label={`${selectedSide} order PDA`} value={<Mono value={chain.orderEscrowPda ?? "—"} />} />
          <Stat
            label="Latest tx"
            value={
              chain.latestSignature ? (
                chain.explorerUrl ? (
                  <a href={chain.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-(--blue)">
                    {shorten(chain.latestSignature)} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Mono value={chain.latestSignature} />
                )
              ) : (
                "—"
              )
            }
            tone={chain.latestSignature ? "blue" : "neutral"}
          />
          <Stat label="Tx signatures" value={chain.signatures?.length ?? 0} tone={chain.signatures?.length ? "blue" : "neutral"} />
          <Stat label="On-chain materialSeq" value={chain.market?.materialSeq ?? "—"} tone="blue" />
          <Stat label="On-chain pricedAtSeq" value={chain.market?.pricedAtSeq ?? "—"} tone="blue" />
          <Stat label="On-chain observed" value={chain.order ? microsToCents(chain.order.observedPriceMicros) : "—"} />
          <Stat label="On-chain fair side" value={chain.order ? microsToCents(chain.order.fairSidePriceMicros) : "—"} />
          <Stat
            label="On-chain edge"
            value={chain.order ? signedMicrosToCents(chain.order.edgeMicros) : "—"}
            tone={chain.order && chain.order.edgeMicros > 0 ? "red" : "neutral"}
            strong
          />
          <Stat label="On-chain verdict" value={chain.order?.verdict ?? "—"} tone={chain.order?.verdict === "VOIDED_REFUNDED" ? "red" : "green"} />
          <Stat label="Frontend verdict" value={frontendVerdict ?? "—"} tone={frontendVerdict === "VOIDED_REFUNDED" ? "red" : frontendVerdict ? "green" : "neutral"} />
          <Stat
            label="Verdict match"
            value={match === null ? "—" : match ? "MATCH" : "MISMATCH"}
            tone={match === null ? "neutral" : match ? "green" : "red"}
            strong
          />
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-(--border) bg-[#f9fafb] p-1">
            {(["YES", "NO"] as const).map((side) => (
              <button
                key={side}
                onClick={() => setSelectedSide(side)}
                className={cn(
                  "h-7 rounded-md text-[11px] font-bold transition-colors",
                  selectedSide === side ? "bg-(--ink) text-white" : "text-(--ink-2) hover:bg-white"
                )}
              >
                {side} path
              </button>
            ))}
          </div>

          <ActionButton disabled={actionsDisabled} busy={busy === "full-YES"} onClick={() => runFullDemo("YES")}>
            Run on-chain YES attack
          </ActionButton>
          <ActionButton disabled={actionsDisabled} busy={busy === "full-NO"} onClick={() => runFullDemo("NO")}>
            Run on-chain NO allowed path
          </ActionButton>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => refresh()}
              disabled={busy !== null}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-(--border) bg-white px-2 text-[11px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6] disabled:opacity-45"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Fetch state
            </button>
            <button
              onClick={clearProof}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-(--border) bg-white px-2 text-[11px] font-semibold text-(--ink-2) hover:bg-[#f3f4f6]"
            >
              <ShieldX className="h-3.5 w-3.5" /> Clear proof
            </button>
          </div>
        </div>
      </div>

      {chain.signatures && chain.signatures.length > 0 && (
        <div className="mt-3 rounded-lg border border-(--border) bg-[#f9fafb] px-3 py-2">
          <p className="mono text-[9px] uppercase tracking-wide text-(--ink-3)">On-chain transaction sequence</p>
          <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
            {chain.signatures.map((signature, index) => {
              const url = chain.explorerUrls?.[index];
              const content = (
                <>
                  <span>{txLabel(index)}</span>
                  <span className="mono">{shorten(signature)}</span>
                </>
              );
              return url ? (
                <a
                  key={signature}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-md border border-(--border) bg-white px-2 py-1.5 text-[10.5px] font-semibold text-(--ink-2) hover:text-(--blue)"
                >
                  {content}
                </a>
              ) : (
                <div
                  key={signature}
                  className="flex items-center justify-between gap-2 rounded-md border border-(--border) bg-white px-2 py-1.5 text-[10.5px] font-semibold text-(--ink-2)"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2.5 rounded-md border border-(--red)/25 bg-(--red-bg) px-2.5 py-2 text-[10.5px] font-semibold text-(--red)">
          {error}
        </p>
      )}
    </Card>
  );
}

function txLabel(index: number): string {
  return ["Initialize", "Ingest event", "Place order", "Evaluate"][index] ?? `Tx ${index + 1}`;
}

function ActionButton({
  disabled,
  busy,
  onClick,
  children,
}: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-(--ink) px-3 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Send className={cn("h-3.5 w-3.5", busy && "animate-pulse")} />
      {busy ? "Working…" : children}
    </button>
  );
}

function Mono({ value }: { value: string }) {
  return <span className="mono text-[10.5px]">{shorten(value)}</span>;
}

function shorten(value: string): string {
  return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}
