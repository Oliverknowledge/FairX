# FairX — final video sprint report

**Date:** 16 July 2026 · **Base commit:** `af199afec6c22aa87ab0b7b803f96007df23fb62` (tag `submission-v2.1.0`)
**Deadline:** 19 July 2026, 23:59 UTC · **Field:** 82 submissions, 3 prizes
**Scope:** judge-facing correctness, comprehension, TxLINE visibility, truthfulness. **No program, evidence, fixture, or economics changes.**

---

## 1. Official requirements checklist

Read from the live listing, not from memory. **The listing has exactly three judging criteria, not fifteen.**

| Official criterion (verbatim) | Status |
|---|---|
| **Core Functionality** — "Does the application smoothly ingest and operate using live **or simulated** TxLINE data feeds?" | ✅ Simulated is explicitly permitted; the listing itself notes matches end after the deadline so "there may not be live activity during review" |
| **User Experience & Use Case** — "Is the platform intuitive, and does it cover a compelling scenario for soccer fans or analytical users?" | ⚠️ Intuitive yes; serves analytical/operator users, **not fans** |
| **Code Quality & Logic** — "Is the application's resolution and validation code clean, well-documented, and deterministic?" | ✅ FairX's bullseye |

| Submission requirement | Status |
|---|---|
| Demo video ≤ 5 min, showing problem + walkthrough + **how TxLINE powers the backend** — *"absolute requirement to pass initial screening"* | ⏳ **Script ready (3:15). NOT YET RECORDED — the only blocker.** |
| Public repo | ✅ `github.com/Oliverknowledge/FairX`, public, tag pushed |
| Application access (deployed site or devnet endpoint) | ✅ `fair-x-psi.vercel.app`, all routes 200 |
| Brief technical documentation + **list of specific TxLINE endpoints used** | ✅ Paste-ready block in `SUBMISSION.md` |
| **Feedback: experience using the TxLINE API** | ✅ Paste-ready block in `SUBMISSION.md` |
| Deployed (mainnet or devnet) build using TxLINE feeds | ✅ devnet, 24 finalized txs |
| Must use TxLINE as a **primary** data source | ✅ Settlement is gated on a TxLINE CPI |
| Working build, not concept/wireframe | ✅ |
| Team ≤ 3; AI agents permitted if owned by a real person | ✅ Listing explicitly allows AI agents |
| Winner selection includes **live interview rounds** | ✅ `INTERVIEW.md` added |

**Architectural considerations — direct hits:**
- *"Contestants are invited to write custom on-chain settlement logic … utilize **CPIs into TxLINE's validate_stat**"* → FairX does exactly this (`ValidateStatV2`).
- *"If your team chooses to design **independent, custom check gates** … your effort will be **highly valued by the judges**"* → FairX is literally a custom check gate.
- *"No P2P asset transfers of the TxLINE credit token"* → not used; FairX settles in SOL. Compliant.

---

## 2. Initial defects found

| # | Defect | Severity | Status |
|---|---|---|---|
| 1 | **Conformance Lab showed a stale decision after selecting a new vector** — produced frames like `Expected: ACCEPTED / DECISION: STALE_SEQUENCE_RETURNED`, i.e. the product's core rule appearing to fail. Reproducible on every transition. On the video path. | **CRITICAL** | ✅ Fixed |
| 2 | **Canonical-fixture pinning undisclosed** in `PRODUCT_TRUTH.md` — the one gap in an otherwise exemplary honesty artifact, and the exact thing a code-reading judge finds themselves. | **HIGH** | ✅ Fixed on 5 surfaces |
| 3 | **Copy contradicted the frozen three-way policy** — `"otherwise ACCEPTED"` and `"exactly two outcomes"` both imply `>` is accepted. It is `FUTURE_SEQUENCE`. | **HIGH** | ✅ Fixed |
| 4 | **Customer never named above the fold** — took ~90s to infer "operator" from the homepage. | **MEDIUM** | ✅ Fixed |
| 5 | **TxLINE differentiator underexposed** — the real CPI was one grid cell on `/proof`. | **MEDIUM** | ✅ Fixed |
| 6 | **Stale test count** — `/proof` claimed 317 app tests. | **LOW** (overclaim) | ✅ Now 330, test-pinned |
| 7 | **Stale base commit in README** (`26db8b5` vs release `af199af`). | **LOW** | ✅ Now references the tag |

**Non-defects investigated and dismissed:**
- `/markets/france-morocco-v4-replay` returned 500 locally → **local `.next` cache collision** from running `next build` alongside `next dev`. Production returns 200; clean restart returns 200. Not a regression.
- Blank screenshots at scroll offset → browser-tool capture artifact; DOM hit-testing and `opacity` confirmed content painted.
- `"13 Rust"` tests → verified accurate (12 in V4 + 1 in lineguard).
- `"trustless"` / `"audited"` keyword hits → all correctly negated or marked `PLANNED`.

---

## 3. Conformance Lab fix

**Root cause:** `outcome` state was never cleared when `selected` changed ([IntegrationKitDemo.tsx:27](../../components/integration-kit/IntegrationKitDemo.tsx)), so the previous vector's decision persisted beside the new vector's expectation.

**Approach:** extracted the lab's state machine into a **pure, testable module** — [lib/integration-kit/lab-view.ts](../../lib/integration-kit/lab-view.ts) — rather than adding a DOM test dependency three days from the deadline. The repo's vitest config is deliberately `environment: "node"` / "pure logic only"; this respects that.

**Behaviour now:**
- Selecting a vector → `selectCase()` discards the outcome → panel shows **READY TO RUN** in muted slate (visually distinct from a decision), typed response shows a placeholder, `aria-live="polite"`.
- After Run → actual typed decision + **"Matches expected"** / "Does not match expected" indicator.
- First paint is also READY TO RUN (no decision until Run is pressed).

**Regression tests:** [lab-view.test.ts](../../lib/integration-kit/lab-view.test.ts) — 8 tests including a **25-transition sweep** (every from×to vector pair) asserting the decision is never stale and never contradicts its expectation.

**Mutation-verified:** reverting `selectCase` to the buggy behaviour **fails 3 tests**; restoring passes 8/8. The tests genuinely catch the shipped defect.

**Browser-verified at human interaction speed** (real mouse clicks, production build path):

| Vector | On select | After Run |
|---|---|---|
| Stale order | READY TO RUN | `STALE_SEQUENCE_RETURNED` ✓ |
| Synchronized order | READY TO RUN | `ACCEPTED` · Matches expected ✓ |
| Malformed | READY TO RUN | `INVALID_INPUT` · Matches expected ✓ |
| Expired | READY TO RUN | `QUOTE_EXPIRED` · Matches expected ✓ |
| Future sequence | READY TO RUN | `FUTURE_SEQUENCE` · Matches expected ✓ |

---

## 4. Canonical-scope disclosure

**What is true:** the deployed program pins fixture identity, participants, regulation template, material-event sequences (739 goal / 1114 final) **and the captured odds themselves** (`CANONICAL_PRE_GOAL_PRICES = [1913, 2691, 9473]` → 1/1.913 = 52.274%, the genuine TxLINE StablePrice). `validate_canonical_identity` rejects any other market. `initialize_market_v4` **cannot bind a second fixture.**

**Why it's defensible:** the pinning is what makes the lifecycle tamper-evident — the published numbers cannot be re-run with different inputs. The constants are real captured evidence, not invented values.

**Disclosed on 5 surfaces:**

| Surface | Form |
|---|---|
| `PRODUCT_TRUTH.md` | New row: **Canonical V4 scope · PINNED BY DESIGN · NOT GENERIC**, naming the constants and `validate_canonical_identity`. Prohibited-claims line now bans any suggestion of genericity. |
| `README.md` | New "Current truth" bullet: **PINNED BY DESIGN — canonical V4 scope** |
| `SUBMISSION.md` | Leads the Limitations list + stated in the paste-ready technical documentation |
| `/proof` | Collapsed inside "View full technical evidence": **"Canonical V4 scope: pinned by design"** section + trust-boundary item |
| `/integrate` | "Operator reality" fact: **Canonical scope** |

Test-pinned in [page.test.tsx](../../lib/proof/page.test.tsx) so it cannot silently regress. **The pitch above the fold is unchanged.**

---

## 5. Homepage customer clarity

Subheadline now reads:

> FairX is execution-integrity infrastructure for **operators running live sports markets** — prediction-market and sportsbook operators and the liquidity and risk teams behind them: detect, measure, protect, explain, recover, and verify.
>
> *Fans keep access to synchronized markets instead of a full suspension after every material event.*

Customer identified **in the first sentence** (~8s, down from ~90s). Fan benefit stated without any consumer pivot. Test-pinned in [judgeComprehension.test.tsx](../../lib/proof/judgeComprehension.test.tsx).

**Three-way policy now stated consistently everywhere:**
- Demo READY panel: `Behind → STALE_SEQUENCE_RETURNED · level → ACCEPTED · ahead → FUTURE_SEQUENCE`
- `/integrate` hero: behind / level / ahead, with `FUTURE_SEQUENCE` named
- Code sample: three explicit comment lines
- A test asserts `"otherwise ACCEPTED"` never reappears.

---

## 6. TxLINE visibility improvements

New **"How TxLINE powers the backend"** panel on `/proof` (the listing's own phrase), placed directly under the proof summary — no raw logs required:

- **Caller** FairX Vault V4 `2x3vhmoj…` · invoke depth **[1]** → **CPI** → **Callee** Official TxLINE program `6pW64gN1…` · invoke depth **[2]**
- `VerifyTxlineQuote → ValidateOdds` — pre-goal, seq 738 — **2 of 2 verified** (linked)
- `VerifyTxlineQuote → ValidateOdds` — post-goal, seq 739 — **2 of 2 verified**
- `ProveResolutionWithTxlineV4 → ValidateStatV2` — France 2–0, seq 1114 — **Result verified** (linked)
- Closing line: **"Settlement cannot execute without TxLINE."** `execute_resolution_v4` requires `resolution_receipt.direct_cpi_verified`. *"TxLINE is not a display source here — it is the gate on the money."*

⚠️ **Integrity note:** while building this panel I initially wrote a **fabricated transaction signature** from a truncated prefix. It was caught before shipping, replaced with the real signature, and **all four production Explorer links were then re-verified against devnet RPC** (all found, finalized, zero errors). A verification step now exists for this; never hand-type a signature.

---

## 7. Final video script

[VIDEO_SCRIPT_FINAL.md](../../VIDEO_SCRIPT_FINAL.md) — **3:15**, second-by-second, with shot list, 10-step click sequence, fallbacks, 486-word narration count, and thumbnail spec.

**Key decisions:**
- **3:15, not 5:00.** The allowance is a ceiling, not a target. Judges watch ~82 of these.
- **TxLINE gets 0:20 up front + 0:30 at proof (~50s total, up from 12s).** This is the listing's explicit requirement and our only real differentiator.
- **Climax preserved at 1:12–1:20** with a mandated 2-second hold on `738 < 739`.
- **Only 2 conformance vectors shown**, not 5.
- **Explorer is pre-recorded, never live** — measured ~11s load, and it renders FairX as "Unknown Program" (no IDL). A 2–3s Logs crop showing `6pW64gN1… invoke [2]` / `ValidateStatV2` / `Evaluation complete` is the optional splice.
- Cut: the ten-step workflow scroll, ARG–BRA, live RPC re-verification.

---

## 8. Submission copy

`SUBMISSION.md` restructured to lead in the required order (operator problem → strict rule → genuine CPI → deployed engine → atomic return → trading continues → verified lifecycle → honest scope), plus a **"Paste-ready Superteam fields"** section containing verbatim blocks for: application access, repo + tag + commit, video URL placeholder, technical documentation **with the TxLINE endpoint list**, and the **TxLINE API feedback** answer.

Both easy-to-miss required fields are now copy-paste ready. The video URL is an explicit `<<PASTE … >>` placeholder so it cannot be forgotten.

---

## 9. Interview Q&A

[INTERVIEW.md](../../INTERVIEW.md) — all 18 required questions answered in 1–3 sentences, plus three likely traps ("isn't this just suspension?", "isn't the on-chain part theatre?", "the rule is one line of code").

The canonical-fixture answer leads with the limitation rather than defending it: *"We optimized the hackathon release for one fully reproducible, deeply verified lifecycle… the next program release removes the canonical constants."*

---

## 10. Tests and QA

| Check | Result |
|---|---|
| App tests | **330 passed / 330** (was 317; +13 new) |
| Test files | 55 |
| Typecheck | ✅ clean |
| Production build | ✅ compiled, 16/16 static pages |
| Routes (`/`, `/integrate`, `/proof`, `/portfolio`, `/markets/france-morocco-v4-replay`) | ✅ all 200 |
| Browser console errors | ✅ none |
| Mobile (375px / 390px) | ✅ no horizontal overflow |
| All 5 conformance vectors, real clicks | ✅ all correct, no stale frames |
| Explorer tx links | ✅ **all 4 verified against devnet RPC** — found, finalized, 0 errors |
| Secret scan | ✅ none; `.env*` gitignored; no keypairs tracked |
| Prohibited-claim keywords | ✅ `trustless`/`audited` only ever negated; no `production-ready`/`mainnet`/`organic users` |
| **Frozen boundaries** | ✅ `programs/`, `lib/v4/replay.ts`, `v4VerificationSnapshot.ts`, `fixtures/`, `quote-guard/canonical.ts` — **all untouched** |
| Transactions sent | ✅ **zero** |
| Redeployment | ✅ **none** |

**Diff:** 10 files changed (+300/−79), 4 new files. No program, evidence, economics, or verifier changes.

---

## 11. Remaining limitations

**Accepted (disclosed, not fixable in 3 days):**
- Deployed program is pinned to one fixture — now disclosed on 5 surfaces.
- No fan-facing product. This is the structural gap against the UX criterion and cannot be closed without becoming a different product.
- Not permissionless: operator quotes, 2-of-3 resolution, single upgrade authority (= operator key).
- No live feed demonstrated, though free World Cup data is available through the deadline.
- Unaudited devnet prototype; no users, no revenue.

**Cosmetic, deliberately not touched:**
- Demo displays liability `0.001431276` vs chain `0.001431275` (1 lamport, display rounding). Touching it means touching liability formatting — a frozen boundary — for a 1-lamport display artifact. Not worth the regression risk.
- ARG–BRA mode retains two canonical-mode strings ("Recorded outcome for the canonical stale order"). Low-value; ARG–BRA is cut from the video.
- No LICENSE file.
- Explorer shows "Unknown Program" (no IDL published). Publishing an IDL is a devnet transaction — out of scope under the frozen boundaries.

---

## 12. Final recommendation

**Record the video.** The product work is done; the remaining probability is almost entirely in the 3:15 take.

The submission's strength is that **every claim survives independent verification** — I re-checked the CPI target against TxLINE's published docs, the reconciliation against RPC, and the deployed binary against its own SHA-256, and found zero overclaiming. The listing says custom check gates on TxLINE primitives will be "highly valued by the judges"; FairX is precisely that, and it is real.

The weakness is structural and unfixable in three days: the track description asks for "prediction platforms, consumer sportsbook interfaces, or data dashboards," and FairX is none of them. A polished 104-fixture consumer market will beat it on the UX criterion and on video appeal. FairX wins if the judges are engineers who verify; it loses if they are product leads who watch.

**Expected effect of this sprint:** Top-3 credibility moves from ~25% to ~33–36% with the new script; first place ~12–15%. The conformance fix removes a genuine "their core rule fails" risk; the canonical disclosure converts the worst interview gotcha into a trust signal; the CPI panel makes the differentiator impossible to miss.

---

## 13. Exact deployment actions if needed

Nothing is deployed. **No deployment has been performed and none is authorized.** To ship:

```bash
# 1. Verify locally (all must pass)
npm run typecheck
npm test                      # expect 330 passed
npm run build

# 2. Review the diff — must touch NO program/evidence/fixture files
git diff --stat
git status --porcelain

# 3. Commit and tag a new release candidate
git checkout -b final-video-sprint
# Stage ONLY sprint files. Do not `git add -A` — docs/final-fixes, docs/first-place and
# docs/proof-final are pre-existing untracked local working notes (incl. screenshots/)
# that are deliberately not part of this release.
git add PRODUCT_TRUTH.md README.md SUBMISSION.md \
        app/integrate/page.tsx app/proof/page.tsx \
        components/integration-kit/IntegrationKitDemo.tsx \
        components/proof/JudgeProofSummary.tsx \
        components/runtime/FairXLiveDemo.tsx \
        lib/proof/judgeComprehension.test.tsx lib/proof/page.test.tsx \
        lib/integration-kit/lab-view.ts lib/integration-kit/lab-view.test.ts \
        VIDEO_SCRIPT_FINAL.md INTERVIEW.md docs/final-video-sprint/FINAL_REPORT.md
git commit -m "Sprint: fix conformance lab state, disclose canonical scope, surface TxLINE CPI"
git push -u origin final-video-sprint
# open PR -> merge to main -> Vercel auto-deploys

# 4. AFTER deploy, confirm production serves the new commit
curl -s https://fair-x-psi.vercel.app/proof | grep -o "How TxLINE powers the backend"
# and confirm /proof "Deployed commit" matches the merged SHA

# 5. Tag the recorded release
git tag -a submission-v2.2.0 -m "Final video sprint"
git push origin submission-v2.2.0
```

**Do NOT:** redeploy the program, send transactions, re-run `v4:record-lifecycle`, or regenerate canonical evidence. The deployed program and its 24 transactions are frozen and already verified.

**Recording note:** record against **production after deploy**, so the URL bar and the `/proof` deployed-commit both corroborate the video.

---

# FAIRX FINAL SPRINT VERDICT

**Official criteria readiness:**
9/10

**Core functionality:**
9/10

**UX and use case:**
8/10

**Code quality and logic:**
9/10

**TxLINE visibility in video:**
9/10

**Demo memorability:**
8/10

**Interview readiness:**
9/10

**Top-3 credibility:**
7/10

**First-place credibility:**
5/10

**Remaining blocker:**
The demo video does not exist yet. The listing calls it an "absolute requirement to pass initial screening" and says entries are "evaluated heavily based on the demo video." Every product-side blocker is closed; this is the only one left, and it is 100% of the remaining downside.

**Must complete before submission:**
1. **Record the 3:15 video** to `VIDEO_SCRIPT_FINAL.md`, against production, with the Explorer Logs crop pre-recorded (never navigate to Explorer live — ~11s load, "Unknown Program" label). Three takes, reject any over 3:20.
2. **Deploy the sprint branch** (section 13) and confirm `/proof` shows the new commit and the "How TxLINE powers the backend" panel — then record against that deployment so the URL bar corroborates the claims.
3. **Paste both required fields** from `SUBMISSION.md` — the **TxLINE endpoint list** and the **TxLINE API feedback** — into the Superteam form, plus the video URL into the `<<PASTE …>>` placeholder.

**RELEASE DECISION:**
READY TO RECORD

*(Conditional only on deploying the sprint branch first — the script points at the new `/proof` CPI panel at 2:46, which is not on production yet. Everything else is green: 330 tests, clean typecheck, clean build, all routes 200, no console errors, no secrets, all Explorer links RPC-verified, and every frozen boundary untouched.)*
