import { getApprovedMapping, verifyMapping } from "@/lib/polymarket/mapping";
import { POLYMARKET_DISCLAIMER } from "@/lib/polymarket/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full detail for one approved mapping, including its verified hash chain. */
export async function GET(_req: Request, ctx: { params: Promise<{ mappingId: string }> }): Promise<Response> {
  const { mappingId } = await ctx.params;
  const mapping = getApprovedMapping(mappingId);
  if (!mapping) {
    return Response.json(
      { ok: false, code: "MAPPING_NOT_APPROVED", reason: "This mapping id is not in the approved registry." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  const mappingErrors = verifyMapping(mapping);
  return Response.json(
    {
      source: "Polymarket order book",
      disclaimer: POLYMARKET_DISCLAIMER,
      mappingValid: mappingErrors.length === 0,
      mappingErrors,
      mapping,
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
