# FairX product-truth audit

Audited 2026-07-12 at repository commit `0cc0a99234b7c859740bc6882035229e0a56e620` plus the current uncommitted sprint changes.

## Surface classification

| Surface | Classification | Public meaning |
| --- | --- | --- |
| Homepage canonical metrics | canonical historical evidence | Genuine TxLINE historical event and StablePrice values; recorded legacy devnet transactions. |
| Homepage v2 claims | planned / locally verified | User-wallet, isolated-vault, Position, direct-CPI, and threshold flows are tested locally but not deployed. |
| Markets catalogue canonical card | genuine TxLINE historical + canonical historical evidence | Prices are from the captured TxLINE StablePrice payload. The current v2 execution status is deployment-pending. |
| Other catalogue cards | seeded UI state + local simulation | Local previews only. `TOTAL_GOALS`, `NEXT_GOAL`, and custom markets are unsupported for on-chain resolution. |
| Canonical market detail | genuine TxLINE historical + local preview of pending v2 devnet path | Wallet connection is real. Trading is disabled unless the expected v2 Market and MarketVault accounts exist on devnet. |
| Create-market flow | local simulation; legacy operator initializer where configured | It does not create an arbitrary securely resolvable market. Only `MATCH_WINNER_HOME_V1` is supported in v2. |
| Legacy order ticket / terminal | local simulation or operator-wallet transaction depending explicit mode | No browser-local order is described as an on-chain position. |
| v2 market order ticket | user-wallet transaction when the v2 market is deployed | Atomic `place_order_v2 + evaluate_order_v2`; the connected wallet pays, signs, owns the order and Position PDA, and receives any refund. |
| Portfolio | genuine Solana account reads | Shows only Position PDAs filtered by the connected trader public key. No seeded portfolio state. |
| Walkthrough | canonical historical evidence + operator-wallet transactions | Demonstrates the recorded legacy lifecycle; it is not a public user-wallet run. |
| Proof page | canonical historical evidence | Finalized legacy devnet transactions and separate TxLINE `validateStatV2` evidence. |
| Technical terminal | local simulation with optional operator-wallet routes | Developer surface; not market volume or public wallet activity. |
| Operator page | genuine server/runtime checks + canonical historical evidence | Reports configuration without exposing secrets. |
| Receipt verifier | deterministic local verification + canonical historical evidence | Recomputes receipt/event hashes. Legacy receipts do not prove in-program Merkle verification. |
| TxLINE server routes | genuine TxLINE when credentials exist; explicit historical fallback for the canonical fixture | Credentials remain server-only. No generated odds are substituted as TxLINE. |
| Legacy Anchor instructions | genuine Solana transactions, mostly operator-wallet | Shared ProtocolVault, OrderEscrow, root-bound receipt, operator-submitted scores, separate `validateStatV2`. |
| v2 Anchor instructions | locally verified; planned devnet upgrade | Per-market MarketVault, wallet-owned Position, deterministic odds commitments, direct TxLINE CPI, 2-of-3 resolution, owner-signed claims. |
| Market fixtures | canonical historical evidence or seeded UI state | `fixtures/txline/canonical*` and finalized proof files are evidence; catalogue demo fixtures are local previews. |
| Pricing values | genuine TxLINE historical on canonical market; seeded elsewhere | Canonical v2 pricing derives `Pct[part1]` deterministically through `txline-demargined-pct-v1`. |
| Volume/liquidity/users/profit | not presented as market facts | The attack lab uses explicitly labelled sandbox units. No public volume, liquidity, user count, or profit is claimed. |
| Legacy settlement | genuine operator-wallet devnet transaction | Historical shared-vault parimutuel payout. |
| v2 settlement | locally verified | Direct TxLINE CPI derives scores/outcome, threshold approval resolves, and the wallet owner signs the claim. |

## Current public labels

- `Devnet SOL only.`
- `TxLINE historical.`
- `Canonical verified proof.`
- `Local preview.`
- `User-signed devnet order.` only after a wallet signature exists.
- `On-chain position.` only after the Position PDA contains accepted lamports.
- `Devnet settled.` only after resolved state and a claim transaction exist.
- `Resolution proof validated separately.` for the historical legacy path.
- `Direct TxLINE CPI verified.` only for a v2 receipt whose on-chain flag is true.

## Deployment truth

The v2 binary is not deployed. The current devnet ProgramData capacity is `316672` bytes while the reviewed local artifact is `600192` bytes (SHA-256 `08e426ea3c8fbd8c3b651567dae7ee143a80f9d0470f6437e6e5c8caf37ea861`). Deployment requires a separate `283520`-byte program-data extension and upgrade transaction. The configured operator key is also the current program upgrade authority; this must be separated before claiming reduced deployment-authority risk.
