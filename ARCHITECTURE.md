# FairX V4 architecture

```text
historical TxLINE capture ──> recorded StablePrice odds proofs ──> operator commits quote
                                      │
operator funds liquidity vault; every accepted order freezes gross payout and
reserves (gross − stake) from free collateral BEFORE it can execute
                                      │
                         place_fixed_payout_order evaluates atomically
                         ├─ quote stale (event sequence advanced) → refund trader; no durable vault change
                         └─ quote current → FixedPayoutPosition; liability reserved
                                      │
genuine material event (France goal, seq 739) ──> ingest_material_event_v4 invalidates prior quote
                                      │
final result (seq 1114, 2–0) ──> prove_resolution_with_txline_v4 (direct ValidateStatV2 CPI)
                                      │
                         2-of-3 approval ──> execute_resolution ──> winners claim frozen payout
                                      │
                         losers reconciled; operator withdraws only free collateral; positions close
```

## The vault invariant

At every transition the vault satisfies `A = F + R + S`:
- `A` spendable balance, `F` free collateral, `R` reserved liability, `S` accepted stake principal.

YES and NO liabilities are reserved **independently** — the market is intentionally over-collateralised (no outcome netting), so the operator can never be short a payout. Free collateral is the only withdrawable amount; accepted stake and reserved liability are never touched by a withdrawal.

## Economic model

A centrally-quoted, fully-collateralised **fixed-payout vault**: the operator supplies both the quote and every payout liability, so an honest fill wins a real payout from operator liquidity rather than merely recovering its stake. This is not an AMM, order book, or permissionless price oracle.

## Authority and custody boundaries

- The market snapshots its feed, pricing, emergency and three resolution authorities at init, so later config changes cannot rewrite an existing market's trust model.
- Emergency can only void/refund; it cannot choose a winner. Void requires a deterministic reason and 2-of-3 approval; refunds return principal and cannot double-spend.
- Trader and a persistent order nonce are part of the position PDA seeds, blocking order-id reuse. Terminal positions (claimed / lost / refunded / voided) close and return rent to the owner; accepted positions cannot close.

## Trust boundaries

- TxLINE validates historical result evidence; it does **not** attest FairX's prices, spread, or stale-edge policy.
- Pricing, feed ingestion and resolution submission are operator services.
- The upgrade authority is a single devnet key, not frozen or multisig.
- The program is deployed on devnet with a finalized canonical lifecycle, but remains unaudited, upgradeable, single-operator, and unsuitable for real-value custody.
