import { Connection } from "@solana/web3.js";

export const PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";

export interface RpcTransportMetrics {
  httpRequests: number;
  retries: number;
  rateLimits: number;
}

export interface ResilientFetchOptions {
  requestTimeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  metrics?: RpcTransportMetrics;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function combinedAbortSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("RPC request timed out")), timeoutMs);
  const abort = () => controller.abort(parent?.reason ?? new Error("RPC verification aborted"));
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

/** Server-side JSON-RPC transport with bounded timeout, Retry-After support and jittered backoff. */
export function createResilientRpcFetch(options: ResilientFetchOptions = {}): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const metrics = options.metrics;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? 350);
  const requestTimeoutMs = Math.max(250, options.requestTimeoutMs ?? 8_000);

  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let lastResponse: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const abort = combinedAbortSignal(options.signal, requestTimeoutMs);
      try {
        if (metrics) metrics.httpRequests += 1;
        const response = await fetchImpl(input, { ...init, signal: abort.signal });
        lastResponse = response;
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxAttempts - 1) return response;
        if (metrics) {
          metrics.retries += 1;
          if (response.status === 429) metrics.rateLimits += 1;
        }
        const serverDelay = retryAfterMs(response);
        const jitter = Math.floor(random() * baseDelayMs);
        await sleep(Math.min(serverDelay ?? baseDelayMs * 2 ** attempt + jitter, 4_000));
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted || attempt === maxAttempts - 1) throw error;
        if (metrics) metrics.retries += 1;
        await sleep(Math.min(baseDelayMs * 2 ** attempt + Math.floor(random() * baseDelayMs), 4_000));
      } finally {
        abort.clear();
      }
    }
    if (lastResponse) return lastResponse;
    throw lastError instanceof Error ? lastError : new Error("RPC request failed");
  }) as typeof fetch;
}

export function serverRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? PUBLIC_DEVNET_RPC;
}

export function privateRpcConfigured(): boolean {
  return Boolean(process.env.SOLANA_RPC_URL && process.env.SOLANA_RPC_URL !== PUBLIC_DEVNET_RPC);
}

export function createServerRpcConnection(options: ResilientFetchOptions & { rpcUrl?: string } = {}) {
  return new Connection(options.rpcUrl ?? serverRpcUrl(), {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
    fetch: createResilientRpcFetch(options),
  });
}
