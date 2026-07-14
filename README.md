# FairX — selective stale-price protection on Solana

FairX is an unaudited Solana devnet prototype. LineGuard evaluates each signed order against a newer committed price: only an order capturing excessive stale-price edge is refunded; honest accepted collateral remains in the market. **Devnet SOL only. No mainnet or real-money operation.**

## Current truth

- **REAL / HISTORICAL:** the archived France–Morocco v2 run used genuine historical TxLINE evidence, a direct `ValidateStatV2` CPI, threshold resolution, a per-market vault and a wallet-owned Position.
- **MISLEADING if called economically complete:** that v2 winner recovered only its own `0.01 SOL`; no losing counterparty funded the payout.
- **REAL and independently verified:** the current devnet binary signs execution price, slippage, pricing/odds sequences and expiry; prices create pool shares; ephemeral user accounts close. The canonical 14-transaction three-wallet lifecycle is finalized and `/api/verify/v3-lifecycle` recomputes it from RPC as `VERIFIED`.
- **REAL economics:** A's synchronized YES and B's synchronized NO were accepted; C's stale YES alone was refunded; YES resolved from TxLINE evidence; A received the full `0.02 SOL` accepted pool. Excluding equal setup funding, A finished `+0.01 SOL`, B `-0.01 SOL`, and C flat.
- **HISTORICAL, not live:** the canonical TxLINE capture is a replay of fixture `18209181`, sequence `739`.
- **REAL external reference, READ-ONLY:** the opening quote for the current France–Spain reference market is the public Polymarket order-book midpoint (`/reference`), recomputed from best bid/ask and hash-captured. It is an external reference, not FairX liquidity, not an oracle, and not routed to Polymarket. The France–Morocco proof stays TxLINE StablePrice history and is unchanged. See [POLYMARKET_REFERENCE.md](POLYMARKET_REFERENCE.md).

The target lifecycle is:

```text
Wallet A: synchronized YES accepted ─┐
Wallet B: synchronized NO accepted  ├─ YES resolves → A receives A+B collateral
Wallet C: stale exploit refunded ───┘             → B/C close their Position rent
```

The pricing model is a price-weighted parimutuel pool, not an AMM or order book. Accepted shares are `stake × 1,000,000 / execution_price`; winners divide accepted collateral by winning shares. The pricing authority still supplies quotes.

## Judge routes

- `/` — problem and selective-refund thesis
- `/walkthrough` — lifecycle and trust boundaries
- `/markets/france-morocco-france-win` — archived v2 state, trading disabled
- `/reference` — live Polymarket external reference quote + RECORDED-EVIDENCE proof (France–Spain)
- `/proof` — v3 verifier first; archived v2 evidence second
- `/portfolio` — wallet-owned positions and rent recovery
- `/integrate` — exact implemented and missing capabilities

## Verification

```bash
npm install
npm run typecheck
npm test
npm run build
NO_DNA=1 anchor test
NO_DNA=1 cargo clippy --manifest-path programs/lineguard/Cargo.toml -- -D warnings
```

Use `NO_DNA=1 anchor test --validator legacy` for the full local suite with the cloned external TxLINE executable. The default validator profile skips that genuine CPI test.

## Deployment boundary

The hardened binary was deployed to devnet at slot `475972063`; its dumped bytes exactly match local SHA-256 `1903958567efc17f3a31a2b3d6e4bcd594fe2f601b458ec82ec946badd3830cc`. The separate canonical lifecycle proves the deployed economic path. Upgrade authority remains `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`; it is neither frozen nor multisig-controlled. Server-side operator routes fail closed unless `LINEGUARD_OPERATOR_API_TOKEN` is configured.

See [PRODUCT_TRUTH.md](PRODUCT_TRUTH.md), [ARCHITECTURE.md](ARCHITECTURE.md), [PROOF.md](PROOF.md), [TXLINE.md](TXLINE.md), and [DEPLOYMENT.md](DEPLOYMENT.md).
