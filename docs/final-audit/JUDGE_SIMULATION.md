# FairX judge simulation

These scores judge the product a sponsor can actually access today, while giving technical credit for the public repository and independently verified devnet evidence. Deploying the audited candidate and publishing the video would materially raise every score.

## Judge A — technical Solana engineer: 7.6/10

**Strongest impression:** unusually complete hackathon-grade custody/accounting evidence. The exact deployed binary, finalized 24-transaction lifecycle, independent 20-check verifier, conservative liability reservation and closure tests are credible.

**Biggest objection:** the public site does not expose this V4 work, the audited tree is dirty/unpushed, and the program remains upgradeable by a single authority.

**Likely questions**

1. How does the verifier prove it is not trusting fixture verdicts? It re-fetches finalized transactions/accounts, derives PDAs, decodes instructions/state, validates program owners/roots/hashes/balance deltas and recomputes solvency.
2. Can the operator withdraw user liabilities? No; only `free_collateral` is withdrawable, with deficit and donation-surplus cases covered.
3. What prevents a double claim or stale nonce reuse? Terminal position states, account constraints and nonce/sequence checks; tested in LiteSVM/Rust.
4. Who can change the program? The current single upgrade authority; do not imply immutability or multisig.

**What raises the score:** deploy this exact candidate, push an auditable tagged tree, rerun the clean reproducible-build gate, and disclose a concrete authority-hardening plan.

## Judge B — TxLINE sponsor: 7.4/10

**Strongest impression:** TxLINE is essential rather than decorative. Genuine historical fixture, odds, material sequence, score roots and final-result proof drive stale invalidation, price acceptance and settlement. Read-only TxLINE proof validation is correctly separated from finalized V4 settlement evidence.

**Biggest objection:** the public product still looks V3-era and the live proof path depends on rate-limited public RPC. Exact endpoint documentation exists only in the candidate until it is pushed.

**Likely questions**

1. What endpoints were used? `GET /api/fixtures/snapshot`, `GET /api/scores/historical/18209181`, and `GET /api/odds/updates/20643/21/5?fixtureId=18209181` on `https://txline-dev.txodds.com`.
2. Is the data live? The canonical source is genuine historical/captured evidence; read-only validation is live against the TxLINE devnet program. The UI now says this explicitly.
3. What does V4 enforce? The fixed TxLINE program/root accounts, committed proof material, fixture/sequence/period/quote relationships and the resulting lifecycle transitions.
4. What remains trusted? Operator/feed/pricing authority inputs, resolution authorities, upgrade authority and RPC availability.

**What raises the score:** deploy the honest wording, show one compact root/proof validation moment in the video, and add specific TxLINE feedback about historical endpoint ergonomics and stable proof schemas.

## Judge C — product/generalist: 5.4/10

**Strongest impression:** “refund the stale goal exploit while fair positions continue” is memorable, and the corrected local replay makes the money path understandable.

**Biggest objection:** today’s public URL tells an overclaiming older story, exposes legacy routes, lacks the complete V4 journey and has no published demo video. The repository depth cannot rescue a five-second product review.

**Likely questions**

1. Can I trade? No. This is a deterministic devnet evidence/replay prototype, not connected-wallet production trading.
2. Why is a refund better than pausing? It selectively neutralises the information-arbitrage attempt while synchronized fair positions can still be accepted.
3. Who benefits? Prediction-market operators and users in fast-changing live sports markets.
4. Why should this exist after the hackathon? It is a settlement/fairness primitive that other market front ends could integrate, but that integration path is future work.

**What raises the score:** deploy the local candidate, record the scripted sub-four-minute demo, keep hashes below the fold and show the goal/refund/payout sequence before any verifier detail.

## Panel conclusion

- **Initial screening:** technically plausible, but the submission as-is can fail administrative/product screening because the public build is outdated and the video is unpublished.
- **Shortlist / Top 10:** credible after the three blockers are cleared; the on-chain depth is differentiating.
- **Top 3:** not defensible from the current public URL. Credible after deploy + pushed/tagged evidence + strong video.
- **First place:** possible but not the favorite; a stronger competitor may pair equivalent on-chain rigor with connected interaction, a reliable public proof service and a more dramatic live demo.

The three most likely objections are: “the public app is not this repository,” “this is a replay/protocol proof rather than a usable market,” and “the authority/RPC trust model is still centralized.” The single issue most likely to sink the submission is judges never reaching V4 because the stale public build remains deployed.
