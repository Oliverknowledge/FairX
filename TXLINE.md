# FairX × TxLINE

FairX uses genuine TxLINE historical fixture, score, stat-proof, and StablePrice odds evidence. It never labels this canonical replay as live.

## Canonical evidence

- Fixture: France vs Morocco (`18209181`)
- Material sequence: `739`
- Stat keys: home `1`, away `2`
- StablePrice: France `52.274% → 86.505%`
- TxLINE program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Daily root PDA: `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr`

## Hash-domain separation

**TxLINE capture hash — canonical JSON domain**

`e4701bab0a8d2b8576eef7d2050ad032d3e090315129f51a732c8c6e5f2db598`

This commits the preserved canonical JSON score payload and is recomputed with the recursively key-sorted JSON serializer.

**TxLINE CPI payload hash — Borsh domain**

`1b1c31c9ffee2aec676fa9d9585e677c0c5ee42d38ec137f222fc87ea8501c98`

This commits the exact 606-byte Borsh `StatValidationInput` passed by LineGuard to TxLINE `ValidateStatV2`.

The hashes differ because they commit different serializations of the same underlying TxLINE evidence. They are never compared for equality. The verifier instead checks each representation in its own domain, then checks that fixture, sequence, stat keys, and scores agree.

## Direct CPI result

Transaction `2qSJAY4iuFnkvtrAtXDxCWKfJP8kwA2dpG8HJsSvWRFEfpwsot8EZNYgXaXmosVZxkvakiY1Bpx7GeAyCLx3ank7` invoked the real TxLINE devnet program. `ValidateStatV2` returned success. LineGuard recorded `direct_cpi_verified=true`, derived YES from France `1–0` Morocco, and accepted no caller-supplied outcome.

The capture and proof fixtures contain no authentication headers, JWTs, API tokens, or private keys. Runtime TxLINE credentials remain server-only.
