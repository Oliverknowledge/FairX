# FairX V4 evidence hierarchy

`/proof` separates reproducible artifacts, the deterministic replay, finalized V4 evidence and the historical V3 predecessor.

## 1. Real and reproducible today

- **Reproducible build.** The pinned toolchain (Rust 1.89.0 · Anchor 1.1.2 · Solana 3.1.10 · platform tools 1.52) rebuilds a byte-identical SBF, `sha256 7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0`, 422,040 bytes. `bash scripts/fairx-v4-reproducibility.sh`.
- **Live TxLINE devnet validation.** The genuine TxLINE devnet program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` validates all three settlement proofs by read-only RPC simulation and returns `true`:
  - pre-goal StablePrice odds (odds root `ACo4UtSFM5jtUeQwkrWuv7uDS9qeNVQv858eRBTKpHxh`)
  - post-goal StablePrice odds (same odds root)
  - final France 2–0 result, sequence 1114, `validate_stat_v2` (scores root `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr`)
  No transaction is signed or sent. `npm run v4:verify-proofs`.
- **Deployed devnet program.** The executable Program and ProgramData accounts are live; the temporary upload buffer was drained and purged.
- **Live deployment status.** `/proof` reads the program and buffer accounts on every load and reports `DEPLOYED` / `BUFFER_FUNDED` / `NOT_STARTED` / `UNKNOWN`. It never asserts deployment; RPC failure degrades to `UNKNOWN`.
- **V4 lifecycle evidence.** The recorded fixture identifies 24 real finalized devnet transactions. The verifier re-fetches them and the durable accounts from RPC and currently returns `VERIFIED` for all 20 checks.

## 2. Deterministic replay UI

The lifecycle on `/markets/france-morocco-v4-replay` and `/portfolio` is a deterministic replay using recorded TxLINE event, odds and final-result proofs. Ten invariants hold — fixture isolation, both StablePrice branches, the confirmed goal (seq 739), final-not-mid-game evidence (seq 1114, 2–0), regulation-time period 100, strict stale invalidation, frozen fixed payouts, every `A = F + R + S` snapshot, and final solvency.

Replay controls do not submit new trades. `/proof` separately verifies the real finalized devnet transactions.

## 3. Finalized on-chain proof

Program `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p` is deployed. The 24-transaction lifecycle is re-read from RPC — program bytes, real signatures, account owners, TxLINE receipts, settlement fields, balance deltas and closed positions — and currently verifies 20/20.

## Historical predecessor (not V4 evidence)

An earlier LineGuard v2/v3 program was deployed to devnet and independently RPC-verified for the France–Morocco three-wallet lifecycle. It demonstrates that the team ships and verifies on-chain settlement, but it is a **different program**; its transactions are never presented as V4 evidence.
