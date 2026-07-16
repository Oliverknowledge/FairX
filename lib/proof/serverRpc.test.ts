import { describe, expect, it, vi } from "vitest";
import { createResilientRpcFetch, type RpcTransportMetrics } from "@/lib/proof/serverRpc";

describe("server RPC transport", () => {
  it("respects Retry-After on 429 and retries a bounded number of times", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const metrics: RpcTransportMetrics = { httpRequests: 0, retries: 0, rateLimits: 0 };
    const resilient = createResilientRpcFetch({ fetchImpl, sleep, metrics, random: () => 0, maxAttempts: 3 });
    const response = await resilient("https://rpc.invalid", { method: "POST" });
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
    expect(metrics).toEqual({ httpRequests: 2, retries: 1, rateLimits: 1 });
  });

  it("stops after the configured bound", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));
    const resilient = createResilientRpcFetch({ fetchImpl, sleep: async () => undefined, random: () => 0, maxAttempts: 2 });
    expect((await resilient("https://rpc.invalid")).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
