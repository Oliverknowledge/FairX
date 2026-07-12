# FairX demo video — 3:45 target

Use a 16:9 browser window at 1440×900 or 1920×1080. Record the canonical historical proof first; fresh devnet execution is optional and must never be the only usable route.

## Complete narration and page sequence

### 0:00–0:20 — Problem

Page: `/`

Clicks: none. Hold on the headline and France probability movement.

Narration:

> A goal can reach the data feed before a prediction market reprices. Fast bots can buy at the old price with information the market has not incorporated.

### 0:20–0:40 — Solution

Page: `/`

Clicks: point to the YES and NO outcome cards; do not open them yet.

Narration:

> FairX uses LineGuard, an on-chain settlement guard. It evaluates each order separately and refunds only trades that benefit from stale information. It does not freeze the whole market.

### 0:40–1:15 — Genuine TxLINE evidence

Page: `/walkthrough`

Clicks:

1. Click **Run the proof walkthrough**.
2. Keep stage 1 visible.
3. Point to `TxLINE historical`, France vs Morocco, fixture `18209181`, sequence `739`, the historical endpoint, both hashes, and `validateStatV2 PASSED`.
4. Click **Next stage** once to show `52.274%` before and `86.505%` after while the displayed price remains stale.

Narration:

> This is genuine TxLINE historical evidence, not generated sports data. FairX selected France versus Morocco from the fixture snapshot, preserved score sequence 739, and hashed the raw response before normalization. TxLINE StablePrice moved France from 52.274 percent to 86.505 percent. The score proof passed validateStatV2 separately. Scores are operator-submitted; the TxLINE Merkle proof is not re-verified inside LineGuard.

### 1:15–2:00 — YES exploit

Page: `/walkthrough`

Clicks:

1. Click **Next stage** to the YES order.
2. Point to `0.02 SOL`, the OrderEscrow PDA, and `+34.231¢`.
3. Click **Next stage** to the refund.
4. Open the YES evaluation transaction in a new tab only if Solana Explorer is responsive.

Narration:

> The market still displays the pre-event quote. A YES order escrows 0.02 SOL at that old price and receives 34.231 cents of positive stale edge. LineGuard reads material sequence 739 against priced sequence 738, evaluates the frozen order inputs, and returns VOIDED_REFUNDED. The full stake goes back to the trader.

### 2:00–2:35 — Receipt and tamper detection

Page: `/verify/rcpt-devnet-yes-3uqFKfEcAt`

Clicks:

1. Click **Next stage** to receipt verification.
2. Click **Open canonical YES receipt verifier**.
3. Point to payload integrity, normalized event, on-chain source-hash match, fixture commitment, validation metadata, MarketConfig, and transaction links.
4. For tampering, use the prepared tampered URL from the recording notes or paste a copy with one provenance field changed while retaining the original receipt hash.

Narration:

> The receipt is independently recomputable. It binds the genuine raw payload, normalized hash, validation root and payload hash, fixture commitment, order snapshot, verdict, destination, and four finalized transactions. Change a sealed endpoint, fixture, sequence, hash, or verdict and the verifier reports TAMPER DETECTED.

### 2:35–3:10 — NO safe trade

Page: `/walkthrough`, final stage, then `/verify/rcpt-devnet-no-TdYx89cGtQ`

Clicks:

1. Return to `/walkthrough` and advance to the last stage.
2. Point to `−34.231¢`, `STALE_ALLOWED_NO_EDGE`, and ProtocolVault.
3. Open the stable NO receipt route.

Narration:

> The opposite NO order sees the same stale market but has negative edge. It gains nothing from the lag, so LineGuard returns STALE_ALLOWED_NO_EDGE and finalizes exactly 0.02 SOL to ProtocolVault. The canonical vault balance increases by exactly 20 million lamports.

### 3:10–3:35 — Why it matters

Page: `/walkthrough`, final stage

Narration:

> LineGuard does not pause the whole market. It blocks only the side exploiting stale information. The safe side can still settle.

### 3:35–3:55 — Platform vision and close

Pages: `/create`, then `/integrate`

Clicks:

1. Open **Create Market** briefly to show market-specific configuration.
2. Open **Integrate** and point to the architecture and LineGuard program ID.

Narration:

> FairX demonstrates LineGuard, but any live prediction market could integrate the same settlement guard while keeping its own product and matching layer. Every prediction market can prove who won. FairX proves whether the trade was fair.

## Backup route when fresh devnet execution fails

Do not wait on a spinner during the recording. Use the immutable canonical sequence:

1. `/walkthrough`
2. `/proof`
3. `/verify/rcpt-devnet-yes-3uqFKfEcAt`
4. `/verify/rcpt-devnet-no-TdYx89cGtQ`
5. Open the already-finalized Explorer links from either receipt.

Say: “Fresh execution is temporarily unavailable, so I’m using the canonical finalized devnet proof. The transaction signatures and account commitments are the same independently verifiable evidence shown on the proof page.”

## Visual checklist

- Homepage headline and exact `52.274% → 86.505%` movement are readable.
- Browser zoom is 100%; no developer tools or secret-bearing terminals are visible.
- TxLINE historical label, fixture, sequence, endpoint, raw hash, normalized hash, and validation result are shown.
- YES OrderEscrow, positive edge, verdict, refund destination, and transaction link are shown.
- Receipt validation metadata and `INTEGRITY VERIFIED` are shown.
- A changed provenance field visibly produces `TAMPER DETECTED`.
- NO negative edge, verdict, vault destination, and exact 0.02 SOL increase are shown.
- Program ID is readable on `/integrate` or `/proof`.

## Recording checklist

- Use a clean incognito/private window against the production URL.
- Disable notifications, password-manager overlays, and browser bookmarks containing private information.
- Pre-open only the required FairX and Solana Explorer tabs.
- Confirm `/api/status` is healthy immediately before recording.
- Confirm both stable receipt routes load without query strings.
- Keep the recording under five minutes; target 3:45–3:55.
- Export 1080p H.264 with clear text and normalized audio.
- Watch the exported file once at 1× speed before uploading.

## Title and thumbnail

Title: **FairX — Selective Stale-Price Protection for Prediction Markets**

Thumbnail: split-screen outcome card with **YES +34.231¢ → REFUNDED** in red and **NO −34.231¢ → VAULT** in blue, plus a small “Genuine TxLINE evidence · Solana devnet” label.
