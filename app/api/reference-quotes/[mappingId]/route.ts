import { isApprovedMappingId } from "@/lib/polymarket/mapping";
import { clientKeyFromRequest, rateLimit } from "@/lib/polymarket/rateLimit";
import { getReferenceQuoteView } from "@/lib/polymarket/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const PER_IP_LIMIT = 30;
const GLOBAL_LIMIT = 300;
const WINDOW_MS = 60_000;

/**
 * Current reference quote for an APPROVED mapping. Allowlisted, per-IP and
 * global rate-limited, cached with stale-while-revalidate, and honest about
 * freshness: LIVE / RECENTLY_CACHED / HISTORICAL_CAPTURE / UNAVAILABLE. Never
 * proxies arbitrary upstream urls or token ids, never leaks a raw exception.
 */
export async function GET(req: Request, ctx: { params: Promise<{ mappingId: string }> }): Promise<Response> {
  const { mappingId } = await ctx.params;
  if (!isApprovedMappingId(mappingId)) {
    return Response.json(
      { ok: false, code: "MAPPING_NOT_APPROVED", reason: "This mapping id is not in the approved registry." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const perIp = rateLimit(`quote:${clientKeyFromRequest(req)}`, PER_IP_LIMIT, WINDOW_MS);
  const global = rateLimit("quote:__global__", GLOBAL_LIMIT, WINDOW_MS);
  if (!perIp.allowed || !global.allowed) {
    const retryAfterMs = Math.max(perIp.retryAfterMs, global.retryAfterMs);
    return Response.json(
      { ok: false, code: "RATE_LIMITED", reason: "Too many reference-quote requests. Try again shortly." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const view = await getReferenceQuoteView(mappingId);
    if (!view) {
      return Response.json({ ok: false, code: "MAPPING_NOT_APPROVED" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    // Short public cache; UNAVAILABLE is never cached at the edge.
    const cacheControl = view.freshness === "LIVE" ? "public, max-age=5" : "no-store";
    return Response.json(view, { headers: { "Cache-Control": cacheControl } });
  } catch {
    return Response.json(
      { ok: false, code: "UPSTREAM_UNAVAILABLE", reason: "Polymarket reference data is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
