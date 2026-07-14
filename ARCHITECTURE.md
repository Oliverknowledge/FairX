# FairX architecture

```text
historical TxLINE capture ──> deterministic odds transform ──> pricing authority commit
                                      │
wallet signs price + slippage + pricing/odds sequences + expiry
                                      │
                         LineGuard evaluates atomically
                         ├─ excessive stale edge → refund trader; close order
                         └─ acceptable quote → isolated vault + price-weighted shares
                                                        │
feed closes market → direct TxLINE ValidateStatV2 CPI → derived outcome
                                                        │
                         2-of-3 resolution approval → winners divide pool
                                                        │
                         claim/close Position → user rent recovered
```

## Authority and custody boundaries

- Market snapshots feed, pricing, emergency and three resolution authorities so later config changes cannot silently rewrite an existing market's trust model.
- Emergency can only void/refund; it cannot choose a winner.
- Each market uses an isolated vault. Claims are non-expiring and the final winner receives integer remainder dust.
- Trader is part of Order PDA seeds. Evaluation is permissionless after placement so an absent operator cannot strand escrow.
- Orders close on evaluation/cancel; winning Positions close on claim; empty/losing/legacy-settled Positions have explicit rent recovery paths.

## Economic model

Accepted pool shares equal `stake_lamports × 1,000,000 / execution_price_micros`. Winning payouts divide total accepted collateral by winning shares. This is solvent and makes the signed price economically meaningful, but it is a centrally quoted parimutuel pool—not an AMM or order book.

## External reference price (Polymarket)

```text
Polymarket public order book ──> recomputed midpoint ──> reference-quote capture (hashed)
                                      │
                    commit_txline_odds_v2 (odds_sequence + odds_payload_hash + fair_price_micros)
                                      │
                    wallet signs expected_odds_sequence + price + slippage + expiry (place_order_v2)
```

The canonical opening quote can be sourced from the midpoint of an equivalent Polymarket market
instead of the operator heuristic. It rides the **already-deployed** LineGuard V2 pricing slot, so no
program upgrade is required. FairX holds no Polymarket liquidity, routes no orders to Polymarket, and
custodies no Polygon assets; the midpoint is an external reference, not an oracle. See
[POLYMARKET_REFERENCE.md](POLYMARKET_REFERENCE.md).

## Trust boundaries

- TxLINE validates historical result evidence; it does not attest FairX's prices or stale-edge policy.
- Pricing, feed ingestion and resolution submission remain operator services.
- The upgrade authority is retained by one devnet key, not frozen or controlled by a multisig.
- Malicious frontend/RPC risk is reduced by wallet-signed constraints, simulation/finalized confirmation and an independent verifier, not eliminated.
- Program is unaudited and devnet-only.
