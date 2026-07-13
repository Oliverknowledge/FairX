import { repriceOnChainMarket } from "@/lib/solana/lineguardServer";
import { requireOperatorApiAuthorization } from "@/lib/server/operatorApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const denied = requireOperatorApiAuthorization(req);
  if (denied) return denied;
  const result = await repriceOnChainMarket();
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
