import { getApprovedMapping } from "@/lib/polymarket/mapping";
import { POLYMARKET_DISCLAIMER, loadHistoricalCapture } from "@/lib/polymarket/service";
import { verifyReferenceCapture } from "@/lib/polymarket/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The bundled, durable reference capture for an approved mapping, with its
 * RECORDED-EVIDENCE verification. This is offline proof — explicitly NOT a live
 * quote — so a judge can reproduce the derivation even if Polymarket is down.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ mappingId: string }> }): Promise<Response> {
  const { mappingId } = await ctx.params;
  if (!getApprovedMapping(mappingId)) {
    return Response.json(
      { ok: false, code: "MAPPING_NOT_APPROVED", reason: "This mapping id is not in the approved registry." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  const capture = loadHistoricalCapture(mappingId);
  if (!capture) {
    return Response.json(
      { ok: false, code: "NO_HISTORICAL_CAPTURE", reason: "No bundled reference capture exists for this mapping." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  const verification = verifyReferenceCapture(capture);
  return Response.json(
    { source: "Polymarket order book", disclaimer: POLYMARKET_DISCLAIMER, verification, capture },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
