# FairX IntegrationKit

IntegrationKit is the smallest reference contract for putting FairX behind another market frontend. It does not create another exchange.

```ts
const result = await submitProtectedOrder({
  marketId,
  side: "YES",
  stakeLamports: 10_000_000n,
  quote: displayedQuote,
  latestMaterialEventSequence,
  submittedAtMs: Date.now(),
});
```

## Inputs

- `marketId`: the operator's market identifier.
- `side`: `YES` or `NO`.
- `stakeLamports`: positive order principal.
- `quote`: a complete QuoteGuard commitment containing fixture, TxLINE snapshot identity, deterministic price, sequence, timestamp and expiry.
- `latestMaterialEventSequence`: the event sequence the operator currently considers executable.
- `submittedAtMs`: order submission time used for expiry checking.

## Outputs

- `ACCEPTED`: the quote is verified and synchronized. The response includes the exact liability reserved for the position.
- `STALE_SEQUENCE_RETURNED`: the quote itself is genuine but its event sequence is old. The full principal is returned and no position liability is created.

Both responses include `quoteGuard: "VERIFIED"`, principal, returned principal, reserved liability and a plain-English reason.

## Errors

- `INVALID_INPUT`: malformed market, amount, sequence or time.
- `QUOTE_UNVERIFIED`: the price or its TxLINE commitment does not recompute.
- `QUOTE_EXPIRED`: the order arrived outside the quote envelope.
- `FUTURE_SEQUENCE`: the quote refers to an event sequence the market has not reached.
- `TRANSPORT_ERROR`: the adapter could not reach or parse the operator endpoint.

## Reference boundary

`/api/integration-kit/reference-order` is deliberately a **no-send adapter** over the recorded France–Morocco V4 evidence. It proves the frontend contract and both result branches without asking a wallet to sign or pretending to submit a new transaction. A production operator adapter would construct and submit the existing V4 instructions, then map the finalized program outcome into the same two statuses.
