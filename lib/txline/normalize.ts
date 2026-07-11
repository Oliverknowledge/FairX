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

const EVENT_TYPE_KEYS = ["Action", "action", "eventType", "event_type", "type", "event", "msgType", "messageType", "kind", "code", "statType", "stat_type"];
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
  /** Genuine fixture metadata used to map TxLINE Participant 1/2 into names. */
  participantNames?: { 1: string; 2: string };
}

const SEQ_KEYS = ["Seq", "seq", "sequence", "updateSeq", "update_seq", "sequenceNumber", "sequence_number", "eventSeq", "event_seq", "msgSeq", "revision", "version"];
const TS_KEYS = ["Ts", "ts", "timestamp", "time", "eventTime", "event_time", "publishedAt", "published_at", "createdAt", "created_at"];

export const TXLINE_NORMALIZER_VERSION = "txline-normalizer-v2";

function txlineScores(obj: Record<string, unknown>): {
  homeScore?: number;
  awayScore?: number;
  method: "flat" | "txline-stats" | "txline-score" | "none";
} {
  const flatHome = pickNumber(obj, HOME_SCORE_KEYS)?.value;
  const flatAway = pickNumber(obj, AWAY_SCORE_KEYS)?.value;
  if (flatHome !== undefined || flatAway !== undefined) {
    return { homeScore: flatHome, awayScore: flatAway, method: "flat" };
  }

  const participant1IsHome = obj["Participant1IsHome"] !== false;
  const stats = isRecord(obj["Stats"]) ? obj["Stats"] : null;
  const participant1 = stats ? asNumber(stats["1"]) : undefined;
  const participant2 = stats ? asNumber(stats["2"]) : undefined;
  if (participant1 !== undefined || participant2 !== undefined) {
    return {
      homeScore: participant1IsHome ? participant1 : participant2,
      awayScore: participant1IsHome ? participant2 : participant1,
      method: "txline-stats",
    };
  }

  const score = isRecord(obj["Score"]) ? obj["Score"] : null;
  const p1 = score && isRecord(score["Participant1"]) ? score["Participant1"] : null;
  const p2 = score && isRecord(score["Participant2"]) ? score["Participant2"] : null;
  const p1Total = p1 && isRecord(p1["Total"]) ? p1["Total"] : null;
  const p2Total = p2 && isRecord(p2["Total"]) ? p2["Total"] : null;
  const p1Goals = p1Total ? asNumber(p1Total["Goals"]) : undefined;
  const p2Goals = p2Total ? asNumber(p2Total["Goals"]) : undefined;
  if (p1Goals !== undefined || p2Goals !== undefined) {
    return {
      homeScore: participant1IsHome ? p1Goals : p2Goals,
      awayScore: participant1IsHome ? p2Goals : p1Goals,
      method: "txline-score",
    };
  }
  return { method: "none" };
}

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

  const fixtureKeys = ["FixtureId", "fixtureId", "fixture_id", "matchId", "match_id", "gameId", "game_id", "fixture"];
  const fixtureStringPick = pickString(obj, fixtureKeys);
  const fixtureNumberPick = pickNumber(obj, fixtureKeys);
  const fixtureId = fixtureStringPick?.value ?? (fixtureNumberPick ? String(fixtureNumberPick.value) : ctx.fallbackFixtureId);
  const fixtureIdField = fixtureStringPick?.key ?? fixtureNumberPick?.key ?? null;
  const score = txlineScores(obj);
  const explicitTeam = pickString(obj, ["team", "teamName", "team_name", "side", "club"]);
  const participant = pickNumber(obj, ["Participant", "participant"])?.value;
  const mappedTeam = participant === 1 || participant === 2 ? ctx.participantNames?.[participant] : undefined;
  const clock = isRecord(obj["Clock"]) ? obj["Clock"] : null;
  const clockSeconds = clock ? asNumber(clock["Seconds"]) : undefined;

  const trace: NormalizeTrace = {
    seqField: seqPick?.key ?? null,
    tsField,
    eventTypeField: typeInfo.field,
    eventTypeMethod: typeInfo.method,
    fixtureIdField,
    scoreMethod: score.method,
    teamMethod: explicitTeam ? "field" : mappedTeam ? "participant-map" : "none",
  };

  return {
    provider: "TXLINE",
    source: ctx.source,
    fixtureId,
    seq,
    ts,
    eventType: typeInfo.type,
    team: explicitTeam?.value ?? mappedTeam,
    player: pickString(obj, ["player", "playerName", "player_name", "scorer"])?.value,
    minute: pickNumber(obj, ["minute", "matchMinute", "match_minute", "min"])?.value
      ?? (clockSeconds === undefined ? undefined : Math.floor(clockSeconds / 60)),
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    raw,
    signature: signature?.value,
    merkleRoot: merkleRoot?.value,
    proofStatus: ctx.source === "demo" ? "simulated" : signature || merkleRoot ? "api_verified" : "unverified",
    trace,
  };
}
