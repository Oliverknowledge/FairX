import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyV3Lifecycle } from "@/lib/proof/v3LifecycleVerifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let record: unknown;
  try {
    record = JSON.parse(await readFile(resolve(process.cwd(), "fixtures/lineguard/v3-france-morocco-three-wallet.json"), "utf8"));
  } catch {
    record = undefined;
  }
  const verification = await verifyV3Lifecycle(record);
  return Response.json(verification, {
    status: verification.status === "UNKNOWN" && !record ? 404 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
