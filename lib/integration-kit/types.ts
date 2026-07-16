import type { QuoteGuardCommitment } from "@/lib/quote-guard";

export type ProtectedOrderStatus = "ACCEPTED" | "STALE_SEQUENCE_RETURNED";
export type IntegrationKitErrorCode = "INVALID_INPUT" | "QUOTE_UNVERIFIED" | "QUOTE_EXPIRED" | "FUTURE_SEQUENCE" | "TRANSPORT_ERROR";

export interface ProtectedOrderInput {
  marketId: string;
  side: "YES" | "NO";
  stakeLamports: bigint;
  quote: QuoteGuardCommitment;
  latestMaterialEventSequence: number;
  submittedAtMs: number;
}
export interface ProtectedOrderResult {
  status: ProtectedOrderStatus;
  quoteGuard: "VERIFIED";
  principalLamports: string;
  returnedPrincipalLamports: string;
  reservedLiabilityLamports: string;
  reason: string;
}

export interface SerializedProtectedOrderInput extends Omit<ProtectedOrderInput, "stakeLamports"> {
  stakeLamports: string;
}

export class IntegrationKitError extends Error {
  constructor(public readonly code: IntegrationKitErrorCode, message: string) {
    super(message);
    this.name = "IntegrationKitError";
  }
}
