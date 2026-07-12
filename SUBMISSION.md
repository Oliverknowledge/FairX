# FairX submission

## One-line description

FairX is a Solana devnet prediction market where LineGuard refunds stale-price exploitation, validates the result through direct TxLINE CPI, and pays a wallet-owned Position from an isolated market vault.

## Verified canonical lifecycle

- Program: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`
- Slot: `475831626`
- Genuine TxLINE historical fixture `18209181`, sequence `739`
- Deterministic France probability `52.274% → 86.505%`
- Exact stale `0.01 SOL` refund to the submitting wallet
- Synchronized `0.01 SOL` order created Position PDA `FvhAN2x2S1CNvAuu3EQDpQfnWg4cNXiGZkJySsqf9PMJ`
- Direct CPI to real TxLINE `ValidateStatV2`
- France `1–0` Morocco deterministically derived YES
- Resolution authorities A and B reached 2-of-3
- Position owner claimed `0.01 SOL`
- Isolated vault conserved `0.02 = 0.01 refunded + 0.01 paid + 0 claimable + 0 dust`

## Product and authority truth

The canonical automation used a secure test-user devnet keypair. It is not described as a Phantom signature. Phantom, Solflare, and compatible adapters are supported for public devnet user transactions.

Feed, pricing, emergency, and resolution roles are separated. Emergency can only void/refund. The program upgrade authority has not yet been transferred.

## TxLINE verification

The verifier keeps two domains separate:

- canonical JSON capture hash: `e4701bab0a8d2b8576eef7d2050ad032d3e090315129f51a732c8c6e5f2db598`
- exact Borsh CPI payload hash: `1b1c31c9ffee2aec676fa9d9585e677c0c5ee42d38ec137f222fc87ea8501c98`

They differ because they commit different serializations of the same underlying evidence. Fixture, sequence, stat keys and scores bridge the two verified representations.

## Judge route

1. `/`
2. `/walkthrough`
3. `/markets/france-morocco-france-win`
4. `/verify/v2-france-morocco`
5. `/proof`
6. `/portfolio`

## Limitations

- Unaudited prototype
- Solana devnet and Devnet SOL only
- No mainnet deployment or real-money operation
- Canonical match evidence is historical, not a currently live match
- Operator services remain responsible for TxLINE ingestion, pricing updates and proposing resolution evidence
- Only `MATCH_WINNER_HOME_V1` is supported by the canonical v2 settlement path
