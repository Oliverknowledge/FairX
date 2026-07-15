# FairX — execution integrity for live sports markets

FairX is Solana infrastructure for prediction-market operators. If genuine TxLINE evidence advances before an executable quote catches up, the order's quote sequence no longer matches the market's required event sequence: its principal returns, no position liability is created, and synchronized orders continue. The sequence decision, liabilities, claims, and operator withdrawal are independently re-readable on Solana. **Unaudited devnet prototype only. No mainnet or real-money operation.**

The current submission is **FairX Vault V4**: a fixed-payout, fully-collateralised market. An operator funds a liquidity vault; every accepted order's gross payout is frozen and its incremental liability reserved from free collateral before it can execute (the vault invariant `A = F + R + S` holds at every step). A genuine TxLINE material-event sequence (the France goal, sequence 739) invalidates the prior quote, so a stale-quote order entering afterward is refunded within a single instruction and can never claim.

## Current truth

Read this before the demo. Nothing below is exaggerated.

- **REAL and reproducible now — build:** a clean rebuild with the pinned toolchain produces byte-identical SBF (`sha256 7917273c…bffc71f0`, 422,040 bytes). `bash scripts/fairx-v4-reproducibility.sh`.
- **REAL and reproducible now — TxLINE:** the genuine TxLINE devnet program (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) validates all three settlement proofs — pre-goal odds, post-goal odds, and the final France 2–0 result — by **read-only RPC simulation**, each returning `true`. No transaction is signed or sent. `npm run v4:verify-proofs`.
- **REAL on devnet now — deployment:** the executable V4 Program and ProgramData accounts are loader-owned; the temporary upload buffer was drained and purged by deployment. `/proof` reads this state live.
- **LOCAL, exact-binary:** the full signed lifecycle and the void lifecycle both pass in LiteSVM against the exact deploy binary. `npm run v4:test-lifecycle`, `npm run v4:test-void`.
- **DETERMINISTIC REPLAY UI:** `/markets/france-morocco-v4-replay` and `/portfolio` replay the fixed canonical scenario from recorded TxLINE and finalized V4 evidence. They do not submit new trades.
- **LIVE DEVNET PROTOTYPE:** the V4 program is deployed and executable at `2x3vh…yF7p`. The 24-transaction France–Morocco lifecycle is finalized and independently re-verifies **20/20** from RPC, including the strict stale refund, fixed payouts, France 2–0 resolution, vault reconciliation, position closures and operator withdrawal.
- **REAL, HISTORICAL predecessor:** an earlier LineGuard program (v2/v3) *was* deployed to devnet and independently RPC-verified for the France–Morocco lifecycle. V4 is a from-scratch, better-collateralised redesign; it does not reuse that program or claim its transactions as its own.

The pricing model is a centrally-quoted, fully-collateralised fixed-payout vault — not an AMM or order book. TxLINE anchors the sports-event and final-result evidence; it does **not** attest FairX's prices, spread, or stale-edge policy.

## What is deployed

Program `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p` and its 24-transaction France–Morocco lifecycle are live on devnet. The record contains real transaction signatures, account owners, receipts and balance deltas. This repo contains no signer keypair.

## Judge routes

- `/` — the operator problem, canonical economic counterfactual, and product thesis
- `/markets/france-morocco-v4-replay` — the five-chapter historical replay (does not send transactions)
- `/integrate` — the operator integration boundary and ownership model
- `/proof` — live deployment, lifecycle, trust boundary, and reconciliation evidence
- `/portfolio` — the four canonical position outcomes

## Verification

```bash
npm install
npm run typecheck
npm test
npm run build
npm run v4:verify-proofs      # read-only RPC: real TxLINE devnet program returns true for all three proofs
npm run v4:test-lifecycle     # LiteSVM signed lifecycle against the exact deploy binary
npm run v4:test-void          # LiteSVM void/refund lifecycle
bash scripts/fairx-v4-reproducibility.sh   # full reproducible build + hash pinning (clean tree, pinned TxLINE .so)
```

## Deployment boundary

The V4 program is deployed but remains an unaudited devnet prototype. Its upgrade authority is a single devnet key (`ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`), neither frozen nor multisig-controlled. Any real-value use requires a multisig/frozen upgrade authority, managed signers, rate limits and an external audit.

See [PRODUCT_TRUTH.md](PRODUCT_TRUTH.md), [ARCHITECTURE.md](ARCHITECTURE.md), [PROOF.md](PROOF.md), [TXLINE.md](TXLINE.md), and [DEPLOYMENT.md](DEPLOYMENT.md).
