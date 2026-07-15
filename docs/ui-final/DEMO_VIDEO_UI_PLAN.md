# FairX demo video UI plan

## Recording setup

- Title: **FairX — The market that refunds the exploit, not the game**
- Thumbnail text: **GOAL. STALE PRICE. FULL REFUND.**
- Target duration: **3:50**
- Browser: Chromium, 100% zoom, 1440×900, bookmarks bar hidden, pointer visible.
- Tabs, left to right: homepage; canonical replay; proof; Solana Explorer program account as a backup only.
- Start with replay at stage 1, paused, speed 1.5×. Do not depend on a live match or send transactions.

## Shot list, narration and clicks

| Time | Screen / exact action | Exact narration | Expected state / screenshot |
|---|---|---|---|
| 0:00–0:15 | Homepage. No click for 8 seconds, then hover **Watch the protected market**. | “Live sports markets should not reward whoever sees the goal first. FairX protects a market when a real-world event arrives before the displayed price catches up.” | Hero and provenance; `homepage-desktop-hero.jpg`. |
| 0:15–0:35 | Click **Watch the protected market**. Pause on the provenance banner and header. | “This is a genuine TxLINE historical replay of France versus Morocco—not a live match and not a simulation. The full settlement is recorded across 24 finalized Solana devnet transactions.” | Replay stage 1; `replay-initial.jpg`. |
| 0:35–0:55 | Click **Next event** once. | “Before the goal, fair YES and NO positions open at 53.28 percent. Their fixed payout liabilities are reserved, so the vault is fully collateralised from the start.” | Stage 2; `replay-pre-event-position.jpg`. |
| 0:55–1:10 | Click **Next event**. | “Then TxLINE records France’s genuine historical goal at material sequence 739.” | Stage 3; `replay-goal-event.jpg`. |
| 1:10–1:25 | Click **Next event**. Let the two prices sit for four seconds. | “The fair probability moves to 87.48 percent while the displayed market is briefly stuck at 53.28. That 34.20-point gap is the exploit window.” | Stage 4; `replay-stale-gap.jpg`. |
| 1:25–1:38 | Click **Next event**. | “A bot tries to buy YES at the old sequence-738 price with 0.01 SOL.” | Stage 5; `replay-exploit-attempt.jpg`. |
| 1:38–1:50 | Click **Next event**. Hold on the refund flow. | “LineGuard rejects only that order and returns the entire stake atomically. No position is created. The market remains open.” | Stage 6; `replay-refund.jpg`. |
| 1:50–1:59 | Click **Next event**. | “The displayed price catches up and the market returns to synchronized.” | Stage 7; `replay-repriced.jpg`. |
| 1:59–2:10 | Click **Next event**. | “A new fair trade at sequence 739 is accepted. FairX did not freeze the market after the goal; it refunded only the exploitative trade.” | Stage 8; `replay-valid-trade.jpg`. |
| 2:10–2:22 | Click **Next event**. | “Final TxLINE evidence records France winning two–nil in regulation time, and the approved resolution authorities settle YES.” | Stage 9; `replay-resolution.jpg`. |
| 2:22–2:40 | Click **Next event**. | “Both valid YES positions receive their frozen payouts. The honest NO position closes as a normal losing trade.” | Stage 10; `replay-payout.jpg`. |
| 2:40–3:05 | Click **Next event**. Trace the equation with the pointer. | “Now the accounting: 0.20 SOL from the operator, plus 0.03 SOL of accepted principal, minus 0.030200572 SOL in payouts, equals the exact 0.199799428 SOL operator withdrawal. Free collateral, reserved liability, pending refunds and open positions all finish at zero. Every lamport reconciles.” | Stage 11; `replay-final-reconciliation.jpg`. |
| 3:05–3:20 | Click **Proof**. Pause on deployment, then scroll to Layer 2. | “The interface is not the source of truth. The V4 program is executable on devnet, its binary matches the manifest, and the verifier independently re-reads the finalized lifecycle.” | `proof-v4-deployed.jpg`, then `proof-v4-verified-20of20.jpg`. |
| 3:20–3:35 | Point to **VERIFIED 20/20**, the four proof outcomes, then the collapsed transaction row. | “Twenty of twenty checks verify all 24 transactions, the stale refund, winner payouts and final solvency. Raw transaction evidence remains one disclosure away.” | Layer 2 verified, transactions collapsed. |
| 3:35–3:50 | Return to homepage asymmetric cards. | “FairX’s idea is simple: block the stale-price advantage, not the market. Fair trades continue, winners are paid on Solana, and every liability is independently auditable.” | `homepage-asymmetric-protection.jpg`. |

## RPC-failure backup shot

If devnet is rate-limited during recording, do not wait on camera and do not claim a fresh success. Cut to `proof-v4-verified-20of20.jpg`, label it **Earlier read-only RPC verification from this canonical lifecycle**, then show `proof-rpc-unavailable.jpg` and say: “The public RPC is unavailable right now, so FairX shows no success state. The finalized signatures and Explorer links remain available.”

Do not use `proof-verifier-failed-controlled.jpg` in the submission video; it is a UI test fixture, not evidence.

## Recording checklist

- Run `npm run build` and serve the production bundle before recording.
- Open only the four tabs listed above; preload proof once and confirm either VERIFIED or the backup-shot plan.
- Confirm 100% zoom, 1440×900 viewport, reduced notification noise and no wallet prompts.
- Restart replay, select 1.5×, then leave it paused at stage 1.
- Keep the pointer below headlines and numerical facts; no fast circular movement.
- Speak “TxLINE historical replay” every time provenance is introduced; never say live or simulated.
- Do not expand raw signatures in the main take.
- Record a clean second take of stages 3–8 and the reconciliation as edit fallbacks.
- Verify audio peaks, 3:30–4:00 duration and legibility at 1080p before export.

## Video description

“FairX is a protected live-sports prediction-market prototype on Solana. Using genuine historical TxLINE evidence from France vs Morocco, this demo shows a stale-price exploit refunded, a synchronized trade accepted, winners paid and every vault liability reconciled. The canonical V4 lifecycle contains 24 finalized devnet transactions and is independently re-verified 20/20 from RPC. Historical replay; unaudited hackathon prototype; no real-money settlement.”
