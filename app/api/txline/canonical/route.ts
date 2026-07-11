import canonicalCapture from "@/fixtures/txline/canonical.json";
import canonicalValidation from "@/fixtures/txline/canonical.validation.json";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return Response.json({ capture: canonicalCapture, validation: canonicalValidation }, {
    headers: { "Cache-Control": "public, max-age=300, immutable" },
  });
}
