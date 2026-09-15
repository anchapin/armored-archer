#!/usr/bin/env bash
# ci-check-ai-trailers.sh — CI gate for the [AI-assisted] trailer contract
# (issue #1173, follow-up to the #1157 local hook).
#
# Walks every commit in a git range and pipes each full commit message into
# scripts/commit-msg-check-ai-trailer.sh (stdin mode) — the exact validator
# behind the local commit-msg hook and `make commit-check`. No rule logic is
# duplicated here: a commit fails this gate if and only if it would fail the
# local hook. This closes the gap where a PR author never ran
# `make hooks-install` (or committed via the GitHub web UI), so the local
# hook never fired.
#
# Usage:
#   ./scripts/ci-check-ai-trailers.sh [base-ref] [head-ref]
#
#   base-ref  Commit-ish the range starts from. Defaults to
#             origin/${GITHUB_BASE_REF} when that env var is set (GitHub
#             pull_request events), otherwise origin/main.
#   head-ref  Commit-ish the range ends at. Defaults to HEAD.
#
# Wired from .github/workflows/ai-trailer-check.yml (runs on pull_request,
# covering fork and branch PRs alike).
#
# Exit codes (mirrors the per-commit validator):
#   0  every commit in the range satisfies the trailer contract
#   1  at least one commit violates it (stderr lists each violation)
#   2  environment/usage error (not a git repo, unresolvable ref, ...)

set -euo pipefail

SCRIPT_NAME="ci-check-ai-trailers"
DOCS_REF="AGENTS.md (Commit & PR Guidelines) and docs/CONTRIBUTING_AI.md"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="${SCRIPT_DIR}/commit-msg-check-ai-trailer.sh"

if [[ ! -x "${VALIDATOR}" ]]; then
  echo "${SCRIPT_NAME}: validator not found or not executable: ${VALIDATOR}" >&2
  exit 2
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "${SCRIPT_NAME}: not inside a git repository" >&2
  exit 2
fi

# Resolve the base ref: explicit arg > GITHUB_BASE_REF (pull_request) > main.
BASE_REF="${1:-}"
if [[ -z "${BASE_REF}" && -n "${GITHUB_BASE_REF:-}" ]]; then
  BASE_REF="origin/${GITHUB_BASE_REF}"
fi
if [[ -z "${BASE_REF}" ]]; then
  BASE_REF="origin/main"
fi
HEAD_REF="${2:-HEAD}"

# rev-parse --verify fails cleanly on unknown refs (exit 2 path).
BASE_SHA="$(git rev-parse --verify --quiet "${BASE_REF}^{commit}")" || {
  echo "${SCRIPT_NAME}: cannot resolve base ref '${BASE_REF}' — fetch it first (e.g. git fetch origin main)" >&2
  exit 2
}
HEAD_SHA="$(git rev-parse --verify --quiet "${HEAD_REF}^{commit}")" || {
  echo "${SCRIPT_NAME}: cannot resolve head ref '${HEAD_REF}'" >&2
  exit 2
}

total=0
ai_assisted=0
skip_tagged=0
failures=0

# Walk oldest-first so the log reads chronologically. Each iteration pipes
# the commit's full message (%B: subject + body) into the validator, which
# owns every pass/fail rule ([AI-assisted] detection, trailer shape, and the
# [skip-ai-check] escape hatch).
while read -r sha; do
  short="$(git rev-parse --short "${sha}")"
  subject="$(git log -1 --format=%s "${sha}")"
  total=$((total + 1))

  # Informational counters mirroring the validator's own classification.
  if [[ "${subject}" =~ ^[[:space:]]*\[AI-assisted\] ]]; then
    ai_assisted=$((ai_assisted + 1))
  fi
  if [[ "${subject}" == *'[skip-ai-check]'* ]]; then
    skip_tagged=$((skip_tagged + 1))
  fi

  if ! validator_output="$(git log -1 --format=%B "${sha}" | "${VALIDATOR}" - 2>&1)"; then
    failures=$((failures + 1))
    {
      echo "${SCRIPT_NAME}: FAIL ${short} ${subject}"
      printf '%s\n' "${validator_output}"
      echo
    } >&2
  else
    echo "${SCRIPT_NAME}: ok   ${short} ${subject}"
  fi
done < <(git rev-list --reverse "${BASE_SHA}..${HEAD_SHA}")

echo
echo "${SCRIPT_NAME}: checked ${total} commit(s) in ${BASE_SHA}..${HEAD_SHA}" \
     "(${ai_assisted} [AI-assisted], ${skip_tagged} [skip-ai-check])"

if (( failures > 0 )); then
  {
    echo
    echo "${SCRIPT_NAME}: ${failures} commit(s) violate the [AI-assisted] trailer contract."
    echo "Remediation: rebase and amend the listed commit message(s) per ${DOCS_REF},"
    echo "or use the documented [skip-ai-check] escape hatch for hotfix/squash merges."
  } >&2
  exit 1
fi

exit 0
