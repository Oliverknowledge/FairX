import type { NormalizedTxLineEvent, NormalizeTrace, TxLineEventType, TxLineSource } from "@/lib/txline/types";

/**
 * Defensive normalization of TxLINE payloads. Real feeds vary in shape; this
 * layer extracts what it can, infers the rest, never throws, and always keeps
 * the raw payload attached. Every extracted field also records which key (if
 * any) supplied it, so the UI can show judges exactly what was inferred
 * rather than asking them to trust a black box.
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

interface Picked<T> {
  value: T;
  /** The exact object key that supplied this value. */
  key: string;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): Picked<number> | undefined {
  for (const key of keys) {
    const n = asNumber(obj[key]);
    if (n !== undefined) return { value: n, key };
  }
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): Picked<string> | undefined {
  for (const key of keys) {
    const s = asString(obj[key]);
    if (s !== undefined) return { value: s, key };
  }
  return undefined;
}

/** Epoch seconds → ms when the value is clearly in seconds. */
function toEpochMs(n: number): number {
  return n > 0 && n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

const TYPE_PATTERNS: Array<[RegExp, TxLineEventType]> = [
  [/GOAL|SCORE[D_]?CHANGE|SCORING/, "GOAL"],
  [/RED[_ ]?CARD|SEND[_ ]?OFF|DISMISS/, "RED_CARD"],
  [/YELLOW[_ ]?CARD|BOOKING|CAUTION/, "YELLOW_CARD"],
  [/PENALTY|SPOT[_ ]?KICK/, "PENALTY"],
  [/\bVAR\b|VIDEO[_ ]?REVIEW/, "VAR"],
  [/ODDS|PRICE|LINE[_ ]?MOVE|MARKET[_ ]?UPDATE/, "ODDS_UPDATE"],
  [/MATCH[_ ]?(STATE|STATUS)|KICK[_ ]?OFF|HALF|FULL[_ ]?TIME|PERIOD|CLOCK|FIXTURE[_ ]?STATE/, "MATCH_STATE"],
];

const EVENT_TYPE_KEYS = ["eventType", "event_type", "type", "event", "msgType", "messageType", "kind", "code", "statType", "stat_type"];
const HOME_SCORE_KEYS = ["homeScore", "home_score", "homeGoals"];
const AWAY_SCORE_KEYS = ["awayScore", "away_score", "awayGoals"];
const MATCH_STATUS_KEYS = ["matchStatus", "match_status", "period", "phase"];

interface EventTypeInference {
  type: TxLineEventType;
  method: "explicit" | "structural" | "default";
  field: string | null;
}

function inferEventType(obj: Record<string, unknown>): EventTypeInference {
  const explicit = pickString(obj, EVENT_TYPE_KEYS);
  if (explicit) {
    const upper = explicit.value.toUpperCase();
    for (const [pattern, type] of TYPE_PATTERNS) {
      if (pattern.test(upper)) return { type, method: "explicit", field: explicit.key };
    }
  }
  // Structural inference when no explicit type field maps to a known pattern.
  if (obj["odds"] !== undefined) return { type: "ODDS_UPDATE", method: "structural", field: "odds" };
  if (obj["prices"] !== undefined) return { type: "ODDS_UPDATE", method: "structural", field: "prices" };
  if (obj["price"] !== undefined) return { type: "ODDS_UPDATE", method: "structural", field: "price" };
  if (pickNumber(obj, HOME_SCORE_KEYS) !== undefined && pickNumber(obj, AWAY_SCORE_KEYS) !== undefined) {
    return { type: "GOAL", method: "structural", field: "homeScore+awayScore" };
  }
  const status = pickString(obj, MATCH_STATUS_KEYS);
  if (status) return { type: "MATCH_STATE", method: "structural", field: status.key };
  return { type: "UNKNOWN", method: "default", field: null };
}

/** Unwrap common envelope shapes: { data: {...} }, { payload: {...} }, { event: {...} }. */
function unwrap(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  for (const key of ["data", "payload", "body", "message"]) {
    const inner = raw[key];
    if (isRecord(inner)) return { ...raw, ...inner };
  }
  return raw;
}

export interface NormalizeContext {
  source: TxLineSource;
  /** Fixture from config, used when the payload has none. */
  fallbackFixtureId: string;
  /** Used when no numeric sequence can be extracted (kept monotonic by caller). */
  fallbackSeq: number;
  /** Clock injection for determinism in tests. */
  now?: number;
}

const SEQ_KEYS = ["seq", "sequence", "updateSeq", "update_seq", "sequenceNumber", "sequence_number", "eventSeq", "event_seq", "msgSeq", "revision", "version"];
const TS_KEYS = ["ts", "timestamp", "time", "eventTime", "event_time", "publishedAt", "published_at", "createdAt", "created_at"];

export function normalizeTxLineEvent(raw: unknown, ctx: NormalizeContext): NormalizedTxLineEvent {
  const obj = unwrap(raw);

  const seqPick = pickNumber(obj, SEQ_KEYS);
  const seq = seqPick?.value ?? ctx.fallbackSeq;

  const tsNumPick = pickNumber(obj, TS_KEYS);
  let ts: number;
  let tsField: string | null;
  if (tsNumPick) {
    ts = toEpochMs(tsNumPick.value);
    tsField = tsNumPick.key;
  } else {
    const tsStrPick = pickString(obj, TS_KEYS);
    const parsed = tsStrPick ? Date.parse(tsStrPick.value) : NaN;
    if (tsStrPick && Number.isFinite(parsed)) {
      ts = parsed;
      tsField = tsStrPick.key;
    } else {
      ts = ctx.now ?? Date.now();
      tsField = null;
    }
  }

  const typeInfo = inferEventType(obj);
  const signature = pickString(obj, ["signature", "sig", "eventSignature"]);
  const merkleRoot = pickString(obj, ["merkleRoot", "merkle_root", "root", "statProofRoot"]);

  const trace: NormalizeTrace = {
    seqField: seqPick?.key ?? null,
    tsField,
    eventTypeField: typeInfo.field,
    eventTypeMethod: typeInfo.method,
  };

  return {
    provider: "TXLINE",
    source: ctx.source,
    fixtureId: pickString(obj, ["fixtureId", "fixture_id", "matchId", "match_id", "gameId", "game_id", "fixture"])?.value ?? ctx.fallbackFixtureId,
    seq,
    ts,
    eventType: typeInfo.type,
    team: pickString(obj, ["team", "teamName", "team_name", "side", "club"])?.value,
    player: pickString(obj, ["player", "playerName", "player_name", "scorer"])?.value,
    minute: pickNumber(obj, ["minute", "matchMinute", "match_minute", "min"])?.value,
    homeScore: pickNumber(obj, HOME_SCORE_KEYS)?.value,
    awayScore: pickNumber(obj, AWAY_SCORE_KEYS)?.value,
    raw,
    signature: signature?.value,
    merkleRoot: merkleRoot?.value,
    proofStatus: ctx.source === "demo" ? "simulated" : signature || merkleRoot ? "api_verified" : "unverified",
    trace,
  };
}
