# FairX — 90-second demo script

Target: 90 seconds. One browser tab (https://fairx.vercel.app) + one Solana Explorer tab. Calm, evidence-first.

---

**0:00–0:12 — The problem (home page hero)**

> "In a live prediction market, a goal moves the true odds *before* the book reprices. A bot buys the stale price with a guaranteed edge. Cancelling every trade is too blunt — it punishes the honest side too."

Show the home hero and the France 52.274% → 86.505% probability jump.

**0:12–0:30 — The insight: selective protection**

> "FairX uses genuine TxLINE data. When TxLINE sees the goal, LineGuard refunds *only* the side exploiting the stale price. The honest counterparty still settles."

Scroll to the two verdict cards: `YES attack → VOIDED_REFUNDED → refunded`, `NO trade → STALE_ALLOWED_NO_EDGE → finalized`.

**0:30–0:48 — It's a complete market, not just a guard**

> "But FairX isn't only a guard — it closes the whole settlement loop on-chain. Fill, protect, resolve, pay."

Show the "A complete market, not just a guard" lifecycle band (Fill → Protect → Resolve → Pay). Click "See the settlement proof."

**0:48–1:12 — On-chain settlement evidence (/proof#settlement)**

> "Here's a real devnet run. Both sides staked 0.02 SOL into their parimutuel pools. LineGuard derived the outcome from operator-submitted scores bound to the genuine TxLINE root account. The separate validateStatV2 check passed. The winning side collected the full 0.04 SOL pool — a 2× payout — from the ProtocolVault."

Show the settlement panel: pools, 2× winner payout, winner `Settled`, loser `Filled`. Click the **Resolve** and **Settle** transactions — open them in Solana Explorer to show they're finalized.

**1:12–1:24 — Verifiable, honest**

> "Every claim links to evidence. Receipts are tamper-evident — change the rule, team mapping, stat keys, score, or outcome and verification fails. The limitation is explicit: the TxLINE Merkle proof is validated separately, not inside LineGuard."

Show the runtime status strip (`settlement-v3`, `fresh proof available`) and a receipt verify link.

**1:24–1:30 — Close**

> "FairX: fair settlement for live prediction markets — the complete loop, on Solana, powered by TxLINE."

Show program ID `6k8uu3N8…HWDSe` and the app URL.

---

## Backup live shot (optional)

`POST /api/solana/lineguard/full-settlement-demo` runs the entire lifecycle live (fill YES + NO → resolve → parimutuel payout) and returns the seven signatures. Takes ~2–4 minutes to finalize, so prefer the pre-recorded `/proof#settlement` evidence for the 90-second cut.
