# FairX final UI screenshot index

Captured from the final local production build on 15 July 2026. Standard screenshots use the real canonical France–Morocco data and read-only devnet routes. `proof-verifier-failed-controlled.jpg` is the only intercepted test fixture and is labelled accordingly.

| File | Route | Viewport | State | Source | Judge takeaway |
|---|---|---:|---|---|---|
| `homepage-desktop-hero.jpg` | `/` | 1440×900 | Hero | local production build | The product, stale-price problem, CTA and provenance are understandable above the fold. |
| `homepage-mobile-hero.jpg` | `/` | 390×844 | Hero | local production build | Primary CTA and replay visual remain visible without horizontal overflow. |
| `homepage-full-local.jpg` | `/` | 1440×3600 | Full homepage | local production build | One page carries the attack, asymmetric protection, lifecycle and proof narrative. |
| `homepage-problem-visual.jpg` | `/` | 1440×900 crop | Five-step attack | local production build | Goal → stale price → exploit → refund → continued market is immediate. |
| `homepage-asymmetric-protection.jpg` | `/` | 1440×900 crop | Paired outcomes | local production build | FairX rejects the stale exploit but accepts the synchronized trade. |
| `homepage-lifecycle.jpg` | `/` | 1440×900 crop | Five lifecycle stages | local production build | Liquidity, positions, refund, payouts and zero liabilities form one story. |
| `homepage-proof-cta.jpg` | `/` | 1440×900 crop | Proof summary | local production build | The strongest deployment, transaction and final-state facts are one click away. |
| `replay-initial.jpg` | `/markets/france-morocco-v4-replay?stage=1` | 1440×1050 | Before goal | local production build | Market and TxLINE fair price are synchronized at 53.28%. |
| `replay-pre-event-position.jpg` | replay, `stage=2` | 1440×1050 | Fair orders accepted | local production build | Honest pre-event YES and NO liabilities are reserved. |
| `replay-goal-event.jpg` | replay, `stage=3` | 1440×1050 | Historical goal | local production build | Sequence 739 is visibly historical, not fake live activity. |
| `replay-stale-gap.jpg` | replay, `stage=4` | 1440×1050 | Price stale | local production build | Displayed 53.28% and fair 87.48% create a visible 34.20-point gap. |
| `replay-exploit-attempt.jpg` | replay, `stage=5` | 1440×1050 | Exploit enters | local production build | The bot’s stale 0.01 SOL attempt is the single suspect order. |
| `replay-refund.jpg` | replay, `stage=6` | 1440×1050 | Full refund | local production build | Stake out, guard check and full stake back; no position; market remains open. |
| `replay-repriced.jpg` | replay, `stage=7` | 1440×1050 | Repriced | local production build | The displayed price catches up and returns to synchronized. |
| `replay-valid-trade.jpg` | replay, `stage=8` | 1440×1050 | Post-goal trade | local production build | The market was not frozen; the fair 87.48% order is accepted. |
| `replay-resolution.jpg` | replay, `stage=9` | 1440×1050 | France 2–0 | local production build | Final TxLINE evidence resolves the market after regulation time. |
| `replay-payout.jpg` | replay, `stage=10` | 1440×1050 | Winners paid | local production build | Two YES payouts and the losing NO closure are easy to distinguish. |
| `replay-final-reconciliation.jpg` | replay, `stage=11` | 1440×1050 | Vault reconciled | local production build | Deposit + principal − payouts equals withdrawal; every liability is zero. |
| `replay-final-mobile.jpg` | replay, `stage=11` | 390×1800 | Mobile reconciliation | local production build | The equation stacks, controls remain usable and no value is clipped. |
| `positions-all-four.jpg` | `/portfolio` | 1440×1800 | Four user outcomes | local production build | Refund, winners and loser can be compared without account terminology. |
| `positions-technical-details-collapsed.jpg` | `/portfolio` | 1440×1800 | Details collapsed | local production build | PDAs and internal fields do not obstruct the user outcome. |
| `positions-mobile.jpg` | `/portfolio` | 390×1800 | Mobile outcomes | local production build | Status, stake and payout/refund remain readable and touch targets are preserved. |
| `proof-v4-deployed.jpg` | `/proof` | 1440×700 crop | Layer 1 | local production build | Program, ProgramData, slot and binary match are clearly deployed evidence. |
| `proof-v4-verified-20of20.jpg` | `/proof` | 1280×720 | Layer 2 verified | live read-only local browser | Fresh RPC result shows VERIFIED 20/20, 24 transactions, refund, payouts and solvency. |
| `proof-solvency.jpg` | `/proof` | 1440×700 crop | Exact accounting | local production build | “Every lamport reconciled” and the four zero buckets dominate the proof. |
| `proof-transactions-collapsed.jpg` | `/proof` | 1440×650 crop | Evidence collapsed | local production build | Twenty low-level checks are reachable but not dumped by default. |
| `proof-v3-predecessor.jpg` | `/proof` | 1440×500 crop | Layer 3 secondary | local production build | V3 is explicitly historical and not evidence for V4. |
| `proof-mobile-loading.jpg` | `/proof` | 390×1800 | Mobile + RPC loading | local production build | Deployment, truthful loading and reconciliation remain readable without overflow. |
| `proof-loading-local.jpg` | `/proof` | 1440×1800 | Initial RPC loading | local production build | Loading never receives a green verified treatment. |
| `proof-loading-interactive.jpg` | `/proof` | 1280×720 | Re-verify loading | local production build | Retry preserves the canonical accounting while a fresh read is pending. |
| `proof-rpc-unavailable.jpg` | `/proof` | 390×844 | Server deliberately stopped | controlled local outage | “Verifier unavailable” explains the failure and never implies success. |
| `proof-verifier-failed-controlled.jpg` | `/proof` | 1280×900 | FAILED 19/20 | controlled browser interception | A failed check is unmistakably red/labelled and is never conflated with VERIFIED. |

The controlled failure screenshot does not represent production or canonical evidence. It exists only to test the failure-state visual contract.
