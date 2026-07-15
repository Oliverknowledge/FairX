# Judge comprehension test

Date: 15 July 2026
Method: structured cold-read audit of the rendered production build at 1440×900 and 390×844. This is a product-review heuristic, not a claim of external human usability research. Answers were scored only from information visible within each time window.

## Five-second test — 10/10

Prompted questions and visible answers:

- **What is FairX?** A protected live-sports market.
- **What problem does it solve?** Traders exploiting a goal before the displayed price updates.
- **What makes it different?** It refunds only stale-price orders; fair orders continue.

Evidence: the hero states the category, harm and selective response in the headline and first sentence. The primary CTA and provenance line are above the fold; no hash or PDA competes with them.

Failure check: “Does FairX freeze the market?” The paired visual and market status both answer no.

## Thirty-second test — 9.5/10

A judge can explain:

1. TxLINE records the historical France goal at sequence 739.
2. The displayed market remains temporarily at 53.28% while the fair price becomes 87.48%.
3. The sequence-738 exploit receives its full 0.01 SOL back and creates no position.
4. The repriced sequence-739 trade is accepted because it has no stale advantage.

The five-step homepage timeline and the paired stale/fair cards carry this without technical disclosures. The remaining 0.5 reflects that a judge who skips both visuals may not yet know the exact sequence numbers—and should not need to.

## Ninety-second test — 9.2/10

A judge can explain:

- **Operator liquidity:** 0.20 SOL is deposited as free collateral.
- **Liabilities:** accepted positions reserve fixed gross payouts; the rejected stale order creates none.
- **Settlement:** France resolves YES from final TxLINE evidence; two valid YES positions are paid and the valid NO closes lost.
- **Reconciliation:** 0.200000000 + 0.030000000 − 0.030200572 = 0.199799428 SOL withdrawn, with all four final buckets at zero.
- **On-chain proof:** V4 is deployed and executable; 24 finalized transactions are re-read by a 20-check verifier; V3 is labelled predecessor evidence only.

The 0.8 deduction is for the unavoidable conceptual step from “reserved liability” to fixed gross payout and for public-RPC verification latency. Both are explained, but neither is truly five-second material.

## Misinterpretation probes

| Probe | Result |
|---|---|
| “Was a real goal happening during judging?” | No. Persistent **TxLINE historical replay** and **Genuine recorded evidence, not a live match** labels prevent this. |
| “Was every post-goal trade cancelled?” | No. Stage 8 and Positions explicitly show the synchronized post-goal trade accepted and paid. |
| “Is V3 proof of V4?” | No. Layer 3 says exactly that V3 is not evidence for V4. |
| “Does loading mean verified?” | No. Loading is blue/neutral and says it is never shown as success. |
| “Does a failed RPC invalidate the accounting model?” | No. It suppresses a verified claim, offers retry and leaves canonical accounting visibly separate. |
| “Are these connected-wallet balances?” | No. Positions identifies them as deterministic canonical replay outcomes. |

## Conclusion

The interface passes the 5-, 30- and 90-second comprehension gates. The strongest retained sentence is: **FairX does not freeze the market after a goal. It refunds only the exploitative trade.**
