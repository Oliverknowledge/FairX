import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hashRawEvent, hashNormalizedTxLineEvent } from "../lib/proof/eventHash";
import { serializeTxlineCapture, type CapturedNormalizedEvent, type TxlineCapture } from "../lib/txline/captureFormat";
import { normalizeTxLineEvent, TXLINE_NORMALIZER_VERSION } from "../lib/txline/normalize";
import { normalizeStablePriceSelection } from "../lib/txline/pricing";

const ORIGIN = process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com";
const NETWORK = process.env.TXLINE_NETWORK === "mainnet" ? "mainnet" : "devnet";
const PROGRAM_ID = process.env.TXLINE_PROGRAM_ID
  ?? (NETWORK === "devnet" ? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J" : "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const OUTPUT = resolve(process.env.TXLINE_CAPTURE_PATH ?? "fixtures/txline/canonical.json");

function credential(name: "TXLINE_JWT" | "TXLINE_API_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required; run the server-only TxLINE activation flow first`);
  return value;
}

function headers(accept = "application/json"): HeadersInit {
  return {
    Accept: accept,
    Authorization: `Bearer ${credential("TXLINE_JWT")}`,
    "X-Api-Token": credential("TXLINE_API_TOKEN"),
  };
}

async function fetchText(endpoint: string, accept = "application/json"): Promise<{ body: string; receivedAt: string }> {
  const response = await fetch(`${ORIGIN}${endpoint}`, { headers: headers(accept), cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new Error(`${endpoint} failed with HTTP ${response.status}`);
  return { body, receivedAt: new Date().toISOString() };
}

function parseSse(body: string): Array<Record<string, unknown>> {
  return body.split(/\r?\n\r?\n/).flatMap((block) => {
    const data = block.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function score(record: Record<string, unknown>): [number, number] {
  const stats = typeof record.Stats === "object" && record.Stats !== null && !Array.isArray(record.Stats)
    ? record.Stats as Record<string, unknown>
    : {};
  return [Number(stats["1"] ?? 0), Number(stats["2"] ?? 0)];
}

function confirmedScoreChange(rows: Array<Record<string, unknown>>) {
  const sorted = [...rows].sort((a, b) => Number(a.Seq ?? 0) - Number(b.Seq ?? 0));
  const changes = sorted.flatMap((event, index) => {
    if (index === 0 || event.Confirmed !== true) return [];
    const previous = sorted[index - 1];
    const before = score(previous);
    const after = score(event);
    if (before[0] === after[0] && before[1] === after[1]) return [];
    return [{ previous, event, before, after }];
  });
  return changes.find((change) => change.event.Action === "goal") ?? changes[0] ?? null;
}

function intervalEndpoint(timestamp: number, fixtureId: number, shift = 0): string {
  const date = new Date(timestamp);
  let epochDay = Math.floor(timestamp / 86_400_000);
  let hour = date.getUTCHours();
  let interval = Math.floor(date.getUTCMinutes() / 5) + shift;
  while (interval < 0) { interval += 12; hour -= 1; }
  while (interval >= 12) { interval -= 12; hour += 1; }
  if (hour < 0) { hour = 23; epochDay -= 1; }
  if (hour >= 24) { hour = 0; epochDay += 1; }
  return `/api/odds/updates/${epochDay}/${hour}/${interval}?fixtureId=${fixtureId}`;
}

async function findCanonicalFixture(fixtures: Array<Record<string, unknown>>) {
  const configured = process.env.TXLINE_FIXTURE_ID?.trim();
  const candidates = fixtures
    .filter((fixture) => fixture.CompetitionId === 72)
    .filter((fixture) => configured ? String(fixture.FixtureId) === configured : fixture.GameState === 3)
    .sort((a, b) => Number(b.StartTime ?? 0) - Number(a.StartTime ?? 0));

  for (const fixture of candidates) {
    const fixtureId = numberField(fixture, "FixtureId");
    if (!fixtureId) continue;
    const endpoint = `/api/scores/historical/${fixtureId}`;
    const response = await fetchText(endpoint, "text/event-stream");
    const rows = parseSse(response.body);
    const change = confirmedScoreChange(rows);
    if (change) return { fixture, fixtureId, endpoint, receivedAt: response.receivedAt, change };
  }
  throw new Error("No completed World Cup fixture with a genuine confirmed score change was returned by TxLINE");
}

function withoutRaw(normalized: ReturnType<typeof normalizeTxLineEvent>): CapturedNormalizedEvent {
  const { raw: _raw, ...event } = normalized;
  return event as CapturedNormalizedEvent;
}

async function persistCanonicalFixtureId(fixtureId: number) {
  const envPath = resolve(".env.local");
  let contents = await readFile(envPath, "utf8");
  const line = `TXLINE_FIXTURE_ID=${fixtureId}`;
  const rows = contents.split(/\r?\n/);
  const index = rows.findIndex((row) => row.startsWith("TXLINE_FIXTURE_ID="));
  if (index >= 0) rows[index] = line;
  else rows.push(line);
  contents = `${rows.join("\n").replace(/\n*$/, "")}\n`;
  const temporary = `${envPath}.txline-capture-tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, envPath);
  await chmod(envPath, 0o600);
}

async function main() {
  const startEpochDay = Math.floor(Date.now() / 86_400_000) - 14;
  const fixtureEndpoint = `/api/fixtures/snapshot?competitionId=72&startEpochDay=${startEpochDay}`;
  const fixtureResponse = await fetchText(fixtureEndpoint);
  const fixtures = JSON.parse(fixtureResponse.body) as Array<Record<string, unknown>>;
  if (!Array.isArray(fixtures)) throw new Error("TxLINE fixtures response was not an array");

  const selected = await findCanonicalFixture(fixtures);
  const participant1 = String(selected.fixture.Participant1 ?? "Participant 1");
  const participant2 = String(selected.fixture.Participant2 ?? "Participant 2");
  const normalized = normalizeTxLineEvent(selected.change.event, {
    source: "historical",
    fallbackFixtureId: String(selected.fixtureId),
    fallbackSeq: -1,
    participantNames: { 1: participant1, 2: participant2 },
  });
  if (normalized.trace.seqField !== "Seq") throw new Error("Genuine TxLINE sequence was not preserved");
  if (normalized.fixtureId !== String(selected.fixtureId)) throw new Error("Genuine TxLINE fixture ID was not preserved");

  const oddsEndpoint = intervalEndpoint(normalized.ts, selected.fixtureId);
  const oddsResponse = await fetchText(oddsEndpoint);
  const previousOddsEndpoint = intervalEndpoint(normalized.ts, selected.fixtureId, -1);
  const previousOddsResponse = await fetchText(previousOddsEndpoint);
  const odds = [
    ...(JSON.parse(previousOddsResponse.body) as Array<Record<string, unknown>>),
    ...(JSON.parse(oddsResponse.body) as Array<Record<string, unknown>>),
  ];
  const participant = Number(selected.change.event.Participant);
  const selection = participant === 1 ? "part1" : "part2";
  const matchingOdds = odds
    .filter((record) => record.SuperOddsType === "1X2_PARTICIPANT_RESULT")
    .filter((record) => record.MarketPeriod == null && record.MarketParameters == null)
    .filter((record) => Array.isArray(record.Pct) && (record.Pct as unknown[]).length === 3)
    .sort((a, b) => Number(a.Ts) - Number(b.Ts));
  const oddsRecord = matchingOdds.find((record) => Number(record.Ts) >= normalized.ts);
  const previousScoreTimestamp = Number(selected.change.previous.Ts);
  const previousOddsRecord = matchingOdds.filter((record) => Number(record.Ts) < previousScoreTimestamp).at(-1);
  if (!oddsRecord) throw new Error("No genuine post-event full-match StablePrice record was available");
  if (!previousOddsRecord) throw new Error("No genuine pre-event full-match StablePrice record was available");

  const normalizedPricingInput = normalizeStablePriceSelection(oddsRecord, selection);
  const displayedPricingInput = normalizeStablePriceSelection(previousOddsRecord, selection);
  const normalizedEvent = withoutRaw(normalized);
  const capturedAt = new Date().toISOString();
  const capture: TxlineCapture = {
    version: 1,
    source: "txline",
    mode: "historical",
    network: NETWORK,
    programId: PROGRAM_ID,
    endpoint: selected.endpoint,
    fixtureId: String(selected.fixtureId),
    receivedAt: selected.receivedAt,
    capturedAt,
    rawPayload: selected.change.event,
    previousRawPayload: selected.change.previous,
    rawPayloadHash: hashRawEvent(selected.change.event),
    normalizedEvent,
    normalizedEventHash: hashNormalizedTxLineEvent(normalized),
    normalizerVersion: TXLINE_NORMALIZER_VERSION,
    fixture: {
      endpoint: "/api/fixtures/snapshot",
      receivedAt: fixtureResponse.receivedAt,
      rawResponseHash: hashRawEvent(fixtures),
      record: selected.fixture,
    },
    odds: {
      endpoint: oddsEndpoint,
      previousEndpoint: previousOddsEndpoint,
      receivedAt: oddsResponse.receivedAt,
      previousRawPayload: previousOddsRecord,
      previousRawPayloadHash: hashRawEvent(previousOddsRecord),
      displayedPricingInput,
      rawPayload: oddsRecord,
      rawPayloadHash: hashRawEvent(oddsRecord),
      normalizedPricingInput,
    },
    pricingModel: {
      version: "txline-demargined-pct-v1",
      configHash: hashRawEvent({ version: "txline-demargined-pct-v1", field: "Pct", scale: 100 }),
    },
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, serializeTxlineCapture(capture), { encoding: "utf8", mode: 0o644 });
  await persistCanonicalFixtureId(selected.fixtureId);
  console.log(JSON.stringify({
    capture: OUTPUT,
    network: capture.network,
    fixtureId: capture.fixtureId,
    fixture: `${participant1} vs ${participant2}`,
    endpoint: capture.endpoint,
    seq: capture.normalizedEvent.seq,
    score: `${capture.normalizedEvent.homeScore}-${capture.normalizedEvent.awayScore}`,
    oddsEndpoint: capture.odds.endpoint,
    fairPriceMicros: normalizedPricingInput.fairPriceMicros,
    displayedPriceMicros: displayedPricingInput.fairPriceMicros,
    rawPayloadHash: capture.rawPayloadHash,
    normalizedEventHash: capture.normalizedEventHash,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
