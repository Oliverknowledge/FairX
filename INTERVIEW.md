# FairX — interview answers

The listing selects winners **after live interview rounds**. Every answer below is 1–3 sentences and matches what a judge can independently verify. Never evade the canonical-fixture limitation — leading with it is the strongest move available, because a judge who finds `CANONICAL_*` themselves after we hid it loses trust in everything else.

---

### Who is the customer?
Operators running live sports prediction markets and sportsbooks — specifically their liquidity and risk teams, who currently absorb stale-price losses or suspend the whole market after every goal. Fans are the downstream beneficiary: they keep access to synchronized markets instead of a blanket suspension.

### Why does this need Solana?
The guard needs to take the stake, compare the event sequence, and either reserve a fixed liability or return the principal **atomically in one instruction**, with no intermediate custodial state. Solana gives us that plus cheap account-level auditability and direct composability with TxLINE's deployed program.

### Why not implement this in a private database?
A centralized exchange can absolutely apply the same rule — the rule is trivial. What it cannot do is let anyone else re-read the outcome: in a private ledger the operator *reports* whether an order was cancelled, liabilities are a database row, and settlement history can be rewritten. Our evidence is the product, not the comparison.

### Why not simply pause the market?
Pausing punishes every honest trader for one bot's latency advantage, and it converts a per-order problem into a market-wide outage. FairX scopes the protection to the individual obsolete order and leaves synchronized trading open.

### Why return rather than reject before transfer?
The durable refund receipt is the point: an on-chain position account permanently marked `Refunded` is evidence the trader and an auditor can both read, which a pre-transfer rejection would never leave behind. The stake enters and leaves the vault inside the same instruction, so the trader is never exposed and the vault's net balance is unchanged.

### What exactly does TxLINE prove?
TxLINE proves the source sports evidence: the fixture identity, the pre- and post-goal StablePrice odds, and the final regulation-time result — validated by its own program against its own Merkle roots. It does **not** prove that our pricing transform is fair, our liquidity is real, or our operator is honest.

### Who sets the quote?
A configured pricing authority; there is no AMM, order book, or permissionless oracle inside FairX. QuoteGuard constrains that authority to a deterministic transform of the committed TxLINE snapshot, so it cannot silently substitute an arbitrary price — but it does not make the authority permissionless.

### What remains trusted?
The operator's quote, feed submission, liquidity and availability; two-of-three configured resolution authorities; and a single upgrade authority on the deployed program. All of it is listed in `PRODUCT_TRUTH.md` and on `/proof`, and none of it is hidden behind a "trustless" claim.

### Why is V4 pinned to one fixture?
We optimized the hackathon release for one fully reproducible, deeply verified lifecycle: `CANONICAL_*` constants pin the fixture, sequences and captured odds, and `validate_canonical_identity` rejects anything else. That pinning is what makes the 24-transaction record tamper-evident — the numbers on `/proof` cannot be re-run with different inputs. The policy and integration interfaces are reusable; the next program release removes the canonical constants and supports arbitrary fixture configuration.

### Is IntegrationKit production-ready?
No. It is a typed, no-send reference implementation that signs and sends nothing — it exists so an operator can exercise every decision branch before touching production. A production SDK would need transaction construction, key management, retries and an audit.

### Is the product live?
No. It is an unaudited devnet prototype with no real-money settlement, no connected-wallet trading and no users. The deployment, the transactions and the TxLINE CPIs are real; the traffic is not.

### What is replayed?
The browser demo is a deterministic reenactment of one recorded France–Morocco incident — it advances a state machine and sends no transaction, which the UI says on screen. Argentina–Brazil is a clearly labelled runtime reference that makes no on-chain claim at all.

### What is genuinely on-chain?
The deployed program (byte-for-byte matching the published SHA-256), 24 finalized devnet transactions with zero errors, three direct CPIs into TxLINE's official program, the atomic principal return, both fixed payouts, the reconciliation and the operator withdrawal. All of it re-verifies from public RPC without trusting our UI.

### What happens for a future sequence?
It is rejected as invalid — `FUTURE_SEQUENCE` — never coerced into acceptance. The deployed rule is strictly three-way: behind returns the principal, level is accepted, ahead is rejected, because an order claiming a sequence the market has not reached is feed or client skew.

### How is the replacement order different?
It is a genuinely distinct order: a different order ID (`post-yes` vs `stale-bot`), a different actor, sequence 739 instead of 738, and it prices against the synchronized 87.48¢ quote rather than the obsolete 53.28¢ one. It is not the same order retried — the first one is permanently `Refunded` and can never claim.

### Why would an incumbent integrate instead of rebuild?
They could rebuild the rule in an afternoon; they cannot self-issue independently verifiable evidence that they applied it. The value is the externally reproducible receipt an auditor, a regulator or a counterparty can check without trusting the operator's database.

### What is the business model?
Per-market or per-incident infrastructure pricing to operators, the same shape as feed or risk-tooling licensing — this is a B2B integrity layer, not a consumer venue. We have no revenue, no pilots and no users; claiming otherwise would be inventing traction.

### What would you build next?
Remove the canonical constants so any TxLINE fixture can be configured at market creation, then freeze or multisig the upgrade authority and get an audit. After that, multi-fixture operator tooling — but the correct order is genericity, then trust-minimization, then breadth.

---

## Three traps and the honest answer

| Likely trap | Answer |
|---|---|
| "Isn't returning every order in the window just suspension with extra steps?" | No — suspension blocks every trader for the whole window; we block one order and leave the book open. The window is per-order and closes as soon as the quote resyncs, and every returned order carries a reason and a retry path. |
| "Your program only does one match — isn't the on-chain part theatre?" | The pinning is deliberate and disclosed before you find it. It buys tamper-evidence: this lifecycle cannot be re-run with different numbers. The reusable part is the policy and the interface; genericity is the next release, and I'm not claiming it today. |
| "The rule is one line of code. What's hard?" | The rule is trivial; the accounting around it is not. Fixed payouts frozen at acceptance, independent YES/NO reservation with no netting, a solvency invariant re-checked after every mutation, and settlement gated on a real TxLINE CPI — that's what makes the returned order provably free of liability. |

---

## The five conceptual objections

These are the strongest attacks on the **idea**, not the implementation. None of them are removable — they are properties of the design. Raise them before the judge does; getting there first converts each one from an ambush into evidence that you understand your own problem.

### 1. "You prove the orders you saw were handled right. How do I know you saw all of them?"

**You don't, and that is the honest boundary.** FairX makes a vault-level claim, not a network-level one: every order that touches the vault is recorded, sequenced by a monotonic nonce, and completely accounted for. It does not compel the operator to route flow through the vault — the same limitation any escrow has. An operator could run most flow through FairX and handle some privately, and the public record would still look clean.

What FairX removes is the operator's ability to lie about **what happened to an order it accepted**. What it does not remove is the operator's choice of **what to submit**. That is a real relocation of trust, not an elimination of it, and the fix is a venue-level commitment to route a named market through the vault — which is a business commitment, not a cryptographic one.

### 2. "A trader watching the stadium feed beats TxLINE. Your guard never sees them."

**Correct — FairX catches the second-fastest adversary, not the fastest.** The guard bounds exposure to *feed-relative* staleness: orders slower than TxLINE but faster than the operator's requote. Someone with a broadcast or co-located edge knows about the goal before TxLINE publishes sequence 739; their order arrives while 738 is still required, and it passes.

That is not a gap we can close. No on-chain guard can prove what a human saw on a television. FairX bounds the staleness that is *provable* and makes no claim about the staleness that is not. A design that claimed to eliminate all latency arbitrage would be lying.

### 3. "This is operator protection. Why call it integrity?"

**Because the alternative denies everyone, and this denies one order.** But the objection lands: the rule is not fairness to the individual trader, it is consistency. A trader who watched the goal and clicked is *right*, and we return their order anyway — the demo shows this deliberately, returning an ordinary "Incoming trader" on the runtime fixture, not a cartoon bot.

The trader-side benefit is **access, not fills**: without the guard the operator suspends the market and nobody trades; with it, only the obsolete order is returned and synchronized traders keep trading. That is a genuine trade, and it is the one the product actually makes. "Verifiable adverse-selection protection" is the more precise name; "market integrity" is the shorter one.

### 4. "The operator controls when the quote updates. Doesn't your design reward being slow?"

**Yes, and the protocol does not bound it.** Returning an order is good for the operator — it is free optionality against informed flow — and the operator decides when to requote. Nothing in V4 caps the stale window or penalises latency. Taken to the limit, a market that returns every order is suspension with extra steps.

What the design does provide is visibility rather than enforcement: sequence delta is public, and every return is a durable on-chain receipt, so a systematically slow operator produces a public trail of mass returns rather than a silent one. A protocol-enforced maximum window — return the order *and* penalise the operator's collateral past a bound — is the obvious next design question, and it is not in this release.

### 5. "Who is actually asking for this?"

**Nobody yet, and I am not going to pretend otherwise.** No regulator requires an on-chain order-decision receipt and no trader picks a venue for one. The demand is reputational and regulatory in a direction this market has not travelled yet. We have no pilots, no revenue and no users.

The bet is that verifiable execution becomes a procurement question for prediction markets the way proof-of-reserves became one for exchanges — after an incident, not before. That is a bet on timing, and it is the honest reason to build the primitive now rather than a claim that anyone is buying it today.
