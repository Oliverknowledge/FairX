# Devnet deployment and evidence gate

## Deployed artifact

- Program: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`
- ProgramData: `D6buB3VxXnxX3jXjPX5HCqRAMJqtV4yLzaKuMra17nPT`
- Upgrade authority: `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`
- Deployment slot: `475972063`
- Program capacity and deployed binary size: `571,808` bytes
- SHA-256 of both local artifact and independently dumped deployed bytes: `1903958567efc17f3a31a2b3d6e4bcd594fe2f601b458ec82ec946badd3830cc`
- ProgramData rent balance: `3.98098776 SOL`
- Extension transaction: `4mre6S26M63aMQUcXUasuzjZXirQKJYrY1GJChxSqAtEQvQJrAJKZHtqSqjiDhuRbM1Uoh6ZbJ783e7dqDjt54aM`
- Upgrade transaction: `5rYPkn9pUtd4SSAGYPTo7ew7LeyGi8M2SFr3FQGQJ535dS6FeAGUdv9MvSgmHBeXEVhczdp1Tc33Pca66yd4kF6E`

The initial RPC upload attempt hit public-devnet rate limits. Its temporary buffer was treated as compromised after its recovery material appeared in CLI error output; the buffer was immediately closed and its entire `3.98098776 SOL` balance recovered. The successful retry used TPU transport. No compromised buffer remains funded.

## Canonical lifecycle evidence

Deployment identity and economic behavior are separately verified.

The recorder verified that locally configured signers matched the existing AuthorityConfig roles without exposing private material:

- feed: `FbC9mbuyi9iWeMyhe9ZtTRg6KY4qz6Vqb83S2ssUwSm5`
- pricing: `Ckwtt9Hd6eyn9wWFTEsJ1YyhUg9jCWAm944od29wK1qa`
- resolution A: `ABrWPMaGRRCY2qGbF3cYkZv7E2rMMANoesGWcoSDUkTG`
- resolution B: `EXVwU5mGZBAn7MBWZLwnDwqSkDZzn6PvhXJwh1L5cNm5`

The recorder completed the exact A/B/C sequence, persisted `fixtures/lineguard/v3-france-morocco-three-wallet.json`, and the independent RPC verifier returned `VERIFIED` across 18 checks. The public record contains only addresses, transaction signatures, hashes, balances and derived accounting—not key material.

Future authority replacement still requires the enforced 86,400-second timelock. Bypassing that delay with a program upgrade would invalidate the security story.

## Server deployment

Required public configuration includes devnet cluster, RPC URL and program ID. Server-only values include the operator keypair, TxLINE credentials and a random `LINEGUARD_OPERATOR_API_TOKEN` of at least 32 characters. Never expose these through `NEXT_PUBLIC_*` or client bundles.

The operator API is not production architecture: it is an authenticated hackathon control plane backed by a hot key. Use a multisig/frozen upgrade authority, managed signer, rate limits and an external audit before any production or real-value use.
