# FairX × TxLINE

FairX uses genuine TxLINE fixture, score, and StablePrice odds responses as its canonical sports-data evidence. The raw response is preserved before deterministic normalization and hashing; the normalized hash is then committed to LineGuard on Solana devnet.

## Network and subscription

- Environment: TxLINE devnet
- API origin: `https://txline-dev.txodds.com`
- API base: `https://txline-dev.txodds.com/api`
- TxLINE program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Solana RPC: `https://api.devnet.solana.com`
- Operator: `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`
- Service level: `1`, World Cup & International Friendlies, free tier
- Duration: four weeks (`subscribe(1, 4)`)
- Subscription transaction: `3gCxJZXZxapQhN9giuVeByJxen8yAqVE69pYLhYgL3vNq3hHBibtj5CJJgTqJdkoeQAyiUtcEHfP48Woj2dsDmm`
- Operator TxL associated account: `Edwv4WDkaBq3e8Yqb5QWjork8Du1nr6BZSvVWAZsred`
- On-chain expiry: `2026-08-07T14:27:11Z`

The transaction combined creation of the operator's Token-2022 TxL associated account and the subscription instruction. It was simulated first, then sent once and finalized.

## Authentication lifecycle

The same operator wallet and devnet environment are used throughout:

1. Subscribe on-chain to service level 1.
2. Request a guest JWT with `POST /auth/guest/start`.
3. Sign the exact activation message with the subscription wallet.
4. Activate with `POST /api/token/activate`.
5. Send the guest JWT and activated API token only from server code.

`TXLINE_JWT`, `TXLINE_API_TOKEN`, and `LINEGUARD_OPERATOR_KEYPAIR` live in the gitignored, mode-0600 `.env.local`. They are never returned by APIs or placed in `NEXT_PUBLIC_*` variables.

## Canonical fixture and endpoints

The capture command queries TxLINE instead of hardcoding a fictional fixture. It selected:

- Fixture: France vs Morocco
- Fixture ID: `18209181`
- Competition: World Cup (`72`)
- Feed designation: France is `Participant1` and home; Morocco is `Participant2`
- Start time: `1783627200000`
- Fixture response timestamp: `1783641600000`
- Fixture endpoint: `/api/fixtures/snapshot`
- Fixture response hash: `22594d12895885e777b8f1e9e469ea0a14e7473c0ea91777956511b092e223ec`

Endpoints used and supported by the server integration:

- `GET /api/fixtures/snapshot`
- `GET /api/scores/snapshot/:fixtureId`
- `GET /api/scores/historical/:fixtureId`
- `GET /api/scores/updates/...`
- `GET /api/scores/stream`
- `GET /api/odds/snapshot/:fixtureId`
- `GET /api/odds/updates/...`
- `GET /api/odds/stream`
- `GET /api/scores/stat-validation`

The score and odds SSE endpoints returned HTTP 200 with `text/event-stream` during the integration audit, but no event arrived during the short quiet-period probes. The canonical label is therefore **TxLINE historical**, never live.

## Score normalization and hashing

The historical score sequence contains adjacent records 738 and 739. Sequence 739 is TxLINE's confirmed France goal record and changes the score from 0–0 to 1–0. FairX preserves TxLINE's `FixtureId`, `Seq`, `Ts`, `Action`, `Participant`, `Stats`, and `Clock` fields without manufacturing a sequence.

- Source endpoint: `/api/scores/historical/18209181`
- Source mode: historical
- Sequence: `739`
- Raw payload hash: `e4701bab0a8d2b8576eef7d2050ad032d3e090315129f51a732c8c6e5f2db598`
- Normalized event hash: `ebd02daad8b04845804c46ebeae892026adf4b37f2b4909952cd9fe80f4b16d5`
- Normalizer: `txline-normalizer-v2`

Hashing uses recursively key-sorted canonical JSON and SHA-256. The normalizer trace records the exact source field for every provenance-critical value.

## Odds and fair-price derivation

The canonical price uses genuine full-match `TXLineStablePriceDemargined` 1X2 records:

- Pre-event endpoint: `/api/odds/updates/20643/21/4?fixtureId=18209181`
- Pre-event France probability: `52.274%` (`522740` micros)
- Post-event endpoint: `/api/odds/updates/20643/21/5?fixtureId=18209181`
- Post-event France probability: `86.505%` (`865050` micros)
- Post-event odds payload hash: `67747c9378b15f9ca0a080a88449d74de9a9d06cc57096c4a063368e23c8512e`
- Derivation: `txline-demargined-pct-v1`
- Model config hash: `b80c573d463f213b5cc7da1178abece152221b5d61b6543c6053296a5a6cfc58`

FairX parses TxLINE's demargined `Pct` value and divides by 100. It does not claim that TxLINE supplied a LineGuard verdict.

## Durable capture

`fixtures/txline/canonical.json` is a versioned, schema-validated capture containing the raw score event, adjacent record, fixture provenance, odds records, normalized event, trace, and hashes. It contains no headers or credentials.

```bash
npm run txline:capture
npm run txline:verify-capture
```

Verification replays the production normalizer and fails if the fixture ID, TxLINE sequence, payload, normalization, or hash is altered.

## TxLINE cryptographic validation

FairX fetched the genuine stat proof for fixture `18209181`, sequence `739`, and stat keys `1,2` from `/api/scores/stat-validation`.

- Method: `validateStatV2`
- Daily scores Merkle-root PDA: `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr`
- Validation payload hash: `a16b46dbdc5f80a62fa102460b9826386fa130e25db2076303ab4a018bd6f809`
- Result: `true` through an on-chain view/simulation against the real TxLINE devnet program

The safe validation record is stored in `fixtures/txline/canonical.validation.json`. Direct CPI was not added to LineGuard: validation is a separately verified step and its fixture, sequence, root, method, stat keys, and payload hash are sealed into the receipt. A direct `ingest_verified_txline_event` CPI remains planned only after a dedicated compute/account-safety review.

## Runtime and fallback

`/api/status` derives authentication, endpoint availability, stream connectivity, last request time, canonical mode, and validation state from real checks or the verified capture. Historical/captured evidence is never labelled live. If authentication or the upstream API is unavailable, the canonical historical artifact remains usable and the separate generated path stays behind **Use offline fallback**.

## Friction and feedback for TxLINE

- Activation requires exact wallet/network continuity; clearer machine-readable activation errors would help.
- Historical score data uses SSE framing even for bounded reads, which should be prominent in endpoint documentation.
- Examples pairing `stat-validation` responses with the exact `validateStatV2` IDL argument conversion would reduce integration time.
- Explicit canonical-hash guidance for API records would make cross-application provenance comparison easier.
