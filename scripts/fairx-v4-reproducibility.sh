#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ "${ALLOW_DIRTY:-0}" != "1" ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "V4 reproducibility requires a clean tracked checkout" >&2
  exit 1
fi

[[ "$(anchor --version)" == "anchor-cli 1.1.2" ]]
[[ "$(solana --version | awk '{print $1, $2}')" == "solana-cli 3.1.10" ]]
[[ "$(rustc --version | awk '{print $1, $2}')" == "rustc 1.89.0" ]]

if find . -type f -name 'fairx_vault_v4-keypair.json' -not -path './.git/*' -print -quit | grep -q .; then
  echo "A forbidden V4 program keypair is present" >&2
  exit 1
fi

manifest="fixtures/txline/v4-build-manifest.json"
txline_manifest="fixtures/txline/v4-pinned-artifacts.json"
txline_so="$(jq -r '.txlineProgram.path' "$txline_manifest")"
[[ -f "$txline_so" ]] || {
  echo "Missing pinned TxLINE executable. Follow docs/v4-phase-b1-reproducibility.md." >&2
  exit 1
}
[[ "$(shasum -a 256 "$txline_so" | awk '{print $1}')" == "$(jq -r '.txlineProgram.sha256' "$txline_manifest")" ]]
[[ "$(shasum -a 256 fixtures/txline/daily-odds-root-account.json | awk '{print $1}')" == "$(jq -r '.oddsRoot.fileSha256' "$txline_manifest")" ]]
[[ "$(shasum -a 256 fixtures/txline/daily-scores-root-account.json | awk '{print $1}')" == "$(jq -r '.scoresRoot.fileSha256' "$txline_manifest")" ]]

NO_DNA=1 cargo fmt --all -- --check
NO_DNA=1 cargo test --offline -p fairx-vault-v4
NO_DNA=1 anchor idl build -p fairx_vault_v4 -o target/idl/fairx_vault_v4.json -t target/types/fairx_vault_v4.ts -- --offline

# cargo-build-sbf normally creates a program keypair as a post-processing side effect. A directory
# sentinel at the keypair path makes that side effect impossible while still allowing the SBF copy.
safe_out="$(mktemp -d)"
trap 'rm -rf "$safe_out"' EXIT
mkdir "$safe_out/fairx_vault_v4-keypair.json"
NO_DNA=1 cargo build-sbf --offline --skip-tools-install \
  --manifest-path programs/fairx_vault_v4/Cargo.toml \
  --sbf-out-dir "$safe_out"
cp "$safe_out/fairx_vault_v4.so" target/deploy/fairx_vault_v4.so
[[ -d "$safe_out/fairx_vault_v4-keypair.json" ]]

source_hash="$({
  shasum -a 256 \
    programs/fairx_vault_v4/Cargo.toml \
    programs/fairx_vault_v4/src/lib.rs \
    Cargo.toml Cargo.lock Anchor.toml rust-toolchain.toml
} | shasum -a 256 | awk '{print $1}')"
idl_hash="$(shasum -a 256 target/idl/fairx_vault_v4.json | awk '{print $1}')"
sbf_hash="$(shasum -a 256 target/deploy/fairx_vault_v4.so | awk '{print $1}')"

[[ "$source_hash" == "$(jq -r '.sourceSha256' "$manifest")" ]]
[[ "$idl_hash" == "$(jq -r '.idlSha256' "$manifest")" ]]
[[ "$sbf_hash" == "$(jq -r '.sbfSha256' "$manifest")" ]]
[[ "$(stat -f '%z' target/deploy/fairx_vault_v4.so)" == "$(jq -r '.sbfSizeBytes' "$manifest")" ]]

NO_DNA=1 npm run typecheck
NO_DNA=1 npm run v4:test-lifecycle
NO_DNA=1 npm run v4:test-void
NO_DNA=1 npm run build

echo "V4 source=$source_hash idl=$idl_hash sbf=$sbf_hash"
