export type MarketSide = "YES" | "NO";

export type RuntimeScenario = {
  id: string;
  fixtureId: string;
  teams: {
    home: string;
    away: string;
    homeCode: string;
    awayCode: string;
  };
  marketQuestion: string;
  evidenceLabel: string;
  canonicalEvidence: boolean;
  initial: {
    clock: string;
    score: [number, number];
    eventSequence: number;
  };
  event: {
    clock: string;
    type: "GOAL" | "RED_CARD";
    label: string;
    score: [number, number];
    sequence: number;
  };
  quote: {
    sequence: number;
    before: { yes: number; no: number };
    after: { yes: number; no: number };
  };
  incomingOrder: {
    actor: string;
    side: MarketSide;
    stakeSol: number;
  };
  synchronizedOrder: {
    actor: string;
    side: MarketSide;
    stakeSol: number;
  };
  resolution: string;
};

export const RUNTIME_SCENARIOS: readonly RuntimeScenario[] = [
  {
    id: "france-morocco",
    fixtureId: "18209181",
    teams: { home: "France", away: "Morocco", homeCode: "FRA", awayCode: "MAR" },
    marketQuestion: "France to win",
    evidenceLabel: "Canonical captured TxLINE evidence",
    canonicalEvidence: true,
    initial: { clock: "67:14", score: [0, 0], eventSequence: 738 },
    event: {
      clock: "67:16",
      type: "GOAL",
      label: "Goal confirmed — France",
      score: [1, 0],
      sequence: 739,
    },
    quote: {
      sequence: 738,
      before: { yes: 0.532785, no: 0.487215 },
      after: { yes: 0.874793, no: 0.145207 },
    },
    incomingOrder: { actor: "Latency bot", side: "YES", stakeSol: 0.01 },
    synchronizedOrder: { actor: "Fair trader", side: "YES", stakeSol: 0.01 },
    resolution: "France 2–0 Morocco",
  },
  {
    id: "argentina-brazil",
    fixtureId: "runtime-fixture-002",
    teams: { home: "Argentina", away: "Brazil", homeCode: "ARG", awayCode: "BRA" },
    marketQuestion: "Argentina to win",
    evidenceLabel: "TxLINE-schema runtime scenario",
    canonicalEvidence: false,
    initial: { clock: "54:06", score: [0, 0], eventSequence: 411 },
    event: {
      clock: "54:08",
      type: "RED_CARD",
      label: "Red card confirmed — Brazil",
      score: [0, 0],
      sequence: 412,
    },
    quote: {
      sequence: 411,
      before: { yes: 0.48, no: 0.52 },
      after: { yes: 0.64, no: 0.36 },
    },
    incomingOrder: { actor: "Incoming trader", side: "NO", stakeSol: 0.01 },
    synchronizedOrder: { actor: "Fair trader", side: "YES", stakeSol: 0.01 },
    resolution: "Runtime scenario only — no canonical settlement claim",
  },
] as const;

export function validateRuntimeScenario(value: RuntimeScenario): RuntimeScenario {
  if (!value.id || !value.fixtureId || !value.teams.home || !value.teams.away) {
    throw new Error("Runtime scenario identity is incomplete");
  }
  if (value.event.sequence <= value.initial.eventSequence) {
    throw new Error("Material event sequence must advance");
  }
  if (value.quote.sequence !== value.initial.eventSequence) {
    throw new Error("Opening quote must be synchronized with the initial event sequence");
  }
  for (const price of [value.quote.before.yes, value.quote.before.no, value.quote.after.yes, value.quote.after.no]) {
    if (!Number.isFinite(price) || price <= 0 || price >= 1) throw new Error("Quotes must be probabilities between zero and one");
  }
  if (value.incomingOrder.stakeSol <= 0 || value.synchronizedOrder.stakeSol <= 0) {
    throw new Error("Order stake must be positive");
  }
  return value;
}

export function scenarioById(id: string): RuntimeScenario {
  const scenario = RUNTIME_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown FairX runtime scenario: ${id}`);
  return validateRuntimeScenario(scenario);
}
