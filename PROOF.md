# FairX Devnet Proof

Last audited: 10 July 2026.

## Fresh versus canonical

- **Fresh proof generated now** means the server runtime check passed and a new transaction sequence was executed during this session.
- **Canonical verified proof** means the recorded devnet accounts and signatures below. It is the fallback when operator balance, RPC, or deployed schema prevents a fresh run.

The public UI does not label canonical evidence as fresh.

## Program

- Program ID: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`
- ProgramData: `D6buB3VxXnxX3jXjPX5HCqRAMJqtV4yLzaKuMra17nPT`
- Upgrade authority: `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`
- Current audited upgrade slot: `475252011`
- Current audited upgrade transaction: `3z7S9vVxh1CDWw3b3qYap1m7CSxXuciMdDSXujzxLEudP1YP6YyTx4NhKNrH2xfTYUJngENE3y5tR5sKFg92fw49`
- Upgrade time: `2026-07-10T08:39:55Z`

The audited deployed binary contains the event-hash and ProtocolVault behavior. The checked-in program and IDL also contain MarketConfig v2; `/api/status` reports `event-hash-v1` until that larger binary is deployed.

## ProtocolVault

- PDA: `HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE`
- Audited balance: `21,287,600` lamports
- Total finalized: `20,000,000` lamports
- Fill count: `1`
- Last finalization: `5m7rcQYWn55s1qDJqLcwEG3Y6aYMDSqMSukX9N5E9muX75LB3wABMgPstwbD4i2zChV3mWK5aohcy7zGKFhpBx6g`

Devnet funds only.

## Source event hash

Normalized event hash committed by the authority:

```text
f6f38ccc42718c0f063908bdf8c6244b135971e55a592c93dd6c2748ed2f6b97
```

The canonical event is a guided TxLINE-shaped goal scenario. It is not presented as a live TxLINE connection.

## YES — refunded to trader

- Market PDA: `HvfPZpLz5Sym6LSKQtKoATJ8VaAv9KmbjdLEjHuAzt8C`
- OrderEscrow PDA: `FGHuTa2YtoBDkQY31V5iCQQiyNcLhJfsbQFJcRxPRXhB`
- `materialSeq 2 > pricedAtSeq 1`
- observed YES `400000`, fair YES `630000`, edge `+230000` micros
- verdict: `VOIDED_REFUNDED`
- destination: `REFUNDED_TO_TRADER`

Transactions:

1. Initialize: `5cMHjD3JkzkJgfStJhrQtoMLozcgNrV7jcnDKnLtcqEQSivwU8T24evuNNsEM2FRWpNFW27zFTwWumF3YaWpgLif`
2. Ingest: `5dfrQNRyxvLN8YyFEcGWVxPfZT4bebRuc1cnNjyi6EFjVvoQjmjnM5Cdkd3Xj4B4eb5EFUB427W9AT1v44odWeY8`
3. Place: `WBWBHmktP5HzL3YNtAJ5Zt3J8xPVWV6kRA1XRmde2vSfxksPHJDwtewX5rAFvrBF1573s5FsWR7vaLNDiW8H3Bs`
4. Evaluate/refund: `2tR13kJbCS4K75f2UFiLEExgsDdoRo26B8Q7tZGhEhWwiAtDJkaQcGerJiQ3GEzqdxKvs8NWc4Rkqe6oXHuCNcH2`

## NO — finalized to ProtocolVault

- Market PDA: `6JWmWT8Nf5Z3hRKspaAZY7oG9y195E6NhPCFDk6uqQ3K`
- OrderEscrow PDA: `D8ac76DsU7gusDRcGnD9eFsttLteFgc89nWHKTHe6vzu`
- observed NO `600000`, fair NO `370000`, edge `-230000` micros
- verdict: `STALE_ALLOWED_NO_EDGE`
- destination: `FINALIZED_TO_VAULT`

Transactions:

1. Initialize: `648msqkbBW9F18xKWcTxvaBN9r1eTU7yBVip3zhfvXndNui4Bec7rBookL1AtdgNXbpofoWi2JCkugrpMPPwRPRc`
2. Ingest: `4YN6XVNmGkvjLvrGGw3VdQmULL5CxC5KMfjFb4MsCh17PtFTDxGUuS2NzPvKTdDsVQquL31xaaNs6FrLMDinqXyq`
3. Place: `3jodiyLyHLgQ2ABUoSnzXwxTx3rmVAQTk6aRiD9mjX6fYV2Paov2t19WKPehRthi7ue4ty9CMQwPnFemec4E89uM`
4. Evaluate/finalize: `5m7rcQYWn55s1qDJqLcwEG3Y6aYMDSqMSukX9N5E9muX75LB3wABMgPstwbD4i2zChV3mWK5aohcy7zGKFhpBx6g`

## Custom market proof

Custom-market initialization and order routes exist and were verified on devnet against the event-hash deployment. MarketConfig hashes are not attached to a current canonical custom proof because the MarketConfig-capable program upgrade is pending. Generate a fresh custom proof after `/api/status` reports `market-config-v2`.

## Verify a receipt

Open `/proof`, select the canonical receipt, then inspect `/verify/<receipt-id>`. The verifier recomputes the receipt hash in the browser. Changing a sealed event hash, config hash, verdict, destination, or transaction field causes verification failure.
