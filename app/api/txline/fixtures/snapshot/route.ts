import { getTxLineServerConfig } from "@/lib/txline/config";
import { proxyTxLineJson } from "@/lib/txline/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return proxyTxLineJson(getTxLineServerConfig().fixturesSnapshotPath);
}
