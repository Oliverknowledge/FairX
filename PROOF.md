# FairX proof hierarchy

## Current canonical proof: v3 three-wallet lifecycle

`/proof` and `/api/verify/v3-lifecycle` independently verify the target lifecycle from Solana devnet. The verifier checks capture and Borsh hashes, program and ProgramData ownership/hash, TxLINE identities, market/vault/receipt/proposal fields, evidence timestamps, threshold approvals, transaction finality, account closures and wallet balance deltas.

The canonical record is `fixtures/lineguard/v3-france-morocco-three-wallet.json`. Its 14 transactions are finalized. The verifier currently reports **VERIFIED** with 18 passed checks, zero failures and zero unknowns. It recomputes final wallet balances of A `0.06 SOL`, B `0.04 SOL`, and C `0.05 SOL`; excluding equal `0.05 SOL` setup funding, the economic deltas are `+0.01`, `-0.01`, and `0 SOL`.

The v3 record also proves `0.03 deposited = 0.01 refunded + 0.02 paid`, zero claimable collateral, zero rounding dust, and closure of all three Order and Position accounts. A temporary RPC outage changes the live verdict to **UNKNOWN**, not success.

## Archived v2 evidence

- Program: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`
- Deployed slot: `475831626`
- Market: `GRP8PvhytfrXku1WW5bnaWDgS7L14A84qNG51kRB5E2j`
- Vault: `2w9qFjUGNjdKjEw3tp9ko3SoCYdk19bwKoxixxZ6KyLb`
- Position: `FvhAN2x2S1CNvAuu3EQDpQfnWg4cNXiGZkJySsqf9PMJ`
- TxLINE fixture/sequence: `18209181` / `739` (historical)
- Direct CPI: `ValidateStatV2` succeeded
- Resolution: YES from France 1–0 Morocco, 2-of-3 approvals
- Accounting: `0.02 deposited = 0.01 refunded + 0.01 paid + 0 remaining`

That accounting is solvent, but the accepted pool contained only the winner's own stake. The v2 record must never be used to claim that a winner captured a loser's collateral.

## Polymarket reference-price proof (RECORDED EVIDENCE)

`/reference` and `/api/reference-quotes/fifwc-fra-esp-2026-07-14-france-win/history` verify the bundled
Polymarket reference capture. The verifier ([lib/polymarket/verify.ts](lib/polymarket/verify.ts))
recomputes `rawPayloadHash`, `mappingHash`, `normalizedQuoteHash`, and `pricingPolicyHash`, and
re-derives best bid/ask, midpoint, spread, depth, method and validity from the stored raw book. Four
statuses must pass: mapping verified, fixture/YES-orientation verified, order-book integrity verified,
reference quote verified. Tampering with any level, the midpoint, the mapping, the timestamp, or a hash
fails verification (32 unit tests in `lib/polymarket/*.test.ts`).

This is **RECORDED EVIDENCE** — a bundled capture re-verified offline. It never re-fetches Polymarket,
so it is never presented as **LIVE VERIFIED**. Live serving is labelled `LIVE`/`RECENTLY_CACHED`/
`HISTORICAL_CAPTURE`/`UNAVAILABLE`. The reference midpoint is an external market reference, not an
oracle; TxLINE remains the settlement source and this capture does not resolve the market.
