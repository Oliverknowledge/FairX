# LineGuard — Stale-Price Protection for Live Sports Markets

FairX is a devnet-backed protected prediction-market prototype. LineGuard is the settlement-integrity
primitive at its core: it compares two sequence numbers per market and voids only the trades that
exploit an un-repriced event.

> In live sports markets the officiated feed can know a goal happened before the displayed price
> has repriced. In that gap, bots trade new information at old prices. LineGuard compares two
> sequence numbers per market and voids only the trades that exploit the gap.

Fresh devnet execution is available for the canonical YES/NO proof flows. Custom markets can be
initialized on devnet; custom trading currently runs as local simulation.

```bash
npm install
npm run dev        # → http://localhost:3000
```

Open the **Proof walkthrough**, or step through the **LineGuard Terminal** manually.

## The mechanism

Two numbers per market:

- **`materialSeq`** — latest officiated (TxLINE-style) event sequence affecting the market
- **`pricedAtSeq`** — latest sequence the displayed price has repriced through

A market is **stale** when `materialSeq > pricedAtSeq`. But LineGuard doesn't freeze a stale
market — it checks whether *this order* profits from the un-repriced event:

```
staleness = materialSeq − pricedAtSeq
if staleness ≤ 0                 → ALLOWED                (in sync)
edge = fairSidePrice − observedPrice
if edge > tolerance              → VOIDED_REFUNDED        (stale + captures edge)
else                             → STALE_ALLOWED_NO_EDGE  (stale but no advantage)
```

That's the entire protocol. It's a single pure function — [lib/lineguard/evaluate.ts](lib/lineguard/evaluate.ts).

## On-chain settlement guard

The repo now also includes a minimal Anchor program that enforces the same guard before settlement:

- market freshness registers live in `MarketState`
- order stake is transferred into an `OrderEscrow` PDA
- `evaluate_order` computes the side-specific edge on-chain
- stale YES edge above tolerance is refunded from escrow
- stale NO/no-edge and in-sync orders are marked filled
- `GuardVerdictEvent` emits the verdict fields needed for a receipt/proof

Anchor entry point: [programs/lineguard/src/lib.rs](programs/lineguard/src/lib.rs).

Local program id generated for this workspace:

```txt
6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe
```

Run the local Anchor enforcement tests:

```bash
npm install
NO_DNA=1 anchor test
```

Optional frontend/server on-chain mode is intentionally honest. Without configuration, the app shows
**Devnet operator not configured** and continues to run the off-chain sandbox.

```bash
NEXT_PUBLIC_SOLANA_CLUSTER=devnet        # or localnet
NEXT_PUBLIC_LINEGUARD_PROGRAM_ID=6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe
SOLANA_RPC_URL=https://api.devnet.solana.com
LINEGUARD_OPERATOR_KEYPAIR='[1,2,3,...]' # server-side only; never exposed to the browser
                                         # (SOLANA_DEMO_KEYPAIR still read as a fallback)
```

Devnet deployment path:

```bash
NO_DNA=1 anchor build
NO_DNA=1 anchor deploy --provider.cluster devnet
```

If deployment produces a different program id, update all three places before running the app:

- `declare_id!` in `programs/lineguard/src/lib.rs`
- `[programs.devnet]` in `Anchor.toml`
- `NEXT_PUBLIC_LINEGUARD_PROGRAM_ID`

The server routes under `app/api/solana/lineguard/*` simulate transactions before sending and return
real transaction signatures only when the program id, RPC, and server-side operator keypair are configured.

Fresh devnet execution routes:

```bash
curl -X POST http://localhost:3000/api/solana/lineguard/full-yes-demo
curl -X POST http://localhost:3000/api/solana/lineguard/full-no-demo
```

Expected configured behavior:

- YES route: initialize → ingest stale event → place YES escrow → evaluate → `VOIDED_REFUNDED`
- NO route: initialize → ingest stale event → place NO escrow → evaluate → `STALE_ALLOWED_NO_EDGE` / `Filled`

Devnet on-chain settlement guard implemented:

```txt
Program ID: 6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe
Program explorer: https://explorer.solana.com/address/6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe?cluster=devnet
Deployer / upgrade authority: ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq
```

Anchor deployed the executable program. The subsequent Anchor IDL metadata upload failed, so the
frontend/server uses the checked-in generated IDL in `target/idl/lineguard.json`.

YES devnet route proof:

```txt
Market PDA: GSVsEECW7EuXQbS8ztskoYDE18GhRvY8wFNbxHwrezZs
Order escrow PDA: 8khPDtj1S1yQA67898yRXKyUdgV45cMUiBainz1JCxo2
Outcome: VOIDED_REFUNDED
Edge: +230000 micros
Refunded: yes
Tx 1 initialize: 3nxMTmkqBhekhqChe85QST9ypKyWyBzZoPE1EV62Y9CvgG2d2Pe7dWHiRNRDRLwT2PY3yVhHbfXGRg8akoPnE367
Tx 2 ingest: 2kconXTGBD9G2GqX7ftf63LkKeXVcmsDGkUyQJM1Rtr8Ve4kfWCrdvsSSwKwSJ3S7WHY1oaCouitttDtMnXSpzqv
Tx 3 place: 2gA8QGUNEDXBmtH8iqrxL135AhhcecFdBSdNghzJuh3DUUhMiKcoAUrT9GiV7SdEnEeHyPWUtuisfAhNK6RB4Q2y
Tx 4 evaluate: 2kdy7Jw65WkaotvM749MFSdtoNbxTS2Q8Wb6rAyCQCuT8iEhVXxNgMHPmEkZKv7DwcuemqxnkP8WDBLMFW7YW2LU
```

NO devnet route proof:

```txt
Market PDA: HTs6RaHawcnffbKgGNjiXBhh5eAmWn2A9qKD5nRjp4pH
Order escrow PDA: Cu2c5BffadxKwRXHpSKbzrF5TNT9wpd54vL3dzUX6bF2
Outcome: STALE_ALLOWED_NO_EDGE / Filled
Edge: -230000 micros
Refunded: no
Tx 1 initialize: 4SPrLtMrZ4QPmoMuDnTpP3N7XTCvwji9GNSW9VHf1jcv7qWgJPyX4As2cty6YtekS4T8L4E7E1cbUxferYhga6R9
Tx 2 ingest: 2gdJVLcLFr7oyzs8Lfj8b1jhi1QUaY8HsxRrAE5pFDENUiQZbr8fQ9ozPZfJ6tCUB8fxxEi8siqhSp5LoVSv5aSd
Tx 3 place: 4kHjR8hxuRH6Ws1PxDAaetvccZsiGWW1EmZyXHFr2NcrxEBW3dLeKsfWEcv7nNhv4qc18H9D1GbG2quAiad3j6LP
Tx 4 evaluate: pq4KQJgJqRhLHdreXpqwLkuQzz55JFou9Bhr2PfawFs4hR4gEASTEt3W8Kh5tHwYXFS5kXFUW87opktiGaaywkA
```

Append `?cluster=devnet` explorer URLs with `https://explorer.solana.com/tx/<signature>?cluster=devnet`.
The on-chain slice is only market freshness registers, escrow custody, guard evaluation, refund/fill
decision, and receipt proof linkage. TxLINE ingestion, the replay UI, charts, and counterparty
settlement remain off-chain/simulated.

## The story (understandable in 10 seconds)

1. England wins trades at **40¢** · in sync (seq 1 = seq 1).
2. Saka scores. TxLINE publishes event **seq 2**. Fair value → **63¢**, displayed price still **40¢**.
   `materialSeq 2 > pricedAtSeq 1` → **stale window open**.
3. A latency bot fires **YES $500 @ 40¢** into the stale price.
4. LineGuard computes **+23¢** unfair edge (> 2¢ tolerance) → **VOIDED & REFUNDED**.
5. The market reprices to **63¢**, `pricedAtSeq → 2`, window closed.

Split: **without LineGuard** the bot pockets **+$287.50** (1,250 shares × 23¢); **with LineGuard, $0.00**.

## Files

| File | Role |
| --- | --- |
| [lib/lineguard/evaluate.ts](lib/lineguard/evaluate.ts) | The guard — one pure, testable function |
| [programs/lineguard/src/lib.rs](programs/lineguard/src/lib.rs) | Minimal Anchor enforcement primitive: registers, escrow, evaluate, refund/fill event |
| [tests/lineguard-onchain.ts](tests/lineguard-onchain.ts) | Anchor tests for YES refund, NO fill, in-sync allow, below-tolerance allow |
| [components/lineguard/OnChainPanel.tsx](components/lineguard/OnChainPanel.tsx) | Optional on-chain settlement guard UI and verdict match display |
| [lib/terminal/state.ts](lib/terminal/state.ts) | Types + fixtures (one market, one event, one bot order) |
| [lib/terminal/reducer.ts](lib/terminal/reducer.ts) | 5-transition state machine; the decision is made in `REVEAL_VERDICT` |
| [components/lineguard/MarketPanel.tsx](components/lineguard/MarketPanel.tsx) | Displayed price vs fair-value ghost, sequence chips |
| [components/lineguard/GuardPanel.tsx](components/lineguard/GuardPanel.tsx) | The hero — registers, checks, verdict |
| [components/lineguard/BotPanel.tsx](components/lineguard/BotPanel.tsx) | The adversary + without/with split |
| [components/lineguard/EventTimeline.tsx](components/lineguard/EventTimeline.tsx) | Officiated feed |
| [components/lineguard/ReplayControls.tsx](components/lineguard/ReplayControls.tsx) | Step buttons + auto-replay |
| [components/lineguard/OrderLog.tsx](components/lineguard/OrderLog.tsx) | Event/order log |
| [app/page.tsx](app/page.tsx) | The one screen; holds the `useReducer` and replay timer |

## Scripts

```bash
npm run dev        # dev server on :3000
npm run build      # production build (strict types)
npm run typecheck  # tsc --noEmit
npm run test       # Vitest domain tests
npm run test:onchain # Anchor localnet tests
npm run anchor:build # Anchor build
npm run deploy:devnet # Anchor deploy --provider.cluster devnet
```

## Built / not built

Built:

- UI terminal for the LineGuard stale-price scenario
- TxLINE live/sandbox/captured ingestion and normalizer traces
- off-chain guided scenario and guard verdict
- escrow ledger simulation in the UI
- receipt hashing, tamper detection, and standalone verifier
- Anchor enforcement primitive with on-chain lamport escrow, guard evaluation, refund/fill state, and verdict event
- server-side transaction routes for configured localnet/devnet execution, including fresh full YES/NO proof flows
- receipt fields for linking a real on-chain verdict transaction when present

Not built:

- full market matching engine
- production AMM
- real counterparty settlement for filled orders
- mainnet deployment
- production oracle authority management
- automatic devnet deployment from this repo

Current honest status: **Devnet on-chain settlement guard implemented.**
This is not a fully on-chain prediction market: matching, pricing, TxLINE ingestion, charts, and
counterparty settlement remain outside the program.

## Where this goes next

- **Real feed + authority flow.** Bind TxLINE/captured material events to the on-chain market authority path
  instead of manually clicking ingest.
- **Counterparty settlement.** Replace the filled-order placeholder with a protocol vault or matching/collateral
  path that represents real settlement obligations.
- **Many markets.** Per-market registers (a red card is material to "France wins" but not to
  "Kane to score"), a market board, and a fair-value model instead of hardcoded keyframes.

Not a real-money product — a devnet-backed prototype of the fairness mechanism.
