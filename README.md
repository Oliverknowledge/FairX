# FairX — Fair Settlement for Live Prediction Markets

## What FairX does

**FairX is a complete on-chain prediction market that protects live settlement from stale-price exploitation.**

The full lifecycle runs on Solana: orders fill into parimutuel pools, LineGuard refunds only the orders exploiting a stale price, the resolved outcome is committed from the genuine final result, and the winning side is paid its parimutuel share from the ProtocolVault. Losers forfeit.

```text
fill (YES + NO pools) → protect (selective refund) → resolve (committed outcome) → pay (parimutuel payout)
```

## How it works

FairX uses genuine TxLINE events and consensus odds as its sports-data source. The canonical France vs Morocco walkthrough preserves and hashes the raw TxLINE data, validates its score proof, commits the normalized event evidence to LineGuard on Solana, and demonstrates selective refund versus settlement.

**Protection.** LineGuard evaluates every escrowed order independently:

- stale positive-edge trade → `VOIDED_REFUNDED` → trader
- stale trade with no positive edge → `STALE_ALLOWED_NO_EDGE` → ProtocolVault
- synchronized trade → `ALLOWED`

LineGuard does not freeze the market. It blocks only the side benefiting from stale information.

**Settlement.** Filled orders accumulate into on-chain `yes_pool` / `no_pool` registers. Once the authority commits the resolved outcome (`resolve_market`, bound to a normalized final-result hash), each winning order claims its parimutuel share — `stake × total_pool ÷ winning_pool` — from the ProtocolVault via `settle_order`. Losing filled orders forfeit their stake, which funds the winners. Parimutuel math keeps each market's payouts equal to its pooled stakes, so the shared vault stays solvent.

## Canonical proof

| Evidence | Verified value |
| --- | --- |
| Fixture | France vs Morocco |
| TxLINE fixture ID / sequence | `18209181` / `739` |
| France probability | `52.274%` before → `86.505%` after |
| YES result | `+34.231¢` → `VOIDED_REFUNDED` → trader |
| NO result | `−34.231¢` → `STALE_ALLOWED_NO_EDGE` → ProtocolVault |
| Settlement run | YES + NO fill `0.02 SOL` each → resolve `YES_WON` → winner paid `0.04 SOL` (2×), loser forfeits |
| LineGuard program | `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe` |
| Schema / deployment slot | `settlement-v3` / `475735558` |

- Public app: `[PUBLIC_APP_URL]`
- Walkthrough: `/walkthrough`
- Proof page: `/proof`
- Repository: `[GITHUB_REPOSITORY_URL]`
- Demo video: `[DEMO_VIDEO_URL]`

```bash
npm install
npm run dev
```

Open [the proof walkthrough](http://localhost:3000/walkthrough) for the judge path or [the proof audit](http://localhost:3000/proof) for independently verifiable evidence.

## Current truth

Program ID:

```text
6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe
```

Verified on the current Solana devnet deployment:

- executable upgradeable Anchor program
- `MarketState` freshness registers, displayed/fair prices, tolerance, and source event hash
- `OrderEscrow` PDA custody
- stale positive-edge YES refund to the trader
- stale/no-edge NO finalization to `ProtocolVault`
- `GuardVerdict` evidence and tamper-evident receipts
- custom-market initialization and guarded order execution routes
- `MarketConfig` PDA with fixture/title/materiality/settlement hashes
- config attachment to `MarketState`
- config/event-hash snapshots in `OrderEscrow`
- on-chain parimutuel pools (`yes_pool` / `no_pool`) accumulated on fill
- `resolve_market` outcome commitment bound to a normalized final-result hash
- `settle_order` parimutuel payout to the winning side from `ProtocolVault`, with losing stakes forfeited
- genuine TxLINE historical capture, deterministic normalization, StablePrice conversion, and `validateStatV2` proof simulation

See [PROOF.md](PROOF.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [TXLINE.md](TXLINE.md).

## Mechanism

```text
# Protection (evaluate_order)
stale = materialSeq > pricedAtSeq
fairSidePrice = side == YES ? fairYes : 1 - fairYes
edge = fairSidePrice - observedPrice

if not stale          → ALLOWED               → fill → vault + side pool
else if edge > tol    → VOIDED_REFUNDED        → refund trader
else                  → STALE_ALLOWED_NO_EDGE  → fill → vault + side pool

# Settlement (resolve_market → settle_order)
resolve:  authority commits outcome ∈ {YES_WON, NO_WON} + final-result hash
settle:   require order filled on the winning side
          payout = stake × total_pool ÷ winning_pool      (parimutuel)
          transfer payout: ProtocolVault → trader; losing filled stakes forfeit
```

The browser preview uses the pure function in `lib/lineguard/evaluate.ts`. The Anchor implementation in `programs/lineguard/src/lib.rs` enforces custody and settlement on-chain.

## Runtime configuration

```bash
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_LINEGUARD_PROGRAM_ID=6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe
SOLANA_RPC_URL=https://api.devnet.solana.com

# Server-only; never prefix with NEXT_PUBLIC_.
LINEGUARD_OPERATOR_KEYPAIR='[64-byte secret array]'

# Server-only TxLINE integration.
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_JWT=
TXLINE_API_TOKEN=
TXLINE_FIXTURE_ID=
TXLINE_NETWORK=devnet
TXLINE_SCORES_STREAM_PATH=/api/scores/stream
TXLINE_ODDS_STREAM_PATH=/api/odds/stream
TXLINE_SCORES_SNAPSHOT_PATH=/api/scores/snapshot
TXLINE_SCORES_HISTORICAL_PATH=/api/scores/historical
TXLINE_FIXTURES_SNAPSHOT_PATH=/api/fixtures/snapshot
TXLINE_ODDS_SNAPSHOT_PATH=/api/odds/snapshot
```

`LINEGUARD_OPERATOR_KEYPAIR`, `TXLINE_JWT`, and `TXLINE_API_TOKEN` are read only by server code. Public APIs expose booleans, public keys, balances, endpoints, and health—not secret values.

## Commands

```bash
npm test
npm run typecheck
npm run build
npm run txline:verify-capture
npm run txline:validate
NO_DNA=1 anchor test
```

Devnet deployment changes require explicit operator approval:

```bash
NO_DNA=1 anchor build
NO_DNA=1 anchor deploy --provider.cluster devnet
```

## Boundaries

On-chain: market freshness and event evidence, MarketConfig commitments, order escrow, edge evaluation, verdict, refund/finalize destination, ProtocolVault, parimutuel pools, resolved-outcome commitment, and parimutuel payout settlement.

Off-chain: website, discovery, TxLINE HTTP/SSE transport, normalization, StablePrice conversion, separate TxLINE `validateStatV2` view/simulation, receipt rendering, operator dashboard, and terminal. Direct TxLINE CPI is not implemented.

FairX is not a full exchange, sportsbook, AMM, order book, production oracle, mainnet deployment, or real-money product. Devnet and sandbox funds only.
