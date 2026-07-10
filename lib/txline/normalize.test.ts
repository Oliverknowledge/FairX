import { describe, expect, it } from "vitest";
import { normalizeTxLineEvent } from "@/lib/txline/normalize";

const ctx = { source: "live" as const, fallbackFixtureId: "FALLBACK-FIXTURE", fallbackSeq: 99, now: 1_700_000_000_000 };

describe("normalizeTxLineEvent — defensiveness", () => {
  it("never crashes on totally unknown/garbage payloads", () => {
    const garbage: unknown[] = [null, undefined, 42, "just a string", [1, 2, 3], true, {}];
    for (const payload of garbage) {
      expect(() => normalizeTxLineEvent(payload, ctx)).not.toThrow();
      const result = normalizeTxLineEvent(payload, ctx);
      expect(result.eventType).toBe("UNKNOWN");
      expect(result.raw).toBe(payload);
    }
  });

  it("falls back to fixtureId/seq from context when the payload has none", () => {
    const r = normalizeTxLineEvent({ foo: "bar" }, ctx);
    expect(r.fixtureId).toBe("FALLBACK-FIXTURE");
    expect(r.seq).toBe(99);
    expect(r.trace.seqField).toBeNull();
  });

  it("defaults to UNKNOWN and records method 'default' when nothing matches", () => {
    const r = normalizeTxLineEvent({ someRandomField: 123 }, ctx);
    expect(r.eventType).toBe("UNKNOWN");
    expect(r.trace.eventTypeMethod).toBe("default");
    expect(r.trace.eventTypeField).toBeNull();
  });

  it("always preserves the raw payload verbatim", () => {
    const raw = { weird: "shape", nested: { a: 1 } };
    expect(normalizeTxLineEvent(raw, ctx).raw).toBe(raw);
  });
});

describe("normalizeTxLineEvent — sequence extraction", () => {
  it.each([
    ["seq", { seq: 5 }],
    ["sequence", { sequence: 5 }],
    ["updateSeq", { updateSeq: 5 }],
    ["eventSeq", { eventSeq: 5 }],
    ["revision", { revision: 5 }],
  ])("extracts seq from field '%s' and traces it", (field, payload) => {
    const r = normalizeTxLineEvent(payload, ctx);
    expect(r.seq).toBe(5);
    expect(r.trace.seqField).toBe(field);
  });

  it("accepts a numeric string sequence", () => {
    const r = normalizeTxLineEvent({ seq: "7" }, ctx);
    expect(r.seq).toBe(7);
  });
});

describe("normalizeTxLineEvent — timestamp extraction", () => {
  it("extracts and converts an epoch-seconds timestamp to ms", () => {
    const r = normalizeTxLineEvent({ ts: 1_700_000_000 }, ctx); // seconds
    expect(r.ts).toBe(1_700_000_000_000);
    expect(r.trace.tsField).toBe("ts");
  });

  it("accepts an already-ms timestamp untouched", () => {
    const r = normalizeTxLineEvent({ timestamp: 1_700_000_000_123 }, ctx);
    expect(r.ts).toBe(1_700_000_000_123);
    expect(r.trace.tsField).toBe("timestamp");
  });

  it("parses an ISO string timestamp", () => {
    const r = normalizeTxLineEvent({ createdAt: "2024-01-01T00:00:00.000Z" }, ctx);
    expect(r.ts).toBe(Date.parse("2024-01-01T00:00:00.000Z"));
    expect(r.trace.tsField).toBe("createdAt");
  });

  it("falls back to ctx.now when no timestamp field is present", () => {
    const r = normalizeTxLineEvent({ foo: "bar" }, ctx);
    expect(r.ts).toBe(ctx.now);
    expect(r.trace.tsField).toBeNull();
  });
});

describe("normalizeTxLineEvent — event type inference", () => {
  it("matches GOAL explicitly from an eventType field", () => {
    const r = normalizeTxLineEvent({ eventType: "GOAL_SCORED" }, ctx);
    expect(r.eventType).toBe("GOAL");
    expect(r.trace.eventTypeMethod).toBe("explicit");
    expect(r.trace.eventTypeField).toBe("eventType");
  });

  it("matches RED_CARD from a differently-named type field", () => {
    const r = normalizeTxLineEvent({ code: "SEND_OFF" }, ctx);
    expect(r.eventType).toBe("RED_CARD");
    expect(r.trace.eventTypeField).toBe("code");
  });

  it("infers ODDS_UPDATE structurally from an 'odds' key with no type field", () => {
    const r = normalizeTxLineEvent({ odds: { home: 1.8 } }, ctx);
    expect(r.eventType).toBe("ODDS_UPDATE");
    expect(r.trace.eventTypeMethod).toBe("structural");
  });

  it("infers GOAL structurally from home/away score fields with no type field", () => {
    const r = normalizeTxLineEvent({ homeScore: 1, awayScore: 0 }, ctx);
    expect(r.eventType).toBe("GOAL");
    expect(r.trace.eventTypeMethod).toBe("structural");
  });
});

describe("normalizeTxLineEvent — envelope unwrapping", () => {
  it("unwraps a { data: {...} } envelope", () => {
    const r = normalizeTxLineEvent({ data: { seq: 3, eventType: "GOAL" } }, ctx);
    expect(r.seq).toBe(3);
    expect(r.eventType).toBe("GOAL");
  });

  it("unwraps a { payload: {...} } envelope", () => {
    const r = normalizeTxLineEvent({ payload: { seq: 4, team: "France" } }, ctx);
    expect(r.seq).toBe(4);
    expect(r.team).toBe("France");
  });
});

describe("normalizeTxLineEvent — proof status by source", () => {
  it("marks demo events as simulated regardless of proof fields", () => {
    const r = normalizeTxLineEvent({ seq: 1, signature: "abc" }, { ...ctx, source: "demo" });
    expect(r.proofStatus).toBe("simulated");
  });

  it("marks captured events api_verified when signature/merkle fields are present", () => {
    const r = normalizeTxLineEvent({ seq: 1, signature: "abc" }, { ...ctx, source: "captured" });
    expect(r.proofStatus).toBe("api_verified");
    expect(r.source).toBe("captured");
  });

  it("marks live events unverified with no proof fields", () => {
    const r = normalizeTxLineEvent({ seq: 1 }, { ...ctx, source: "live" });
    expect(r.proofStatus).toBe("unverified");
  });
});
