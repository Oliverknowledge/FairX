# FairX Vault V4 Phase B.1 reproducibility

This is the isolated France–Morocco test build. It is not deployment authorization.

## Pinned toolchain

- Rust `1.89.0` from `rust-toolchain.toml`
- Anchor CLI and `anchor-lang` `1.1.2`
- Solana CLI `3.1.10`, platform tools `v1.52`
- Node.js `24.12.0`, npm `11.6.2`

`Cargo.lock`, `package-lock.json`, the TxLINE root snapshots, and their hashes are repository inputs.

## Bootstrap administrator

The B.1 binary contains the deliberately public test-only address
`GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB`. Its deterministic test seed is public and it must
never secure a deployment.

Before the final Phase C reproducible build:

1. Generate the real bootstrap administrator in an approved external wallet or HSM workflow.
2. Insert only its public key bytes into `BOOTSTRAP_ADMIN` in `programs/fairx_vault_v4/src/lib.rs`.
3. Never copy its seed, secret key, or keypair JSON into this repository or test environment.
4. Rebuild twice from clean checkouts and update `v4-build-manifest.json` only if both SBF hashes match.
5. Obtain explicit deployment approval for that public key, the final program ID, binary hash, and transaction budget.

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

The script refuses a dirty tree, checks that no V4 keypair exists, regenerates the IDL, builds SBF
behind a directory sentinel that prevents keypair creation, verifies all expected hashes, runs both
signed LiteSVM lifecycles, typechecks, and performs the production web build.

LiteSVM signature verification covers deterministic local test signers and transaction signatures.
It does not prove devnet loader behavior, cluster feature parity, compute pricing, RPC availability,
or the final live TxLINE program/root state.
