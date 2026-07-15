# FairX — execution integrity for live sports markets

## One-line pitch

FairX is Solana execution and settlement infrastructure for prediction-market operators: when genuine TxLINE evidence advances before a quote updates, an old-sequence order returns its principal, synchronized orders continue, and every resulting liability remains publicly verifiable.

## Problem

A goal can reach an officiated data feed before a prediction market updates its executable price. The operator must then accept an obsolete-information liability, pause every trader, or apply an unverifiable private cancellation. None is a good market primitive.

## Solution

FairX Vault V4 is a centrally quoted, fully collateralised fixed-payout vault. The operator deposits liquidity; every accepted position freezes its gross payout and reserves the incremental liability before execution. An order is eligible only when its quote sequence matches the latest recorded material-event sequence. A mismatch returns principal without creating a position liability; synchronized positions remain valid.

The canonical France–Morocco lifecycle is a deterministic replay in the UI, backed by a separate finalized 24-transaction Solana devnet record. Replay controls never send transactions.

## Why TxLINE is essential

TxLINE supplies the fixture identity, historical goal sequence, pre/post StablePrice evidence, and final regulation-time result proof. FairX uses those inputs to decide which quote sequence is current and which outcome may resolve. TxLINE does not attest FairX's operator-set prices, spread, or liquidity policy.

Canonical authenticated API origin and captured endpoints:

- `https://txline-dev.txodds.com`
- `GET /api/fixtures/snapshot`
- `GET /api/scores/historical/18209181`
- `GET /api/odds/updates/20643/21/5?fixtureId=18209181`

On devnet, the genuine TxLINE program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` owns the recorded odds and scores roots. Independent read-only simulation returns `true` for both odds proofs and the final France 2–0 proof. The finalized V4 lifecycle separately records successful direct TxLINE CPIs for quote validation and resolution.

## Why Solana

FairX needs atomic stake-in/refund-out execution, deterministic PDA isolation, inexpensive account-level auditability, and composability with TxLINE's deployed program. Solana lets one instruction transfer the stake, evaluate the event sequence, and either reserve a fixed liability or return the stake without an intermediate custodial state.

## Product links

- Public app: [https://fair-x-psi.vercel.app](https://fair-x-psi.vercel.app) — **deployment blocker:** as of 2026-07-15 this serves commit `be4adbf…`, not the V4 release candidate; redeploy and re-audit before submission.
- GitHub: [https://github.com/Oliverknowledge/FairX](https://github.com/Oliverknowledge/FairX)
- Demo video: **not yet published — submission blocker**
- Judge route after redeploy: `/` → `/markets/france-morocco-v4-replay` → `/integrate` → `/proof`

## Technical architecture

1. Operator funds the V4 liquidity-vault PDA.
2. Pricing authority commits a quote bound to TxLINE odds payload and material-event sequence.
3. V4 invokes TxLINE `validate_odds` and stores a quote-validation receipt.
4. A fair order transfers stake, freezes gross payout, and reserves `gross payout − stake`.
5. Feed authority ingests the canonical goal at sequence 739, invalidating sequence 738.
6. An old-sequence order transfers stake in and receives it back in the same instruction; its receipt is permanently `REFUNDED`.
7. A synchronized quote and position remain executable.
8. V4 invokes TxLINE `validate_stat_v2` for final sequence 1114, France 2–0.
9. Two of three configured resolution authorities approve the derived outcome.
10. Winners claim fixed payouts, the loser reconciles, position PDAs close, and only free collateral is withdrawable.

At every transition, spendable vault balance `A = free collateral F + reserved liability R + accepted principal S`. YES and NO liabilities are reserved independently; there is no outcome netting.

## Real on-chain proof

- Cluster: Solana devnet
- V4 Program: `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p`
- ProgramData: `9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V`
- Deployment slot: `476416258`
- Deployed SBF: 422,040 bytes
- SHA-256: `7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0`
- Canonical lifecycle: 24 finalized transactions
- Independent verifier: `VERIFIED`, 20/20
- Operator deposit: 200,000,000 lamports
- Accepted principal: 30,000,000 lamports
- Stale refund: 10,000,000 lamports
- User payouts: 30,200,572 lamports
- Operator free-liquidity withdrawal: 199,799,428 lamports
- Final free collateral, reserve, principal, pending refund, and open positions: all zero

`npm run v4:verify-lifecycle` reads RPC rather than trusting display copy or a fixture verdict. It checks program identity and bytes, PDAs, owners, TxLINE roots and receipts, decoded account state, all transaction signatures/slots/instruction discriminators, balance deltas, refund, payout, conservation, and account closures. RPC failure produces `UNKNOWN`; mismatches produce `FAILED`.

## Historical predecessor

LineGuard V3 is a separate deployed devnet predecessor. Its 14-transaction three-wallet lifecycle independently verifies 18/18 after recomputing immutable transaction evidence. It proves the earlier selective-refund primitive but is never used as V4 evidence.

## Limitations and trust assumptions

- unaudited prototype; devnet SOL only; no mainnet or real-money operation
- deterministic UI replay of one historical TxLINE fixture, not connected-wallet live trading
- operator controls quotes, feed submission, liquidity, and service availability
- two-of-three configured resolution authorities approve the TxLINE-derived result
- single-key upgrade authority; not frozen or multisig-controlled
- no AMM, order book, permissionless price discovery, public market creation, LP tokens, or organic users
- direct TxLINE CPI validates the submitted proof against approved roots; it does not make the operator's pricing policy trustless

## TxLINE feedback

TxLINE's on-chain validation interface made the strongest part of this prototype possible: the same captured Merkle proof can be simulated independently and then consumed by CPI during settlement. The main integration friction was discoverability across API payloads, root-account identity, epoch-day PDA derivation, IDL field naming, and proof-period semantics. A single canonical end-to-end example linking authenticated API response → normalized proof → root PDA → simulation → CPI receipt would materially shorten integration time. Stable fixture/version metadata and explicit historical-versus-live labels in examples would also help downstream products avoid accidental overclaiming.

## Reproduce

```bash
npm install
npm run typecheck
npm test
npm run build
npm run v4:verify-proofs
npm run v4:test-lifecycle
npm run v4:test-void
npm run v4:verify-lifecycle
```

The deployment and canonical lifecycle are complete. The submission itself is not ready until the current V4 candidate is deployed to the public app and a public demo video is added.
