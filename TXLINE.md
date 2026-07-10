# TxLINE Integration

TxLINE is the intended low-latency event and odds source for LineGuard. Its transport and normalization run off-chain; the event evidence hash is what crosses the on-chain authority boundary.

## Endpoints used by the implementation

Default origin from `lib/txline/config.ts`:

```text
https://txline-dev.txodds.com
```

Default paths:

```text
GET /scores/stream
GET /odds/stream
GET /scores/snapshot
```

FairX proxies them through server routes so credentials never enter the browser:

```text
GET /api/txline/scores/stream
GET /api/txline/odds/stream
GET /api/txline/scores/snapshot
GET /api/txline/health
```

All origin and path values can be overridden by server environment variables. The UI reads the sanitized resolved origin/paths from `/api/status`; it does not invent endpoint names.

## Payloads and normalization

The integration accepts scores and odds payloads as untrusted JSON. `lib/txline/normalize.ts` extracts a monotonic sequence, timestamp, event type, fixture, team/player/minute fields, and records the exact fields/method used. Unknown event types do not stale-lock a market.

Two deterministic hashes are generated:

- raw event hash: canonical JSON of the received payload
- normalized event hash: provenance-relevant normalized fields

The normalized hash used for the guard is committed to `MarketState.source_event_hash` by the market authority. Receipts seal both hashes where available.

## Provenance modes

- **Live TxLINE**: only after credentials exist and the actual stream/health request succeeds.
- **Captured TxLINE event**: a previously received or manually provided payload replayed through the same normalizer.
- **Historical TxLINE replay**: an explicitly historical payload.
- **Guided scenario**: FairX-generated controlled evidence; never labelled live.
- **Unconfigured**: no live credentials/working connection; captured and guided paths remain available.

The current canonical proof uses a guided TxLINE-shaped goal scenario, not a live production feed.

## Production environment

```text
TXLINE_API_ORIGIN
TXLINE_JWT
TXLINE_API_TOKEN
TXLINE_FIXTURE_ID
TXLINE_NETWORK
TXLINE_SCORES_STREAM_PATH
TXLINE_ODDS_STREAM_PATH
TXLINE_SCORES_SNAPSHOT_PATH
```

At least one supported credential is required to attempt live mode. Secret values are server-only and must never use `NEXT_PUBLIC_`.

## Friction and feedback

- Payload field names vary enough that normalizer traces must remain visible.
- A configured credential is not proof of a healthy stream; connection state must be checked separately.
- A stable fixture identifier and monotonic event sequence are essential for safe market freshness updates.
- Explicit signed event identifiers or a canonical payload-hash recipe would reduce integration ambiguity.

## Future CPI path

A future program version may call a TxLINE `validate_stat` CPI before accepting an event. That path is planned, not implemented. The current program uses an operator-controlled authority and commits the supplied non-zero event hash.
