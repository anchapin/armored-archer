#!/usr/bin/env bash
# Regression cases for symbol anchors and legacy citation boundaries.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/docs/runbooks" "$ROOT/backend/src/modules"
printf 'export function knownSymbol() {}\n' > "$ROOT/backend/src/modules/example.ts"
check() {
  local citation="$1" expected="$2" output status=0
  printf '%s\n' "$citation" > "$ROOT/docs/runbooks/Example.md"
  output="$(bash "$SCRIPT_DIR/audit-runbook-citations.sh" "$ROOT")" || status=$?
  if [[ "$status" != "$expected" ]]; then
    printf 'Unexpected status %s for %s\n%s\n' "$status" "$citation" "$output"
    exit 1
  fi
}
check 'example.ts#knownSymbol' 0
check 'example.ts:99999#knownSymbol' 0
check 'example.ts#unknownSymbol' 1
check 'example.ts:99999#unknownSymbol' 1
check 'missing.ts#knownSymbol' 1
check 'example.ts:1' 0
check 'example.ts:99999' 1
printf 'PASS: 7 runbook citation regression cases\n'
