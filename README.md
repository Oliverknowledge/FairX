# FairX — LineGuard-protected prediction markets

FairX is a Solana devnet prediction-market prototype designed to prevent stale-price exploitation and make every market decision independently auditable. **Devnet SOL only. No real-money settlement. No mainnet deployment.**

## Canonical FairX v2 lifecycle

FairX v2 is deployed on Solana devnet:

- Program: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`
- Upgrade slot: `475831626`
- Reviewed binary SHA-256: `76c2fd8e386d20e47af77b883175a26c5069b72e9c256413dea3f29ce06f3dd8`
- Source checkpoint for the deployed binary: `fd478a75318e7da5b729906e905260597c6cee29`
- Template: `MATCH_WINNER_HOME_V1`
- Direct TxLINE CPI: `ValidateStatV2` passed
- Resolution: 2-of-3 authorities
- Custody: isolated per-market vault
- Position: wallet-owned PDA

The canonical France–Morocco lifecycle uses genuine TxLINE historical evidence and one user-owned devnet wallet lifecycle:

```text
TxLINE event seq 739
→ stale 0.01 SOL YES order refunded exactly
→ market repriced from 52.274% to 86.505%
→ synchronized 0.01 SOL YES order opens Position PDA
→ feed authority closes market
→ LineGuard CPIs into TxLINE ValidateStatV2
→ France 1–0 Morocco derives YES inside LineGuard
→ resolution authorities A + B reach 2-of-3
→ user wallet claims 0.01 SOL
→ 0.02 deposited = 0.01 refunded + 0.01 paid + 0 claimable + 0 dust
```

The canonical wallet was a secure test-user devnet keypair, not a Phantom browser signature. The product supports Phantom, Solflare, and compatible wallet-adapter wallets for public devnet transactions.

## Proof routes

- `/markets/france-morocco-france-win` — public settled-market evidence
- `/verify/v2-france-morocco` — v2 receipt and tamper verifier
- `/walkthrough` — continuous v2 lifecycle
- `/proof` — primary v2 proof; legacy versions are collapsed under **Historical protocol versions**

The durable machine-readable fixture is [`fixtures/lineguard/v2-france-morocco-lifecycle.json`](fixtures/lineguard/v2-france-morocco-lifecycle.json).

## Two TxLINE hash domains

- **TxLINE capture hash — canonical JSON domain:** SHA-256 of the preserved canonical JSON score payload.
- **TxLINE CPI payload hash — Borsh domain:** SHA-256 of the exact Borsh `StatValidationInput` supplied to `ValidateStatV2`.

The hashes differ because they commit different serializations of the same underlying TxLINE evidence. Each representation is reconstructed and verified in its own domain.

## Local verification

```bash
npm install
npm test
npm run typecheck
npm run build
NO_DNA=1 anchor test --validator legacy
```

## Security and deployment status

- Solana devnet only; no mainnet or real-money operation.
- The program is unaudited and is not represented as production-ready.
- The program upgrade authority remains `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`; it has not been transferred.
- Feed, pricing, emergency, and three resolution roles are separated on-chain.
- Emergency authority can void/refund but cannot select a winner.
- TxLINE credentials and operator key material remain server-only and gitignored.

See [PROOF.md](PROOF.md), [TXLINE.md](TXLINE.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [PRODUCT_TRUTH.md](PRODUCT_TRUTH.md).
