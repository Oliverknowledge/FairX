import { parseSide, placeOnChainOrder } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { side?: unknown };
  const result = await placeOnChainOrder(parseSide(body.side));
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
