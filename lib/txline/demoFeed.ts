import type { NormalizedTxLineEvent } from "@/lib/txline/types";

/**
 * The guided-scenario feed — the sacred England/Saka replay. Same shape as a
 * live normalized event so the entire downstream pipeline (materiality, fair
 * value, guard, receipts) is identical in scenario and live modes. Only `source`
 * and `proofStatus` differ, and both are surfaced honestly in the UI.
 */

export const DEMO_FIXTURE_ID = "ENG-FRA-2026-QF";
export const DEMO_FIXTURE_LABEL = "England vs France · World Cup QF";

/** seq 1 — kickoff; the market's opening 40¢ quote prices this in. */
export const DEMO_KICKOFF_EVENT: NormalizedTxLineEvent = {
  provider: "TXLINE",
  source: "demo",
  fixtureId: DEMO_FIXTURE_ID,
  seq: 1,
  ts: 0, // rendered as "priced in at listing" — replaced at ingest time
  eventType: "MATCH_STATE",
  minute: 0,
  homeScore: 0,
  awayScore: 0,
  raw: { type: "MATCH_STATE", status: "KICK_OFF", fixtureId: DEMO_FIXTURE_ID, seq: 1 },
  proofStatus: "simulated",
  trace: { seqField: "seq", tsField: null, eventTypeField: "type", eventTypeMethod: "explicit" },
};

/** seq 2 — the material event: Saka scores. Fair value 40¢ → 63¢. */
export const DEMO_GOAL_EVENT: NormalizedTxLineEvent = {
  provider: "TXLINE",
  source: "demo",
  fixtureId: DEMO_FIXTURE_ID,
  seq: 2,
  ts: 0, // stamped with the ingest timestamp by the action creator
  eventType: "GOAL",
  team: "England",
  player: "Saka",
  minute: 63,
  homeScore: 1,
  awayScore: 0,
  raw: {
    type: "GOAL",
    fixtureId: DEMO_FIXTURE_ID,
    seq: 2,
    team: "England",
    player: "Bukayo Saka",
    minute: 63,
    homeScore: 1,
    awayScore: 0,
    officiated: true,
  },
  proofStatus: "simulated",
  trace: { seqField: "seq", tsField: null, eventTypeField: "type", eventTypeMethod: "explicit" },
};

/** Stamp a demo event with a real ingest timestamp (kept out of the fixtures for determinism). */
export function stampDemoEvent(event: NormalizedTxLineEvent, at: number): NormalizedTxLineEvent {
  return { ...event, ts: at };
}
