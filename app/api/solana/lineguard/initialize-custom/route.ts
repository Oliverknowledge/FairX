import { initializeCustomOnChainMarket } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // An empty/invalid body is handled by the marketId check below.
  }

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  if (!marketId) {
    return Response.json({ ok: false, reason: "A marketId is required to derive the market PDA." }, { status: 400 });
  }

  const result = await initializeCustomOnChainMarket({
    marketId,
    displayedPriceMicros: toMicros(body.displayedPriceMicros, 500_000),
    fairPriceMicros: toMicros(body.fairPriceMicros, 500_000),
    toleranceMicros: toMicros(body.toleranceMicros, 20_000),
  });

  const status = result.ok ? 200 : result.configured ? 500 : 503;
  return Response.json(result, { status });
}

function toMicros(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
