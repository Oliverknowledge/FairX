import "server-only";
import { after } from "next/server";
import { currentV4VerificationResponse, refreshV4Verification, v4VerificationIsInFlight } from "@/lib/proof/v4VerificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Independent RPC verification of the recorded V4 lifecycle. Read-only; never signs or sends. */
export async function GET(request: Request): Promise<Response> {
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (force) {
    const response = await refreshV4Verification();
    const unavailable = response.latestAttempt?.status === "UNKNOWN" && !response.verification;
    return Response.json(response, {
      status: unavailable ? 503 : 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const response = currentV4VerificationResponse();
  if (response.cache.stale && !v4VerificationIsInFlight()) after(() => refreshV4Verification());
  return Response.json(response, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" },
  });
}
