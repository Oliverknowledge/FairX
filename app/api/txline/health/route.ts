import { getTxLineHealth } from "@/lib/txline/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sanitized TxLINE config for the browser: mode, network, origin, fixture and
 * credential *presence* booleans. Never the credential values themselves.
 */
export async function GET(): Promise<Response> {
  return Response.json(getTxLineHealth(), { headers: { "Cache-Control": "no-cache" } });
}
