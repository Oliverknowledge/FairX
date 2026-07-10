import { MAX_CAPTURED_SAMPLES, readCapturedSamples, writeCapturedSamples, type CapturedSample } from "@/lib/txline/capture";
import { normalizeTxLineEvent } from "@/lib/txline/normalize";
import type { NormalizedTxLineEvent } from "@/lib/txline/types";

export type { CapturedSample };
export { MAX_CAPTURED_SAMPLES };

/**
 * Domain layer over the raw capture store: build, list, and replay captured
 * TxLINE samples. Replaying always re-runs `normalizeTxLineEvent` with
 * source "captured" — the exact same normalizer a live SSE tick uses — so a
 * captured replay is never a shortcut around the real pipeline, only a
 * different provenance label on its output.
 */

let idSeq = 0;
function makeSampleId(): string {
  idSeq += 1;
  return `sample-${Date.now()}-${idSeq}`;
}

export function listCapturedSamples(): CapturedSample[] {
  return readCapturedSamples();
}

interface AddSampleInput {
  raw: unknown;
  event: NormalizedTxLineEvent;
  streamType: CapturedSample["streamType"];
  origin: CapturedSample["origin"];
}

/** Save a payload — from a live SSE tick or a manual paste — as a captured sample. Newest first, capped. */
export function addCapturedSample(input: AddSampleInput): CapturedSample[] {
  const sample: CapturedSample = {
    id: makeSampleId(),
    capturedAt: Date.now(),
    origin: input.origin,
    streamType: input.streamType,
    raw: input.raw,
    event: input.event,
    fixtureId: input.event.fixtureId,
    seq: input.event.seq,
  };
  return writeCapturedSamples([sample, ...readCapturedSamples()]);
}

export function removeCapturedSample(id: string): CapturedSample[] {
  return writeCapturedSamples(readCapturedSamples().filter((s) => s.id !== id));
}

export function clearCapturedSamples(): CapturedSample[] {
  return writeCapturedSamples([]);
}

/**
 * Re-normalize a captured sample's raw payload with source "captured" so
 * replay runs through the identical normalizer a live tick would use — only
 * the provenance label differs, never the extraction logic.
 */
export function toReplayEvent(sample: CapturedSample, fallbackFixtureId: string, fallbackSeq: number): NormalizedTxLineEvent {
  return normalizeTxLineEvent(sample.raw, {
    source: "captured",
    fallbackFixtureId: sample.fixtureId || fallbackFixtureId,
    fallbackSeq,
  });
}
