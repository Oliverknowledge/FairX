import { sha256 } from "js-sha256";
import canonicalCapture from "@/fixtures/txline/canonical.json";
import { canonicalize } from "@/lib/receipts/create";
import { hashRawEvent } from "@/lib/proof/eventHash";
import { getTxLineServerConfig, hasTxLineCredentials } from "@/lib/txline/config";
import { deriveMatchWinnerHomePrice, findStablePriceRecord, TXLINE_PRICING_MODEL_V1 } from "@/lib/txline/pricing";
import { fetchTxLineJson } from "@/lib/txline/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ fixtureId: string }> }): Promise<Response> {
  const { fixtureId } = await context.params;
  if (!/^\d+$/.test(fixtureId)) return Response.json({ error: "Invalid fixture ID" }, { status: 400 });
  const cfg = getTxLineServerConfig();
  let sourceMode: "live" | "historical";
  let sourceEndpoint: string;
  let payload: unknown;
  try {
    if (!hasTxLineCredentials(cfg)) throw new Error("Historical fallback required");
    sourceEndpoint = `${cfg.oddsSnapshotPath}/${fixtureId}`;
    payload = await fetchTxLineJson(sourceEndpoint);
    sourceMode = "live";
  } catch {
    if (fixtureId !== canonicalCapture.fixtureId) {
      return Response.json({ error: "Live TxLINE odds unavailable and no genuine historical evidence exists for this fixture." }, { status: 503 });
    }
    payload = canonicalCapture.odds.rawPayload;
    sourceEndpoint = canonicalCapture.odds.endpoint;
    sourceMode = "historical";
  }

  try {
    const rawPayload = findStablePriceRecord(payload, fixtureId);
    const derived = deriveMatchWinnerHomePrice(rawPayload, fixtureId);
    const oddsPayloadHash = hashRawEvent(rawPayload);
    const pricingModelHash = sha256(canonicalize(TXLINE_PRICING_MODEL_V1));
    return Response.json({
      source: "txline",
      sourceMode,
      sourceEndpoint,
      fixtureId,
      selection: "part1",
      rawPayload,
      oddsPayloadHash,
      oddsSequence: derived.timestamp,
      pricingModel: TXLINE_PRICING_MODEL_V1,
      pricingModelHash,
      pricingModelVersion: TXLINE_PRICING_MODEL_V1.version,
      fairPriceMicros: derived.fairPriceMicros,
      derivation: derived,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 422 });
  }
}
