#!/usr/bin/env bash
# pre-commit-check-handoff-files.sh — reject cross-repo work-handoff files (issue #1186).
#
# Wired as the git `pre-commit` hook via .githooks/pre-commit and installed by
# `make hooks-install`. Runs against the staged (cached) tree; takes no args.
#
# Rationale: a `.continue-here.md` pause-work handoff written for a DIFFERENT
# repository (tomyud1/godot-mcp) sat tracked at this repo's root for ~4 months
# because nothing flagged it at commit time. .gitignore now carries the deny
# patterns (see the "Agent/human work-handoff files" block), but ignore rules
# don't stop `git add -f` or files staged by tooling that bypasses gitignore —
# this hook is the commit-time backstop. CI re-checks the landed state via
# `make tracked-ignored-check` (any tracked file matching an ignore rule fails).
#
# Deny-list (mirrors the .gitignore block — keep the two in sync):
#   .continue-*          path component starts with ".continue-"
#   *.continue-here*     basename contains ".continue-here"
#   *-handoff.md         basename ends with "-handoff.md"
#   pause-work*          path component starts with "pause-work"
#   wip-*.md             basename like "wip-anything.md"
#
# Only newly ADDED paths are rejected (--diff-filter=A), matching the check
# suggested in issue #1186. Already-tracked files that suddenly match an ignore
# rule are the CI gate's job, not this hook's.
#
# Exit codes:
#   0  pass (no staged handoff files)
#   1  fail (staged handoff file(s) found — unstage them and re-commit)
#
# Manual test cases (run from repo root with a dirty index):
#   touch .continue-here.md && git add -f .continue-here.md
#   ./scripts/pre-commit-check-handoff-files.sh              # FAIL (violation listed)
#   git restore --staged .continue-here.md && rm .continue-here.md
#   ./scripts/pre-commit-check-handoff-files.sh              # PASS
#
#   touch docs/real-note.md && git add docs/real-note.md
#   ./scripts/pre-commit-check-handoff-files.sh              # PASS (no match)

set -euo pipefail

SCRIPT_NAME="pre-commit-check-handoff-files"
DOCS_REF="AGENTS.md (AI Agent-Assisted Development) and .gitignore (handoff deny-list)"

# Single ERE covering every deny pattern, applied to full repo-relative paths.
# `(^|/)` anchors per-component rules so a matching substring inside an
# unrelated directory name cannot satisfy them; `\.continue-` is deliberately
# unanchored because gitignore's `*.continue-here*` matches mid-basename too
# (e.g. "notes.continue-here.md").
DENY_PATTERN='\.continue-|(^|/)pause-work|(^|/)[^/]*-handoff\.md$|(^|/)wip-[^/]*\.md$'

# Collect newly staged (added) paths. -z keeps odd filenames intact.
STAGED_ADDED=()
while IFS= read -r -d '' path; do
  STAGED_ADDED+=("${path}")
done < <(git diff --cached --name-only --diff-filter=A -z)

VIOLATIONS=()
for path in "${STAGED_ADDED[@]+"${STAGED_ADDED[@]}"}"; do
  if printf '%s\n' "${path}" | grep -Eq "${DENY_PATTERN}"; then
    VIOLATIONS+=("${path}")
  fi
done

if (( ${#VIOLATIONS[@]} > 0 )); then
  cat >&2 <<EOF
${SCRIPT_NAME}: staged file(s) look like cross-repo work-handoff residue.

  Offending path(s):
$(for v in "${VIOLATIONS[@]}"; do printf '    - %s\n' "${v}"; done)

Handoff notes (pause-work state, ".continue-here" pointers, wip summaries)
belong OUTSIDE this repository — most such files are written for a different
repo or a single session and must not be committed here (see ${DOCS_REF}).

Remediation:

    git restore --staged <file>   # unstage
    rm <file>                     # or move it to the repo/session it belongs to

If you are certain a matching file IS legitimate project content, update the
deny-list in BOTH .gitignore and this script in the same commit. Bypassing
with --no-verify only defers the failure — CI's tracked-ignored check
(\`make tracked-ignored-check\`, issue #1032) will still reject the PR.
EOF
  exit 1
fi

exit 0
