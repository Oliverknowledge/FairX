# FairX four-minute demo script

The v3 verifier currently passes. Record only while it shows `VERIFIED`; if it degrades to `UNKNOWN`, say so and retry rather than implying live verification.

## 0:00–1:00 — problem and mechanism

Show `/`. Explain: a score event can move fair value before a market reprices; cancelling the whole market harms honest traders. FairX signs the expected quote, sequence, slippage and expiry, then refunds only an order capturing excessive stale edge.

## 1:00–2:00 — economic trade

Show the market ticket. State that this is a price-weighted parimutuel pool: the execution quote controls shares and winners divide accepted collateral. Do not call it an AMM, order book, live liquidity or fixed-dollar share market.

## 2:00–3:10 — three-wallet proof

Open `/proof`. Only if the status is VERIFIED, show:

- Wallet A synchronized YES accepted
- Wallet B synchronized NO accepted
- Wallet C stale YES refunded alone
- TxLINE historical evidence and direct CPI
- YES resolution and A receiving A+B accepted collateral
- closed Order/Position accounts and recovered user rent

Open at least one Explorer transaction and the program hash check. If any item is UNKNOWN, stop and identify the missing evidence.

## 3:10–4:00 — limitations and close

Show the archived v2 section and explicitly say why it is not the primary economic proof. Disclose historical evidence, devnet SOL, pricing-authority trust, retained upgrade authority and unaudited status. Close on the narrow claim: **refund the stale exploit, keep the honest market.**

Never use the old script's invented `0.04 SOL` two-sided payout. The canonical gross payout is `0.02 SOL`: A's `0.01 SOL` principal plus B's `0.01 SOL` losing stake.
