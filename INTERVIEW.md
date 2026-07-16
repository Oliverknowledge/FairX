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
