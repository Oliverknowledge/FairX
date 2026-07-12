# Production deployment handoff

## LineGuard v2 upgrade gate

No program upgrade was performed in this sprint. Read-only checks on 12 July 2026 found:

- built program size: `532,232` bytes
- current ProgramData capacity: `316,672` bytes
- current raw ProgramData length: `316,717` bytes, including the 45-byte loader header
- required raw ProgramData length: `532,277` bytes
- exact required extension: `215,560` bytes (upgrade must stop until capacity is extended deliberately)
- exact additional rent at the audited devnet rate: `1.5002976 SOL`
- current reviewed artifact SHA-256: `76c2fd8e386d20e47af77b883175a26c5069b72e9c256413dea3f29ce06f3dd8`
- rejected vulnerable artifact: `ba42231f41fc2f01c6fcd406adf11fe6132c80d9bc844211b313d34c8c5a7962` must never be deployed; it allowed unauthorized one-time v2 initialization
- configured wallet / upgrade authority: `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq` (match)
- authority wallet devnet balance: `10.531445351 SOL`
- local simulation: `NO_DNA=1 anchor test --validator legacy` passes 30 tests, including direct CPI against the cloned genuine TxLINE executable, user-owned Position PDAs, per-market vault isolation, threshold resolution, refund, claim, and double-claim rejection
- unresolved authority separation: the configured web/operator wallet remains the program upgrade authority during verification; the separately generated future authority must not receive upgrade authority until the post-upgrade verification report is explicitly approved

Before any approved upgrade, re-run these checks, extend capacity safely, rebuild, verify the final binary size, and simulate every canonical instruction using the final artifact. Never send settlement-v5 instructions while `/api/status` reports the deployed `settlement-v4` schema.

The repository is Vercel-ready as a standard Next.js application. No Vercel project metadata or authenticated Vercel CLI was available during the release audit, so production configuration and deployment must be completed by the project owner. Do not treat production as verified until every check below passes.

## Required production environment variables

Public/configuration values:

```text
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_LINEGUARD_PROGRAM_ID=6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe
SOLANA_RPC_URL=https://api.devnet.solana.com
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
```

Server-only secrets:

```text
LINEGUARD_OPERATOR_KEYPAIR
TXLINE_JWT
TXLINE_API_TOKEN
```

Treat all eight values as unverified/missing in Vercel until the owner confirms them in the Production environment. Never prefix any secret with `NEXT_PUBLIC_`.

Recommended optional public metadata:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_BUILD_TIME=<ISO-8601 build timestamp>
```

## Exact owner steps

1. Install and authenticate the Vercel CLI, or import the GitHub repository through the Vercel dashboard.
2. Link the repository without copying secrets into shell history:

   ```bash
   vercel link
   vercel env ls production
   ```

3. Confirm the linked project uses the `main` production branch and the intended public domain.
4. Add each required variable through `vercel env add <NAME> production` or the encrypted dashboard. Paste secret values only into Vercel’s secure prompt.
5. Confirm the build command is `npm run build` and the framework preset is Next.js.
6. Commit and push the final submission commit to `main` if Git integration is enabled, or deploy explicitly:

   ```bash
   vercel --prod
   ```

7. Record the deployment URL and immutable commit SHA in the submission form.

## Incognito production verification

- `/api/status` returns `market-config-v2`, deployment slot `475298151`, the expected program ID, and no secrets.
- `/walkthrough` defaults to France vs Morocco TxLINE historical evidence.
- `/proof` shows all ten canonical proof stages and both stable receipt links.
- `/verify/rcpt-devnet-yes-3uqFKfEcAt` reports `INTEGRITY VERIFIED`.
- `/verify/rcpt-devnet-no-TdYx89cGtQ` reports `INTEGRITY VERIFIED`.
- A receipt with any changed sealed field reports `TAMPER DETECTED`.
- Missing or expired TxLINE credentials degrade to canonical historical evidence without a server 500.
- No page labels the canonical historical record live.
- Homepage, walkthrough, proof, markets, create, integrate, operator, terminal, and both receipts work at 390×844 and desktop widths.
- Browser console has no errors; internal links return 2xx; Explorer links resolve.

## Secret verification after deployment

Download or inspect only public build assets and public API responses. Confirm the JWT, API token, and operator keypair each occur zero times. Never print the secret values while running the check; compare in-memory and report counts only.
