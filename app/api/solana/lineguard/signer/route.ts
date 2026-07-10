import { getSignerInfo } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(await getSignerInfo(), { headers: { "Cache-Control": "no-cache" } });
}
