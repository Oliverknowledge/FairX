# Removed / demoted features — FairX simplification sprint

> **V4 pivot note.** The submission is now **FairX Vault V4** (fixed-payout, fully-collateralised).
> The public product is exactly four surfaces — `/` · `/markets/france-morocco-v4-replay` ·
> `/portfolio` · `/proof`. The earlier LineGuard v2/v3 surfaces (`/walkthrough`, `/reference`,
> `/operator`, `/terminal`, `/attack-lab`, `/integrate`, `/verify/[receiptId]`) now **server-redirect**
> to the nearest V4 surface so a judge exploring URLs never meets a second, divergent product. Their
> source and components remain in git history; nothing was deleted destructively. The sections below
> document the earlier simplification sprint and remain accurate for that LineGuard product.

This file records everything removed, demoted, or hidden during the product
simplification sprint. **No genuine engineering was deleted.** Every capability
listed as "demoted" or "hidden" still exists and is still reachable; it was only
moved out of the primary attention path so the core story reads in three minutes.

Objective: one unforgettable product — **FairX, protected stale-information
prediction markets** — not fewer files.

---

## Deleted routes

| Name | Path | Why removed | Safely restorable? |
|---|---|---|---|
| V2 lifecycle verifier (standalone) | `app/verify/v2-france-morocco/page.tsx` | Pure duplicate. The identical `V2LifecycleVerifier` is already embedded behind the "Archived v2 lifecycle" disclosure on `/proof`. A second dedicated route only added a menu entry and a second place explaining the same archived record. | Yes — restore the 21-line wrapper; the `V2LifecycleVerifier` component is untouched. |
| Custom market builder stub | `app/create/page.tsx` | Already a dead-end "feature removed" placeholder. Keeping a route + footer link for a non-feature spent a menu slot and judge attention on something FairX intentionally does **not** do. The honesty note it carried is preserved in `PRODUCT_TRUTH.md` (`/create` → REMOVED / STATIC). | Yes — restore the static file; nothing depended on it. |

Nothing else was deleted. In particular the deterministic receipt verifier
`app/verify/[receiptId]/page.tsx` was **kept** — it is genuine cryptographic
evidence (tamper detection / deterministic receipts) and remains linked from the
receipt panels that produce those receipts.

---

## Demoted from primary navigation (still reachable in the footer)

The primary nav is now **Trade · How It Works** plus a prominent **Verify Proof**
button (the logo is Home). Everything below moved to the footer "Developer &
detail" row. None of it was weakened.

| Surface | Path | Status |
|---|---|---|
| External reference price (Polymarket) | `/reference` | Kept, footer. Polymarket is the source of the live quote, not the hero. |
| My positions (wallet) | `/portfolio` | Kept, footer + still linked from the market ticket. Real wallet flow unchanged. |
| Guard terminal (LineGuard replay) | `/terminal` | Kept, footer. The interactive guard-function demo is intact. |
| Operator status | `/operator` | Kept, footer. Deployed-program / vault / CPI status intact. |
| Attack-lab simulation | `/attack-lab` | Kept, footer. Same guard function at scale, still labelled simulation. |
| Integration docs | `/integrate` | Kept, footer. Full instruction flow intact. |
| Markets list | `/markets` | Kept, reachable. Redundant one-item list; "Trade" now points straight at the market. |

---

## Content hidden behind disclosure (not removed)

- Market page (`DevnetMarket`): the embedded `CanonicalV2Settlement` receipt block
  is collapsed behind a "Full settlement receipt" disclosure instead of always-on.
  The trade surface leads; the receipt is one click away.
- Proof page: the archived v2 lifecycle and the developer/operator link remain
  behind their existing disclosures. A plain-language 7-step story now leads, and
  the live 18-check verifier renders below it — the verifier itself is unchanged.

---

## Clarity sprint 2 — presentation only (no engineering touched)

| Change | Where | What happened |
|---|---|---|
| Static two-card example → live animation | `app/page.tsx`, new `components/fairx/ExploitAnimation.tsx` | The homepage centrepiece is now an animated side-by-side: the same stale-price snipe plays out on an ordinary market (retail loses) vs FairX (refunded → reprices → trading continues). Pure presentation, no data. Honours `prefers-reduced-motion`. |
| Hero rewritten to the mental model | `app/page.tsx` | An earlier absolute hero claim was retired; the current V4 hero says exactly what happens: fair trades settle and stale-goal attempts refund. |
| How It Works collapsed to three sections | `app/walkthrough/page.tsx` | Was 9 steps across "Protected entry" + "Settlement". Now exactly **Capture · Protect · Verify**, one sentence each, answering "Why is this fair?". The technical-details disclosure was dropped from this page (the full evidence still lives on `/proof`). |
| Trade jargon reduced | `components/fairx/DevnetMarket.tsx` | "Genuine TxLINE odds history / StablePrice de-margined · part1" → "Price history / France goal repriced YES 52¢ → 86¢". "Accepted collateral" → "Total staked"; "Pool payout estimate" → "Est. payout"; "Archived settled v2 market" → "Settled market · outcome verified on Solana". Same chart, plain language. No trade/wallet logic changed. |
| Dead-end "MARKET RESOLVED" button fixed | `components/fairx/DevnetMarket.tsx` | The disabled grey button on the settled market became a live **"See how this market settled →"** link to `/proof`. Resolved-branch only; the live wallet/order path for an unresolved market is byte-identical. |
| Engineering noise made conditional | `components/fairx/DevnetMarket.tsx` | The always-on "Devnet blockhash / confirm network" warning now renders only after a wallet connects (it is meaningless before signing). The "connect a wallet" prompt is hidden on the settled market. |
| Homepage 3-step aligned to one vocabulary | `app/page.tsx` | "From match event to payout" (TxLINE/vault jargon, duplicating the animation) → **Capture · Protect · Verify** in plain English, matching How It Works. Added a single Verify-Proof CTA before the footer; de-jargoned the featured-market card and footer line. Removed now-dead `canonicalV2Lifecycle` import + `OutcomeCard` helper. |
| Animation made accurate | `components/fairx/ExploitAnimation.tsx` | Both markets now correctly reprice to 86¢; the only difference is the snipe (ordinary "Kept +34¢" in red vs FairX "Refunded" in green). The earlier version implied the ordinary price never repriced — inaccurate, and a Solana/Polymarket judge would catch it. |

## Clarity sprint 3 — resolved-market redesign & route cleanup (presentation only)

**No Anchor program, pricing, LineGuard, receipt, verifier, or deployed evidence was touched.**

### Deleted / redirected

| Name | Path | Why | Restorable? |
|---|---|---|---|
| Market-list route | `app/markets/page.tsx` | Redundant one-item list. Now a server `redirect()` to `/markets/france-morocco-france-win` (the primary Trade target). All inbound `/markets` links keep working. | Yes — restore the list page + `MarketCard`. |
| `MarketsDiscovery.tsx` | `components/fairx/` | **Dead code** — zero importers before this sprint. | Yes (git history). |
| `MarketCard.tsx` | `components/fairx/` | Orphaned once `/markets` redirects and `MarketsDiscovery` is gone. `lib/markets/catalog` kept (still used by `store.ts` + tests). | Yes (git history). |

### Resolved-market experience (`components/fairx/DevnetMarket.tsx`)
The inert trading interface no longer renders on a settled market. The trading ticket (wallet selector, YES/NO, stake, payout preview, transaction warning, buy button) is gated behind `showTicket` — it renders **only when an on-chain market is genuinely open** (`deployed && !resolved && !tradingClosed`). For the settled canonical market a single **Result card** leads: `Resolved · France won (YES)`, official score, accepted stake, stale order refunded, gross payout, net profit (with an honest "net is 0 because the exploit was refunded" note), protection status, TxLINE verification, and a `See verified lifecycle →` CTA. Every number is read from the on-chain-verified `v2-france-morocco-lifecycle` fixture — nothing invented.

### Technical disclosures merged
The market page previously had three technical disclosures ("Technical details", "Technical order details", "Full settlement receipt"). On the resolved view these are now **one** `Technical evidence` section: market/vault/position/refunded-order PDAs, quote & fixture commitment, TxLINE evidence, vault accounting, Explorer transaction links, the (kept, shared) `CanonicalV2Settlement` receipt, and the single link to the stress-test. No technical fact is duplicated elsewhere on the page. The consumer-facing "Refresh on-chain state" button moved into this section.

### Footer / developer-surface noise (`components/fairx/FairXShell.tsx`)
- `Attack-lab simulation` removed from the consumer footer; the route stays functional and is now reached only from the market's `Technical evidence` area as `Stress test (attack simulation)`.
- Internal build metadata line (`build <sha> · <cluster> · program …`) removed from the footer.

### Consumer copy
`TXLINE HISTORICAL` → `Historical TxLINE evidence`; `Market synchronized` → `Price up to date`; settled-ticket status → `Protection complete`; `archived v2 lifecycle` (proof disclosure) → `earlier settled market & developer view`. Header now shows 🇫🇷/🇲🇦 flags + `France 1–0 Morocco` + highlighted winner.

### Test kept truthful
`lib/proof/judgeComprehension.test.tsx` (a **presentation** comprehension test, not a protocol/security test) asserted pre-sprint copy and rendered the now-redirecting `MarketsPage`. Its assertions were updated to the current intended content (hero, simplified nav, Capture/Protect/Verify). All 211 tests pass.

## Confirmation: all real engineering still exists

LineGuard, stale-price detection, stale-sequence returns, TxLINE integration, direct
TxLINE CPI, the Solana program, wallet integration, the proof verifier, tamper
detection, deterministic receipts, on-chain settlement, real devnet transactions,
the real user lifecycle, isolated market vaults, Position PDAs, and every genuine
cryptographic artifact remain in the codebase and reachable in the UI. This sprint
changed presentation and navigation only.
