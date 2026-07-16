# FairX — execution-integrity infrastructure for operators running live sports markets

## One-line pitch

FairX is execution-integrity infrastructure for live prediction-market and sportsbook operators: it returns obsolete-sequence orders atomically and keeps synchronized markets open, with every decision proven by a direct CPI into TxLINE's official Solana program.

## Summary for judges

1. **Operator problem.** A goal reaches TxLINE before the market updates its executable quote. The operator must then eat an obsolete-information liability, pause every trader, or apply an unverifiable private cancellation. None is a good market primitive.
2. **Strict sequence rule.** The deployed rule is exact and three-way: `OrderSequence < RequiredSequence → STALE_SEQUENCE_RETURNED`; `== → ACCEPTED`; `> → FUTURE_SEQUENCE` (invalid). No side-awareness, no discretion, no operator override.
3. **Genuine TxLINE CPI.** FairX Vault V4 performs **direct Cross-Program Invocations into TxLINE's official devnet program** `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` — `ValidateOdds` for both executable quotes and `ValidateStatV2` for the final France 2–0 result. `execute_resolution_v4` requires `resolution_receipt.direct_cpi_verified`, so **settlement cannot execute without TxLINE**.
4. **Deployed custom settlement engine.** A fixed-payout, fully-collateralised vault deployed on Solana devnet at `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p`, byte-identical to the published SHA-256.
5. **Atomic principal return.** The stale order's stake enters and leaves the vault inside one instruction; its position account is permanently `Refunded` and can never claim. Zero liability created.
6. **Synchronized trading continues.** The market is never suspended. The quote resyncs, and a distinct replacement order at sequence 739 is accepted normally.
7. **Independently verified lifecycle.** 24 finalized devnet transactions, zero errors; independent RPC verifier returns **VERIFIED 20/20**; every recorded liability reconciles to zero.
8. **Honest canonical-reference scope.** The deployed program is intentionally **pinned to the canonical France–Morocco fixture** and is **not generic across fixtures** — see Limitations. Pinning is what makes the lifecycle tamper-evident.

## Problem

A goal can reach an officiated data feed before a prediction market updates its executable price. The operator must then accept an obsolete-information liability, pause every trader, or apply an unverifiable private cancellation. None is a good market primitive.

## Solution

FairX Vault V4 is a centrally quoted, fully collateralised fixed-payout vault. The operator deposits liquidity; every accepted position freezes its gross payout and reserves the incremental liability before execution. The deployed rule is exact: if `OrderSequence < RequiredSequence`, return `STALE_SEQUENCE_RETURNED`; otherwise return `ACCEPTED`. A returned order gets its principal back and creates no position liability; a synchronized position remains valid.

The main UI is a seven-stage operational replay with an integrated market-integrity panel, stale-window timeline, receipt, recovery state, settlement, and proof. `/integrate` adds a five-vector no-send conformance lab. Canonical France–Morocco evidence remains a finalized 24-transaction Solana devnet record on `/proof`.

## Why TxLINE is essential

TxLINE supplies the fixture identity, historical goal sequence, pre/post StablePrice evidence, and final regulation-time result proof. QuoteGuard deterministically derives and verifies the executable quote from the committed odds update and fixed transformation. TxLINE does not make the configured pricing authority permissionless, and QuoteGuard does not claim an external audit or universal economic optimality.

Canonical authenticated API origin and captured endpoints:

- `https://txline-dev.txodds.com`
- `GET /api/fixtures/snapshot`
- `GET /api/scores/historical/18209181`
- `GET /api/odds/updates/20643/21/5?fixtureId=18209181`

On devnet, the genuine TxLINE program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` owns the recorded odds and scores roots. Independent read-only simulation returns `true` for both odds proofs and the final France 2–0 proof. The finalized V4 lifecycle separately records successful direct TxLINE CPIs for quote validation and resolution.

## Why Solana

FairX needs atomic stake-in/refund-out execution, deterministic PDA isolation, inexpensive account-level auditability, and composability with TxLINE's deployed program. Solana lets one instruction transfer the stake, evaluate the event sequence, and either reserve a fixed liability or return the stake without an intermediate custodial state.

## Product links

- Public app: [https://fair-x-psi.vercel.app](https://fair-x-psi.vercel.app) — production deployment of the tagged candidate; the Proof page displays the exact build commit supplied by Vercel.
- GitHub: [https://github.com/Oliverknowledge/FairX](https://github.com/Oliverknowledge/FairX)
- Release: tag `submission-v2.2.0` · commit `9b87378c3cca65b43643634f0159ccda23805e27` — this is the commit production serves; `/proof` displays it live from `VERCEL_GIT_COMMIT_SHA`
- Demo video: `<<PASTE YOUTUBE/LOOM URL HERE BEFORE SUBMITTING>>`
- Judge route: `/` Demo → `/integrate` Conformance Lab → `/proof`

---

# Paste-ready Superteam fields

> Everything below is written to be pasted **verbatim** into the Superteam submission form. Do not retype from memory.

### Field: Application access
```
https://fair-x-psi.vercel.app
Judge route: / (Demo) -> /integrate (Conformance Lab) -> /proof (Evidence)
```

### Field: Public repo
```
https://github.com/Oliverknowledge/FairX
Release tag: submission-v2.2.0
Commit: 9b87378c3cca65b43643634f0159ccda23805e27
```

### Field: Demo video
```
<<PASTE YOUTUBE/LOOM URL HERE BEFORE SUBMITTING>>
```

### Field: Brief technical documentation — core idea, highlights, and the specific TxLINE endpoints used
```
CORE IDEA
FairX is execution-integrity infrastructure for operators running live sports markets. When a goal reaches
TxLINE before the market updates its executable quote, the operator must either eat an obsolete-price
liability, suspend every trader, or silently cancel. FairX gives them a fourth option: return the obsolete
order's principal atomically, keep synchronized trading open, and make the decision independently verifiable.

DEPLOYED RULE (exact, three-way)
  OrderSequence <  RequiredSequence -> STALE_SEQUENCE_RETURNED  (full principal returned, zero liability)
  OrderSequence == RequiredSequence -> ACCEPTED                 (position + fixed liability reserved)
  OrderSequence >  RequiredSequence -> FUTURE_SEQUENCE          (rejected as invalid)

TECHNICAL HIGHLIGHTS
- Custom on-chain settlement engine: FairX Vault V4, Solana devnet
  2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p
- DIRECT CPI into TxLINE's official devnet program 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J:
    verify_txline_quote          -> TxLINE ValidateOdds    (pre-goal + post-goal executable quotes, 2/2)
    prove_resolution_with_txline_v4 -> TxLINE ValidateStatV2 (final result, France 2-0, sequence 1114)
  execute_resolution_v4 REQUIRES resolution_receipt.direct_cpi_verified -- settlement cannot execute
  without a successful TxLINE CPI. TxLINE is the gate on the money, not a display source.
- Atomic principal return: the stale stake enters and leaves the vault within a single instruction; the
  position account is permanently REFUNDED and can never claim.
- Fully collateralised fixed payouts: gross payout frozen at acceptance, incremental liability reserved
  from free collateral, YES/NO reserved independently (no outcome netting). Vault invariant A = F + R + S
  asserted after every mutation.
- 24 finalized devnet transactions, 0 errors. Independent RPC verifier: VERIFIED 20/20.
- Reproducible build: deployed SBF is 422,040 bytes, sha256
  7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0 (hash the on-chain ProgramData to check).
- 330 app tests, 13 Rust tests.

BUSINESS HIGHLIGHT
On the canonical book, the guard prevented 0.008769297 SOL of old-price liability on 0.03 SOL of accepted
stake -- roughly 29% of turnover on a single goal -- without suspending the market.

TXLINE ENDPOINTS USED
Origin: https://txline-dev.txodds.com
  GET /api/fixtures/snapshot
      -> fixture identity and participants (France v Morocco, fixture 18209181)
  GET /api/scores/historical/18209181
      -> historical score/event sequence; source of the goal at material-event sequence 739
         and the final regulation result at sequence 1114
  GET /api/odds/updates/20643/21/5?fixtureId=18209181
      -> historical StablePrice updates; source of the pre-goal (52.274%) and post-goal (86.505%)
         quote proofs

TXLINE ON-CHAIN IDENTITIES USED
  Program (devnet):        6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
  Odds validation root:    ACo4UtSFM5jtUeQwkrWuv7uDS9qeNVQv858eRBTKpHxh
  Daily scores root:       EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr
  Instructions invoked:    ValidateOdds, ValidateStatV2

SCOPE (stated plainly)
The deployed program is intentionally pinned to the canonical France-Morocco fixture and its committed
TxLINE evidence; it is NOT generic across fixtures. Pinning is what makes the recorded lifecycle
tamper-evident -- the published numbers cannot be re-run with different inputs. Unaudited devnet
prototype: no mainnet, no real money, no users.
```

### Field: Feedback — what was your experience using the TxLINE API?
```
What we liked most: the on-chain validation interface is the single strongest thing in this stack, and it
made the best part of our prototype possible. Being able to take one captured Merkle proof, simulate it
read-only against the genuine devnet program to check our own work, and then consume that same proof by CPI
during real settlement is a genuinely rare property in a sports data feed. It let us build a custom check
gate whose correctness a judge can verify without trusting us at all. The normalised JSON schema also meant
the fixture, odds and score payloads composed cleanly into one deterministic quote transform.

Where we hit friction:
1. Discoverability across payloads. Getting from an authenticated API response to the exact bytes the
   on-chain program expects took a lot of trial and error -- root-account identity, epoch-day PDA
   derivation, IDL field naming and proof-period semantics were each a separate discovery.
2. Hash-domain confusion. The canonical-JSON capture hash and the Borsh CPI payload hash commit different
   serializations of the same evidence, which is correct but very easy to misread as a mismatch. We had to
   document the two domains explicitly to avoid convincing ourselves we had a bug.
3. Proof-period semantics. Working out which period's evidence constitutes the final regulation result
   (rather than a mid-game snapshot) was not obvious from the docs and is exactly the kind of thing a
   settlement engine must not get wrong.
4. Historical vs live labelling in examples. Examples do not always make it obvious whether a payload is
   historical or live, which makes it easy for a downstream product to accidentally overclaim liveness.

Highest-value fix: one canonical end-to-end example threading authenticated API response -> normalized proof
-> root PDA derivation -> read-only simulation -> CPI receipt. That single example would have saved us days
and is the difference between "TxLINE has proofs" and "developers actually settle on TxLINE proofs".
Secondary: stable fixture/version metadata and explicit historical-vs-live labels in every example.
```

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

LineGuard V3 is a separate deployed devnet predecessor. Its historical transactions are never used as V4 evidence and are intentionally absent from the primary judge journey.

## Limitations and trust assumptions

- unaudited prototype; devnet SOL only; no mainnet or real-money operation
- deterministic runtime simulation, not a live external TxLINE feed or connected-wallet trading
- **canonical V4 scope (pinned by design):** the deployed reference implementation is intentionally pinned to the recorded France–Morocco fixture and its committed TxLINE evidence. `CANONICAL_*` constants fix fixture identity, sequences and captured odds; `validate_canonical_identity` rejects any other market, so `initialize_market_v4` cannot bind a second fixture without new constants and a redeploy. Pinning is what makes the lifecycle tamper-evident. Runtime scenarios and IntegrationKit demonstrate the reusable policy interface, not additional on-chain fixture deployments; the next program release removes the canonical constants in favour of arbitrary fixture configuration
- France–Morocco is canonical captured evidence; the second fixture is an off-chain schema-compatible scenario with no on-chain proof claim
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

The tagged source, canonical lifecycle evidence, and production app form one release candidate. The final release check records reproducibility against that exact candidate and smoke-tests the public routes before submission.
