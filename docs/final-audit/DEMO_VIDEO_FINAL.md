# FairX final demo video

Target length: **3:55**. Maximum: 5:00. Record only after the audited candidate is deployed and its production proof page has completed V4 20/20 and V3 18/18 at least once.

## Title and publishing copy

**Title:** FairX — Refund the stale goal exploit, settle every fair position

**Thumbnail text:** THE GOAL ARRIVED. THE PRICE DIDN’T.

**Description:**

> FairX is a protected live-sports prediction-market prototype on Solana devnet. Genuine historical TxLINE odds, event and result evidence drives a fixed-payout operator vault. A stale post-goal attempt is refunded, synchronized positions continue, winners are paid, the loser closes, and an independent RPC verifier reconciles all 24 finalized transactions. Program: `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p`. Source and exact TxLINE endpoints: https://github.com/Oliverknowledge/FairX

## Word-for-word narration and exact page sequence

### 0:00–0:18 — Hook

Route: `/`
Shot: `screenshots/local-home-desktop.png` replaced by the equivalent production capture. Hold hero for 5 seconds, then scroll one viewport to the problem visual.
Narration: “A goal can reach the official feed before a prediction market updates its price. Fast traders can exploit that stale window. FairX refunds the exploit without freezing the whole market.”

### 0:18–0:40 — Product

Click: **Run the France–Morocco replay**.
Route: `/markets/france-morocco-v4-replay`
Shot: `screenshots/local-replay-01-funded.png`, production equivalent required. Point once to “recorded TxLINE” and once to the vault equation.
Narration: “This canonical France–Morocco replay uses genuine historical TxLINE odds, event and final-result evidence. The operator funds a fixed-payout vault, and every accepted position’s liability must already be free.”

### 0:40–1:05 — Fair pre-event positions

Clicks: **Advance replay** twice, stopping on scene 3.
Expected state: pre-goal quote 53.28 cents; honest YES and NO each accepted; reserve and principal increase; equation remains exact.
Narration: “Before the goal, an honest YES and an honest NO position each stake point-zero-one SOL. Their gross payouts are fixed at execution, and the vault reserves both liabilities independently. There are no pool shares and no hidden outcome netting.”

Fallback: use the top half of `screenshots/local-portfolio.png` while reading the same narration.

### 1:05–1:35 — Stale exploit

Clicks: advance to scene 4, pause on sequence 739; advance to scene 5.
Expected state: genuine goal invalidates quote sequence 1; stale bot stake is returned atomically and the position is terminal `REFUNDED`.
Narration: “The confirmed France goal advances the material sequence to seven-three-nine. The trader still tries to buy at the old quote. FairX detects that mismatch and returns the full stake inside the instruction. The attempt never becomes accepted principal and can never claim.”

Fallback: use the bottom-left refunded card in `screenshots/local-portfolio.png`.

### 1:35–2:00 — Market continues

Click: advance to scene 6.
Expected state: post-goal price 87.48 cents; synchronized YES position accepted; solvency still exact.
Narration: “FairX does not freeze every trader. Once the quote is synchronized to sequence seven-three-nine, a new YES position executes at eighty-seven point four-eight cents. Fair orders continue while the stale exploit alone is neutralized.”

Fallback: use the bottom-right synchronized card in `screenshots/local-portfolio.png`.

### 2:00–2:35 — Final result and payout

Click: advance to scene 7, then scene 8.
Expected state: sequence 1114; France 2–0; period-100 keys; both YES positions paid; NO closes lost.
Narration: “Final TxLINE evidence at sequence one-one-one-four proves France won two nil in regulation time. Two of three resolution authorities approve YES. Both winning positions receive their fixed payouts, the NO position closes, and the refunded position stays permanently unclaimable.”

Fallback: `screenshots/local-portfolio.png`, which shows both claimed winners, the lost NO and the refunded attempt together.

### 2:35–3:00 — Reconciliation

Remain on scene 8 and point to the exact equation and zero final buckets.
Narration: “Two hundred million operator lamports, plus thirty million accepted user lamports, minus thirty million two hundred thousand five hundred seventy-two in payouts, leaves exactly one hundred ninety-nine million seven hundred ninety-nine thousand four hundred twenty-eight. The operator withdraws only that free remainder. Reserve, principal, refunds, open positions and final balance all reach zero.”

### 3:00–3:35 — Independent proof

Click: **Verify all evidence**.
Route: `/proof`
Expected production state: Layer 1 `DEPLOYED`; hash ending `bffc71f0`; Layer 2 `VERIFIED · 20/20`; 24 finalized transactions; reconciliation table; Layer 3 predecessor `VERIFIED · 18/18`. Open one explorer transaction in a prepared adjacent tab for no more than four seconds, then return.
Narration: “This is not accepted from replay copy. The exact program is deployed on Solana devnet. Twenty-four finalized transactions record the lifecycle, and an independent RPC verifier rechecks program IDs, accounts, TxLINE roots, balance changes, refund, payouts, withdrawal, solvency and closures. The older V3 proof is shown separately as predecessor evidence.”

Network fallback: play a genuine pre-recorded successful production proof scroll captured immediately before recording. Overlay “production capture — [date/time]”; do not use a mocked green state.

### 3:35–3:55 — Close

Click logo to return to `/`; hold the hero and canonical fixture card.
Narration: “FairX does not pause every trade when information changes. It refunds the stale exploit, keeps fair positions open, and proves the vault stayed solvent from quote to payout. FairX protects the data-sensitive moment before settlement—and proves every accepted liability was paid.”

## Recording checklist

- 1920×1080, 30 fps, browser zoom 100%, system text scaling default.
- Use a clean production browser profile; no localhost, devtools, bookmarks bar or personal extensions in-frame.
- Prepare exactly three tabs: homepage, proof page already verified, one canonical explorer transaction.
- Disable notifications, mail/calendar badges, password-manager prompts and OS focus interruptions.
- Use a visible but calm cursor; move only to the element being discussed; no circles or frantic hovering.
- Record voice through the best external microphone available at 48 kHz; peak near −12 dB; remove fan noise; make a ten-second test and listen back.
- Preload all pages, then perform one dry run with a stopwatch. Never wait silently for RPC on camera.
- Keep hashes, roots and signatures on screen briefly; do not read them aloud.
- Export H.264 MP4, 1080p, AAC audio; watch the exported file end-to-end at normal speed.
- Verify the public link is accessible without login, duration is under five minutes, description links work and no frame says localhost, candidate, undeployed or “impossible to exploit”.
