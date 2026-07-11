import { getTxLineServerConfig, hasTxLineCredentials, txLineAuthHeaders, txLineUrl } from "@/lib/txline/config";

/**
 * Server-only proxy helpers used by app/api/txline/* routes. Credentials are
 * attached here and never leave the server.
 */

const MISSING_CREDENTIALS = {
  error: "TxLINE credentials unavailable. Canonical historical evidence remains available.",
  canonicalSourceMode: "historical",
} as const;

export function missingCredentialsResponse(): Response {
  return Response.json(MISSING_CREDENTIALS, { status: 503 });
}

/** Proxy an upstream TxLINE SSE stream, piping bytes through untouched. */
export async function proxyTxLineStream(path: string, req: Request): Promise<Response> {
  const cfg = getTxLineServerConfig();
  if (!hasTxLineCredentials(cfg)) return missingCredentialsResponse();

  const headers: Record<string, string> = {
    ...txLineAuthHeaders(cfg),
    Accept: "text/event-stream",
  };
  const lastEventId = req.headers.get("last-event-id");
  if (lastEventId) headers["Last-Event-ID"] = lastEventId;

  let upstream: Response;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  req.signal.addEventListener("abort", onAbort, { once: true });
  const handshakeTimeout = setTimeout(() => controller.abort(), 8_000);
  try {
    upstream = await fetch(txLineUrl(cfg, path, true), {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(handshakeTimeout);
  } catch {
    clearTimeout(handshakeTimeout);
    return Response.json(
      { error: "TxLINE stream unavailable. Canonical historical evidence remains available." },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: "TxLINE stream authentication or upstream service is unavailable. Canonical historical evidence remains available." },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Proxy a one-shot JSON TxLINE request. */
export async function proxyTxLineJson(path: string): Promise<Response> {
  const cfg = getTxLineServerConfig();
  if (!hasTxLineCredentials(cfg)) return missingCredentialsResponse();

  try {
    const upstream = await fetch(txLineUrl(cfg, path), {
      headers: { ...txLineAuthHeaders(cfg), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) {
      return Response.json(
        { error: "TxLINE authentication or upstream service is unavailable. Canonical historical evidence remains available." },
        { status: 502 },
      );
    }
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return Response.json(
      { error: "TxLINE request unavailable. Canonical historical evidence remains available." },
      { status: 502 }
    );
  }
}
