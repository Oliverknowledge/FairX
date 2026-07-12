# Superteam submission copy

## 1. Project name

FairX

## 2. One-line description

FairX is a complete on-chain prediction market that protects live settlement from stale-price exploitation.

## 3. Full description

FairX is a Solana devnet prototype that runs the prediction-market custody and settlement loop on-chain: fill → protect → resolve → pay. Orders escrow into per-market parimutuel pools; LineGuard selectively refunds stale-price exploitation, deterministically maps submitted scores to the configured result, and pays the winning side from the ProtocolVault.

The canonical demo uses genuine France vs Morocco TxLINE fixture, score, and consensus-odds data. FairX preserves and hashes the raw score record, normalizes it deterministically, validates the TxLINE score proof, commits the normalized evidence and market configuration to Solana, escrows two opposite orders, demonstrates selective refund versus ProtocolVault finalization, and — in a companion run — fills both sides, resolves the outcome, and pays the winner a parimutuel payout on devnet.

## 4. Problem

Live sports information and market prices do not update atomically. A goal can reach a fast data feed while a prediction market still displays the old price, allowing bots to submit nearly risk-free orders before repricing. Pausing or cancelling the entire market is blunt: it also harms safe users trading on the side that does not benefit from the lag.

## 5. Solution

LineGuard freezes the quote, side, stake, market configuration, and source-event hash inside each OrderEscrow PDA. It compares `materialSeq` with `pricedAtSeq`, calculates the order’s side-specific stale edge, and applies one of two outcomes:

- positive stale edge above tolerance → `VOIDED_REFUNDED` → stake returned to trader
- no positive stale edge → `STALE_ALLOWED_NO_EDGE` → stake finalized to ProtocolVault and its side pool

This is selective order evaluation, not a market-wide freeze.

**Settlement (root-bound, operator-submitted scores).** `MarketConfig` commits the supported `HOME_TEAM_WINS` rule, the home/away teams, and stat keys. `submit_txline_validation` reads that config, binds submitted scores to the genuine TxLINE root account identity, and derives the result. A draft may be replaced before `confirm_validation`; only a confirmed receipt can be resolved, and the resolver takes no outcome argument. Each winning filled order claims its parimutuel share with `settle_order`:

```
payout = stake × total_pool ÷ winning_pool     (parimutuel; losers forfeit)
```

If the validated winning side has no filled stake the market is `VoidedNoWinningPool` and every order reclaims its exact stake via `refund_voided_order` (with an `emergency_void_market` path for abandoned fixtures). `close_market` gates trading (no fills after close, no resolution before close), and per-market accounting enforces `total_in = paid + refunded + remaining`, so one market can never draw on another's pool.

> FairX derives the market outcome on-chain from submitted scores bound to a genuine TxLINE Merkle-root account. The score proof is validated separately through TxLINE `validateStatV2`; direct CPI or in-program Merkle verification remains future work.

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
- `MarketConfig` rule, team mapping, and stat-key commitments for `MATCH_WINNER_HOME`
- replaceable validation draft, immutable confirmation, genuine-root identity check, and deterministic score mapping
- `resolve_market_from_txline` accepts no arbitrary outcome argument
- `settle_order` parimutuel payout to the winning side from ProtocolVault, with losing stakes forfeited
- `VoidedNoWinningPool` + `refund_voided_order` exact-stake reclaim, and `emergency_void_market` for abandoned fixtures
- `close_market` trading-close gating and per-market accounting (`total_in = paid + refunded + remaining`)

## 11. What is off-chain

- TxLINE HTTP/SSE transport and server-only credentials
- Raw capture storage and deterministic normalization
- StablePrice probability conversion
- TxLINE `validateStatV2` view/simulation
- Website, discovery, receipt rendering, and browser-side receipt hash verification

## 12. Validation approach

FairX fetched the genuine stat-validation payload for fixture `18209181`, sequence `739`, and stat keys `1,2`. `validateStatV2` returned true against daily scores root PDA `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr` on the real TxLINE devnet program. The validation method, root, stat keys, and validation-payload hash are sealed into both canonical receipts.

TxLINE validation is performed separately before LineGuard ingestion. Direct TxLINE CPI is not implemented or claimed.

## 12b. Unified-lifecycle evidence (devnet, verifiable)

The recorded lifecycle below is settlement-v4 evidence. Settlement-v5 source now adds machine-readable rule/team/stat-key binding and validation confirmation, but that program upgrade has not been performed.

One market runs the whole loop in **13 finalized transactions**: a stale exploit is refunded, the market reprices, valid YES + NO orders fill both pools, trading closes, the genuine TxLINE final result is bound on-chain, the outcome is **derived** (`1–0 ⇒ YES`), and the winner is paid `0.04 SOL` (2×). `total_in = paid + refunded + remaining` (`0.04 = 0.04 + 0 + 0`).

- Program upgrade (settlement-v4): `3UE7ipWmwJypE6TZNdpZDT9X3Jq2CaKgNHS2unWWK5LVUu96zvpm16yKsotsyJYCBrMwrDX82f7HSQDsB3h2Rcu4` (slot `475793035`)
- Lifecycle market PDA: `AGEQQnjamHxtAZVn3xkVxg3u34exK1QyeXC7RYi4SScB`
- Protection — stale exploit refunded (`VOIDED_REFUNDED`): `5JyHiYVNGB9KSbJE6M84cpWR48uimV562zPmRjM2DvjMMUaXpQRzYQjvMNgATZ9WUyfyUjvAnjsy6nMrDu1tRCVt`
- TxLINE validation bound (genuine root `EUCbk9…TZ9Zr`): `5SfRcEH5JeAZdMJ7nHxK4pCfEaL7uGeg5wTjm72vNY2c4HnC9Du7uuAVKm7bGoLPSWYWtaDkK9fmHm9Az7FjvGhr`
- Resolve from root-bound submitted scores: `4vHbWZaWLXHHM1gzCvEi3JxethtrhWCTAxEWy72pGSvNLzqt9rqPMt1Q2kffuKYwqqNGpE8J2S4bvRyBPBhiWNwy`
- Parimutuel payout: `3Hnqs2nffc81wQ69QxekHNwsX5tYg3nmTHjJKUhfVBiJgXKrwCnxU3taaVEzXQdE8EuiaXr8vh16BDyHvrg4Z9W1`
- ProtocolVault: `HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE`

All 13 signatures render on `/proof#settlement`, and a receipt verifier detects tampering with the validated result, winning side, payout, fixture, sequence, root, or pool totals. Re-run the full lifecycle in one call: `POST /api/solana/lineguard/full-settlement-demo`. Local proof: `NO_DNA=1 anchor test` (16 tests) covers score-derived outcome, fixture/root rejection, close gating, void + exact-stake refund, many-winner split + bounded dust, and cross-market isolation.

## 13. Business and use-case potential

Any live prediction market, sportsbook-style exchange, fantasy contest, or event-driven trading venue can lose trust when fast actors exploit repricing latency. LineGuard can be integrated as a settlement-policy layer without requiring that product to replace its discovery, pricing, or matching system. Potential models include per-market protection fees, protocol integration fees, or enterprise settlement infrastructure.

## 14. Current limitations

- Solana devnet only; no mainnet deployment or real-money operation
- Canonical source is genuine historical TxLINE evidence, not a currently active match
- The recorded legacy canonical market does not use direct TxLINE CPI; the deployment-pending v2 program implements and locally verifies direct CPI
- Scores are operator-submitted; the TxLINE Merkle proof is not re-verified inside LineGuard
- Only `MATCH_WINNER_HOME` is supported by the current settlement engine; totals, next-goal, and custom propositions are not settlement-enabled
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
