import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyV3Lifecycle } from "@/lib/proof/v3LifecycleVerifier";
import { createServerRpcConnection, privateRpcConfigured, serverRpcUrl, type RpcTransportMetrics } from "@/lib/proof/serverRpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicV3Result = Omit<Awaited<ReturnType<typeof verifyV3Lifecycle>>, "rpcUrl"> & {
  privateRpcConfigured: boolean;
  durationMs: number;
  rpcRequestCount: number;
};

let verificationInFlight: Promise<PublicV3Result> | undefined;

async function verifyOnceAtATime(record: unknown): Promise<PublicV3Result> {
  if (verificationInFlight) return verificationInFlight;
  const started = (async () => {
    const start = Date.now();
    const metrics: RpcTransportMetrics = { httpRequests: 0, retries: 0, rateLimits: 0 };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("V3 verification timed out")), 30_000);
    try {
      const rpcUrl = serverRpcUrl();
      const connection = createServerRpcConnection({ rpcUrl, signal: controller.signal, metrics });
      const privateRpc = privateRpcConfigured();
      const verification = await verifyV3Lifecycle(record, rpcUrl, {
        connection,
        transactionBatchSize: privateRpc ? 8 : 1,
        transactionBatchPaceMs: privateRpc ? 0 : 500,
      });
      const { rpcUrl: _privateRpcUrl, ...safe } = verification;
      return { ...safe, privateRpcConfigured: privateRpcConfigured(), durationMs: Date.now() - start, rpcRequestCount: metrics.httpRequests };
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  })();
  verificationInFlight = started;
  try {
    return await started;
  } finally {
    if (verificationInFlight === started) verificationInFlight = undefined;
  }
}

export async function GET(): Promise<Response> {
  let record: unknown;
  try {
    record = JSON.parse(await readFile(resolve(process.cwd(), "fixtures/lineguard/v3-france-morocco-three-wallet.json"), "utf8"));
  } catch {
    record = undefined;
  }
  try {
    const verification = await verifyOnceAtATime(record);
    return Response.json(verification, {
      status: verification.status === "UNKNOWN" && !record ? 404 : 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return Response.json({
      status: "UNKNOWN",
      checkedAt: new Date().toISOString(),
      checks: [],
      summary: { verified: 0, failed: 0, unknown: 1 },
      privateRpcConfigured: privateRpcConfigured(),
      durationMs: 30_000,
      rpcRequestCount: 0,
      message: error instanceof Error ? error.message : String(error),
    }, { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
