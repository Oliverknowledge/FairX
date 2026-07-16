import { NextResponse } from "next/server";
import { evaluateReferenceProtectedOrder } from "@/lib/integration-kit/reference";
import { IntegrationKitError, type SerializedProtectedOrderInput } from "@/lib/integration-kit/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as SerializedProtectedOrderInput;
    const stakeLamports = BigInt(body.stakeLamports);
    const result = evaluateReferenceProtectedOrder({ ...body, stakeLamports });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof IntegrationKitError) return NextResponse.json({ error: error.code, message: error.message }, { status: 422 });
    return NextResponse.json({ error: "INVALID_INPUT", message: "The protected-order request could not be parsed" }, { status: 400 });
  }
}
