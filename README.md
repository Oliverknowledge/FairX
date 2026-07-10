# FairX — Fair Settlement for Live Prediction Markets

FairX is a devnet-backed prediction-market prototype powered by LineGuard, an on-chain settlement guard that protects live markets from stale-price extraction.

When an authoritative event is known before a displayed market price has repriced, LineGuard evaluates each escrowed order independently:

- stale positive-edge trade → `VOIDED_REFUNDED` → trader
- stale trade with no positive edge → `STALE_ALLOWED_NO_EDGE` → ProtocolVault
- synchronized trade → `ALLOWED`

The important property is selective asymmetry: LineGuard does not freeze every stale trade. It blocks only the order benefiting from the stale information.

```bash
npm install
npm run dev
```

Open [the proof walkthrough](http://localhost:3000/walkthrough) for the judge path or [the proof audit](http://localhost:3000/proof) for PDAs and transaction evidence.

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

Implemented in the current repository program/IDL but not claimable against the audited deployment until the pending program upgrade succeeds:

- `MarketConfig` PDA with fixture/title/materiality/settlement hashes
- config attachment to `MarketState`
- config/event-hash snapshots in `OrderEscrow`

The `/api/status` endpoint checks this schema boundary from ProgramData. Fresh actions are disabled when the deployed binary is older than the checked-in MarketConfig-capable build.

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

# Optional TxLINE server integration.
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_JWT=
TXLINE_API_TOKEN=
TXLINE_FIXTURE_ID=
TXLINE_SCORES_STREAM_PATH=/scores/stream
TXLINE_ODDS_STREAM_PATH=/odds/stream
TXLINE_SCORES_SNAPSHOT_PATH=/scores/snapshot
```

`LINEGUARD_OPERATOR_KEYPAIR`, `TXLINE_JWT`, and `TXLINE_API_TOKEN` are read only by server code. Public APIs expose booleans, public keys, balances, endpoints, and health—not secret values.

## Commands

```bash
npm test
npm run typecheck
npm run build
NO_DNA=1 anchor test
```

Devnet deployment changes require explicit operator approval:

```bash
NO_DNA=1 anchor build
NO_DNA=1 anchor deploy --provider.cluster devnet
```

## Boundaries

On-chain: market freshness and event evidence, order escrow, edge evaluation, verdict, refund/finalize destination, ProtocolVault, and—after the pending schema upgrade—market configuration hashes.

Off-chain: website, discovery, charts/presentation, TxLINE HTTP/SSE transport, normalization, fair-price input, receipt rendering, operator dashboard, and terminal.

FairX is not a full exchange, sportsbook, AMM, order book, production oracle, mainnet deployment, or real-money product. Devnet and sandbox funds only.
