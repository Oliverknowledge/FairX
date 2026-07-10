import { beforeEach, describe, expect, it } from "vitest";
import { writeCapturedSamples } from "@/lib/txline/capture";
import { addCapturedSample, clearCapturedSamples, listCapturedSamples, removeCapturedSample, toReplayEvent } from "@/lib/txline/capturedSamples";
import { normalizeTxLineEvent } from "@/lib/txline/normalize";

beforeEach(() => {
  writeCapturedSamples([]); // reset the module-level in-memory fallback between tests
});

const rawGoalPayload = { eventType: "GOAL", fixtureId: "ENG-FRA-2026-QF", seq: 4, team: "England", signature: "sig-abc" };

function makeLiveEvent() {
  return normalizeTxLineEvent(rawGoalPayload, { source: "live", fallbackFixtureId: "FALLBACK", fallbackSeq: 1 });
}

describe("capturedSamples domain layer", () => {
  it("adds a sample from a live-stream payload and lists it newest-first", () => {
    const event = makeLiveEvent();
    const after = addCapturedSample({ raw: rawGoalPayload, event, streamType: "scores", origin: "live-stream" });
    expect(after).toHaveLength(1);
    expect(after[0].origin).toBe("live-stream");
    expect(after[0].seq).toBe(4);
    expect(after[0].fixtureId).toBe("ENG-FRA-2026-QF");
    expect(listCapturedSamples()).toHaveLength(1);
  });

  it("adds a manually-imported sample distinctly labelled", () => {
    const event = normalizeTxLineEvent({ eventType: "RED_CARD", fixtureId: "F", seq: 9 }, { source: "captured", fallbackFixtureId: "F", fallbackSeq: 1 });
    const after = addCapturedSample({ raw: { eventType: "RED_CARD" }, event, streamType: "manual", origin: "manual-import" });
    expect(after[0].origin).toBe("manual-import");
    expect(after[0].streamType).toBe("manual");
  });

  it("removes a sample by id", () => {
    const event = makeLiveEvent();
    addCapturedSample({ raw: rawGoalPayload, event, streamType: "scores", origin: "live-stream" });
    const [sample] = listCapturedSamples();
    const after = removeCapturedSample(sample.id);
    expect(after).toHaveLength(0);
  });

  it("clears all samples", () => {
    addCapturedSample({ raw: rawGoalPayload, event: makeLiveEvent(), streamType: "scores", origin: "live-stream" });
    addCapturedSample({ raw: rawGoalPayload, event: makeLiveEvent(), streamType: "odds", origin: "live-stream" });
    expect(listCapturedSamples().length).toBeGreaterThan(0);
    const after = clearCapturedSamples();
    expect(after).toEqual([]);
    expect(listCapturedSamples()).toEqual([]);
  });

  it("toReplayEvent re-normalizes the raw payload with source 'captured', never 'live'", () => {
    const liveEvent = makeLiveEvent();
    expect(liveEvent.source).toBe("live");
    const [sample] = addCapturedSample({ raw: rawGoalPayload, event: liveEvent, streamType: "scores", origin: "live-stream" });
    const replay = toReplayEvent(sample, "FALLBACK", 1);
    expect(replay.source).toBe("captured");
    // Same extraction logic — identical seq/eventType/team to the original live-normalized event.
    expect(replay.seq).toBe(liveEvent.seq);
    expect(replay.eventType).toBe(liveEvent.eventType);
    expect(replay.team).toBe(liveEvent.team);
  });
});
