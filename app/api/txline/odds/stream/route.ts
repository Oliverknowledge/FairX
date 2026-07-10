import { getTxLineServerConfig } from "@/lib/txline/config";
import { proxyTxLineStream } from "@/lib/txline/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE proxy: browser ⇄ this route ⇄ TxLINE odds stream (credentials server-side only). */
export async function GET(req: Request): Promise<Response> {
  return proxyTxLineStream(getTxLineServerConfig().oddsStreamPath, req);
}
