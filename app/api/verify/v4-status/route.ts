import "server-only";
import { fetchV4DeploymentStatus } from "@/lib/v4/deploymentStatus";
import { privateRpcConfigured } from "@/lib/proof/serverRpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live, read-only devnet deployment status for the V4 program. Never signs or sends. */
export async function GET(): Promise<Response> {
  const status = await fetchV4DeploymentStatus();
  const { rpcUrl: _privateRpcUrl, ...safe } = status;
  return Response.json({ ...safe, privateRpcConfigured: privateRpcConfigured() }, {
    status: status.phase === "UNKNOWN" ? 503 : 200,
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
