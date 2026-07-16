# FairX — definitive submission demo script

**Target length: 3:15 (hard ceiling 3:20).** The listing allows up to 5:00; we deliberately do not use it. Every second below is assigned.

- **Audience:** TxODDS and Superteam judges. Assume technical, skeptical, and reviewing ~82 submissions.
- **Thesis:** FairX is execution-integrity infrastructure for operators running live sports markets.
- **Central line (closes the video):** *Return obsolete orders. Keep synchronized markets open.*
- **Emotional climax:** the returned-order moment at **1:00–1:20**. Everything else supports it.
- **Listing requirement this script satisfies explicitly:** "showing the problem, live app walkthrough, and **how TxLINE powers the backend**."

**Narration: 486 words ≈ 3:14 at 150 wpm.** Do not speed up to fit; cut a sentence instead.

---

## Recording setup

- 1920×1080, 100% browser zoom, no bookmarks bar, no notifications, cursor visible.
- **Use production** (`https://fair-x-psi.vercel.app`), not localhost. The URL bar is evidence.
- Pre-load in background tabs **before recording**: `/`, `/integrate`, `/proof`, and the Explorer Logs shot (see Fallbacks).
- Fixture toggle must read **FRA–MAR** for the whole take. Never switch to ARG–BRA on camera.
- Hard rules: never call the browser controls live trading; never imply a transaction was sent; never present the counterfactual as measured loss.
- Record 3 complete takes. Reject any take over 3:20.

---

## Timeline

| Time | Screen | Action / click | Narration | Judge takeaway |
|---|---|---|---|---|
| **0:00–0:08** | `/` hero | Hold. No cursor movement. | "A goal can reach TxLINE before a live prediction market updates its executable quote." | The problem is real and specific. |
| **0:08–0:18** | `/` hero subline | Cursor traces "operators running live sports markets" | "Operators normally either pause every trader, or risk executing against obsolete information. FairX gives prediction-market and sportsbook operators a third option." | **Customer named by 0:18.** |
| **0:18–0:30** | `/` evidence header | Point to `Recorded TxLINE evidence · Fixture 18209181` | "TxLINE supplies fixture-bound odds and event evidence. This is a recorded France–Morocco incident; the controls send no transaction." | Evidence boundary is honest. |
| **0:30–0:38** | Integrity panel | Point to `YES 53.28¢`, then event/quote `738 / 738` | "QuoteGuard deterministically derives the executable quote from that committed snapshot, so the operator cannot silently substitute another price." | TxLINE → quote is deterministic, not decorative. |
| **0:38–0:46** | Run control | **Click `Run integrity incident`** | "Watch one integrity window open and close." | Something is about to happen. |
| **0:46–0:56** | Score + panel | Follow `0–0 → 1–0`, event `738 → 739` | "France scores. TxLINE's material event sequence advances to 739. The quote is still bound to 738." | Cause is unambiguous. |
| **0:56–1:04** | STALE state | Point to `SEQUENCE DELTA +1`, `STALE WINDOW OPEN`, then `MARKET STATUS OPEN` | "Delta plus one. The stale window is open — but the market is not suspended." | Measurable, not hand-waved. |
| **1:04–1:12** | Incoming order | Point to `Latency bot · order sequence 738` | "An order arrives carrying the old sequence." | The exact invalid input. |
| **1:12–1:20** | **Decision** | Trace `738 < 739`. **Hold 2 full seconds.** | "V4 applies a strict rule: an order behind the required event sequence cannot execute. **The stale trade stops. The market doesn't.**" | **CLIMAX. The deployed rule is unambiguous.** |
| **1:20–1:32** | Integrity receipt | Point to principal, then `Position created: No`, then `Liability created: 0` | "The trader gets a precise integrity receipt, not an unexplained cancellation: full 0.01 SOL principal returned, no position, zero liability." | Funds outcome is obvious. |
| **1:32–1:38** | Counterfactual | Point to `0.008769297 SOL` and its `ILLUSTRATIVE` label | "Beside it, explicitly labelled as arithmetic — the old-price liability the operator did not take." | No fabricated analytics. |
| **1:38–1:48** | Recovery | **Click `Synchronize and retry`** | "The operator synchronizes the quote instead of pausing every trader." | Recovery is part of the product. |
| **1:48–1:58** | Accepted | Point to `Fair trader · 739`, `ACCEPTED`, `739 = 739` | "Once the quote synchronizes, a distinct replacement order — new ID, new sequence — is accepted normally, and its fixed liability is reserved." | Fair trading continues. |
| **1:58–2:08** | **Click step `07 Settlement verified`** | Timeline completes | "At full time, FairX calls TxLINE's official validation program again to prove the final result." | End-to-end loop closes. |
| **2:08–2:18** | Settlement / panel | Point to `MARKET SETTLED`, `SEQUENCE DELTA 0` | "Winners are paid, the operator withdraws only free liquidity, and every remaining liability reconciles to zero." | Settlement is complete and bounded. |
| **2:18–2:26** | **Click `Integrate`** | Nav → `/integrate` | "Other market frontends receive a finite execution contract." | Developer-ready. |
| **2:26–2:32** | Lab · stale | **Click `Stale order`** → **`Run selected vector`** | "Stale order returns the principal." | Typed, testable. |
| **2:32–2:38** | Lab · synchronized | **Click `Synchronized order`** → **`Run selected vector`** | "Synchronized order is accepted. The browser lab is a no-send reference implementation — zero transactions." | Honest boundary. |
| **2:38–2:46** | **Click `Proof`** | Nav → `/proof` | "This is not a frontend-only simulation." | Here comes the evidence. |
| **2:46–2:58** | `/proof` CPI panel | Point to caller → **CPI** → callee `6pW64gN1…` | "The canonical V4 reference is deployed on Solana devnet, and it performs direct CPI into TxLINE's official program — ValidateOdds for both quotes, ValidateStatV2 for the final France 2–0 result." | **THE DIFFERENTIATOR.** |
| **2:58–3:04** | Gate sentence + optional Explorer splice | Point to `Settlement cannot execute without TxLINE` | "Settlement literally cannot execute without it: the program requires a verified TxLINE CPI receipt before it will pay anyone." | TxLINE is the gate on the money. |
| **3:04–3:08** | Proof summary | Point to `Verified 20/20`, `24 finalized transactions` | "An independent verifier confirms the binary, the atomic principal return, payouts and solvency — twenty checks out of twenty." | Independently verifiable. |
| **3:08–3:15** | `/` hero | Cut back to hero. Hold still. | "FairX turns an unverifiable stale-price decision into a deterministic, publicly auditable rule. **Return obsolete orders. Keep synchronized markets open.**" | Memorable thesis. |

---

## Exact click sequence (10 clicks, in order)

1. `Run integrity incident` — hero, right side
2. *(no click 0:46–1:32 — autoplay carries goal → stale → order → decision → receipt)*
3. `Synchronize and retry` — white button inside the integrity receipt
4. `07 Settlement verified` — last step chip in the bottom rail
5. `Integrate` — top nav
6. `Stale order` — vector 1
7. `Run selected vector`
8. `Synchronized order` — vector 2
9. `Run selected vector`
10. `Proof` — top nav

**Autoplay note:** `Run integrity incident` advances the scenario on its own. If it runs ahead of narration, use `Next step` to drive manually instead, or `Restart` and re-take. Never let the video show a stage the narration has not reached.

---

## Shot list

| # | Shot | Source | Duration | Notes |
|---|---|---|---|---|
| S1 | Hero headline | `/` | 0:18 | Static. Sets problem + customer. |
| S2 | Evidence header + panel | `/` | 0:20 | TxLINE fixture ID visible. |
| S3 | Incident run | `/` | 0:42 | The spine of the video. |
| S4 | Decision + receipt split | `/` | 0:18 | **Hero frame. Thumbnail source.** |
| S5 | Recovery + accepted | `/` | 0:20 | Must show the new order ID. |
| S6 | Settlement | `/` | 0:20 | Timeline all green. |
| S7 | Conformance lab (2 vectors only) | `/integrate` | 0:20 | Do **not** show all five. |
| S8 | TxLINE CPI panel | `/proof` | 0:22 | The differentiator. |
| S9 | Explorer Logs crop (optional) | pre-recorded | 0:02–0:03 | See fallback. |
| S10 | Close on hero | `/` | 0:07 | Central line. |

---

## Fallback shots (record these BEFORE the main take)

1. **Explorer Logs crop — optional 2–3s splice at 2:58.**
   Pre-record only. Open in advance:
   `https://explorer.solana.com/tx/5Qua7sbaufHDXeMsDYyyHVdPQVhwCRwE9KqbxaR9vtGpZ1WczWNyzDtJfUYdWQT8NGxBcarG5HQhySzWRFWuBz7r?cluster=devnet` → **Logs** tab.
   Crop to the lines showing `6pW64gN1… invoke [2]`, `Instruction: ValidateStatV2`, `Evaluation complete`.
   **Do not navigate to Explorer live.** It took ~11 seconds to load in testing and renders FairX as "Unknown Program" (no IDL published). Splice the crop; never risk the hang on camera.
2. **Static PNG of the `/proof` CPI panel** — insurance if production is slow during recording.
3. **Static PNG of the decision + receipt frame** — insurance for the climax.
4. If the demo desyncs mid-take: `Restart`, do not improvise. Re-take.

---

## Narration word count

| Section | Words |
|---|---|
| Hook + customer (0:00–0:18) | 46 |
| TxLINE + QuoteGuard (0:18–0:38) | 51 |
| Main incident (0:38–1:20) | 74 |
| Receipt (1:20–1:38) | 47 |
| Recovery (1:38–1:58) | 44 |
| Settlement (1:58–2:18) | 45 |
| IntegrationKit (2:18–2:38) | 41 |
| Proof + TxLINE backend (2:38–3:08) | 96 |
| Close (3:08–3:15) | 42 |
| **Total** | **486 words ≈ 3:14 @ 150 wpm** |

---

## Thumbnail

**Use the S4 frame:** the `STALE_SEQUENCE_RETURNED` decision beside the integrity receipt, with `MARKET STATUS: OPEN` visible in the same shot.

- Overlay text (2 lines max, top-left, white on the dark panel): **"The stale trade stops."** / **"The market doesn't."**
- Do not overlay the FairX logo over the numbers — the numbers are the product.
- Avoid a face-cam thumbnail. This is infrastructure; the evidence is the hook.

---

## What was deliberately cut, and why

| Cut | Reason |
|---|---|
| All five conformance vectors | Two make the point. Five is a test-suite tour and costs 15s of the climax's oxygen. |
| The ten-step operator workflow scroll | A static list. Reads as filler on video. |
| ARG–BRA runtime fixture | Correct and honest, but splitting the fixture story mid-demo invites "so which one is real?" Keep it for the interview. |
| Live Explorer navigation | ~11s load risk and an "Unknown Program" label. Pre-recorded crop only. |
| Live RPC re-verification on camera | Nothing to gain; a slow or `UNKNOWN` result on camera is pure downside. |
| The remaining 1:45 of allowed runtime | A tight 3:15 beats a padded 5:00. Judges are watching ~82 of these. |
