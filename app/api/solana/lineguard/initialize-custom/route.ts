import { initializeCustomOnChainMarket } from "@/lib/solana/lineguardServer";
import { isFairXMarketType } from "@/lib/markets/fairx";
import { requireOperatorApiAuthorization } from "@/lib/server/operatorApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const denied = requireOperatorApiAuthorization(req);
  if (denied) return denied;
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
  const marketType = isFairXMarketType(body.marketType) ? body.marketType : null;
  const marketTitle = typeof body.marketTitle === "string" ? body.marketTitle.trim() : "";
  const fixtureId = typeof body.fixtureId === "string" ? body.fixtureId.trim() : `custom:${marketId}`;
  if (!marketType || !marketTitle) {
    return Response.json({ ok: false, reason: "marketType and marketTitle are required for the on-chain config commitment." }, { status: 400 });
  }

  const result = await initializeCustomOnChainMarket({
    marketId,
    marketType,
    marketTitle,
    fixtureId,
    materialityRules: parseMaterialityRules(body.materialityRules),
    backedTeam: typeof body.backedTeam === "string" ? body.backedTeam : undefined,
    awayTeam: typeof body.awayTeam === "string" ? body.awayTeam : undefined,
    targetSide: typeof body.targetSide === "string" ? body.targetSide : undefined,
    displayedPriceMicros: toMicros(body.displayedPriceMicros, 500_000),
    fairPriceMicros: toMicros(body.fairPriceMicros, 500_000),
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
