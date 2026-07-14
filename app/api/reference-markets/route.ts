import { listApprovedMappings } from "@/lib/polymarket/mapping";
import { POLYMARKET_DISCLAIMER } from "@/lib/polymarket/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List the APPROVED TxLINE↔Polymarket reference mappings (allowlist). Metadata
 * only — no upstream fetch, no orders, no token ids a caller could abuse.
 */
export async function GET(): Promise<Response> {
  const markets = listApprovedMappings().map((m) => ({
    mappingId: m.mappingId,
    fixture: `${m.txlineHomeTeam} vs ${m.txlineAwayTeam}`,
    competition: m.txlineCompetitionId,
    yesMeaning: m.fairxYesMeaning,
    fairxTemplate: m.fairxTemplate,
    polymarketSlug: m.polymarketSlug,
    polymarketQuestion: m.polymarketQuestion,
    resolutionScope: m.resolutionSemantics.scope,
    semanticsMatch: m.resolutionSemantics.semanticsMatch,
    mappingHash: m.mappingHash,
    verifiedAt: m.verifiedAt,
    verifiedBy: m.verifiedBy,
  }));
  return Response.json(
    { source: "Polymarket order book", disclaimer: POLYMARKET_DISCLAIMER, markets },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
