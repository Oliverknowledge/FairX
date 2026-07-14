import { getApprovedMapping } from "@/lib/polymarket/mapping";
import { clientKeyFromRequest, rateLimit } from "@/lib/polymarket/rateLimit";
import { CLOB_BASE_URL } from "@/lib/polymarket/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const INTERVALS = new Set(["1d", "1w", "max"]);
const PER_IP_LIMIT = 30;
const WINDOW_MS = 60_000;

/**
 * Polymarket CLOB price history for an APPROVED mapping's YES token — the same
 * series Polymarket's own market page charts. Allowlisted (never proxies an
 * arbitrary token id), rate-limited, and honest: returns only recomputed
 * {t, priceMicros} points, labelled as an external reference.
 */
export async function GET(req: Request, ctx: { params: Promise<{ mappingId: string }> }): Promise<Response> {
  const { mappingId } = await ctx.params;
  const mapping = getApprovedMapping(mappingId);
  if (!mapping) {
    return Response.json(
      { ok: false, code: "MAPPING_NOT_APPROVED", reason: "This mapping id is not in the approved registry." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const limit = rateLimit(`price-history:${clientKeyFromRequest(req)}`, PER_IP_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return Response.json(
      { ok: false, code: "RATE_LIMITED", reason: "Too many requests." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const url = new URL(req.url);
  const requested = url.searchParams.get("interval") ?? "1w";
  const interval = INTERVALS.has(requested) ? requested : "1w";

  try {
    const upstream = new URL(`${CLOB_BASE_URL}/prices-history`);
    upstream.searchParams.set("market", mapping.polymarketYesTokenId);
    upstream.searchParams.set("interval", interval);
    upstream.searchParams.set("fidelity", "60");
    const res = await fetch(upstream, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = (await res.json()) as { history?: Array<{ t: number; p: number }> };
    const history = (body.history ?? [])
      .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p))
      .map((pt) => ({ t: pt.t, priceMicros: Math.round(pt.p * 1_000_000) }));
    return Response.json(
      { ok: true, mappingId, interval, source: "Polymarket CLOB", points: history },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return Response.json(
      { ok: false, code: "UPSTREAM_UNAVAILABLE", reason: "Polymarket price history is unavailable right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
