# FairX product truth

| Surface or claim | Classification | Truth |
|---|---|---|
| Archived v2 program/accounts/transactions | REAL | Finalized on Solana devnet at deployed slot `475831626`. |
| France–Morocco source evidence | HISTORICAL | Genuine preserved TxLINE evidence; never a current live feed. |
| Direct TxLINE CPI in archived record | REAL | `ValidateStatV2` succeeded for the recorded resolution payload. |
| Archived v2 winner payout | REAL but economically incomplete | The winner recovered its own `0.01 SOL`; there was no losing accepted counterparty. |
| Current signed order constraints and pool shares | REAL | Binary deployed at slot `475972063`; the canonical v3 lifecycle exercised the signed constraints and economic share paths. |
| A-wins-B three-wallet lifecycle | REAL | Fourteen finalized devnet transactions: A and B accepted, C alone refunded, A received A+B collateral, and all six user accounts closed. |
| Current `/proof` verdict | DERIVED from RPC | `VERIFIED` means 18 independent checks passed. RPC unavailability degrades to `UNKNOWN`, never success. |
| Displayed execution quote | DERIVED | Deterministic historical StablePrice transformation supplied by the pricing authority. |
| Economic price effect | REAL in current source/tests | Price determines pool shares; it is not decorative. |
| Price discovery | NOT IMPLEMENTED | No AMM, order book or permissionless oracle sets the quote. |
| Public wallet order flow | REAL when enabled on an unresolved compatible market | Wallet signs order and evaluation atomically. Archived resolved market disables it. |
| `/create` | REMOVED / STATIC | No fake local market creation is presented as deployment. |
| Attack lab and terminal scenarios | SIMULATED | Product exploration only; not proof of funds or TxLINE guarantees. |
| TxLINE odds guarantee | MISLEADING and prohibited | TxLINE evidence anchors events/scores; FairX's pricing authority and model produce odds. |
| Security/production readiness | FUTURE | Unaudited, upgradeable, operator-dependent, devnet only. |

Required visible qualifiers: `Devnet SOL`, `TxLINE historical`, `archived v2`, `price-weighted pool`, and `UNKNOWN` whenever RPC evidence is unavailable.

Prohibited claims: production-ready, trustless, decentralized odds, live canonical match, guaranteed fairness, audited, mainnet, real liquidity, or organic users.
