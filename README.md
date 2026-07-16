# FairX — the market integrity layer for live prediction markets

FairX gives live prediction-market operators one operational loop: **Detect → Measure → Protect → Explain → Recover → Verify.** When an order's quote sequence is behind the required TxLINE event sequence, V4 returns its principal and creates no position liability. A synchronized order remains executable, so the market can stay open. **Unaudited devnet prototype only. No mainnet or real-money operation.**

The current submission is **FairX Vault V4**: a fixed-payout, fully-collateralised market. An operator funds a liquidity vault; every accepted order's gross payout is frozen and its incremental liability reserved from free collateral before it can execute (the vault invariant `A = F + R + S` holds at every step). A genuine TxLINE material-event sequence (the France goal, sequence 739) invalidates the prior quote, so a stale-quote order entering afterward is refunded within a single instruction and can never claim.

## Current truth

Read this before the demo. Nothing below is exaggerated.

- **REAL and reproducible now — build:** a clean rebuild with the pinned toolchain produces byte-identical SBF (`sha256 7917273c…bffc71f0`, 422,040 bytes). `bash scripts/fairx-v4-reproducibility.sh`.
- **REAL and reproducible now — TxLINE:** the genuine TxLINE devnet program (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) validates all three settlement proofs — pre-goal odds, post-goal odds, and the final France 2–0 result — by **read-only RPC simulation**, each returning `true`. No transaction is signed or sent. `npm run v4:verify-proofs`.
- **REAL on devnet now — deployment:** the executable V4 Program and ProgramData accounts are loader-owned; the temporary upload buffer was drained and purged by deployment. `/proof` reads this state live.
- **LOCAL, exact-binary:** the full signed lifecycle and the void lifecycle both pass in LiteSVM against the exact deploy binary. `npm run v4:test-lifecycle`, `npm run v4:test-void`.
- **INTEGRATED MARKET INTEGRITY UI:** `/` runs a seven-stage deterministic control panel with event sequence, quote sequence, delta, health, stale-window state, strict V4 outcome, integrity receipt, recovery, settlement, and proof. It does not submit new trades.
- **CANONICAL EVIDENCE UI:** `/proof` keeps the real France–Morocco deployment, transactions, CPI receipts and accounting evidence separate from the reusable runtime simulation.
- **LIVE DEVNET PROTOTYPE:** the V4 program is deployed and executable at `2x3vh…yF7p`. The 24-transaction France–Morocco lifecycle is finalized and independently re-verifies **20/20** from RPC, including the strict stale refund, fixed payouts, France 2–0 resolution, vault reconciliation, position closures and operator withdrawal.
- **PINNED BY DESIGN — canonical V4 scope:** the deployed reference implementation is intentionally pinned to the recorded France–Morocco fixture and its committed TxLINE evidence. `CANONICAL_*` constants in `programs/fairx_vault_v4/src/lib.rs` fix the fixture identity, sequences and captured odds, and `validate_canonical_identity` rejects any other market — so `initialize_market_v4` cannot bind a second fixture without new constants and a redeploy. This is deliberate: pinning is what makes the 24-transaction lifecycle tamper-evident, because the recorded numbers cannot be re-run with different inputs. Runtime scenarios and IntegrationKit demonstrate the reusable policy interface; they are **not** additional on-chain fixture deployments. The next program release removes the canonical constants in favour of arbitrary fixture configuration.
- **REAL, HISTORICAL predecessor:** an earlier LineGuard program (v2/v3) *was* deployed to devnet and independently RPC-verified for the France–Morocco lifecycle. V4 is a from-scratch, better-collateralised redesign; it does not reuse that program or claim its transactions as its own.

The pricing model is a centrally-authorised, fully-collateralised fixed-payout vault — not an AMM or order book. TxLINE anchors the odds, sports-event, and final-result evidence. QuoteGuard deterministically recomputes the executable YES/NO quote from the committed TxLINE StablePrice update and fixed transformation, then matches it to the on-chain receipt. This proves provenance and transform compliance; it does **not** make the pricing authority permissionless, externally audited, or universally economically optimal.

## What is deployed

Program `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p` and its 24-transaction France–Morocco lifecycle are live on devnet. The record contains real transaction signatures, account owners, receipts and balance deltas. This repo contains no signer keypair.

## Judge journey

- `/` — **Demo:** seven deterministic stages, integrated market-health panel, stale-window timeline, receipt, recovery, and proof
- `/integrate` — **Conformance Lab:** stale, synchronized, malformed, expired, and future-sequence test vectors plus the single operator workflow
- `/proof` — **Proof:** concise V4 judge summary first, expandable technical evidence second

The runtime never claims to be a live external TxLINE feed and never sends a transaction. France–Morocco is backed by the canonical captured evidence; Argentina–Brazil is a schema-compatible runtime scenario and makes no on-chain evidence claim.

## Provenance

- Submission release: tag `submission-final` (public deployments display the live `VERCEL_GIT_COMMIT_SHA` on `/proof`, which is the authoritative deployed-commit source — the docs deliberately do not pin a commit hash, because every deploy would invalidate it)
- V4 deployment: `2026-07-15T10:28:14Z`, slot `476416258`
- Build timestamp: generated into the static Proof page at build time, or supplied with `NEXT_PUBLIC_BUILD_TIMESTAMP`

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
