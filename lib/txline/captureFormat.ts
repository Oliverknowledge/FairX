import { canonicalize } from "@/lib/receipts/create";
import { hashNormalizedEvent, hashRawEvent, type NormalizedEventHashInput } from "@/lib/proof/eventHash";
import type { NormalizedPricingInput } from "@/lib/txline/pricing";
import type { NormalizeTrace, TxLineEventType, TxLineProofStatus } from "@/lib/txline/types";

export type TxlineCaptureMode = "live" | "historical" | "captured";
export type TxlineNetwork = "devnet" | "mainnet";

export interface CapturedNormalizedEvent extends NormalizedEventHashInput {
  provider: "TXLINE";
  source: "live" | "historical" | "captured";
  eventType: TxLineEventType;
  proofStatus: TxLineProofStatus;
  homeScore?: number;
  awayScore?: number;
  trace: NormalizeTrace;
}

export interface TxlineCapture {
  version: 1;
  source: "txline";
  mode: TxlineCaptureMode;
  network: TxlineNetwork;
  programId: string;
  endpoint: string;
  fixtureId: string;
  receivedAt: string;
  capturedAt: string;
  rawPayload: unknown;
  previousRawPayload: unknown;
  rawPayloadHash: string;
  normalizedEvent: CapturedNormalizedEvent;
  normalizedEventHash: string;
  normalizerVersion: string;
  fixture: {
    endpoint: "/api/fixtures/snapshot";
    receivedAt: string;
    rawResponseHash: string;
    record: Record<string, unknown>;
  };
  odds: {
    endpoint: string;
    previousEndpoint: string;
    receivedAt: string;
    previousRawPayload: unknown;
    previousRawPayloadHash: string;
    displayedPricingInput: NormalizedPricingInput;
    rawPayload: unknown;
    rawPayloadHash: string;
    normalizedPricingInput: NormalizedPricingInput;
  };
  pricingModel: {
    version: "txline-demargined-pct-v1";
    configHash: string;
  };
}

const HASH = /^[a-f0-9]{64}$/;
const SECRET_KEY = /authorization|api[-_]?token|jwt|secret|keypair|private[-_]?key/i;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsSecretMetadata(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretMetadata);
  if (!object(value)) return false;
  return Object.entries(value).some(([key, child]) => SECRET_KEY.test(key) || containsSecretMetadata(child));
}

export function captureNormalizedHashInput(event: CapturedNormalizedEvent): NormalizedEventHashInput {
  return {
    provider: event.provider,
    source: event.source,
    fixtureId: event.fixtureId,
    seq: event.seq,
    ts: event.ts,
    eventType: event.eventType,
    team: event.team,
    player: event.player,
    minute: event.minute,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    proofStatus: event.proofStatus,
  };
}

export function validateTxlineCapture(value: unknown): string[] {
  const errors: string[] = [];
  if (!object(value)) return ["capture must be an object"];
  const capture = value as unknown as TxlineCapture;
  if (capture.version !== 1) errors.push("version must be 1");
  if (capture.source !== "txline") errors.push("source must be txline");
  if (!["live", "historical", "captured"].includes(capture.mode)) errors.push("mode is invalid");
  if (!["devnet", "mainnet"].includes(capture.network)) errors.push("network is invalid");
  if (typeof capture.endpoint !== "string" || !capture.endpoint.startsWith("/api/")) errors.push("endpoint is invalid");
  if (typeof capture.fixtureId !== "string" || capture.fixtureId.length === 0) errors.push("fixtureId is required");
  if (!HASH.test(capture.rawPayloadHash ?? "")) errors.push("rawPayloadHash is invalid");
  if (!HASH.test(capture.normalizedEventHash ?? "")) errors.push("normalizedEventHash is invalid");
  if (!object(capture.normalizedEvent)) errors.push("normalizedEvent is invalid");
  if (!object(capture.fixture) || !object(capture.fixture.record)) errors.push("fixture provenance is invalid");
  if (!object(capture.odds) || !object(capture.odds.normalizedPricingInput)) errors.push("odds provenance is invalid");
  if (containsSecretMetadata(capture)) errors.push("capture contains secret metadata");
  if (errors.length > 0) return errors;

  if (String(capture.normalizedEvent.fixtureId) !== capture.fixtureId) errors.push("normalized fixtureId does not match capture");
  if (String(capture.fixture.record.FixtureId) !== capture.fixtureId) errors.push("fixture record ID does not match capture");
  if (capture.odds.normalizedPricingInput.fixtureId !== capture.fixtureId) errors.push("odds fixtureId does not match capture");
  if (hashRawEvent(capture.rawPayload) !== capture.rawPayloadHash) errors.push("raw payload hash mismatch");
  if (hashNormalizedEvent(captureNormalizedHashInput(capture.normalizedEvent)) !== capture.normalizedEventHash) errors.push("normalized event hash mismatch");
  if (hashRawEvent(capture.odds.rawPayload) !== capture.odds.rawPayloadHash) errors.push("odds payload hash mismatch");
  if (hashRawEvent(capture.odds.previousRawPayload) !== capture.odds.previousRawPayloadHash) errors.push("previous odds payload hash mismatch");
  if (capture.odds.displayedPricingInput.fixtureId !== capture.fixtureId) errors.push("displayed odds fixtureId does not match capture");
  if (!HASH.test(capture.fixture.rawResponseHash)) errors.push("fixture response hash is invalid");
  if (!HASH.test(capture.pricingModel.configHash)) errors.push("pricing model config hash is invalid");
  return errors;
}

export function verifyTxlineCapture(value: unknown): asserts value is TxlineCapture {
  const errors = validateTxlineCapture(value);
  if (errors.length > 0) throw new Error(`Invalid TxLINE capture: ${errors.join("; ")}`);
}

export function serializeTxlineCapture(capture: TxlineCapture): string {
  verifyTxlineCapture(capture);
  return `${canonicalize(capture)}\n`;
}
