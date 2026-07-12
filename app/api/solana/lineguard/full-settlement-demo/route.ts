import { runSettlementDemo } from "@/lib/solana/lineguardServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(): Promise<Response> {
  const result = await runSettlementDemo();
  return Response.json(result, { status: result.ok ? 200 : result.configured ? 500 : 503 });
}
