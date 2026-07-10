import { getOnChainState, parseSide } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const side = parseSide(new URL(req.url).searchParams.get("side"));
  return Response.json(await getOnChainState(side), { headers: { "Cache-Control": "no-cache" } });
}
