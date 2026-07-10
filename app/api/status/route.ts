import { getFairXRuntimeStatus } from "@/lib/status/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(await getFairXRuntimeStatus(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
