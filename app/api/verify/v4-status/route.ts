import "server-only";
import { fetchV4DeploymentStatus } from "@/lib/v4/deploymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live, read-only devnet deployment status for the V4 program. Never signs or sends. */
export async function GET(): Promise<Response> {
  const status = await fetchV4DeploymentStatus();
  return Response.json(status, {
    status: status.phase === "UNKNOWN" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
