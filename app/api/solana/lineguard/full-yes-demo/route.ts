import { runFullOnChainDemo } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const result = await runFullOnChainDemo("YES");
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
