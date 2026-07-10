import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CAPTURED_SAMPLES, readCapturedSamples, writeCapturedSamples, type CapturedSample } from "@/lib/txline/capture";

// The Vitest environment is "node", so capture.ts falls back to its in-memory
// store (no localStorage). That store is module-level, so it must be reset
// between tests to avoid cross-test leakage.
beforeEach(() => {
  writeCapturedSamples([]);
});

const makeSample = (id: string, seq: number): CapturedSample => ({
  id,
  capturedAt: Date.now(),
  origin: "live-stream",
  streamType: "scores",
  raw: { seq },
  event: {
    provider: "TXLINE",
    source: "captured",
    fixtureId: "FIX-1",
    seq,
    ts: Date.now(),
    eventType: "GOAL",
    raw: { seq },
    proofStatus: "unverified",
    trace: { seqField: "seq", tsField: null, eventTypeField: null, eventTypeMethod: "default" },
  },
  fixtureId: "FIX-1",
  seq,
});

describe("capture store", () => {
  it("starts empty", () => {
    expect(readCapturedSamples()).toEqual([]);
  });

  it("round-trips a written list", () => {
    const samples = [makeSample("a", 1), makeSample("b", 2)];
    writeCapturedSamples(samples);
    expect(readCapturedSamples()).toEqual(samples);
  });

  it("caps at MAX_CAPTURED_SAMPLES, keeping the front of the list", () => {
    const many = Array.from({ length: MAX_CAPTURED_SAMPLES + 5 }, (_, i) => makeSample(`s${i}`, i));
    writeCapturedSamples(many);
    const stored = readCapturedSamples();
    expect(stored).toHaveLength(MAX_CAPTURED_SAMPLES);
    expect(stored[0].id).toBe("s0");
  });
});
