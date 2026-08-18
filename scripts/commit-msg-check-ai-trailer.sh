#!/usr/bin/env bash
# commit-msg-check-ai-trailer.sh — enforce AGENTS.md:173 [AI-assisted] trailer convention.
#
# Wired as the git `commit-msg` hook via .githooks/commit-msg and as the
# standalone `make commit-check` target. Either invocation passes the path to
# the in-progress commit message file as $1.
#
# Rules (mirror AGENTS.md:173 and issue #1157 acceptance):
#   1. Plain commits (subject does NOT start with "[AI-assisted]") pass freely.
#   2. When the subject starts with "[AI-assisted]", the body MUST contain
#      both trailers, case-insensitive on the prefix but canonicalized to:
#        - AI Model: <model name>
#        - Task:     <task description>
#      (Each trailer line begins at column 0 with "<KEY>:"; one space after
#      the colon; value spans to end-of-line.)
#   3. Any commit whose subject contains the documented escape hatch
#      `[skip-ai-check]` (e.g. `[skip-ai-check] chore(release): ...`) is
#      allowed even if the trailers are missing. This is a maintainer
#      fallback for hotfixes and squash merges where reauthoring the body
#      is impractical. Do NOT use `[skip-ai-check]` to bypass AI commits
#      in normal flow.
#
# The hook HARD-rejects `--no-verify` attempts are NOT a path — use the
# `[skip-ai-check]` escape hatch instead. `--no-verify` only suppresses
# this hook when a developer truly cannot satisfy it (CI re-applies the
# check); see AGENTS.md:173.
#
# Exit codes:
#   0  pass (allow the commit)
#   1  fail (print remediation pointing at AGENTS.md:173 + docs/CONTRIBUTING_AI.md)
#
# Manual test cases (run from repo root):
#   msg="feat: vanilla fix";                              ./scripts/commit-msg-check-ai-trailer.sh <(echo "$msg") # PASS
#   msg="[AI-assisted] feat: thing";                      ./scripts/commit-msg-check-ai-trailer.sh <(echo "$msg") # FAIL (no trailers)
#   msg=$'[AI-assisted] feat: thing\n\n- AI Model: M\n- Task: T'; ./scripts/commit-msg-check-ai-trailer.sh <(echo "$msg") # PASS
#   msg=$'[AI-assisted] feat: thing\n\n-AI Model:M\n- Task:T';   ./scripts/commit-msg-check-ai-trailer.sh <(echo "$msg") # FAIL (no space after colon)
#   msg="[skip-ai-check] chore(release): v1.2.3";         ./scripts/commit-msg-check-ai-trailer.sh <(echo "$msg") # PASS

set -euo pipefail

MSG_FILE="${1:-}"
if [[ -z "${MSG_FILE}" ]]; then
  echo "commit-msg-check-ai-trailer: no commit message file provided (arg \$1 is empty)" >&2
  exit 1
fi
# Accept "-" as stdin shorthand, but otherwise require a readable file.
if [[ "${MSG_FILE}" != "-" ]] && [[ ! -f "${MSG_FILE}" || ! -r "${MSG_FILE}" ]]; then
  echo "commit-msg-check-ai-trailer: commit message source '${MSG_FILE}' is not a readable file (use '-' for stdin)" >&2
  exit 1
fi

SCRIPT_NAME="commit-msg-check-ai-trailer"
DOCS_REF="AGENTS.md:173 and docs/CONTRIBUTING_AI.md"

# Read the full message; tolerate CRLF by stripping carriage returns.
MSG=$(tr -d '\r' < "${MSG_FILE}")

# First non-empty line is the subject (handle leading comments / blank lines).
SUBJECT=$(printf '%s\n' "${MSG}" | awk '
  BEGIN { found = 0 }
  # Skip comment-only lines (# ...) that git puts at the top for rebase -i.
  /^#/ { next }
  # Skip pure blank lines until we find the subject.
  /^[[:space:]]*$/ { if (!found) next; exit }
  { print; found = 1; exit }
')

if [[ -z "${SUBJECT}" ]]; then
  exit 0  # Empty subject — git itself will reject; nothing for us to do.
fi

# Escape hatch: any subject whose first non-whitespace token contains the
# magic [skip-ai-check] tag passes unconditionally.
if [[ "${SUBJECT}" == *'[skip-ai-check]'* ]]; then
  exit 0
fi

# Rule 1: non-AI commits pass freely. We require [AI-assisted] to appear as the
# leading token (after optional leading whitespace) per AGENTS.md:173.
if ! [[ "${SUBJECT}" =~ ^[[:space:]]*\[AI-assisted\] ]]; then
  exit 0
fi

# Rule 2: AI-assisted commit must include both trailers in the body.
# Look only at lines after the first blank line (the "body"), and accept the
# trailers case-insensitively on the prefix but require canonical "KEY:" form
# with at least one space after the colon and a non-empty value.
BODY=$(printf '%s\n' "${MSG}" | awk '
  BEGIN { in_body = 0 }
  /^#/ { next }
  {
    if (in_body) { print; next }
    # First blank line marks the end of the subject and start of body.
    if ($0 ~ /^[[:space:]]*$/) { in_body = 1; next }
  }
')

missing=()
# Trailers may be canonical markdown style ("- AI Model: ...") or git style
# ("AI Model: ...") — both are common in this repo per AGENTS.md:173. Match
# both prefixes, then require at least one ASCII space after the colon and a
# non-empty value. The leading whitespace before "- AI Model:" is tolerated
# because some tools indent trailers inside lists. Trailer keys are matched
# case-insensitively; the canonical form per AGENTS.md:173 is "- AI Model:"
# and "- Task:".
if ! printf '%s\n' "${BODY}" | grep -iEq '^[[:space:]]*(-[[:space:]]+)?AI[[:space:]]+Model:[[:space:]]+\S'; then
  missing+=("- AI Model:")
fi
if ! printf '%s\n' "${BODY}" | grep -iEq '^[[:space:]]*(-[[:space:]]+)?Task:[[:space:]]+\S'; then
  missing+=("- Task:")
fi

if (( ${#missing[@]} > 0 )); then
  cat >&2 <<EOF
${SCRIPT_NAME}: commit subject starts with "[AI-assisted]" but required trailers are missing.

  Subject: ${SUBJECT}
  Missing: ${missing[*]}

Per ${DOCS_REF}, AI-assisted commits must include BOTH trailers in the body:

    - AI Model: <model name and version>
    - Task:     <what the commit does>

Example commit message:

    [AI-assisted] feat(api): add rate limiting to RPC entry points

    Adds a per-IP token bucket on the auth RPC; bumps the limit envelope.

    - AI Model: MiniMax-M3
    - Task: implement rate limit middleware for auth RPC

To suppress this check for an emergency hotfix or squash merge, prefix the
subject with [skip-ai-check] (e.g. "[skip-ai-check] chore(release): v1.2.3").
Do NOT use --no-verify for routine AI-assisted commits — the host-side
guard still rejects the PR (see issue #1157).
EOF
  exit 1
fi

exit 0
