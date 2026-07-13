import { timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

export function requireOperatorApiAuthorization(req: Request): Response | null {
  const expected = process.env.LINEGUARD_OPERATOR_API_TOKEN?.trim();
  if (!expected || expected.length < MIN_TOKEN_LENGTH) {
    return Response.json(
      { ok: false, code: "OPERATOR_API_DISABLED", reason: "Server-signed operator mutations are disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  const authorized = expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
  if (!authorized) {
    return Response.json(
      { ok: false, code: "UNAUTHORIZED", reason: "This route is restricted to the offline operator workflow." },
      { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } }
    );
  }
  return null;
}
