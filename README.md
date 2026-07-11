# FairX — Fair Settlement for Live Prediction Markets

## What FairX does

**FairX protects live prediction markets from stale-price exploitation.**

When TxLINE reports a material event before the market reprices, LineGuard refunds only the orders exploiting the old price while allowing safe trades to settle.

## How it works

FairX uses genuine TxLINE events and consensus odds as its sports-data source. The canonical France vs Morocco walkthrough preserves and hashes the raw TxLINE data, validates its score proof, commits the normalized event evidence to LineGuard on Solana, and demonstrates selective refund versus settlement.

LineGuard evaluates every escrowed order independently:

- stale positive-edge trade → `VOIDED_REFUNDED` → trader
- stale trade with no positive edge → `STALE_ALLOWED_NO_EDGE` → ProtocolVault
- synchronized trade → `ALLOWED`

LineGuard does not freeze the market. It blocks only the side benefiting from stale information.

## Canonical proof

| Evidence | Verified value |
| --- | --- |
| Fixture | France vs Morocco |
| TxLINE fixture ID / sequence | `18209181` / `739` |
| France probability | `52.274%` before → `86.505%` after |
| YES result | `+34.231¢` → `VOIDED_REFUNDED` → trader |
| NO result | `−34.231¢` → `STALE_ALLOWED_NO_EDGE` → ProtocolVault |
| LineGuard program | `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe` |
| Schema / deployment slot | `market-config-v2` / `475298151` |

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
- genuine TxLINE historical capture, deterministic normalization, StablePrice conversion, and `validateStatV2` proof simulation

See [PROOF.md](PROOF.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [TXLINE.md](TXLINE.md).

## Mechanism

```text
stale = materialSeq > pricedAtSeq
fairSidePrice = side == YES ? fairYes : 1 - fairYes
edge = fairSidePrice - observedPrice

if not stale          → ALLOWED
else if edge > tol    → VOIDED_REFUNDED
else                  → STALE_ALLOWED_NO_EDGE
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

On-chain: market freshness and event evidence, MarketConfig commitments, order escrow, edge evaluation, verdict, refund/finalize destination, and ProtocolVault.

Off-chain: website, discovery, TxLINE HTTP/SSE transport, normalization, StablePrice conversion, separate TxLINE `validateStatV2` view/simulation, receipt rendering, operator dashboard, and terminal. Direct TxLINE CPI is not implemented.

FairX is not a full exchange, sportsbook, AMM, order book, production oracle, mainnet deployment, or real-money product. Devnet and sandbox funds only.
