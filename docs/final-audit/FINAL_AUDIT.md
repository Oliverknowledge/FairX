# FairX final product, security and submission audit

Audit date: 2026-07-15
Audited public URL: https://fair-x-psi.vercel.app
Audited candidate HEAD: `1660971a30d6c2df3078d06d1aaf050a885e84cc` plus the documented dirty candidate worktree

## 1. Executive verdict

FairX has a Top-3-calibre technical core trapped behind a non-Top-3 release. The canonical V4 program is genuinely deployed, its dumped bytes match the expected hash, its 24-transaction France–Morocco lifecycle independently verifies 20/20, the TxLINE proofs are genuine, the stale attempt refunds, honest positions settle, and every lamport reconciles. This is stronger than a typical hackathon mock.

The product a judge can access does not show that work. Production is an older V3-era build with a prohibited “Impossible-to-exploit” claim, no V4 APIs, no canonical V4 replay and legacy surfaces. The audited candidate is dirty, ahead of public GitHub and not tagged. The video is unpublished. Those are three submission blockers.

## 2. Current product definition

The candidate is primarily **B: a settlement/fairness protocol**, implemented through **C: an operator-liquidity fixed-payout vault**, and demonstrated as a deterministic prediction-market replay. It is not yet a connected-wallet usable market. It should not be sold as an AMM, order book, Polymarket clone, permissionless exchange or production custody product.

The coherent definition is: **FairX demonstrates a protected live-sports prediction market powered by FairX Vault V4. Genuine historical TxLINE evidence drives quote validity and resolution; stale-information attempts refund, synchronized positions remain tradable, fixed payouts settle on-chain, and independent RPC verification proves vault solvency.**

## 3. Is the vision fulfilled?

**Technically, yes for the canonical devnet lifecycle. As an accessible submission, no.** All twelve intended lifecycle outcomes are present in finalized V4 evidence: operator funding, genuine TxLINE inputs, synchronized acceptance, strict stale-sequence return, continued trading, close/resolution, winners, loser closure, free-liquidity withdrawal, exact reconciliation and independent verification. The candidate UI now walks the same sequence and ends at the actual post-withdrawal zero state.

The vision is deliberately narrow: one historical France–Morocco fixture, permissioned authorities, deterministic replay controls and devnet funds. That is acceptable for a hackathon when labelled honestly. Production currently fails that honesty/coherence test.

## 4. Hackathon scorecard

| Criterion | Weight | Score | Evidence | Weakness |
|---|---:|---:|---|---|
| Core functionality | 10% | 8.8/10 | Complete canonical lifecycle; strict stale-sequence return and continued trading | One fixture; replay rather than user-driven market |
| TxLINE as primary source | 12% | 8.7/10 | Genuine fixture/odds/scores/sequences/roots; proof validation succeeds | Historical source; trusted ingestion roles remain |
| On-chain settlement | 15% | 9.1/10 | 24 finalized V4 transactions; payouts, loser, withdrawal, closures | Devnet; upgradeable/permissioned |
| Verification layer | 12% | 8.2/10 | Independent 20/20 verifier and explicit UNKNOWN/FAILED | Public RPC throttling hurts live reliability |
| UX/use case | 12% | 6.8/10 | Corrected five-second story and eight-scene replay | Still an evidence-led replay, not a usable market |
| Code quality/determinism | 12% | 8.0/10 | Checked math, Anchor constraints, deep LiteSVM/Rust tests | Dirty tree; legacy code remains in repository |
| Working deployment | 12% | 2.0/10 | URL is reachable | Public build is stale and contradictory |
| Demo-video readiness | 5% | 2.0/10 | Complete 3:55 script/storyboard | No published video; proof shots need production capture |
| Technical documentation | 5% | 8.5/10 | Exact endpoints, architecture, proof, limits and audit pack | Candidate docs not pushed |
| Originality/memorability | 5% | 8.5/10 | Selective stale-information refund with solvency proof | Generalist value depends on demonstration |

Weighted current score: **7.2/10**. Clearing the release and video blockers plausibly moves the submission above 8/10; it does not remove centralization or replay-only limitations.

## 5. Route-by-route audit

### Audited candidate

| Route | Classification | Result |
|---|---|---|
| `/` | PRIMARY PRODUCT | Clear problem-first story, one primary replay CTA and proof CTA |
| `/markets` | VALID REDIRECT | 307 to canonical V4 replay |
| `/markets/france-morocco-v4-replay` | PRIMARY PRODUCT | Full eight-scene deterministic lifecycle; every transition exercised |
| `/markets/[other]` | SECONDARY SCOPE GUARD | Explicitly says only one canonical V4 market exists |
| `/portfolio` | PRIMARY SUPPORTING PRODUCT | Shows claimed winner, lost position, refunded stale attempt and synchronized winner; labels replay/non-wallet state |
| `/proof` | PRIMARY EVIDENCE | V4 deployment, V4 lifecycle, model/reconciliation and separate V3 predecessor hierarchy |
| `/api/verify/v4-status` | SECONDARY DEVELOPER SURFACE | Read-only live deployment/account check |
| `/api/verify/v4-lifecycle` | SECONDARY DEVELOPER SURFACE | Independent verifier; explicit VERIFIED/FAILED/UNKNOWN semantics |
| legacy page routes | VALID REDIRECTS | Product contradictions removed from the judge path |

### Production

Production exposes the old homepage, old market/proof hierarchy, legacy pages and no V4 endpoints. `/api/verify/v4-status` and `/api/verify/v4-lifecycle` return 404. The V4 replay is unavailable. **BLOCKER.** See `AUDIT_LOG.md` for the complete public inventory.

## 6. Canonical user journey

The candidate journey is coherent and has no dead end: home → replay → eight controlled states → proof → home. Scene changes are visually and textually explicit. The strongest explanation is the sequence 739 transition: an old quote becomes invalid; the stale stake enters and exits atomically; a sequence-739 synchronized quote can still trade.

Scene 8 now completes the story rather than stopping before withdrawal: total winning payouts are 0.030200572 SOL, the losing position is closed, the operator withdraws 0.199799428 SOL, and the final vault/free/reserve/principal/refund/open-position state is zero. The replay banner makes clear that canonical transactions are finalized on devnet while replay buttons send no transactions.

## 7. TxLINE audit

TxLINE is a primary data source, not branding. The canonical evidence uses fixture `18209181`, pre/post StablePrice evidence, goal sequence `739`, final sequence `1114`, period-100 score keys `1001/1002/3001/3002`, an odds root and a scores root. Read-only simulations against the genuine TxLINE devnet program validated pre-goal odds, post-goal odds and final France 2–0 result.

Exact historical source endpoints:

- `https://txline-dev.txodds.com/api/fixtures/snapshot`
- `https://txline-dev.txodds.com/api/scores/historical/18209181`
- `https://txline-dev.txodds.com/api/odds/updates/20643/21/5?fixtureId=18209181`

The canonical data is genuine **historical/captured** data. “Live” applies only to the current devnet validation/RPC call, not to the old match. V4 consumes committed evidence and enforces fixed program/root ownership, fixture, material sequence, period, quote and lifecycle relationships. Proof validation and V4 settlement are separate claims. Operator/feed/pricing and resolution roles remain trusted.

## 8. V4 on-chain evidence

Independent checks confirmed program `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p`, ProgramData `9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V`, deployment slot `476416258`, 422,040-byte program data and SHA-256 `7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0`.

All 24 lifecycle signatures resolve finalized. The verifier checks the expected program and accounts, exact instruction material, PDAs/owners, TxLINE roots, quote hashes, state transitions, balance deltas, stale refund, winner payouts, no double claim, operator withdrawal, final solvency and closures. It does not trust UI copy or a fixture verdict. A fresh read-only run returned `VERIFIED · 20/20`.

## 9. V3 predecessor

V3 remains deployed, executable and useful historical evidence of an earlier architecture. Its transactions are not evidence for V4 and are intentionally outside the primary judge journey.

Candidate hierarchy is now correct: current V4 deployment/lifecycle first; deterministic model supporting it; V3 clearly labelled deployed historical predecessor and explicitly not V4 evidence.

## 10. Economics and solvency

The exact equation is:

```text
200,000,000 + 30,000,000 − 30,200,572 = 199,799,428 lamports
```

The 10,000,000-lamport stale attempt is refunded and never counted as accepted principal. Pre-goal YES receives 18,769,297; post-goal YES receives 11,431,275; pre-goal NO loses and closes. All ten accounting snapshots satisfy `A = F + R + S`. After claims/loss reconciliation, the remaining 199,799,428 is entirely free collateral; withdrawing it is not theft. Final free, reserve, principal, pending refunds, balance and open positions are all zero. See `SOLVENCY_EXPLAINER.md`.

## 11. UX and usability

The corrected homepage passes the five-second test for problem, difference and next action. Within 30 seconds a judge can see historical TxLINE provenance, operator funding and the full lifecycle. Within 90 seconds the replay makes strict stale-sequence return, continued trading, final payout and solvency comprehensible. Technical hashes remain on `/proof` rather than leading the story.

Desktop and 390×844 checks found no body overflow on the four primary routes, no hydration error and no browser console warning/error. Status text does not rely on colour alone; long hashes are truncated/contained; buttons are named; navigation stays available. Proof requests now time out rather than load forever, and overlapping page loads share one fresh in-flight verification instead of multiplying RPC traffic. **MEDIUM:** remaining decorative CSS animations lack a global reduced-motion override. **MEDIUM:** a cold live proof can still be slow on public RPC; use a genuine pre-recorded production success for the demo fallback.

## 12. Security and trust

No secret was found in tracked files, ignored-file status, API responses or emitted browser bundles. Mutation APIs require an operator token and default closed. No critical/high program flaw was identified in the canonical scope. Tests cover collateral deficit, donation surplus, unsafe withdrawal, bootstrap takeover, u64 failure atomicity, nonce reuse and double claim.

Accepted trust limitations: single upgrade authority, permissioned operator, feed/pricing authority, two-of-three resolution authorities, fixed TxLINE program/accounts and RPC provider. No external audit exists. Public copy must continue to say devnet, prototype, replay/historical and unaudited; it must not imply immutability, multisig, permissionless use or production custody.

## 13. Documentation

`SUBMISSION.md`, `TXLINE.md`, `ARCHITECTURE.md`, `DEMO_VIDEO.md`, `VIDEO_SCRIPT.md`, reproducibility notes and product copy were aligned to the deployed V4 truth. Exact endpoints, program/ProgramData, binary hash, 24 transactions, 20/20 verifier, accounting figures, V3 separation, public links and limitations are now present. **BLOCKER:** these docs are still local/dirty and the submission video field cannot be completed until a public video exists.

## 14. Screenshot index

Five genuine captures are indexed in `SCREENSHOT_INDEX.md`: corrected local desktop/mobile home, initial replay, complete terminal position set and the stale production homepage. They are never mixed without environment labels. Later screenshot transport failures are disclosed; scene-specific and successful proof production captures remain a **HIGH** pre-recording action.

## 15. Judge simulation

Technical Solana judge: 7.6/10. TxLINE sponsor judge: 7.4/10. Generalist judge: 5.4/10 from the currently accessible release. Full questions, objections and score levers are in `JUDGE_SIMULATION.md`. The generalist gap is almost entirely the stale public build/video, while the technical ceiling is authority centralization and replay-only scope.

## 16. Demo plan

`DEMO_VIDEO_FINAL.md` contains a word-for-word 3:55 narration, exact routes/clicks/durations, visible states, RPC fallback, publishing copy and recording/export checklists. `VIDEO_STORYBOARD.md` maps every shot to a file or explicitly required production recapture. Do not show all transactions; prove depth through the compact verifier.

## 17. Remaining limitations

- **ACCEPTED LIMITATION:** devnet-only, one canonical historical fixture, deterministic replay UI, no wallet trading.
- **ACCEPTED LIMITATION:** permissioned operator/feed/resolution model and upgradeable program.
- **ACCEPTED LIMITATION:** no external security audit.
- **MEDIUM:** proof availability depends on public RPC and can degrade to honest UNKNOWN/timeout.
- **MEDIUM:** 18 moderate transitive production dependency advisories; zero high/critical.
- **LOW:** no global reduced-motion CSS fallback for every decorative animation.

## 18. Production blockers

1. **BLOCKER:** public Vercel deployment is the wrong product generation.
2. **BLOCKER:** public GitHub does not equal the audited candidate; canonical evidence and APIs are untracked/unpushed.
3. **BLOCKER:** no published ≤5-minute demo video.

## 19. Must fix before submission

1. Commit the exact audited tree, push it, tag the release, and verify the canonical fixture/API files are included.
2. Deploy that exact commit; smoke-test every route/API and confirm the build SHA in production.
3. Run proof once successfully in production, capture the required stills/fallback, record the 3:55 video, publish it and replace the submission placeholder.

## 20. Should fix only if time

- Use a dedicated devnet RPC or explicitly aged successful-proof cache to improve demo reliability without converting stale evidence into live success.
- Add global `prefers-reduced-motion` treatment and perform a manual keyboard/focus pass in the deployed build.
- Resolve moderate dependency advisories only through non-breaking upgrades and rerun the full gate.

## 21. Things not to touch

- Do not alter V4 economics, instruction layout, fixture schema, program ID or canonical signatures.
- Do not record or resend the devnet lifecycle.
- Do not reintroduce generic markets, wallet trading, AMM/order-book claims or legacy pages.
- Do not upgrade dependencies broadly, rotate authorities or redeploy the program hours before submission.
- Do not replace real proof with mocked green screenshots.

## 22. Brutally honest score

**7.2/10 today.** The underlying technical submission is closer to 8.5; the judge-accessible submission is dragged down by a release mismatch and absent video. Evidence depth can earn Top 3 only if judges actually see it.

## 23. Would I submit it unchanged?

**No.** Submitting unchanged risks immediate dismissal as an older, overclaiming V3 product and leaves mandatory video/repository evidence unresolved.

## 24. Is it frozen and ready?

**The code/economics should be frozen; the release is not ready.** Only release packaging, deployment, production smoke verification, evidence captures and video publication should continue.

## 25. Exact owner actions

Execute the three blocker-clearing actions below in order. If any production check differs from the local audited candidate, stop and fix the release—not the protocol.

FINAL VERDICT:
READY AFTER SPECIFIED FIXES
TOP-3 READINESS:
7.2/10
FIRST-PLACE CREDIBILITY:
5.8/10
SINGLE BIGGEST RISK:
Judges reach the stale public V3-era build and never see the verified V4 lifecycle.
OWNER’S NEXT THREE ACTIONS:
1. Commit, push and tag the complete audited candidate, including canonical evidence, APIs and final-audit documents.
2. Deploy that exact commit and confirm every production route, both V4 APIs and a fresh VERIFIED 20/20 result.
3. Capture the successful production proof/replay states, record the 3:55 demo, publish it and add the final link to SUBMISSION.md.
