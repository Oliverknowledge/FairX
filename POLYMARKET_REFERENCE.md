# FairX × Polymarket external reference price

FairX uses **public Polymarket order-book data as an external reference quote** for an equivalent
market. TxLINE supplies the sports-event and settlement evidence. LineGuard protects Solana
execution when those states diverge.

FairX does **not** hold Polymarket liquidity, does **not** route orders to Polymarket, does **not**
use Polymarket trading authentication, does **not** custody Polygon assets, and is **not** affiliated
with Polymarket. Public Polymarket market data is used only as an external reference source.

## Why an external reference price

FairX has no organic price discovery yet — there is no AMM, order book, or permissionless oracle
inside FairX that sets a quote (see [PRODUCT_TRUTH.md](PRODUCT_TRUTH.md)). Historically the displayed
quote was either genuine TxLINE StablePrice (France–Morocco) or a deterministic operator heuristic
(`FAIR_SHIFTS` in [lib/markets/fairValue.ts](lib/markets/fairValue.ts), e.g. a +23¢ goal shift). The
heuristic is honest as a demo but it is a *unilateral pricing authority*. Sourcing the opening quote
from the midpoint of a liquid, equivalent Polymarket market makes it externally grounded and
independently reproducible — without changing the LineGuard primitive or the TxLINE settlement path.

## Public endpoints used (read-only, no key, no auth header, no cookie)

Gamma market discovery — `https://gamma-api.polymarket.com`
- `GET /events/{id}` · `GET /events/slug/{slug}` — event + its markets (condition id, `clobTokenIds`, resolution text, open/closed state)
- `GET /markets/{id}` · `GET /public-search?q=` — discovery / proposal only

CLOB market data — `https://clob.polymarket.com`
- `GET /book?token_id=` — full order book (`bids`/`asks`, `timestamp`, `hash`, `last_trade_price`)
- `GET /midpoint`, `GET /spread`, `GET /price?token_id=&side=` — cross-checks

All upstream calls run server-side ([lib/polymarket/client.ts](lib/polymarket/client.ts)) with a strict
timeout, capped exponential backoff, and a per-host circuit breaker. `credentials: "omit"`. No
authenticated order-management endpoint is ever called.

## Mapping methodology

A TxLINE fixture is bound to a Polymarket market only after **manual review**, recorded as a
versioned [FairXExternalMarketMapping](lib/polymarket/types.ts) in the approved registry
([lib/polymarket/mapping.ts](lib/polymarket/mapping.ts)). Fuzzy title matching alone is never enough;
the review confirms exact fixture identity, home/away orientation, the YES-meaning, and the
resolution scope (draw / extra-time / cancellation). Each mapping carries deterministic
`homeTeamHash`, `awayTeamHash`, `resolutionRuleHash`, and a canonical `mappingHash`.

**Canonical mapping (approved):** `fifwc-fra-esp-2026-07-14-france-win`
- TxLINE fixture: France (home) vs Spain — 2026 FIFA World Cup semi-final, 14 Jul 2026
- FairX template `MATCH_WINNER_HOME_V1`, YES = `HOME_TEAM_WINS` (France wins)
- Polymarket event `691040`, market `2879968` "Will France win on 2026-07-14?"
- conditionId `0x20fac1c925b7a2fed6b3b2736f47a800b4d0d4001b9deaeb7b918868eb63d081`
- YES token `2531…10183`, NO token `1140…96575`
- Resolution: *"the outcome within the first 90 minutes of regular play plus stoppage time"* — the
  **same basis** as FairX's on-chain `home_score > away_score` derivation from TxLINE, so the YES-side
  probability semantics align exactly. A regulation draw resolves YES→NO on both sides. Only full
  cancellation diverges (Polymarket → NO; FairX → emergency-void + refund); this is documented and
  immaterial to reference pricing.

`txlineFixtureId` is a FairX-side identifier; the live TxLINE fixture-id binding must be confirmed
against TxLINE before any real settlement. Polymarket supplies only the reference **price**.

## Quote policy and thresholds

The default reference is the **YES-token order-book midpoint**, recomputed from best bid and best ask
— the adapter never trusts Polymarket's precomputed midpoint for the canonical quote
([lib/polymarket/pricing.ts](lib/polymarket/pricing.ts)). `midpoint = (bestBid + bestAsk) / 2`.

A quote is **rejected** (`method: UNAVAILABLE`, `quoteValid: false`, with explicit
`rejectionReasons`) — never silently defaulted to 0.5 or silently downgraded to last trade — when any
hold: empty bid/ask, crossed book, spread > max, visible depth < min, quote age > max, market closed,
price outside (0,1), invalid/future timestamp, or the simple and depth-weighted midpoints diverge
beyond tolerance. A depth-weighted midpoint is computed as an additional diagnostic and disagreement
is surfaced, never hidden.

| Threshold (env) | Default | Meaning |
|---|---|---|
| `POLYMARKET_MAX_SPREAD_MICROS` | 50_000 (5¢) | reject wider spreads |
| `POLYMARKET_MIN_VISIBLE_DEPTH` | 100 | min visible size each side |
| `POLYMARKET_MAX_QUOTE_AGE_MS` | 60_000 | reject older books |
| `POLYMARKET_REFERENCE_METHOD` | `ORDERBOOK_MIDPOINT` | canonical method |
| `POLYMARKET_DEPTH_WINDOW_SIZE` | 500 | depth-weighted window |
| `POLYMARKET_MAX_METHOD_DIVERGENCE_MICROS` | 20_000 (2¢) | reject unstable books |

## Hashing and durable capture

A [PolymarketReferenceCapture](lib/polymarket/types.ts) is canonical-JSON serialized and bound by four
deterministic `sha256` hashes ([lib/polymarket/hash.ts](lib/polymarket/hash.ts)): `rawPayloadHash`
(the exact book), `mappingHash` (approved identity), `normalizedQuoteHash` (the recomputed
bid/ask/mid/spread/depth — not upstream's numbers), and `pricingPolicyHash` (thresholds in force). The
verifier ([lib/polymarket/verify.ts](lib/polymarket/verify.ts)) recomputes every hash and re-derives
the whole quote from the stored raw book, so tampering with any level, the midpoint, the mapping, the
timestamp, or a hash is detected. This is **RECORDED EVIDENCE** (bundled, offline) — it never re-fetches
Polymarket, so it never claims **LIVE VERIFIED**.

Scripts: `npm run polymarket:discover`, `npm run polymarket:capture -- <mappingId>`,
`npm run polymarket:verify-capture`. The bundled capture lives at
`fixtures/polymarket/<mappingId>.capture.json` and contains no secrets.

## Signed execution constraints — on-chain vs off-chain

The reference quote is committed through the **already-deployed** LineGuard V2 pricing slot — **no
program upgrade** ([programs/lineguard/src/lib.rs](programs/lineguard/src/lib.rs)):

- `commit_txline_odds_v2(odds_sequence, fair_price_micros, odds_payload_hash, pricing_model_version, pricing_model_hash)`
  — `odds_payload_hash` = the reference capture hash, `fair_price_micros` = the recomputed midpoint,
  `pricing_model_hash` pinned to the value fixed at market init.
- The trader **signs** in `place_order_v2`: `expected_execution_price_micros`, `max_slippage_micros`,
  `max_accepted_edge_micros`, `expected_pricing_sequence`, `expected_odds_sequence`, `expiry_slot`.
- The chain **enforces**: `OddsSequenceMismatch` (a repriced/newer quote), `PricingSequenceMismatch`,
  `SlippageExceeded`, `OrderExpired`, `TradingClosed`; and the verdict
  `refund = trading_closed || resolved || (stale && edge > min(maxAcceptedEdge, tolerance))`.

**On-chain enforces** the hashes, sequences, price/slippage/edge/expiry constraints, and refund/finalize.
**Off-chain enforces** that `fair_price_micros` was honestly derived from the real book — which the
durable capture + verifier make independently reproducible. [lib/polymarket/execution.ts](lib/polymarket/execution.ts)
is a pure mirror of this path so orders can be previewed and verified without sending a transaction.

## Reliability, rate limits, failure behavior

The server service ([lib/polymarket/service.ts](lib/polymarket/service.ts)) uses a short-lived cache
with stale-while-revalidate and a **verified bundled-capture fallback**, and labels every served quote
honestly: `LIVE` / `RECENTLY_CACHED` / `HISTORICAL_CAPTURE` / `UNAVAILABLE`. Cache and history are
never labelled live; if Polymarket is unavailable FairX does not invent a quote. The public routes are
allowlisted by `mappingId`, per-IP and globally rate-limited, and never proxy arbitrary upstream URLs
or user-supplied token ids. `POST …/refresh` is gated by the operator API token.

## Trust assumptions

Polymarket is treated as a **public external market-data source whose payload and mapping must be
verified**, not a trusted oracle and not the objectively correct probability. Its midpoint is a market
reference. TxLINE remains the sports-event and final-result source; LineGuard remains the execution
guard. FairX is not affiliated with Polymarket.
