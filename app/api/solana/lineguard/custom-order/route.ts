import { runCustomOnChainOrder } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // handled by the marketId check below
  }

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  const side = body.side === "NO" ? "NO" : "YES";
  if (!marketId) {
    return Response.json({ ok: false, reason: "A marketId is required to place a custom devnet order." }, { status: 400 });
  }

  const result = await runCustomOnChainOrder({
    marketId,
    side,
    displayedPriceMicros: toMicros(body.displayedPriceMicros, 500_000),
    fairPriceMicros: body.fairPriceMicros !== undefined ? toMicros(body.fairPriceMicros, 500_000) : undefined,
    toleranceMicros: toMicros(body.toleranceMicros, 20_000),
  });

  const status = result.ok ? 200 : result.configured ? 500 : 503;
  return Response.json(result, { status });
}

function toMicros(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
