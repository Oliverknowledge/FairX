# FairX — final demo script

Target length: **2:20–2:45**

Primary audience: **TxLINE and Solana hackathon judges**

Core sentence: **FairX removes the informational advantage and keeps fair trading open.**

## 0:00–0:18 — The product in five seconds

**Screen:** Open `/`. Hold on the headline, match and market first screen.

**Narration:**

> FairX is an execution firewall for live prediction markets. When a sports event reaches TxLINE before a quote catches up, a latency bot sees free money. FairX sees the stale sequence.

Point out the visible qualifier: **Runtime simulation using captured TxLINE-schema events.** Never call it a live external feed.

## 0:18–1:12 — Run the exploit

**Screen:** Click **Run exploit**. Let autoplay run. Follow the six stage pills without scrolling away from the demo.

**Narration:**

> France and Morocco are scoreless. Event sequence 738 and quote sequence 738 match, so the market is synchronized and open. A captured goal event arrives and advances TxLINE to 739. The market is still priced at 738, so it is now stale. A latency bot submits YES at the obsolete 53.28-cent price.

Pause when stage 4 appears.

> FairX evaluates the sequence and direction. The YES order gained 34.20 cents of immediate pricing advantage, so FairX voids it, atomically returns the full 0.01 SOL principal, creates no position liability, and leaves the market open.

Hold on the split-screen comparison for two seconds.

> Without FairX, the bot captures the stale-price advantage. With FairX, that advantage is zero and honest traders keep access.

Continue through stages 5 and 6.

> Once quote sequence 739 catches up, the next fair order succeeds at the updated price.

## 1:12–1:38 — Prove reuse

**Screen:** Click **ARG–BRA**, then click stage 4 or use **Next step** three times.

**Narration:**

> This is the same deterministic engine with a different fixture and a red-card event. Here the incoming NO order did not benefit from the stale state, so the guard returns a different result: allow, no informational edge. This scenario proves reusable off-chain architecture; it makes no canonical on-chain evidence claim.

Point briefly at: **Same FairX guard. Different fixture. Different event. Same deterministic protection.**

## 1:38–1:53 — How it works

**Screen:** Scroll to **How It Works**.

**Narration:**

> The flow is deliberately small: event arrives, FairX compares event sequence, quote sequence and order direction, one advantageous order leaves, and synchronized trading continues. FairX is infrastructure for existing market frontends, not another destination market.

## 1:53–2:28 — Canonical proof

**Screen:** Open `/proof`. Hold on the first screen only.

**Narration:**

> The runtime explains the product. This separate page proves the canonical deployment. FairX Vault V4 is executable on Solana devnet. Twenty-four finalized transactions independently verify the 0.01 SOL stale-order return, both fixed payouts, final accounting, and direct TxLINE CPI validation for the odds and France two–nil result—20 checks out of 20.

Point to the three cards: **Order protection**, **Settlement and accounting**, **TxLINE verification**.

## 2:28–2:42 — Close

**Screen:** Click **View full technical evidence** once, show that the deeper dossier exists, then return to the proof summary.

**Narration:**

> Every explorer link, transaction, binary hash, trust boundary and known limitation remains available underneath. FairX does not pause the whole market. It removes the informational advantage and keeps fair trading open.

## Backup plan

- The runtime is fully deterministic. If autoplay timing is disrupted, use the six stage buttons or **Next step**.
- Do not run a fresh RPC scan on camera. Use the timestamped 20/20 result and explorer links.
- If an explorer is slow, remain on the proof cards; the exact links are already visible.
- Do not open V3 predecessor evidence unless asked in Q&A.
- Do not show a wallet or imply that the runtime buttons send transactions.

## Recording setup

- Record at 1920×1080, 100% browser zoom, with notifications and bookmarks hidden.
- Begin with `/`, keep `/proof` in a second tab, and close unrelated tabs.
- Move the cursor slowly and pause on the atomic-refund and split-screen payoff.
- Record three complete takes and keep the final export below three minutes.
