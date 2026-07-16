# FairX — 2:45 submission demo

Target length: **2:45 maximum**

Audience: **TxLINE and Solana hackathon judges**

Thesis: **FairX is the market integrity layer for live prediction markets.**

The timeline below is continuous: every second from `0:00` through `2:45` is assigned to a screen, animation, pointer action, narration, and intended reaction.

| Time | Screen | Animation | Mouse | Narration | Intended judge reaction |
|---|---|---|---|---|---|
| 0:00–0:05 | `/` hero | Hold on headline | None | “The stale order stops. The market doesn’t.” | I understand the promise immediately. |
| 0:05–0:12 | Hero + thesis | Detect → Verify sentence remains visible | Trace the sentence once | “FairX is the operational integrity layer for live prediction markets.” | This is infrastructure, not another exchange. |
| 0:12–0:18 | Replay header | Canonical evidence badge | Point to `Recorded TxLINE evidence` | “This replay mirrors one finalized V4 incident; the controls send no transaction.” | The evidence boundary is honest. |
| 0:18–0:24 | Healthy panel | HEALTHY highlighted | Point to event 738 and quote 738 | “Before the goal, required sequence and quote sequence both equal 738.” | I can read the control plane. |
| 0:24–0:29 | Run control | Autoplay starts | Click `Run integrity incident` | “Now watch one integrity window open and close.” | Something is about to happen. |
| 0:29–0:36 | Goal / TxLINE | Score and event sequence change | Follow event sequence 738 → 739 | “A France goal advances the required TxLINE event sequence to 739.” | Cause is clear. |
| 0:36–0:43 | STALE state | Health turns amber; delta becomes +1 | Move from event 739 to quote 738 | “The quote is still bound to 738. Delta plus one means the market is stale.” | This is measurable, not hand-waving. |
| 0:43–0:51 | Incoming order | Order block enters | Point to order sequence 738 | “An order arrives carrying the old sequence.” | I see the exact invalid input. |
| 0:51–1:00 | Decision | `STALE_SEQUENCE_RETURNED` appears | Trace `738 < 739` | “V4 compares integers: OrderSequence below RequiredSequence returns STALE_SEQUENCE_RETURNED.” | The deployed rule is unambiguous. |
| 1:00–1:08 | Integrity receipt | Receipt fills in | Point to principal and liability | “The full 0.01 SOL principal returns. No position and zero liability are created.” | Funds outcome is obvious. |
| 1:08–1:15 | Timeline | Protection milestones turn green | Sweep Goal → Principal returned | “The receipt explains what happened without a support ticket.” | Trader and operator confidence improved. |
| 1:15–1:21 | Operator value | Recorded/counterfactual labels visible | Point to both labels | “The recorded outcome is zero liability; the old-price liability beside it is explicitly illustrative arithmetic.” | No fabricated analytics. |
| 1:21–1:28 | Retry control | Recovery begins | Click `Synchronize and retry` | “The operator synchronizes the quote instead of pausing every trader.” | Recovery is part of the product. |
| 1:28–1:35 | RECOVERING | Blue recovery state | Point to RECOVERING | “Health moves from stale, through recovering…” | The state machine feels operational. |
| 1:35–1:43 | HEALTHY / retry | Quote sequence becomes 739; accepted receipt | Click `Accept synchronized retry` if needed | “…to healthy. The replacement order matches 739 and is accepted.” | Fair trading continues. |
| 1:43–1:50 | Settlement / proof timeline | Final milestones complete | Point to Settlement and Proof | “Recorded settlement completes the same lifecycle and makes the outcome independently verifiable.” | End-to-end loop is complete. |
| 1:50–1:55 | Navigation | Integrate highlighted | Click `Integrate` | “An operator can test the contract before adopting it.” | Show me developer readiness. |
| 1:55–2:04 | Conformance Lab | Five vectors visible | Sweep across vectors | “The conformance lab covers stale, synchronized, malformed, expired, and future-sequence inputs.” | This anticipates real integration failures. |
| 2:04–2:13 | Stale vector | Request → decision → response | Click `Run selected vector` | “Each vector shows the request, typed response, explanation, and operator responsibility.” | This is integration-grade product thinking. |
| 2:13–2:21 | Future vector | FUTURE_SEQUENCE response | Click `Future sequence`, then run | “Future sequence is rejected as feed or client skew—never coerced into acceptance.” | Failure semantics are deliberate. |
| 2:21–2:28 | Operator workflow | Ten-step workflow | Scroll once; trace left to right | “One workflow runs from fixture binding and health monitoring through retry, resolution, reconciliation, and evidence export.” | I can picture deployment. |
| 2:28–2:33 | Navigation | Proof highlighted | Click `Proof` | “Now the recorded boundary.” | Show me that it is real. |
| 2:33–2:40 | `/proof` first view | 20/20 status holds | Point to program, lifecycle, TxLINE | “V4 is deployed on Solana devnet: 24 finalized transactions, direct TxLINE validation, and 20 of 20 independent checks.” | Technical credibility established. |
| 2:40–2:45 | Proof + close | Hold still | None | “FairX: detect, measure, protect, explain, recover, verify—while the market stays open.” | Memorable infrastructure thesis. |

## Recording rules

- Record at 1920×1080, 100% zoom, with notifications and bookmarks hidden.
- Use the canonical France–Morocco scenario. Do not run fresh RPC verification on camera.
- Never call the browser controls live trading, never imply a transaction was sent, and never present illustrative arithmetic as measured operator loss.
- Keep `/proof` open in a second tab as a recovery option, but follow the navigation in the primary take.
- Record three complete takes and reject any take over 2:45.
