# FairX V4 demo recording gate

Target 3:45–4:05; maximum 5:00. Record the redeployed public app, not localhost, at 1920×1080 and verify the layout once at 390×844.

Required route: `/` → `/markets/france-morocco-v4-replay` → `/proof` → `/portfolio` → `/`.

Claims that are accurate on camera:

- the V4 program is deployed on Solana devnet at `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p`
- its deployed 422,040-byte SBF hashes to `7917273c…bffc71f0`
- the canonical lifecycle contains 24 finalized transactions and independently verifies 20/20 from RPC
- the UI is a deterministic replay using recorded historical TxLINE event, odds, and final-result proofs; replay controls send nothing
- the genuine TxLINE devnet program validates the three proof inputs; V4's finalized lifecycle also contains direct TxLINE CPI receipts
- 200,000,000 operator lamports + 30,000,000 accepted principal − 30,200,572 payouts = 199,799,428 free-liquidity withdrawal; all final vault fields and open positions are zero
- V3 is a separate historical predecessor and verifies 18/18

Required spoken limitations: unaudited, devnet only, historical fixture replay, operator-quoted price, single-key upgrade authority, no AMM/order book, and no real-money or connected-wallet trading.

Do not record while the public site still serves commit `be4adbf…`. Do not call the replay live trading, call historical evidence live TxLINE, call read-only simulation a transaction, or conflate V3 with V4.

The complete shot list, fallback plan, narration, and export checklist live in `docs/final-audit/DEMO_VIDEO_FINAL.md` and `docs/final-audit/VIDEO_STORYBOARD.md`.
