# FairX final demo — 2:30

## Recording setup

- Desktop viewport at 1440 × 900, browser zoom 100%, no wallet extension popovers.
- Pre-open `/`, `/markets/france-morocco-v4-replay?stage=1`, `/integrate`, and `/proof` in that order.
- Use recorded replay controls only. They send no transactions.
- Keep the pointer still while speaking; click only on the beats below.
- Do not wait for live RPC during the recording. Record the verified proof state after a successful read and keep the live re-check button visible.

## Exact timeline

### 0:00–0:13 — buyer and problem

**Screen:** homepage hero, no scrolling.

**Narration:** “FairX is execution integrity for live sports markets. When sports evidence moves before an operator's quote, the operator normally accepts obsolete-information risk, pauses everyone, or cancels privately.”

**Camera:** hold on the headline and two-outcome operator card.

### 0:13–0:28 — product outcome

**Screen:** same hero; point once to quote 738/event 739, then to both outcome cards.

**Narration:** “FairX gives the order one objective eligibility rule: its quote sequence must match the latest material-event sequence. A mismatch returns principal and creates no position liability. The market stays open for synchronized orders.”

**Click:** “Watch the protected market.”

### 0:28–0:43 — chapter 1, fair market

**Screen:** replay chapter 1.

**Narration:** “This is a deterministic replay of genuine historical France–Morocco TxLINE evidence. At sequence 738, the displayed quote and the event state agree, so fair positions can open.”

**Click:** chapter 2, “Goal happens.”

### 0:43–1:01 — chapter 2, stale window

**Screen:** chapter 2. Advance once if needed to the scene showing event 739 while quote 738 remains.

**Narration:** “France scores. TxLINE advances the material event to 739, while the executable quote is still bound to 738. This narrow window is the entire problem.”

**Click:** chapter 3, “Principal returned.”

### 1:01–1:27 — climax

**Screen:** chapter 3 principal-return scene.

**Narration:** “The program compares 738 with required sequence 739. They do not match, so the 0.01 SOL principal returns atomically. No position or payout liability is created. Network fees are separate from returned principal.”

**Camera:** pause two seconds on the three-step sequence comparison.

**Narration:** “Return the stale order. Keep the market open.”

### 1:27–1:43 — the differentiator

**Click:** chapter 4, “Market continues.”

**Narration:** “This is not a global pause. The quote catches up to sequence 739, the next order executes at 87.48%, and its fixed payout liability is reserved.”

### 1:43–1:58 — settlement

**Click:** chapter 5, “Settlement verified.”

**Narration:** “The final France 2–0 proof resolves the market. Winners claim, the losing position closes, and every final liability and open position returns to zero.”

### 1:58–2:14 — why an operator integrates

**Click:** “For operators” in the primary navigation.

**Narration:** “FairX does not replace the operator's frontend, pricing model, discovery, or compliance. It adds four boundaries: fixture evidence, sequence-bound quotes, order eligibility, and program-constrained reconciliation.”

**Camera:** stop at the responsibility grid.

### 2:14–2:30 — why Solana and proof

**Click:** “Proof.”

**Narration:** “TxLINE remains the source-evidence dependency; pricing, resolution authorities, and upgrade authority are disclosed. Solana enforces the money and makes the 24 finalized transactions, liabilities, claims, and exact withdrawal independently re-readable. That is FairX: one objective execution rule, without shutting the market.”

**End frame:** trust boundary plus “Deployment” heading. No outro animation.

## RPC fallback

If devnet RPC is slow or rate-limited during judging:

1. Do not click “Re-check devnet.”
2. State: “The page distinguishes verified, unknown, and failed; an unavailable RPC is never rendered as success.”
3. Open the checked-in lifecycle manifest or run `npm run v4:verify-lifecycle` after the pitch if asked.
4. Never substitute a mocked success state. The deterministic replay remains available because it is presentation over recorded evidence, not a live-RPC claim.

## What to omit

- No install steps, test counts, PDA derivation, account-rent explanation, V3 history, or source-tree tour in the 2:30.
- No “bot,” “exploit,” “risk-free,” “trustless,” “full refund,” or “real-time demo” language.
- Do not narrate all eleven internal replay moments. Judges need the five chapters and the principal-return climax.
