# FairX Vault V4 Phase C reproducibility

> Historical build-gate record: this document describes the pre-deployment reproducibility gate.
> Deployment and the canonical lifecycle subsequently completed; see
> `docs/v4-phase-c-deployment-plan.md` for the finalized devnet record.

This was the isolated France–Morocco deployment-candidate build. At this gate it was not deployment
authorization, and no transaction had yet been signed or sent.

The transaction and signer plan is recorded in `docs/v4-phase-c-deployment-plan.md`.

## Pinned toolchain

- Rust `1.89.0` from `rust-toolchain.toml`
- Anchor CLI and `anchor-lang` `1.1.2`
- Solana CLI `3.1.10`, platform tools `v1.52`
- Node.js `24.12.0`, npm `11.6.2`

`Cargo.lock`, `package-lock.json`, the TxLINE root snapshots, and their hashes are repository inputs.

## Approved public identities

The V4 program ID is `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p`.
The compiled bootstrap administrator is `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`.
Only these public values are repository inputs. Their private keypairs remain external.

The final Phase C reproducible build:

1. Compiles the approved bootstrap public key into `BOOTSTRAP_ADMIN`.
2. Prevents creation of `fairx_vault_v4-keypair.json` during the SBF build.
3. Never copies a seed, secret key, or keypair JSON into the repository or test environment.
4. Pins the program ID, bootstrap administrator, IDL hash, generated type hash, binary hash, and binary size in `v4-build-manifest.json`.
5. Requires separate approval before any deployment transaction is constructed, signed, or sent.

## TxLINE executable provenance

The expected `txline_oracle.so` hash and root-account hashes are in
`fixtures/txline/v4-pinned-artifacts.json`. The executable was captured with a read-only devnet
program dump of `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`.

The binary remains outside Git under `target/deploy`. For a clean checkout, obtain it explicitly:

```sh
NO_DNA=1 solana program dump \
  --url https://api.devnet.solana.com \
  6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J \
  target/deploy/txline_oracle.so
shasum -a 256 target/deploy/txline_oracle.so
```

The result must equal `a645f9d61fc06e743a5bbcb0ebac0a6d7fdd7387dae67f413ab9b769950a3562`.
The lifecycle aborts before execution if it differs. It never silently fetches root accounts; both
root snapshots, their owners, PDAs, file hashes, and account-data hashes are pinned locally.

## Reproduction

From a clean checkout with the pinned TxLINE executable present:

```sh
bash scripts/fairx-v4-reproducibility.sh
```

The script refuses a dirty tree, checks that no V4 keypair exists, verifies both approved public
identities, regenerates the IDL, builds SBF
behind a directory sentinel that prevents keypair creation, verifies all expected hashes, runs both
signed LiteSVM lifecycles, typechecks, and performs the production web build.

The bootstrap private key remains external. The harness uses a public no-op signer and disables
LiteSVM signature verification only for `initialize_market_v4`; it immediately restores signature
verification for every subsequent lifecycle transaction. This proves the compiled public-key check
without possessing the real bootstrap key. It does not prove control of that key, devnet loader
behavior, cluster feature parity, compute pricing, RPC availability, or the final live TxLINE
program/root state.
