import { getTxLineServerConfig, hasTxLineCredentials, txLineAuthHeaders, txLineUrl } from "@/lib/txline/config";

/**
 * Server-only proxy helpers used by app/api/txline/* routes. Credentials are
 * attached here and never leave the server.
 */

const MISSING_CREDENTIALS = {
  error: "TxLINE credentials missing — running in sandbox mode.",
  demoMode: true,
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
  try {
    upstream = await fetch(txLineUrl(cfg, path), {
      headers,
      cache: "no-store",
      signal: req.signal, // browser disconnect aborts the upstream fetch
    });
  } catch (err) {
    return Response.json(
      { error: `TxLINE unreachable: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => "");
    return Response.json(
      { error: `TxLINE upstream ${upstream.status}`, detail: body.slice(0, 500) },
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
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return Response.json(
      { error: `TxLINE unreachable: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
