import { runCustomOnChainOrder } from "@/lib/solana/lineguardServer";
import { isFairXMarketType } from "@/lib/markets/fairx";

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
  const marketType = isFairXMarketType(body.marketType) ? body.marketType : null;
  const marketTitle = typeof body.marketTitle === "string" ? body.marketTitle.trim() : "";
  const fixtureId = typeof body.fixtureId === "string" ? body.fixtureId.trim() : `custom:${marketId}`;
  if (!marketType || !marketTitle) {
    return Response.json({ ok: false, reason: "marketType and marketTitle are required for the on-chain config commitment." }, { status: 400 });
  }

  const result = await runCustomOnChainOrder({
    marketId,
    side,
    marketType,
    marketTitle,
    fixtureId,
    materialityRules: parseMaterialityRules(body.materialityRules),
    backedTeam: typeof body.backedTeam === "string" ? body.backedTeam : undefined,
    targetSide: typeof body.targetSide === "string" ? body.targetSide : undefined,
    displayedPriceMicros: toMicros(body.displayedPriceMicros, 500_000),
    fairPriceMicros: body.fairPriceMicros !== undefined ? toMicros(body.fairPriceMicros, 500_000) : undefined,
    toleranceMicros: toMicros(body.toleranceMicros, 20_000),
  });

  const status = result.ok ? 200 : result.configured ? 500 : 503;
  return Response.json(result, { status });
}

function parseMaterialityRules(value: unknown) {
  const rules = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    goals: rules.goals === true,
    redCards: rules.redCards === true,
    penalties: rules.penalties === true,
    oddsUpdates: rules.oddsUpdates === true,
  };
}

function toMicros(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
