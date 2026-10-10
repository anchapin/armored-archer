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
mkdir -p "$ROOT/docs/adr"
printf '| [0001](./0001-example.md) | Example |\n' > "$ROOT/docs/adr/README.md"
assert_status() {
  local expected="$1" label="$2" status=0 output
  output="$(bash "$SCRIPT_DIR/audit-runbook-citations.sh" "$ROOT")" || status=$?
  if [[ "$status" != "$expected" ]]; then
    printf 'Unexpected status %s for %s\n%s\n' "$status" "$label" "$output"
    exit 1
  fi
}
printf 'example.ts#knownSymbol\n' > "$ROOT/docs/runbooks/Example.md"
printf 'example.ts#knownSymbol\n' > "$ROOT/docs/adr/0001-example.md"
assert_status 0 'indexed ADR known symbol'
printf 'example.ts#unknownSymbol\n' > "$ROOT/docs/adr/0001-example.md"
assert_status 1 'wrong ADR function name'
printf 'example.ts#knownSymbol\n' > "$ROOT/docs/adr/0001-example.md"
printf '# Index\n' > "$ROOT/docs/adr/README.md"
assert_status 1 'ADR missing index row'
printf '| [0001](./0001-example.md) | Example |\n| [0002](./0002-missing.md) | Missing |\n' > "$ROOT/docs/adr/README.md"
assert_status 1 'index row missing ADR file'
printf '| [0001](./0001-example.md) | Example |\n' > "$ROOT/docs/adr/README.md"
printf '[source](../../backend/src/modules/example.ts)\n' > "$ROOT/docs/adr/0001-example.md"
assert_status 0 'valid relative ADR link'
printf '[source](../../backend/src/modules/missing.ts)\n' > "$ROOT/docs/adr/0001-example.md"
assert_status 1 'missing relative ADR link'
printf '[source](../../backend/src/modules/example.ts)\n' > "$ROOT/docs/adr/0001-example.md"
printf '[missing](./Missing.md)\n' > "$ROOT/docs/runbooks/Example.md"
assert_status 1 'missing relative runbook link'
printf 'example.ts:1#knownSymbol\n' > "$ROOT/docs/runbooks/Example.md"
printf 'export function renamedSymbol() {}\n' > "$ROOT/backend/src/modules/example.ts"
assert_status 1 'symbol removed from source'
printf 'export function knownSymbol() {}\n' > "$ROOT/backend/src/modules/example.ts"
assert_status 0 'symbol restored to source'
printf 'PASS: 16 runbook/ADR citation, index and link regression cases\n'
