# FairX submission truth

## One line

FairX is a Solana devnet prototype that refunds only stale-price exploit orders while allowing honest accepted collateral to settle in a price-weighted pool.

## Canonical verified claim

The first screen on `/proof` is the only current canonical verdict. The recorded v3 lifecycle returns `VERIFIED` after independent RPC reads prove all of the following:

1. Wallet A's synchronized YES and Wallet B's synchronized NO were accepted.
2. Wallet C's stale positive-edge order alone was refunded.
3. Direct TxLINE CPI and 2-of-3 resolution derived YES.
4. A received the full A+B accepted pool; B did not receive a payout.
5. A, B and C order/position accounts were closed and no user rent or escrow was stranded.
6. Program, ProgramData, account owners, transaction finality, slots, hashes, timestamps and balance deltas all match the record.

The recorder completed all 14 finalized devnet transactions and wrote `fixtures/lineguard/v3-france-morocco-three-wallet.json` only after its invariants passed. The independent verifier then recomputed 18 checks with zero failures and zero unknowns.

## Archived evidence

The public v2 France–Morocco record is REAL Solana devnet and HISTORICAL TxLINE evidence. It proves selective refund, direct CPI, threshold resolution and isolated custody. It does **not** prove economically complete counterparty settlement: its sole winning Position claimed only its own `0.01 SOL` principal.

## Material limitations

- unaudited prototype; devnet SOL only
- historical reenactment, not a currently live match
- pricing authority sets quotes; TxLINE does not derive or guarantee FairX odds
- price-weighted parimutuel pool, not AMM/order-book price discovery
- retained single-key upgrade authority and operator trust
- external TxLINE CPI test requires devnet or a validator with the real program cloned
- public RPC throttling can temporarily make the verifier `UNKNOWN`; it never converts unavailable evidence into success

## Judge route

`/` → `/walkthrough` → `/markets/france-morocco-france-win` → `/proof`
