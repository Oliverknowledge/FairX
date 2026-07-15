# FairX product truth (V4)

| Surface or claim | Classification | Truth |
|---|---|---|
| FairX Vault V4 program | REAL · DEPLOYED DEVNET | Anchor program deployed at `2x3vh…yF7p`; executable loader-owned Program and ProgramData are live. The dumped 422,040-byte binary matches SHA-256 `791727…71f0`. |
| Reproducible build | REAL | Pinned Rust 1.89.0 / Anchor 1.1.2 / Solana 3.1.10 rebuild yields `sha256 7917273c…bffc71f0`, 422,040 bytes, matching `v4-build-manifest.json`. |
| Live TxLINE proof validation | REAL · READ-ONLY | The genuine TxLINE devnet program validates the pre-goal odds, post-goal odds, and final France 2–0 result by read-only RPC simulation; each returns `true`. No transaction sent. `npm run v4:verify-proofs`. |
| Devnet upload buffer | REAL · PURGED | The temporary loader-owned buffer was drained into ProgramData and purged by the successful deployment. |
| LiteSVM signed lifecycle + void | REAL · LOCAL | Both pass against the **exact deploy binary** in LiteSVM. Local execution, not devnet; the harness disables signature verification only for `initialize_market_v4`, then restores it. |
| `/markets/*`, `/portfolio` lifecycle | DETERMINISTIC REPLAY | Deterministic replay using recorded TxLINE event, odds and final-result proofs plus the finalized V4 evidence. Replay controls do not submit new transactions. |
| Live deployment status on `/proof` | REAL · READ-ONLY | `getMultipleAccounts` read of the program + buffer on every load; reports `DEPLOYED` / `BUFFER_FUNDED` / `NOT_STARTED` / `UNKNOWN`. Never asserts deployment; RPC failure degrades to `UNKNOWN`, never success. |
| V4 France–Morocco lifecycle | REAL · FINALIZED DEVNET | 24 finalized transactions; RPC verifier returns 20/20. Genuine pre/post TxLINE odds, seq-739 goal, seq-1114 France 2–0 proof, threshold resolution, fixed payouts, stale refund, zero-liability vault and four closed position accounts. |
| Fixed payout / conservative collateral | REAL in source/tests | Every accepted order freezes gross payout and reserves gross-minus-stake from free collateral; YES and NO liabilities are reserved independently (intentionally over-collateralised, no outcome netting). |
| Strict stale invalidation | REAL in source/tests | Material-event sequence 739 invalidates the prior quote; a stale-quote order entering afterward is refunded within one instruction and can never claim. Not a synthetic edge model. |
| Price discovery | NOT IMPLEMENTED | No AMM, order book, or permissionless oracle sets the quote inside FairX. The operator quotes; the model is a centrally-quoted fixed-payout vault. |
| On-chain FairX V4 settlement | REAL · FINALIZED DEVNET | The canonical market resolved YES from the France 2–0 proof; two fixed payouts were claimed, the NO position reconciled lost, the stale position refunded, all position accounts closed, and free collateral withdrawn. |
| Deployed LineGuard v2/v3 predecessor | REAL · HISTORICAL | An earlier program was deployed and independently RPC-verified for the France–Morocco lifecycle. V4 is a separate redesign; it never reuses those transactions as its own evidence. |
| Security/production readiness | FUTURE | Unaudited, upgradeable, single-key authority, operator-dependent, devnet only. |

Required visible qualifiers: `Devnet SOL`, `deterministic replay using recorded TxLINE event, odds and final-result proofs`, `read-only simulation` on standalone TxLINE validation, and `UNKNOWN` whenever RPC evidence is unavailable.

Prohibited claims: production-ready, trustless, decentralized odds, audited, mainnet, real liquidity or organic users.
