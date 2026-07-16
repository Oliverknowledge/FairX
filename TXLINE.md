# FairX × TxLINE

FairX uses genuine TxLINE historical fixture, score, stat-proof, and StablePrice odds evidence. It never labels this replay as live. TxLINE anchors event/result evidence; it does **not** guarantee FairX's displayed odds, pricing transform, liquidity, stale-edge threshold, or economic fairness.

## Canonical evidence

- Fixture: France vs Morocco (`18209181`)
- Material sequence: `739` (goal); final sequence `1114` (France 2–0)
- Stat keys: home `1`, away `2`
- StablePrice (raw home probability): France `52.274% → 86.505%` (the V4 UI adds a 1¢ per-side spread)
- TxLINE program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Odds validation root PDA: `ACo4UtSFM5jtUeQwkrWuv7uDS9qeNVQv858eRBTKpHxh`
- Daily scores root PDA: `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr`

## Exact authenticated API endpoints captured

Origin: `https://txline-dev.txodds.com`

- `GET /api/fixtures/snapshot` — fixture identity and participants
- `GET /api/scores/historical/18209181` — historical score/event sequence used for the goal evidence
- `GET /api/odds/updates/20643/21/5?fixtureId=18209181` — historical StablePrice updates used for the pre-goal and post-goal quote proofs

The checked-in fixtures contain the resulting payloads and hashes, never the JWT or API token. Configurable snapshot and stream paths are documented in `.env.example`, but they are not labelled as canonical inputs unless they contributed to this capture.

## Hash-domain separation

**TxLINE capture hash — canonical JSON domain**

`e4701bab0a8d2b8576eef7d2050ad032d3e090315129f51a732c8c6e5f2db598`

This commits the preserved canonical JSON score payload and is recomputed with the recursively key-sorted JSON serializer.

**TxLINE CPI payload hash — Borsh domain**

`1b1c31c9ffee2aec676fa9d9585e677c0c5ee42d38ec137f222fc87ea8501c98`

This commits the exact 606-byte Borsh `StatValidationInput` passed by LineGuard to TxLINE `ValidateStatV2`.

The hashes differ because they commit different serializations of the same underlying TxLINE evidence. They are never compared for equality. The verifier instead checks each representation in its own domain, then checks that fixture, sequence, stat keys, and scores agree.

## Current V4 validation

Two distinct layers are intentionally shown:

- **Read-only proof validation:** `npm run v4:verify-proofs` submits the exact `validate_odds` and `validate_stat_v2` inputs to the genuine TxLINE devnet program and confirms all three return `true`. It signs and sends nothing. This independently checks the captured proof material.
- **Finalized V4 CPI evidence:** the deployed V4 lifecycle contains finalized `verify_txline_quote` instructions for the pre-goal and post-goal odds and a finalized `prove_resolution_with_txline_v4` instruction for France 2–0. Those instructions validate the approved TxLINE root accounts and invoke the real TxLINE program by CPI. V4 records receipts only after TxLINE returns successfully.

TxLINE proof validation proves the source odds and sports evidence. QuoteGuard then proves that the executable quote followed the committed StablePrice update and `fairx-v4-demargin-spread-v1` transformation: normalized post-goal probability `86.4793%`, executable YES `87.4793%`, and executable NO `14.5207%`. This does not make the configured pricing authority permissionless or externally audited. The V4 verifier checks the CPI-bound receipts and lifecycle separately.

## Historical predecessor CPI (real, not V4 evidence)

An earlier LineGuard v2/v3 transaction (`2bqdPv1M2RUpRUh4kroVEaYXnC5t8soD1cm4rpMN5rAjW7NTgS36krH1zeT8TNh27VfJhtMMjK5PRonS1xH8oNjh`) invoked the real TxLINE program via a signed `ValidateStatV2` CPI on devnet. It is genuine predecessor evidence for a different program and is never presented as V4 evidence.

The capture and proof fixtures contain no authentication headers, JWTs, API tokens, or private keys. Runtime TxLINE credentials remain server-only.
