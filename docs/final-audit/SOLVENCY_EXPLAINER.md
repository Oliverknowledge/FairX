# Why the 199,799,428-lamport withdrawal is correct

FairX V4 is an operator-funded fixed-payout vault. The operator’s deposit is not a user payout pool that must remain forever. It is free collateral used to guarantee every accepted position’s fixed gross payout.

## The complete reconciliation

```text
operator deposit          200,000,000
+ accepted user principal  30,000,000
- winning payouts          30,200,572
= remaining free liquidity 199,799,428 lamports
```

The separate stale 10,000,000-lamport attempt is returned atomically and never becomes accepted principal or claimable payout liability.

## Position-by-position

| Position | Stake | Execution | Terminal result | Cash result |
|---|---:|---:|---|---:|
| Honest pre-goal YES | 10,000,000 | 532,785 micros | CLAIMED | 18,769,297 payout |
| Honest pre-goal NO | 10,000,000 | 487,215 micros | LOST/CLOSED | no payout; principal becomes free collateral |
| Stale pre-goal YES attempt | 10,000,000 | invalidated quote | REFUNDED/CLOSED | 10,000,000 returned; never accepted |
| Synchronized post-goal YES | 10,000,000 | 874,793 micros | CLAIMED | 11,431,275 payout |

Total accepted principal is therefore 30,000,000, not 40,000,000. Total winning payout is 18,769,297 + 11,431,275 = 30,200,572 lamports.

## The invariant

At every recorded transition the verifier recomputes:

```text
spendable vault balance A = free collateral F + reserved liability R + accepted principal S
```

FairX reserves YES and NO liabilities independently. It does not rely on outcome netting, so this binary market is deliberately over-collateralised. The operator withdrawal instruction can remove free collateral only; reserved liability and accepted principal cannot be withdrawn.

After both winners claim and the losing position is reconciled:

```text
A = 199,799,428
F = 199,799,428
R = 0
S = 0
pending refunds = 0
open positions = 0
```

The operator then withdraws exactly `F`. The final spendable vault balance and every accounting bucket are zero. There is no dust, hidden deficit, residual claim, double payout or withdrawal of reserved user funds.

## What independently proves this

The result is not accepted from UI copy. The V4 verifier re-fetches all 24 finalized devnet transactions, verifies program/account ownership and PDAs, decodes the lifecycle, checks relevant balance deltas, recomputes each accounting snapshot and confirms terminal account closures. Its successful result is `VERIFIED · 20/20`; RPC absence is `UNKNOWN`, not success.
