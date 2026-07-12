# FairX / LineGuard Architecture

```text
TxLINE
   ↓
raw capture + deterministic normalization
   ↓
TxLINE validateStatV2 (separate devnet verification)
   ↓
source event hash
   ↓
LineGuard MarketState + MarketConfig
   ↓
validation draft → authority confirmation
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
- MarketConfig hashes and OrderEscrow config/event snapshots
- `MATCH_WINNER_HOME` resolution rule, home/away team hashes, and stat keys
- genuine TxLINE root account identity check
- deterministic score mapping: home win → YES, away win → NO, draw → void
- replaceable validation draft before confirmation; immutable after confirmation/resolution

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

The deployed legacy ingestion and score-submission paths are authority controlled. `ingest_material_event` authorizes the market authority, requires a non-zero hash, validates price bounds, and advances freshness. Its TxLINE `validateStatV2` proof is checked separately, while scores remain operator-submitted. The deployment-pending v2 resolver instead CPIs into the fixed TxLINE devnet program with the exact committed payload, requires a true return value, derives the outcome internally, and requires threshold approval.

## Not included

FairX does not implement a full exchange, matching engine, AMM/order book, mainnet/real-money betting, decentralized oracle network, or audited production custody stack. The settlement engine currently supports only `MATCH_WINNER_HOME`; totals, next-goal, and custom propositions are not settlement-enabled.
