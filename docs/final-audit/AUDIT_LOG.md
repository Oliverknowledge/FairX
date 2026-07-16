# FairX final audit log

Audit date: 2026-07-15 (Europe/London)
Audit target: public product first, then the local V4 release candidate
Public app: https://fair-x-psi.vercel.app
Repository: https://github.com/Oliverknowledge/FairX

## Release state at audit start

| Check | Observed result | Classification |
|---|---|---|
| Branch | `main` | LOW |
| Local HEAD | `1660971a30d6c2df3078d06d1aaf050a885e84cc` | LOW |
| Tag | none | MEDIUM |
| Worktree | heavily dirty; V4 lifecycle/API/evidence files include untracked canonical material | BLOCKER |
| Remote | `https://github.com/Oliverknowledge/FairX.git` | PASS |
| Ahead/behind | local `main` is one commit ahead of `origin/main` (`0 behind / 1 ahead`) | BLOCKER |
| Public deployment | reachable at the URL above | PASS |
| Public build | old `be4adbf0cbf6` generation; not the audited V4 candidate | BLOCKER |
| Local candidate | production build succeeds and exposes the narrowed V4 route set | PASS |

The public deployment is the product a judge sees. It currently opens with “Impossible-to-exploit prediction markets”, routes judges into the old V3-era trade experience, lacks both V4 verification APIs, and does not expose the canonical V4 replay. This is not a cosmetic drift: it prevents a judge from reaching the strongest implementation.

## Independent deployment and evidence checks

| Check | Method | Outcome | Classification |
|---|---|---|---|
| V4 program | devnet `getAccountInfo` / Solana CLI | `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p` exists, executable, owned by the upgradeable loader | PASS |
| ProgramData | upgradeable-program inspection | `9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V` exists | PASS |
| Upgrade authority | Solana CLI | `ELay…brbq`; single-key authority, not immutable or proven multisig | ACCEPTED LIMITATION |
| Deployment slot | Solana CLI | `476416258` | PASS |
| Program size | independent program dump | `422,040` bytes | PASS |
| Program hash | SHA-256 over independent dump | `7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0` | PASS |
| Lifecycle signatures | independent V4 lifecycle verifier | all 24 signatures resolve as finalized transactions | PASS |
| V4 lifecycle | `npm run v4:verify-lifecycle` against devnet | `VERIFIED`, 20/20 | PASS |
| TxLINE proofs | `npm run v4:verify-proofs` | pre-goal odds, post-goal odds and France 2–0 final proof each return true through read-only simulation | PASS |
| V3 predecessor | independent V3 RPC verifier after immutable-balance correction | `VERIFIED`, 18/18 | PASS |
| Placeholder scan | fixture/signature/schema review | no placeholder signature or fixture verdict is accepted as proof | PASS |

The V4 verifier derives expected PDAs, decodes instructions/accounts, checks the program IDs and owners, verifies TxLINE roots and quote hashes, checks relevant balance deltas, proves the stale-sequence principal return, payout, withdrawal and account closures, and computes solvency independently. RPC absence produces `UNKNOWN`; a mismatch produces `FAILED`; neither is converted to `VERIFIED`.

## Canonical lifecycle result

| Quantity | Independently recomputed |
|---|---:|
| Finalized transactions | 24 |
| Operator deposit | 200,000,000 lamports |
| Accepted user principal | 30,000,000 lamports |
| Stale stake refunded | 10,000,000 lamports |
| Total winning payouts | 30,200,572 lamports |
| Losing NO principal | 10,000,000 lamports, reconciled into free collateral |
| Operator withdrawal | 199,799,428 lamports |
| Final free / reserve / principal / pending refund | 0 / 0 / 0 / 0 |
| Open positions | 0; all four terminal position accounts closed |

## Production-first browser audit

The public build was opened before localhost and audited at desktop and 390×844. No body overflow, React hydration error, console error or warning was observed on the tested pages. The primary failure is release truth, not rendering quality.

| Public route | Observed judge state | Classification |
|---|---|---|
| `/` | polished but prohibited absolute claim; V3-era framing | BLOCKER |
| `/markets` | redirects into the old market | BLOCKER |
| `/markets/france-morocco-france-win` | old V3 market | HISTORICAL / CONTRADICTORY AS PRIMARY |
| `/markets/france-morocco-v4-replay` | market unavailable | BLOCKER |
| `/portfolio` | old portfolio surface | MEDIUM |
| `/proof` | old/V3 evidence hierarchy; runtime can remain checking | BLOCKER |
| `/walkthrough`, `/reference`, `/operator`, `/terminal`, `/attack-lab`, `/integrate` | legacy pages still directly exposed | HIGH |
| `/verify/not-a-real-receipt` | legacy receipt surface | MEDIUM |
| `/api/status` | old V3 program, unconfigured RPC/TxLINE status | BLOCKER |
| `/api/verify/v4-status` | 404 | BLOCKER |
| `/api/verify/v4-lifecycle` | 404 | BLOCKER |

The public V3 verifier was also observed at 17/18 because it compared current mutable wallet balances with historical expected balances. That does not invalidate the transactions; it makes the verifier temporally unstable. The candidate now checks the immutable post-balance of each wallet’s final recorded lifecycle transaction.

## Local candidate browser audit

The local production server was built and served on port 3100. The homepage, replay, positions and proof pages were inspected in the in-app browser; every replay transition was advanced through scene 8. At scene 8 the UI showed the exact 199,799,428-lamport operator withdrawal and zero free collateral, reserve, accepted principal and vault balance.

At 390×844, `/`, the replay, `/portfolio` and `/proof` all had `scrollWidth === clientWidth === 390`. Controls remained labelled and navigation remained available. The replay reset/advance path did not enter a dead state; advance is disabled after scene 8.

Local redirect results:

| Route | Result | Classification |
|---|---|---|
| `/markets` | 307 → canonical V4 replay | VALID REDIRECT |
| `/markets/[other]` | explicit outside-V4-scope page | SECONDARY SCOPE GUARD |
| `/walkthrough`, `/reference` | 307 → `/` | VALID REDIRECT |
| `/operator`, `/integrate`, `/verify/[receiptId]` | 307 → `/proof` | VALID REDIRECT |
| `/terminal`, `/attack-lab` | 307 → canonical V4 replay | VALID REDIRECT |

## Controlled failure and operational behaviour

- Unit tests cover malformed/mismatched lifecycle evidence and assert `FAILED`, not success.
- Unit tests cover RPC failure and assert `UNKNOWN`.
- Browser proof fetches now abort after 45 seconds (V4) and 35 seconds (V3), eliminating an infinite loading state.
- Concurrent requests to each lifecycle API now share one in-flight fresh verification run, preventing duplicate page loads from multiplying the 24-transaction RPC workload.
- A fresh CLI run returned V4 20/20. After repeated audit calls, the public RPC heavily rate-limited the local HTTP verifier; one HTTP request exceeded 150 seconds without a response while the browser correctly remained non-green. This is an operational availability weakness, not a proof failure.
- Default transaction pacing of 400 ms was added to both lifecycle verifier paths to reduce public-RPC bursts.

## Security and trust review

No private key, seed phrase, JWT, API token or non-public environment value was found in tracked source or emitted client bundles. `.env.local` is ignored and untracked. Legacy mutation APIs are disabled without a minimum 32-character operator token and use timing-safe comparison. Public signer APIs expose only public data.

Trusted roles remain substantial: bootstrap admin, upgrade authority, operator/liquidity provider, feed/pricing authority, two-of-three resolution authorities, the fixed TxLINE program/accounts and the RPC provider. The prototype is permissioned, upgradeable and devnet-only. It is not externally audited, immutable, permissionless or production custody.

Program-level review found no critical/high-severity accounting or authorization flaw in the canonical V4 scope. Anchor constraints bind signers, PDAs and `has_one` relationships; TxLINE root accounts are owner/PDA checked; material sequence invalidation is strict; math is checked; terminal states prevent double claims; only free collateral is withdrawable. Security tests additionally cover donation surplus, deficit fail-closed behaviour, bootstrap takeover, maximum-u64 atomic failure, nonce reuse and double claim.

## Test record

| Gate | Result |
|---|---|
| `npm test` (pre-final run) | 42 files, 267 tests passed |
| focused verifier/UI tests after fixes | 5 files, 24 tests passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `npm run v4:test-lifecycle` | passed, including exact deployed binary and security cases |
| `npm run v4:test-void` | passed, 13 checks |
| `cargo test -p fairx-vault-v4` | 13 passed |
| `anchor test` | 36 passed, 2 pending |
| `npm audit --omit=dev` | 18 moderate transitive findings; 0 high/critical |

The final clean-tree reproducibility wrapper cannot honestly be certified from this dirty worktree. Independent binary dumping proves that the deployed bytes have the expected hash, and the exact binary is exercised by the lifecycle tests; run the pinned clean rebuild again after committing the release candidate.

## Small corrective changes made during audit

1. **HIGH — unstable V3 verifier:** changed final-wallet verification from mutable present balance to the immutable post-balance recorded in each wallet’s final transaction.
2. **HIGH — infinite proof loading:** added explicit V4/V3 client fetch timeouts and honest non-success handling.
3. **HIGH — misleading product claims:** removed “impossible-to-exploit”, “on deploy”, candidate/undeployed language and V3-as-current implications from the V4 candidate.
4. **HIGH — incomplete final replay:** made scene 8 display payouts, exact operator withdrawal, position closure and zero final balances.
5. **MEDIUM — TxLINE documentation:** documented the exact historical endpoints and separated ingestion, read-only proof validation and finalized V4 CPI evidence.
6. **MEDIUM — public RPC burstiness:** paced transaction requests by default.
7. **HIGH — concurrent RPC amplification:** deduplicated overlapping V4/V3 API verification calls without caching a verdict.

No V4 economics, program instruction, evidence schema, transaction or deployment was changed.

## Open findings

- **BLOCKER:** deploy the audited candidate; the current public URL is an older, contradictory product.
- **BLOCKER:** commit and push all canonical V4 evidence, APIs, program/client changes and audit docs; public GitHub is not the audited tree.
- **BLOCKER:** record, publish and link the ≤5-minute demo video.
- **HIGH:** capture the proof page in a successful 20/20 and 18/18 state immediately before recording; use a pre-recorded canonical fallback if RPC is slow.
- **MEDIUM:** public RPC dependence makes live proof completion slow under throttling; a dedicated RPC endpoint or cached last-success record with explicit age would improve demo reliability.
- **MEDIUM:** no external audit and a single upgrade authority constrain trust claims.
- **MEDIUM:** 18 moderate production dependency advisories remain; none is high/critical, and broad forced upgrades are unsafe at this deadline.
- **LOW:** add an explicit global reduced-motion rule for the remaining decorative CSS animations after submission if time permits.
