#!/usr/bin/env bash
# scripts/ci/verify-rpc-registration.sh
#
# Issue #1393 — defensive CI check that the two RPC-registration branches
# of backend/src/index.ts stay in sync.
#
# Background (see docs/ci/issue-1393-reproduction.md):
#   - The `if (config.rateLimit.enabled)` block (lines 254-540) registers a
#     *subset* of the project's RPCs via `registerRpcWithRateLimit`, each
#     pinned to a `'armored_archer/<id>'` literal.
#   - The `else` block (lines 542-617) registers the *full* set via
#     `registerRpc<Xyz>(initializer)` helpers, each defined in
#     backend/src/modules/*.ts and registering one literal.
#   - When a wrapper is added to the rate-limit-enabled branch without a
#     matching `registerRpc<Xyz>` helper in the else branch (the
#     `get_currency` drift from #1387), the bundle's eval-time publish
#     loop silently swallows the registration error and leaves pool
#     runtimes with stubs. This script catches that drift *before* the
#     bundle is built.
#
# Strategy: treat the rate-limit-enabled set as the reference. For each
# `'armored_archer/<id>'` literal in that branch, verify the else branch
# has a `registerRpc<Xyz>` helper whose definition registers the SAME
# literal. The else branch may have additional registrations (RPCs that
# don't need per-tenant rate limiting) — that's fine.
#
# Exit code: 0 on success (subset holds), 1 on drift.

# --- strict mode ---
set -euo pipefail

# --- locate the repo root (script lives at <root>/scripts/ci/) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

INDEX_TS="${REPO_ROOT}/backend/src/index.ts"
MODULES_DIR="${REPO_ROOT}/backend/src/modules"

if [[ ! -f "${INDEX_TS}" ]]; then
  echo "ERROR: ${INDEX_TS} not found — script must run from repo root" >&2
  exit 1
fi
if [[ ! -d "${MODULES_DIR}" ]]; then
  echo "ERROR: ${MODULES_DIR} not found — backend modules missing" >&2
  exit 1
fi

# --- line ranges (kept in sync with docs/ci/issue-1393-reproduction.md) ---
#
# The unconditional registration area (258-271) runs before either branch
# and registers RPCs from helper modules like `registerAnalyticsEndpoints`.
# The if-branch (273-541) is layered on top of those unconditional
# registrations when `config.rateLimit.enabled` is true — adding rate-
# limited overrides for selected RPCs. The else-branch (542-617) simply
# invokes each module's `registerRpc<Xyz>(initializer)` helper to register
# every RPC directly.
#
# This means an RPC can be "always registered" (via the unconditional
# area) even when the else-branch does NOT call a helper for it. The
# check below treats the union of unconditional + else-branch as the
# "available set" and verifies the if-branch's overrides are a subset.
UNCOND_START=258
UNCOND_END=271
RL_IF_START=273
# RL_IF_END is computed dynamically below: it's the line of the second `} else {` block
# (the start of the rate-limit-disabled branch). The unconditional helpers live
# in lines 258-271, the rate-limit-enabled branch runs from line 273 up to (but
# not including) the first `} else {`, and the rate-limit-disabled branch starts
# at the second `} else {` and runs to end-of-file.
ELSE_END=$(wc -l < "${INDEX_TS}" 2>/dev/null || echo 1)
ELSE_START=$(awk '/^\s*}\s*else\s*\{\s*$/ { print NR; exit }' "${INDEX_TS}" | tail -n 1)
# Fallback if we somehow miss it: end of the file's first else-block region.
: "${ELSE_START:=542}"
RL_IF_END=$((ELSE_START - 1))

# Helper: print 'armored_archer/<id>' literals from a single helper's
# function body. Many helpers register exactly one literal; some (like
# `registerAnalyticsEndpoints`) register several — we emit all of them.
#
# Two separator styles exist in the codebase:
#   'armored_archer/<id>'   — slash (most modules)
#   'armored_archer_<id>'   — underscore (notifications_rpc.ts etc.)
# Both are emitted as the literal form they appear in. The if-branch
# grep below uses the same regex so they can be compared apples-to-apples.
extract_helper_literals() {
  local helper="$1"
  local def_file="$2"

  # Find lines of the form  'armored_archer[/<id>]'  inside the helper body.
  awk -v fn="${helper}" '
    BEGIN { in_fn = 0 }
    {
      if (in_fn == 0) {
        if (index($0, "export function " fn "(") > 0) { in_fn = 1 }
        next
      }
      while (match($0, /'\''armored_archer[_\/][A-Za-z0-9_]+'\''/)) {
        s = substr($0, RSTART + 1, RLENGTH - 2)   # strip surrounding quotes
        print s
        $0 = substr($0, RSTART + RLENGTH)
      }
      # End of helper body — bail (do not emit anything past the closing
      # brace, since another helper might begin on the next line).
      if (in_fn == 1 && /^\}/) { in_fn = 2 }
    }
  ' "${def_file}"
}

# Helper: extract *sub-helper* calls from a helper body (lines like
#   registerRpcFoo(initializer);
# inside the body of `register<Endpoints>(...)`). Used to traverse
# composition helpers that delegate to per-RPC helpers.
extract_sub_helpers() {
  local helper="$1"
  local def_file="$2"

  awk -v fn="${helper}" '
    BEGIN { in_fn = 0 }
    {
      if (in_fn == 0) {
        if (index($0, "export function " fn "(") > 0) { in_fn = 1 }
        next
      }
      if (in_fn == 1) {
        # match `<ident>(initializer)` and emit the ident
        s = $0
        while (match(s, /[A-Za-z_][A-Za-z0-9_]*\(initializer\)/)) {
          ident = substr(s, RSTART, RLENGTH)
          sub(/\(initializer\)/, "", ident)
          print ident
          s = substr(s, RSTART + RLENGTH)
        }
      }
      if (in_fn == 1 && /^\}/) { in_fn = 2 }
    }
  ' "${def_file}"
}

# --- extract unconditional helper names (lines 258-271) ---
uncond_helpers="$(sed -n "${UNCOND_START},${UNCOND_END}p" "${INDEX_TS}" \
  | grep -oE 'register[A-Za-z]+\(' \
  | sed 's/($//' \
  | sort -u)"

# --- extract else-branch helper names (lines 542-617) ---
else_branch_helpers="$(sed -n "${ELSE_START},${ELSE_END}p" "${INDEX_TS}" \
  | grep -oE 'registerRpc[A-Za-z]+\(' \
  | sed 's/($//' \
  | sort -u)"

# --- resolve unconditional + else-branch helpers to their registered literals ---
helper_to_literal="$(mktemp)"
trap 'rm -f "${helper_to_literal}"' EXIT

available_set=""
seen_helpers="$(mktemp)"
trap 'rm -f "${helper_to_literal}" "${seen_helpers}"' EXIT

emit_helper_recursive() {
  local source_label="$1"
  local helper="$2"

  # Cycle / repeat guard
  if grep -qxF "${helper}" "${seen_helpers}" 2>/dev/null; then
    return 0
  fi
  echo "${helper}" >> "${seen_helpers}"

  local def_file
  def_file="$(grep -rln --include='*.ts' "export function ${helper}\b" "${MODULES_DIR}" 2>/dev/null | head -n 1 || true)"
  if [[ -z "${def_file}" ]]; then
    echo "ERROR: helper '${helper}' (${source_label}) has no export in ${MODULES_DIR}" >&2
    echo "  This is a real bug — file a new issue and re-run after fixing." >&2
    exit 1
  fi

  # Try direct literals first.
  local literals
  literals="$(extract_helper_literals "${helper}" "${def_file}")"

  if [[ -n "${literals}" ]]; then
    while IFS= read -r literal; do
      [[ -z "${literal}" ]] && continue
      echo "${source_label} ${helper} -> ${literal}" >> "${helper_to_literal}"
      available_set+="${literal}"$'\n'
    done <<< "${literals}"
    return 0
  fi

  # No direct literals — composition helper. Look for sub-calls to other
  # helpers in the body and recurse. Bail with an error if no sub-helpers
  # either.
  local sub_helpers
  sub_helpers="$(extract_sub_helpers "${helper}" "${def_file}")"

  if [[ -z "${sub_helpers}" ]]; then
    echo "ERROR: helper '${helper}' in ${def_file} does not register any 'armored_archer/...' literal" >&2
    echo "  and does not delegate to other helpers — unrecognised pattern." >&2
    exit 1
  fi

  while IFS= read -r sub; do
    [[ -z "${sub}" ]] && continue
    emit_helper_recursive "${source_label}" "${sub}"
  done <<< "${sub_helpers}"
}

while IFS= read -r helper; do
  [[ -z "${helper}" ]] && continue
  emit_helper_recursive "unconditional" "${helper}"
done <<< "${uncond_helpers}"

while IFS= read -r helper; do
  [[ -z "${helper}" ]] && continue
  emit_helper_recursive "else-branch"   "${helper}"
done <<< "${else_branch_helpers}"

available_set="$(echo "${available_set}" | sort -u | sed '/^$/d')"

# --- extract if-branch literals (lines 273-541) ---
# `registerRpcWithRateLimit(initializer, 'armored_archer[/_<id>]', ...)` is
# the canonical shape; the second positional argument is the literal.
if_branch_set="$(sed -n "${RL_IF_START},${RL_IF_END}p" "${INDEX_TS}" \
  | grep -oE "'armored_archer[/_][A-Za-z0-9_]+'" \
  | sed "s/^'//; s/'$//" \
  | sort -u)"

# --- compare ---
# Compute if-branch \ available-set (drift).
drift="$(comm -23 <(echo "${if_branch_set}") <(echo "${available_set}") || true)"

if [[ -n "${drift}" ]]; then
  echo "ERROR: RPC registration drift detected between rate-limit-enabled and unconditional/else branches." >&2
  echo "" >&2
  echo "The following 'armored_archer/<id>' literals are registered by the" >&2
  echo "rate-limit-enabled branch but are NOT available from any other path" >&2
  echo "(unconditional helper call OR else-branch registerRpc<Xyz>(initializer))." >&2
  echo "When RATE_LIMIT_ENABLED=true the registration works (the if-branch" >&2
  echo "publishes it directly), but the else-branch path never publishes" >&2
  echo "this RPC — a true silent failure unless rate-limit is enabled." >&2
  echo "" >&2
  while IFS= read -r literal; do
    [[ -z "${literal}" ]] && continue
    # Find which if-branch call site owns this literal (for context).
    site="$(grep -n "'${literal}'" "${INDEX_TS}" 2>/dev/null \
      | awk -F: -v lo="${RL_IF_START}" -v hi="${RL_IF_END}" \
          '($1+0 >= lo) && ($1+0 <= hi) { print; exit }' \
      || true)"
    echo "  - ${literal}    (if-branch site: ${site:-unknown})" >&2
  done <<< "${drift}"
  echo "" >&2
  echo "Fix: add the matching registerRpc<Xyz>(initializer) call to the else" >&2
  echo "branch (so the RPC is registered even when RATE_LIMIT_ENABLED=false)." >&2
  echo "(Helper-to-literal mapping used for this check is below.)" >&2
  echo "" >&2
  cat "${helper_to_literal}" >&2
  exit 1
fi

# --- success summary ---
if_count="$(echo "${if_branch_set}" | grep -c . || true)"
avail_count="$(echo "${available_set}" | grep -c . || true)"
echo "OK: rate-limit-enabled RPCs (${if_count}) are all available from the unconditional + else-branch paths."
echo "    Available RPCs (unconditional + else-branch union): ${avail_count}."