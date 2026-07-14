import { isApprovedMappingId } from "@/lib/polymarket/mapping";
import { clientKeyFromRequest, rateLimit } from "@/lib/polymarket/rateLimit";
import { requireOperatorApiAuthorization } from "@/lib/server/operatorApiAuth";
import { getReferenceQuoteView } from "@/lib/polymarket/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const PER_IP_LIMIT = 10;
const WINDOW_MS = 60_000;

/**
 * Force a fresh upstream re-fetch, bypassing the cache. PROTECTED: it is gated
 * by the operator API token so a visitor cannot force unbounded upstream load.
 * When the token is unset the route reports OPERATOR_API_DISABLED rather than
 * exposing a public refresh.
 */
export async function POST(req: Request, ctx: { params: Promise<{ mappingId: string }> }): Promise<Response> {
  const authFailure = requireOperatorApiAuthorization(req);
  if (authFailure) return authFailure;

  const { mappingId } = await ctx.params;
  if (!isApprovedMappingId(mappingId)) {
    return Response.json(
      { ok: false, code: "MAPPING_NOT_APPROVED", reason: "This mapping id is not in the approved registry." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const limit = rateLimit(`refresh:${clientKeyFromRequest(req)}`, PER_IP_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return Response.json(
      { ok: false, code: "RATE_LIMITED", reason: "Too many refresh requests." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  try {
    const view = await getReferenceQuoteView(mappingId, { forceRefresh: true });
    if (!view) return Response.json({ ok: false, code: "MAPPING_NOT_APPROVED" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return Response.json({ ok: true, view }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { ok: false, code: "UPSTREAM_UNAVAILABLE", reason: "Polymarket reference data is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
