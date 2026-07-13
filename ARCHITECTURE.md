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

## Trust boundaries

- TxLINE validates historical result evidence; it does not attest FairX's prices or stale-edge policy.
- Pricing, feed ingestion and resolution submission remain operator services.
- The upgrade authority is retained by one devnet key, not frozen or controlled by a multisig.
- Malicious frontend/RPC risk is reduced by wallet-signed constraints, simulation/finalized confirmation and an independent verifier, not eliminated.
- Program is unaudited and devnet-only.
