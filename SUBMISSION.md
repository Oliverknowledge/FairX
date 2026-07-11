# Superteam submission copy

## 1. Project name

FairX

## 2. One-line description

FairX protects live prediction markets from stale-price exploitation.

## 3. Full description

FairX is a Solana devnet prototype for fair execution in live prediction markets. When a material sports event reaches TxLINE before a market reprices, LineGuard evaluates every escrowed order independently. Orders that benefit from the stale quote are refunded, while trades that gain no advantage from the lag are allowed to settle.

The canonical demo uses genuine France vs Morocco TxLINE fixture, score, and consensus-odds data. FairX preserves and hashes the raw score record, normalizes it deterministically, validates the TxLINE score proof, commits the normalized evidence and market configuration to Solana, escrows two opposite orders, and demonstrates selective refund versus ProtocolVault finalization.

## 4. Problem

Live sports information and market prices do not update atomically. A goal can reach a fast data feed while a prediction market still displays the old price, allowing bots to submit nearly risk-free orders before repricing. Pausing or cancelling the entire market is blunt: it also harms safe users trading on the side that does not benefit from the lag.

## 5. Solution

LineGuard freezes the quote, side, stake, market configuration, and source-event hash inside each OrderEscrow PDA. It compares `materialSeq` with `pricedAtSeq`, calculates the order’s side-specific stale edge, and applies one of two outcomes:

- positive stale edge above tolerance → `VOIDED_REFUNDED` → stake returned to trader
- no positive stale edge → `STALE_ALLOWED_NO_EDGE` → stake finalized to ProtocolVault

This is selective order evaluation, not a market-wide freeze.

## 6. Why TxLINE

LineGuard needs low-latency evidence that a material sports event occurred and a transparent fair-price input. TxLINE supplies genuine fixture discovery, score sequences, historical/stream data, consensus StablePrice odds, and a Merkle-proof validation path. That lets FairX connect a real sports-data record to an auditable Solana settlement decision.

## 7. Technical architecture

TxLINE response → versioned raw capture → canonical JSON/SHA-256 → deterministic normalizer → `validateStatV2` proof check → normalized source hash → LineGuard `MarketState` + `MarketConfig` → `OrderEscrow` → edge verdict → trader refund or ProtocolVault finalization → tamper-evident receipt.

## 8. Specific TxLINE endpoints used

- `GET /api/fixtures/snapshot`
- `GET /api/scores/historical/18209181`
- `GET /api/odds/updates/20643/21/4?fixtureId=18209181`
- `GET /api/odds/updates/20643/21/5?fixtureId=18209181`
- `GET /api/scores/stat-validation?fixtureId=18209181&seq=739&statKeys=1,2`
- Supported/health-checked: score and odds snapshot/stream endpoints

## 9. Solana program ID

LineGuard devnet: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`

TxLINE devnet: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`

## 10. On-chain functionality

- Market freshness registers and fair/displayed price state
- MarketConfig commitments for fixture, title, materiality, and settlement rules
- Source-event hash commitment
- Per-order escrow custody in PDAs
- Deterministic side-specific stale-edge calculation
- `VOIDED_REFUNDED` trader refund
- `STALE_ALLOWED_NO_EDGE` ProtocolVault finalization
- Guard verdict events and settlement-destination state

## 11. What is off-chain

- TxLINE HTTP/SSE transport and server-only credentials
- Raw capture storage and deterministic normalization
- StablePrice probability conversion
- TxLINE `validateStatV2` view/simulation
- Website, discovery, receipt rendering, and browser-side receipt hash verification

## 12. Validation approach

FairX fetched the genuine stat-validation payload for fixture `18209181`, sequence `739`, and stat keys `1,2`. `validateStatV2` returned true against daily scores root PDA `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr` on the real TxLINE devnet program. The validation method, root, stat keys, and validation-payload hash are sealed into both canonical receipts.

TxLINE validation is performed separately before LineGuard ingestion. Direct TxLINE CPI is not implemented or claimed.

## 13. Business and use-case potential

Any live prediction market, sportsbook-style exchange, fantasy contest, or event-driven trading venue can lose trust when fast actors exploit repricing latency. LineGuard can be integrated as a settlement-policy layer without requiring that product to replace its discovery, pricing, or matching system. Potential models include per-market protection fees, protocol integration fees, or enterprise settlement infrastructure.

## 14. Current limitations

- Solana devnet only; no mainnet deployment or real-money operation
- Canonical source is genuine historical TxLINE evidence, not a currently active match
- Direct TxLINE CPI is not implemented
- Authority-controlled LineGuard ingestion is not a decentralized oracle network
- No complete AMM, order book, or counterparty matching engine
- No independent production security audit

## 15. TxLINE feedback

- Publish more end-to-end examples pairing `stat-validation` JSON with exact `validateStatV2` IDL argument conversion.
- Make historical SSE framing explicit in endpoint documentation.
- Provide machine-readable activation errors and canonical API-record hashing guidance.
- Document expected JWT renewal/expiry behavior alongside token activation.

## 16. Public app link

`[PUBLIC_APP_URL]`

## 17. GitHub link

`[GITHUB_REPOSITORY_URL]`

## 18. Video link

`[DEMO_VIDEO_URL]`
