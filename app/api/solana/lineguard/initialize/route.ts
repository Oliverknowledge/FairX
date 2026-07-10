import { initializeOnChainMarket } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const result = await initializeOnChainMarket();
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
