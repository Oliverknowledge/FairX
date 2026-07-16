import { CANONICAL_QUOTE_GUARD } from "@/lib/quote-guard/canonical";
import { verifyQuoteGuard } from "@/lib/quote-guard";
import { IntegrationKitError, type ProtectedOrderInput, type ProtectedOrderResult } from "@/lib/integration-kit/types";

function grossPayout(stake: bigint, priceMicros: number): bigint {
  if (!Number.isSafeInteger(priceMicros) || priceMicros <= 0 || priceMicros >= 1_000_000) throw new IntegrationKitError("INVALID_INPUT", "The execution price is outside the supported range");
  return (stake * 1_000_000n) / BigInt(priceMicros);
}
export function evaluateReferenceProtectedOrder(input: ProtectedOrderInput): ProtectedOrderResult {
  if (!input.marketId || input.stakeLamports <= 0n || !Number.isSafeInteger(input.latestMaterialEventSequence) || !Number.isSafeInteger(input.submittedAtMs)) {
    throw new IntegrationKitError("INVALID_INPUT", "The protected order input is invalid");
  }
  const canonical = input.quote.quoteSequence === CANONICAL_QUOTE_GUARD.pre.commitment.quoteSequence
    ? CANONICAL_QUOTE_GUARD.pre
    : input.quote.quoteSequence === CANONICAL_QUOTE_GUARD.post.commitment.quoteSequence
      ? CANONICAL_QUOTE_GUARD.post
      : null;
  if (!canonical) throw new IntegrationKitError("QUOTE_UNVERIFIED", "The quote is not part of the reference evidence set");
  const verification = verifyQuoteGuard(input.quote, canonical.odds, canonical.commitment.oddsHash);
  if (verification.status !== "VERIFIED") throw new IntegrationKitError("QUOTE_UNVERIFIED", "The displayed price does not recompute from the committed TxLINE odds");
  if (input.submittedAtMs > input.quote.expiresAtMs) throw new IntegrationKitError("QUOTE_EXPIRED", "The order arrived after the quote envelope expired");
  if (input.quote.materialEventSequence > input.latestMaterialEventSequence) throw new IntegrationKitError("FUTURE_SEQUENCE", "The order references a future event sequence");
  const principal = input.stakeLamports.toString();
  if (input.quote.materialEventSequence < input.latestMaterialEventSequence) {
    return {
      status: "STALE_SEQUENCE_RETURNED",
      quoteGuard: "VERIFIED",
      principalLamports: principal,
      returnedPrincipalLamports: principal,
      reservedLiabilityLamports: "0",
      reason: "The quote was genuine but its event sequence was old, so principal returned and no liability was created.",
    };
  }
  const price = input.side === "YES" ? input.quote.generatedYesQuoteMicros : input.quote.generatedNoQuoteMicros;
  const liability = grossPayout(input.stakeLamports, price) - input.stakeLamports;
  return {
    status: "ACCEPTED",
    quoteGuard: "VERIFIED",
    principalLamports: principal,
    returnedPrincipalLamports: "0",
    reservedLiabilityLamports: liability.toString(),
    reason: "The quote and event sequences match, so the position opened and its fixed liability was reserved.",
  };
}
