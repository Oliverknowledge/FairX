import { CheckCircle2, ChevronDown, Clock3, Hash, Radio, Server } from "lucide-react";

export type ProvenanceMode = "live" | "captured" | "historical" | "guided" | "unconfigured";

export interface TxLineProvenanceProps {
  mode: ProvenanceMode;
  connected?: boolean;
  endpoint: string;
  fixtureId: string;
  eventType?: string;
  sequence?: number;
  receivedAt?: number | string;
  rawEventHash?: string;
  normalizedEventHash?: string;
  proofState: string;
  trace?: {
    seqField?: string | null;
    tsField?: string | null;
    eventTypeField?: string | null;
    eventTypeMethod?: string;
  };
  compact?: boolean;
}

function provenanceLabel(mode: ProvenanceMode, connected = false): string {
  if (mode === "live") return connected ? "Live TxLINE" : "TxLINE connection not active";
  if (mode === "captured") return "Captured TxLINE event";
  if (mode === "historical") return "TxLINE historical";
  if (mode === "guided") return "Guided scenario";
  return "TxLINE connection not configured";
}

function provenanceTone(mode: ProvenanceMode, connected = false): string {
  if (mode === "live" && connected) return "border-(--green)/25 bg-(--green-bg) text-(--green)";
  if (mode === "captured" || mode === "historical") return "border-(--blue)/25 bg-(--blue-bg) text-(--blue)";
  return "border-(--amber)/30 bg-(--amber-bg) text-(--amber)";
}

function timestamp(value: number | string | undefined): string {
  if (value === undefined) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }) + " UTC";
}

export function TxLineProvenance(props: TxLineProvenanceProps) {
  const label = provenanceLabel(props.mode, props.connected);
  return (
    <section className="min-w-0 rounded-xl border border-(--border) bg-white" aria-label="TxLINE provenance">
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-(--border) ${props.compact ? "px-3 py-2" : "px-3.5 py-3"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="h-3.5 w-3.5 shrink-0 text-(--blue)" />
          <p className="section-label">TxLINE provenance</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${provenanceTone(props.mode, props.connected)}`}>{label}</span>
      </div>
      <div className={`grid gap-2 ${props.compact ? "p-3 text-[9.5px]" : "p-3.5 text-[10.5px] sm:grid-cols-2"}`}>
        <ProvenanceRow icon={<Server className="h-3 w-3" />} label="Endpoint / source" value={props.endpoint} />
        <ProvenanceRow icon={<Radio className="h-3 w-3" />} label="Fixture / event" value={`${props.fixtureId}${props.eventType ? ` · ${props.eventType}` : ""}${props.sequence !== undefined ? ` · seq ${props.sequence}` : ""}`} />
        <ProvenanceRow icon={<Clock3 className="h-3 w-3" />} label="Received" value={timestamp(props.receivedAt)} />
        <ProvenanceRow icon={<CheckCircle2 className="h-3 w-3" />} label="Proof state" value={props.proofState} />
        {props.rawEventHash && <ProvenanceRow icon={<Hash className="h-3 w-3" />} label="Raw event hash" value={props.rawEventHash} mono />}
        {props.normalizedEventHash && <ProvenanceRow icon={<Hash className="h-3 w-3" />} label="Normalized event hash" value={props.normalizedEventHash} mono />}
      </div>
      {props.trace && (
        <details className="group border-t border-(--border)">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2 text-[9.5px] font-semibold text-(--ink-3)">
            Normalizer trace <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
          </summary>
          <p className="mono break-words px-3.5 pb-3 text-[9px] leading-relaxed text-(--ink-2)">
            seq ← {props.trace.seqField ?? "fallback"} · ts ← {props.trace.tsField ?? "fallback"} · type ← {props.trace.eventTypeMethod ?? "unknown"}{props.trace.eventTypeField ? ` (${props.trace.eventTypeField})` : ""}
          </p>
        </details>
      )}
    </section>
  );
}

function ProvenanceRow({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 font-semibold text-(--ink-3)">{icon}{label}</p>
      <p className={`${mono ? "mono break-all" : "break-words"} mt-0.5 font-semibold leading-relaxed text-(--ink)`}>{value}</p>
    </div>
  );
}
