import { getTxLineServerConfig } from "@/lib/txline/config";
import { proxyTxLineStream } from "@/lib/txline/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ fixtureId: string }> }): Promise<Response> {
  const { fixtureId } = await context.params;
  if (!/^\d+$/.test(fixtureId)) return Response.json({ error: "Invalid fixture ID" }, { status: 400 });
  return proxyTxLineStream(`${getTxLineServerConfig().scoresHistoricalPath}/${fixtureId}`, request);
}
