# FairX / LineGuard Architecture

```text
TxLINE
   ↓
Next.js ingestion and normalization
   ↓
source event hash
   ↓
LineGuard MarketState (+ MarketConfig after v2 deployment)
   ↓
OrderEscrow
   ↓
evaluate_order
   ├── refund trader
   └── finalize ProtocolVault
   ↓
receipt / verifier UI
```

## On-chain

- market authority and freshness registers (`materialSeq`, `pricedAtSeq`)
- displayed and fair prices plus tolerance
- non-zero source event hash committed by the authority
- escrowed order stake and frozen order inputs
- deterministic side-specific edge calculation
- verdict/status and settlement destination
- trader refund for stale positive edge
- ProtocolVault finalization for safe/no-edge orders
- `GuardVerdict` event evidence
- MarketConfig hashes and OrderEscrow config/event snapshots in the checked-in v2 program (runtime-gated until deployed)

## Off-chain

- public website and market discovery
- TxLINE HTTP/SSE transport and credentials
- payload normalization and raw/normalized hash calculation
- materiality/fair-price input before authority ingestion
- local preview, guided scenarios, and Attack Lab
- receipt rendering, URL transport, and browser seal verification
- operator dashboard, technical terminal, and proof walkthrough

The UI does not custody devnet order funds. Server-only routes create and sign on-chain instructions when the runtime is configured and ready.

## Trust model

The current oracle path is authority controlled. `ingest_material_event` authorizes the market authority, requires a non-zero hash, validates price bounds, and advances freshness. This is not production oracle decentralization. A direct TxLINE `validate_stat` CPI is not implemented.

## Not included

FairX does not implement a full exchange, matching engine, AMM/order book, mainnet/real-money betting, decentralized oracle network, or audited production custody stack.
