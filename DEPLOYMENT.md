# FairX V4 deployment and evidence gate

## Current state — deployed and lifecycle verified

The FairX Vault V4 program is deployed on Solana devnet, and its isolated canonical lifecycle is finalized:

- Program `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p` — executable, upgradeable-loader owned
- ProgramData `9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V` — loader owned; upgrade authority `ELayKf…brbq`
- Deployment signature `3na7azn…mKjjS7`, finalized at slot `476416258`
- Upload buffer `BGB1nc…UteLM` — drained and purged by deployment
- Dumped SBF — 422,040 bytes, SHA-256 `7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0`
- France–Morocco lifecycle — 24 finalized transactions; independent RPC verifier `VERIFIED` 20/20

The full deployment and lifecycle record is in [docs/v4-phase-c-deployment-plan.md](docs/v4-phase-c-deployment-plan.md).

## Reproducible artifact (real now)

- SBF SHA-256 `7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0`, 422,040 bytes, matching `fixtures/txline/v4-build-manifest.json`.
- Pinned toolchain: Rust 1.89.0 · Anchor 1.1.2 · Solana CLI 3.1.10 · platform tools 1.52.
- `bash scripts/fairx-v4-reproducibility.sh` rebuilds and re-pins every hash. No keypair, seed, or secret is in this repository; signing occurs only through an external wallet/HSM.

## Verification commands

`npm run v4:verify-lifecycle` re-fetches the executable program, deployed binary, TxLINE roots, durable V4 accounts, all 24 finalized transaction messages, balance deltas and closed-account state. It signs and sends nothing. `npm run v4:verify-proofs` independently re-simulates the three canonical TxLINE validations.

## Historical predecessor (real, not V4 evidence)

An earlier LineGuard v2/v3 program (`6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`) was deployed to devnet (slot `475972063`, SHA-256 `1903958567…3830cc`) and independently RPC-verified for the France–Morocco three-wallet lifecycle. It shows the team ships and verifies on-chain, but it is a different program and its transactions are never presented as V4 evidence.

## Server deployment

Required public configuration: devnet cluster, RPC URL, program ID. Server-only values: operator keypair, TxLINE credentials, and a random operator API token of at least 32 characters. Never expose these through `NEXT_PUBLIC_*` or client bundles. The operator API is an authenticated hackathon control plane backed by a hot key, not production architecture; any real-value use requires a multisig/frozen upgrade authority, a managed signer, rate limits, and an external audit.
