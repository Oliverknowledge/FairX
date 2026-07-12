# FairX product truth

| Surface | Classification | Public truth |
|---|---|---|
| Homepage | verified v2 devnet evidence | Shows slot `475831626`, direct TxLINE CPI, 2-of-3 resolution, isolated vault and wallet-owned Position. |
| Canonical market | genuine TxLINE historical + genuine Solana devnet accounts | Public settled state is visible without a wallet. New trading is disabled because the canonical market is resolved. |
| Public wallet ticket | user-wallet devnet transaction | Phantom, Solflare and compatible adapters sign public orders. No operator routing. |
| Canonical lifecycle wallet | secure test-user devnet keypair | It is a user-owned devnet wallet lifecycle, not a Phantom-signed canonical proof. |
| Position | genuine wallet-bound PDA | `FvhAN…f9PMJ`, accepted `0.01 SOL`, claimed. |
| MarketVault | genuine isolated PDA | `0.02` deposited, `0.01` refunded, `0.01` paid, zero claimable and dust. |
| TxLINE | genuine historical evidence | Fixture `18209181`, sequence `739`; canonical replay is never labelled live. |
| Resolution | genuine direct TxLINE CPI + threshold transactions | `ValidateStatV2` passed; outcome derived from 1–0; approvals A and B reached 2-of-3. |
| V2 receipt verifier | deterministic browser verification | Reconstructs JSON and Borsh hash domains and detects tampering; explorer links are recorded evidence, not live RPC checks. |
| Portfolio | genuine Solana account reads | Shows only Position PDAs for the connected wallet; no seeded positions. |
| Legacy proofs | canonical historical evidence | Kept under **Historical protocol versions**, never presented as the current primary lifecycle. |
| Custom/demo markets | local preview unless explicitly submitted | Unsupported templates are not presented as v2 automatic settlement. |

## Required labels

- `Devnet SOL only.`
- `TxLINE historical.`
- `Direct TxLINE CPI verified.`
- `User-owned devnet wallet lifecycle.`
- `On-chain position.`
- `Devnet settled.`
- `Historical protocol versions.`

## Prohibited claims

FairX does not claim mainnet, real-money operation, complete decentralization, an independent security audit, impossible exploitation, fake users, fake liquidity, or fake volume.

The program upgrade authority remains `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq` and has not been transferred.
