# FairX V4 four-minute narration

## 0:00–0:20 — hook

“A goal can reach the official feed before a prediction market updates its price. Fast traders can exploit that stale window. FairX refunds the stale attempt without freezing synchronized positions.”

## 0:20–0:45 — product

“This is FairX Vault V4, a fully collateralised fixed-payout market on Solana devnet. The operator funds every incremental payout liability. This interface replays one recorded France–Morocco lifecycle using genuine historical TxLINE evidence; the controls do not send new trades.”

## 0:45–1:15 — fair positions

“Before the goal, a 0.01 SOL YES and a 0.01 SOL NO position are accepted. Each receives a frozen gross payout, and the vault reserves gross payout minus stake independently. The solvency equation remains exact.”

## 1:15–1:45 — stale exploit

“TxLINE's confirmed France goal advances the material sequence from 738 to 739. The displayed old quote is now stale. When the bot attempts that old-sequence order, the stake enters and returns within one instruction. Its receipt is permanently refunded and can never claim.”

## 1:45–2:10 — market continues

“FairX does not freeze the whole market. A post-goal quote is validated against TxLINE and a synchronized YES position is accepted at the new sequence.”

## 2:10–2:45 — resolution and accounting

“The final TxLINE evidence is sequence 1114: France two, Morocco nil. Two of three configured authorities approve the derived YES result. Both YES positions receive 30,200,572 lamports in total; the NO position closes lost. Two hundred million operator lamports plus thirty million accepted principal, minus payouts, leaves exactly 199,799,428 lamports for the operator to withdraw. Every final vault field and every open position reaches zero.”

## 2:45–3:30 — independent proof

“This is not only a local model. The V4 program is executable on Solana devnet. Its ProgramData contains the exact 422,040-byte binary with SHA-256 7917273c…bffc71f0. The canonical lifecycle contains 24 finalized transactions, and the independent verifier re-fetches the program, accounts, TxLINE roots, transaction messages, balance changes, refund, payouts, solvency, and closures. It currently returns VERIFIED, 20 out of 20. The V3 panel below is explicitly separate historical predecessor evidence, verified 18 out of 18.”

## 3:30–3:55 — limits and close

“FairX is an unaudited, operator-controlled devnet prototype using a historical fixture replay. It is not an AMM, order book, or real-money product, and its upgrade authority is still a single key. What it proves is focused: refund the stale exploit, keep fair positions valid, pay every accepted liability, and reconcile every lamport.”

Full recording instructions and fallback shots: `docs/final-audit/DEMO_VIDEO_FINAL.md` and `docs/final-audit/VIDEO_STORYBOARD.md`.
