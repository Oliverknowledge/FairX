import { IntegrationKitError, type ProtectedOrderInput, type ProtectedOrderResult, type SerializedProtectedOrderInput } from "@/lib/integration-kit/types";

export * from "@/lib/integration-kit/types";

export interface SubmitProtectedOrderOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export async function submitProtectedOrder(
  input: ProtectedOrderInput,
  options: SubmitProtectedOrderOptions = {},
): Promise<ProtectedOrderResult> {
  if (!input.marketId || (input.side !== "YES" && input.side !== "NO") || input.stakeLamports <= 0n) {
    throw new IntegrationKitError("INVALID_INPUT", "A market, side and positive stake are required");
  }
  const payload: SerializedProtectedOrderInput = { ...input, stakeLamports: input.stakeLamports.toString() };
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(options.endpoint ?? "/api/integration-kit/reference-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new IntegrationKitError("TRANSPORT_ERROR", "FairX order transport is unavailable");
  }
  const body = await response.json().catch(() => null) as (ProtectedOrderResult | { error?: string; message?: string }) | null;
  if (!response.ok || !body || !("status" in body)) {
    const code = body && "error" in body ? body.error : "TRANSPORT_ERROR";
    const valid = ["INVALID_INPUT", "QUOTE_UNVERIFIED", "QUOTE_EXPIRED", "FUTURE_SEQUENCE", "TRANSPORT_ERROR"].includes(code ?? "") ? code as ConstructorParameters<typeof IntegrationKitError>[0] : "TRANSPORT_ERROR";
    throw new IntegrationKitError(valid, body && "message" in body && body.message ? body.message : "FairX rejected the protected order request");
  }
  return body;
}
