import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyV4Lifecycle } from "@/lib/proof/v4LifecycleVerifier";
import { V4_NOT_RECORDED } from "@/lib/v4/lifecycleEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let verificationInFlight: ReturnType<typeof verifyV4Lifecycle> | undefined;

async function verifyOnceAtATime(record: unknown) {
  if (verificationInFlight) return verificationInFlight;
  const started = verifyV4Lifecycle(record);
  verificationInFlight = started;
  try {
    return await started;
  } finally {
    if (verificationInFlight === started) verificationInFlight = undefined;
  }
}

/** Independent RPC verification of the recorded V4 lifecycle. Read-only; never signs or sends. */
export async function GET(): Promise<Response> {
  let record: unknown;
  try {
    record = JSON.parse(await readFile(resolve(process.cwd(), "fixtures/lineguard/v4-france-morocco-lifecycle.json"), "utf8"));
  } catch {
    record = V4_NOT_RECORDED;
  }
  // A cold verification re-reads 24 transactions. Concurrent page loads share
  // that same fresh run instead of multiplying public-RPC traffic.
  const verification = await verifyOnceAtATime(record);
  const rpcUnknown = verification.status === "UNKNOWN" && verification.recordState === "recorded";
  return Response.json(verification, {
    status: rpcUnknown ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
