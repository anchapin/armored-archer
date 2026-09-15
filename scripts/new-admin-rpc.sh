#!/usr/bin/env bash
#
# new-admin-rpc.sh — scaffold a new admin-guarded RPC (issue #1145).
#
# Adding a privileged RPC is a 3-file walk (ADR-0006):
#   1. wrap the handler in withAdminGuard at its registration site in the
#      owning module,
#   2. add the allowlist test fixture (the resetAdminAllowlistCache dance),
#   3. append an RPC_MAP.md row.
# Doing this by hand is error-prone; forgetting step 1 used to merge green
# until the check-admin-guard-coverage gate landed (same issue). This
# script performs all three steps and wires index.ts.
#
# Usage:
#   scripts/new-admin-rpc.sh <module> <rpc_id>
#
#   <module>  module name under backend/src/modules/ (existing or new),
#             snake_case — e.g. season_admin or my_ops_tools
#   <rpc_id>  full RPC id — e.g. armored_archer/admin_probe_dx
#             (the armored_archer/ prefix is added when omitted)
#
# The RPC id must be classified as privileged by
# backend/scripts/check-admin-guard-coverage.ts (--is-privileged); the
# classifier is the single source of truth for privilege, so this script
# refuses to scaffold player-callable RPCs.
#
# Afterwards: implement the TODO handler, then
#   cd backend && npm run lint:fix && npm run typecheck && npm test -- <module>
#   cd backend && npm run check:admin-coverage
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
MODULES="$BACKEND/src/modules"

usage() {
  sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
}

[ $# -eq 2 ] || usage
MODULE="$1"
RPC_ID="$2"

# --- Helpers (dialect-proof file inserts) -----------------------------------

insert_after() { # <file> <line> <text>
  head -n "$2" "$1" > "$1.new" && printf '%s\n' "$3" >> "$1.new" \
    && tail -n +"$(( $2 + 1 ))" "$1" >> "$1.new" && mv "$1.new" "$1"
}

insert_before() { # <file> <line> <text>
  head -n "$(( $2 - 1 ))" "$1" > "$1.new" && printf '%s\n' "$3" >> "$1.new" \
    && tail -n +"$2" "$1" >> "$1.new" && mv "$1.new" "$1"
}

# --- Validate inputs -------------------------------------------------------

if ! [[ "$MODULE" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "ERROR: module name '$MODULE' must be snake_case (^[a-z][a-z0-9_]*$)" >&2
  exit 1
fi
if ! [[ "$RPC_ID" =~ ^(armored_archer/)?[a-z][a-z0-9_]*$ ]]; then
  echo "ERROR: rpc id '$RPC_ID' must look like armored_archer/admin_foo" >&2
  exit 1
fi
[[ "$RPC_ID" == */* ]] || RPC_ID="armored_archer/$RPC_ID"
BARE_ID="${RPC_ID#armored_archer/}"

# Single source of truth for privilege: the coverage checker.
if ! (cd "$BACKEND" && npx ts-node --transpile-only scripts/check-admin-guard-coverage.ts \
      --is-privileged "$RPC_ID" >/dev/null 2>&1); then
  echo "ERROR: $RPC_ID is not classified as privileged by" >&2
  echo "       backend/scripts/check-admin-guard-coverage.ts." >&2
  echo "       If it is genuinely admin-only, add the id/prefix there first;" >&2
  echo "       otherwise this scaffolder is the wrong tool (player RPCs must" >&2
  echo "       NOT be wrapped in withAdminGuard — ADR-0006)." >&2
  exit 1
fi

MODULE_FILE="$MODULES/$MODULE.ts"
TEST_FILE="$MODULES/__tests__/$MODULE.test.ts"
if rg -q "'$RPC_ID'" "$MODULES" 2>/dev/null; then
  echo "ERROR: '$RPC_ID' is already referenced under $MODULES — refusing to scaffold a duplicate." >&2
  exit 1
fi

# --- Derive names ----------------------------------------------------------

# admin_probe_dx -> AdminProbeDx
PASCAL="$(printf '%s' "$BARE_ID" | awk -F_ '{out=""; for (i=1; i<=NF; i++) out=out toupper(substr($i,1,1)) substr($i,2); print out}')"
HANDLER="rpc${PASCAL}"
REGFN="registerRpc${PASCAL}"
TITLE="$(printf '%s' "$PASCAL" | sed 's/\([A-Z]\)/ \1/g' | sed 's/^ //')"

# --- Step 1a: module file (create or append handler + guarded registration)

if [ ! -f "$MODULE_FILE" ]; then
  echo "==> Creating $MODULE_FILE"
  cat > "$MODULE_FILE" <<EOF
/**
 * ${MODULE} module — TODO: describe the feature.
 *
 * Scaffolded by scripts/new-admin-rpc.sh (issue #1145). Every privileged
 * RPC registered here must stay wrapped in withAdminGuard at its
 * registration site (ADR-0006) — enforced by \`npm run check:admin-coverage\`.
 */

import { Runtime } from '../types/nakama';
import { withAdminGuard } from './admin_auth';

/**
 * TODO(${BARE_ID}): implement the handler.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param _payload - JSON request payload (unused in the stub)
 * @returns JSON response string
 */
export function ${HANDLER}(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  _payload: string
): string {
  logger.info('${BARE_ID} called by %s', ctx.userId);
  return JSON.stringify({ success: true, message: 'TODO: implement ${BARE_ID}' });
}

/**
 * Registers the ${BARE_ID} RPC endpoint behind the shared admin gate.
 *
 * @param initializer - Nakama runtime initializer
 */
export function ${REGFN}(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    '${RPC_ID}',
    withAdminGuard('${RPC_ID}', ${HANDLER})
  );
}
EOF
else
  echo "==> Appending ${REGFN} to $MODULE_FILE"
  if ! rg -q "withAdminGuard" "$MODULE_FILE"; then
    # Best-effort: keep import/order (alphabetize) happy by inserting the
    # './admin_auth' import before the first same-dir import line.
    INS_LINE="$(rg -n "^import .*'\./" "$MODULE_FILE" | head -1 | cut -d: -f1 || true)"
    if [ -n "$INS_LINE" ]; then
      insert_before "$MODULE_FILE" "$INS_LINE" "import { withAdminGuard } from './admin_auth';"
    else
      printf '\nimport { withAdminGuard } from \x27./admin_auth\x27;\n' >> "$MODULE_FILE"
    fi
  fi
  cat >> "$MODULE_FILE" <<EOF

/**
 * TODO(${BARE_ID}): implement the handler.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param _payload - JSON request payload (unused in the stub)
 * @returns JSON response string
 */
export function ${HANDLER}(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  _payload: string
): string {
  logger.info('${BARE_ID} called by %s', ctx.userId);
  return JSON.stringify({ success: true, message: 'TODO: implement ${BARE_ID}' });
}

/**
 * Registers the ${BARE_ID} RPC endpoint behind the shared admin gate.
 *
 * @param initializer - Nakama runtime initializer
 */
export function ${REGFN}(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    '${RPC_ID}',
    withAdminGuard('${RPC_ID}', ${HANDLER})
  );
}
EOF
fi

# --- Step 1b: wire index.ts --------------------------------------------------

INDEX="$BACKEND/src/index.ts"
if ! rg -q "$REGFN" "$INDEX"; then
  echo "==> Wiring $REGFN into $INDEX"
  if rg -q "from './modules/${MODULE}';" "$INDEX"; then
    # Extend the existing multi-line import block: insert after its 'import {' line.
    CLOSE_LINE="$(rg -n "} from './modules/${MODULE}';" "$INDEX" | head -1 | cut -d: -f1)"
    OPEN_LINE="$(awk -v c="$CLOSE_LINE" 'NR<=c && /^import \{/ {l=NR} END{print l}' "$INDEX")"
    insert_after "$INDEX" "$OPEN_LINE" "  ${REGFN},"
  else
    # New import line, inserted in best-effort alphabetical position among
    # the './modules/...' imports (import/order is an eslint error). Handles
    # both single-line imports and multi-line `import { ... } from 'path';`
    # blocks (the path sits on the closing line; the insert goes before the
    # block's opening line).
    NEW_PATH="./modules/${MODULE}"
    INS_LINE="$(awk -v new="$NEW_PATH" '
      /^import \{/ { block_open = NR; next }
      /^import / {
        match($0, /'"'"'[^'"'"']+'"'"'/)
        if (RSTART) {
          p = substr($0, RSTART + 1, RLENGTH - 2)
          if (p ~ /^\.\// && p > new && !done) { print NR; done = 1 }
        }
        next
      }
      /^} from/ {
        match($0, /'"'"'[^'"'"']+'"'"'/)
        if (RSTART) {
          p = substr($0, RSTART + 1, RLENGTH - 2)
          if (p ~ /^\.\// && p > new && !done) { print block_open; done = 1 }
        }
      }' "$INDEX")"
    if [ -n "$INS_LINE" ]; then
      insert_before "$INDEX" "$INS_LINE" "import { ${REGFN} } from './modules/${MODULE}';"
    else
      LAST_IMPORT="$(awk '/^import / {l=NR} END{print l}' "$INDEX")"
      insert_after "$INDEX" "$LAST_IMPORT" "import { ${REGFN} } from './modules/${MODULE}';"
    fi
  fi
  # Registration call: append after the last plain registration call in the
  # registration section of InitModule (before the rate-limited wrappers).
  LAST_REG="$(rg -n '^  register[A-Za-z]+\(initializer\);' "$INDEX" | tail -1 | cut -d: -f1 || true)"
  if [ -n "$LAST_REG" ]; then
    insert_after "$INDEX" "$LAST_REG" "  ${REGFN}(initializer);"
  else
    ANCHOR="$(rg -n '^  if \(config\.rateLimit\.enabled\) \{' "$INDEX" | head -1 | cut -d: -f1)"
    insert_before "$INDEX" "$ANCHOR" "  ${REGFN}(initializer);"
  fi
fi

# --- Step 2: allowlist test fixture + unauthorized-path test -----------------

echo "==> Adding allowlist fixture + guard tests ($([ -f "$TEST_FILE" ] && echo 'appending to' || echo 'creating') ${TEST_FILE#"$ROOT"/})"
if [ ! -f "$TEST_FILE" ]; then
  cat > "$TEST_FILE" <<EOF
/**
 * Admin-guard coverage for ${MODULE} (scaffolded by scripts/new-admin-rpc.sh,
 * issue #1145). The fixture dance — save ADMIN_USER_IDS, set +
 * resetAdminAllowlistCache, restore + resetAdminAllowlistCache — is required
 * because the guard parses the env once and freezes it (#1155, ADR-0006).
 */

import { resetAdminAllowlistCache } from '../admin_auth';
import { ${REGFN} } from '../${MODULE}';

describe('${MODULE}: ${RPC_ID} (admin-guarded)', () => {
  const previousAdminIds = process.env.ADMIN_USER_IDS;
  const allowlistedCaller = '00000000-0000-4000-8000-000000000009';
  const stranger = '00000000-0000-4000-8000-00000000000f';

  function captureHandlers(): Record<string, (...args: never[]) => unknown> {
    const handlers: Record<string, (...args: never[]) => unknown> = {};
    const mockInitializer = {
      registerRpc: (id: string, handler: (...args: never[]) => unknown): void => {
        handlers[id] = handler;
      },
    };
    ${REGFN}(mockInitializer as never);
    return handlers;
  }

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = allowlistedCaller;
    resetAdminAllowlistCache();
  });

  afterEach(() => {
    if (previousAdminIds === undefined) {
      delete process.env.ADMIN_USER_IDS;
    } else {
      process.env.ADMIN_USER_IDS = previousAdminIds;
    }
    resetAdminAllowlistCache();
  });

  it('registers ${RPC_ID} behind the admin guard', () => {
    const handlers = captureHandlers();
    expect(handlers['${RPC_ID}']).toBeInstanceOf(Function);
  });

  it('rejects non-allowlisted callers with Not authorized', () => {
    const handlers = captureHandlers();
    process.env.ADMIN_USER_IDS = stranger;
    resetAdminAllowlistCache();
    const result = handlers['${RPC_ID}'](
      { userId: allowlistedCaller } as never,
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
      {} as never,
      '{}'
    ) as string;
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Not authorized');
  });

  it('lets allowlisted callers through to the handler', () => {
    const handlers = captureHandlers();
    const result = handlers['${RPC_ID}'](
      { userId: allowlistedCaller } as never,
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
      {} as never,
      '{}'
    ) as string;
    expect(JSON.parse(result).success).toBe(true);
  });
});
EOF
else
  cat >> "$TEST_FILE" <<EOF

describe('${MODULE}: ${RPC_ID} (admin-guarded, scaffolded by scripts/new-admin-rpc.sh)', () => {
  const previousAdminIds = process.env.ADMIN_USER_IDS;
  const allowlistedCaller = '00000000-0000-4000-8000-000000000009';
  const stranger = '00000000-0000-4000-8000-00000000000f';

  function captureHandlers(): Record<string, (...args: never[]) => unknown> {
    const handlers: Record<string, (...args: never[]) => unknown> = {};
    const mockInitializer = {
      registerRpc: (id: string, handler: (...args: never[]) => unknown): void => {
        handlers[id] = handler;
      },
    };
    ${REGFN}(mockInitializer as never);
    return handlers;
  }

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = allowlistedCaller;
    resetAdminAllowlistCache();
  });

  afterEach(() => {
    if (previousAdminIds === undefined) {
      delete process.env.ADMIN_USER_IDS;
    } else {
      process.env.ADMIN_USER_IDS = previousAdminIds;
    }
    resetAdminAllowlistCache();
  });

  it('registers ${RPC_ID} behind the admin guard', () => {
    const handlers = captureHandlers();
    expect(handlers['${RPC_ID}']).toBeInstanceOf(Function);
  });

  it('rejects non-allowlisted callers with Not authorized', () => {
    const handlers = captureHandlers();
    process.env.ADMIN_USER_IDS = stranger;
    resetAdminAllowlistCache();
    const result = handlers['${RPC_ID}'](
      { userId: allowlistedCaller } as never,
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
      {} as never,
      '{}'
    ) as string;
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Not authorized');
  });

  it('lets allowlisted callers through to the handler', () => {
    const handlers = captureHandlers();
    const result = handlers['${RPC_ID}'](
      { userId: allowlistedCaller } as never,
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
      {} as never,
      '{}'
    ) as string;
    expect(JSON.parse(result).success).toBe(true);
  });
});
EOF
fi

# --- Step 3: RPC_MAP.md row ---------------------------------------------------

RPC_MAP="$ROOT/RPC_MAP.md"
ROW="| ${TITLE} *(admin-only)* | Admin Dashboard (scaffolded) | \`${HANDLER}()\` in \`${MODULE}.ts\` — wrapped in \`withAdminGuard\` (ADR-0006); TODO: describe storage | TODO (scaffolded) | \`/rpc/${RPC_ID}\` |"
if rg -q "^## Infrastructure & Observability" "$RPC_MAP"; then
  echo "==> Appending RPC_MAP.md row under 'Infrastructure & Observability'"
  INSERT_AT="$(awk '
    /^## Infrastructure & Observability/ {in_sec = 1; next}
    in_sec && /^\|/ {last = NR; next}
    in_sec && last {print last; exit}
  ' "$RPC_MAP")"
  if [ -n "$INSERT_AT" ]; then
    insert_after "$RPC_MAP" "$INSERT_AT" "$ROW"
  else
    echo "    (could not locate the table — add this row manually:)"
    echo "    ${ROW}"
  fi
else
  echo "==> RPC_MAP.md: anchor section missing — add this row manually:"
  echo "    ${ROW}"
fi

# --- Done ---------------------------------------------------------------------

cat <<EOF

Scaffolded ${RPC_ID} in ${MODULE}.

Next steps:
  1. Implement TODO(${BARE_ID}) in ${MODULE_FILE#"$ROOT/"}
  2. Fill in the RPC_MAP.md row details (storage ownership, client caller)
  3. Validate:
       cd backend && npm run lint:fix && npm run typecheck
       cd backend && npm test -- ${MODULE}
       cd backend && npm run check:admin-coverage
EOF
