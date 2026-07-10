import { getTxLineServerConfig } from "@/lib/txline/config";
import { proxyTxLineJson } from "@/lib/txline/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-shot scores snapshot proxy (used by the proof panel's validation probe). */
export async function GET(): Promise<Response> {
  return proxyTxLineJson(getTxLineServerConfig().scoresSnapshotPath);
}
