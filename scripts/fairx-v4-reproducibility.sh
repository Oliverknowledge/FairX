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
expected_program_id="2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p"
expected_bootstrap_admin="ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq"
[[ "$(jq -r '.programId' "$manifest")" == "$expected_program_id" ]]
[[ "$(jq -r '.bootstrapAdmin' "$manifest")" == "$expected_bootstrap_admin" ]]
rg -Fq "declare_id!(\"$expected_program_id\")" programs/fairx_vault_v4/src/lib.rs
[[ "$(rg -F "fairx_vault_v4 = \"$expected_program_id\"" Anchor.toml | wc -l | tr -d ' ')" == "2" ]]
rg -Fq "export const V4_PROGRAM_ID = \"$expected_program_id\"" lib/v4/program.ts
rg -Fq "export const V4_BOOTSTRAP_ADMIN = \"$expected_bootstrap_admin\"" lib/v4/program.ts
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
mkdir -p target/idl target/types target/deploy
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
types_hash="$(shasum -a 256 target/types/fairx_vault_v4.ts | awk '{print $1}')"
sbf_hash="$(shasum -a 256 target/deploy/fairx_vault_v4.so | awk '{print $1}')"

[[ "$(jq -r '.address' target/idl/fairx_vault_v4.json)" == "$expected_program_id" ]]
[[ "$source_hash" == "$(jq -r '.sourceSha256' "$manifest")" ]]
[[ "$idl_hash" == "$(jq -r '.idlSha256' "$manifest")" ]]
[[ "$types_hash" == "$(jq -r '.typesSha256' "$manifest")" ]]
[[ "$sbf_hash" == "$(jq -r '.sbfSha256' "$manifest")" ]]
[[ "$(stat -f '%z' target/deploy/fairx_vault_v4.so)" == "$(jq -r '.sbfSizeBytes' "$manifest")" ]]

NO_DNA=1 npm run typecheck
NO_DNA=1 npm run v4:test-lifecycle
NO_DNA=1 npm run v4:test-void
NO_DNA=1 npm run build

echo "V4 source=$source_hash idl=$idl_hash sbf=$sbf_hash"
