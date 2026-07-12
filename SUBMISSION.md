# Superteam submission copy

## 1. Project name

FairX

## 2. One-line description

FairX is a complete on-chain prediction market that protects live settlement from stale-price exploitation.

## 3. Full description

FairX is a Solana devnet prototype that runs the **whole prediction-market settlement loop on-chain**: fill → protect → resolve → pay. Orders escrow into per-market parimutuel pools; when a material sports event reaches TxLINE before a market reprices, LineGuard evaluates every escrowed order independently and refunds only the side exploiting the stale quote; the authority then commits the resolved outcome from the genuine final result, and the winning side is paid its parimutuel share from the ProtocolVault while losers forfeit.

The canonical demo uses genuine France vs Morocco TxLINE fixture, score, and consensus-odds data. FairX preserves and hashes the raw score record, normalizes it deterministically, validates the TxLINE score proof, commits the normalized evidence and market configuration to Solana, escrows two opposite orders, demonstrates selective refund versus ProtocolVault finalization, and — in a companion run — fills both sides, resolves the outcome, and pays the winner a parimutuel payout on devnet.

## 4. Problem

Live sports information and market prices do not update atomically. A goal can reach a fast data feed while a prediction market still displays the old price, allowing bots to submit nearly risk-free orders before repricing. Pausing or cancelling the entire market is blunt: it also harms safe users trading on the side that does not benefit from the lag.

## 5. Solution

LineGuard freezes the quote, side, stake, market configuration, and source-event hash inside each OrderEscrow PDA. It compares `materialSeq` with `pricedAtSeq`, calculates the order’s side-specific stale edge, and applies one of two outcomes:

- positive stale edge above tolerance → `VOIDED_REFUNDED` → stake returned to trader
- no positive stale edge → `STALE_ALLOWED_NO_EDGE` → stake finalized to ProtocolVault and its side pool

This is selective order evaluation, not a market-wide freeze.

**Settlement.** Filled orders accumulate into on-chain `yes_pool` / `no_pool` registers. The authority commits the resolved outcome with `resolve_market` (bound to a normalized final-result hash), and each winning filled order claims its parimutuel share with `settle_order`:

```
payout = stake × total_pool ÷ winning_pool     (parimutuel; losers forfeit)
```

Parimutuel math keeps each market's total payouts equal to its pooled stakes, so the shared ProtocolVault stays solvent.

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
- Parimutuel pools (`yes_pool` / `no_pool`) accumulated on fill
- `resolve_market` resolved-outcome commitment bound to a normalized final-result hash
- `settle_order` parimutuel payout to the winning side from ProtocolVault, with losing stakes forfeited

## 11. What is off-chain

- TxLINE HTTP/SSE transport and server-only credentials
- Raw capture storage and deterministic normalization
- StablePrice probability conversion
- TxLINE `validateStatV2` view/simulation
- Website, discovery, receipt rendering, and browser-side receipt hash verification

## 12. Validation approach

FairX fetched the genuine stat-validation payload for fixture `18209181`, sequence `739`, and stat keys `1,2`. `validateStatV2` returned true against daily scores root PDA `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr` on the real TxLINE devnet program. The validation method, root, stat keys, and validation-payload hash are sealed into both canonical receipts.

TxLINE validation is performed separately before LineGuard ingestion. Direct TxLINE CPI is not implemented or claimed.

## 12b. Settlement evidence (devnet, verifiable)

A complete resolution + parimutuel payout recorded on devnet — seven finalized transactions. YES and NO each staked `0.02 SOL`; the market resolved `YES_WON`; the winner collected the full `0.04 SOL` pool (2×); the losing order forfeited; the vault netted zero (parimutuel pass-through).

- Program upgrade (settlement-v3): `RjdKrMf4s1pdeXJkbjp2rpkMmUDGUBnbYxQjfsEkFeGZfwqtULQ8RSEQTJyUiogxGUgb3pgcd5UGZV7UAsLwBgh` (slot `475735558`)
- Settlement market PDA: `8fXSf5ZE9vd5rSUySoVhK3nwoS3oNYQSKLBWesXrFBN2`
- Resolve outcome tx (`YES_WON`): `2NcQ6JsCNbGwj8oFw7PhNYFapgADPWBYdGbo6WaxJYUq1PHGzE95qvbYKABhmeNwsJQ7bvToGhuwhyjJZ6Rb5e4Z`
- Parimutuel payout tx: `44VBmw5w8iuNAprTFpp6WeRHE9UF8FiDDUqVae5xhk8U3oBgsWVZkMgXKnF7FpUgpsjSCRU6AvANESJqMYf5J9RP`
- ProtocolVault: `HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE`

All seven signatures render with explorer links on `/proof#settlement`. Re-run the full lifecycle in one call: `POST /api/solana/lineguard/full-settlement-demo`. Local proof: `NO_DNA=1 anchor test` includes the parimutuel settlement path (winner paid, loser rejected, double-settle rejected, unauthorized resolve rejected).

## 13. Business and use-case potential

Any live prediction market, sportsbook-style exchange, fantasy contest, or event-driven trading venue can lose trust when fast actors exploit repricing latency. LineGuard can be integrated as a settlement-policy layer without requiring that product to replace its discovery, pricing, or matching system. Potential models include per-market protection fees, protocol integration fees, or enterprise settlement infrastructure.

## 14. Current limitations

- Solana devnet only; no mainnet deployment or real-money operation
- Canonical source is genuine historical TxLINE evidence, not a currently active match
- Direct TxLINE CPI is not implemented
- Authority-controlled LineGuard ingestion and resolution is not a decentralized oracle network
- Settlement is parimutuel (pool-based); there is no continuous AMM or limit-order-book matching engine
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
