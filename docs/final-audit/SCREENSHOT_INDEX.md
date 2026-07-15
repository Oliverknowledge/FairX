# Screenshot index

All files are genuine browser captures. No mocked state is presented as production. In-app capture succeeded for the two homepage images; later in-app CDP captures repeatedly timed out, so clean-profile headless Chrome was used for the remaining static captures after the corresponding states had been inspected interactively in the in-app browser.

| File | Route | Viewport | Environment | State and judge purpose |
|---|---|---:|---|---|
| `local-home-desktop.png` | `/` | 1280×800 | localhost candidate | Corrected product-first hero, primary CTA, canonical fixture summary and devnet-proof label. Establishes what should be deployed. |
| `local-home-mobile.png` | `/` | 390×844 | localhost candidate | Mobile hero and CTA with no horizontal overflow. Shows the five-second story remains legible on a phone. |
| `local-replay-01-funded.png` | `/markets/france-morocco-v4-replay` | 1280×800 | localhost candidate | Initial vault-funded scene, historical TxLINE provenance, pre/post odds, all eight lifecycle steps and solvency invariant. |
| `local-portfolio.png` | `/portfolio` | 1280×1000 | localhost candidate / deterministic replay | Honest winner, real loser, stale refunded attempt and synchronized winner, all explicitly labelled as replay outputs rather than wallet accounts. |
| `production-home-desktop.png` | `/` | 1280×800 | production | Release blocker evidence: old “Impossible-to-exploit” hero, old navigation and old product framing. |

## Interactively verified but not captured as separate files

The following genuine states were exercised and inspected through live DOM snapshots, but the screenshot transport timed out after the listed captures: replay scenes 2–8; final payout/withdrawal/zero-balance scene; proof deployment status; proof loading/UNKNOWN behaviour; V3 predecessor wording; mobile replay, portfolio and proof. Scene 8 was explicitly checked for `0.199799428 SOL withdrawn`, final balance zero and all accounting buckets zero.

This is a **HIGH pre-recording action**, not permission to fabricate images: after the candidate is deployed, capture the successful production proof page (V4 20/20 and V3 18/18), scenes 3–8 and the final reconciliation as video-ready stills. If public RPC is slow, use a genuinely pre-recorded successful production run and label its capture time.

## Screenshot labels for the final recording

- `production-*`: current public deployment only.
- `local-*`: audited release candidate served locally.
- `fallback-*`: may be added only from a genuine successful production verifier run and must include the capture date in the storyboard.
- `mocked-*`: prohibited from the submission video unless explicitly presented as a controlled failure test; none are included here.
