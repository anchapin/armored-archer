# Contributing AI-Assisted Commits

This document describes how to write commits that contain AI-generated
changes, as required by `AGENTS.md:173` in this repository.

## Why

AI-assisted commits need to be discoverable in `git log` and `git blame` so
maintainers can:

1. Spot AI usage patterns when triaging issues.
2. Audit specific models / tasks when reproducing or debugging that work.
3. Catch any AI commit that sneaks in without a human reviewer's sign-off.

The convention is enforced locally by
[`scripts/commit-msg-check-ai-trailer.sh`](../scripts/commit-msg-check-ai-trailer.sh),
which is wired to git's `commit-msg` hook via
[`.githooks/commit-msg`](../.githooks/commit-msg). Run `make hooks-install`
once per clone to activate it (or simply run `make setup`, which now does
this automatically).

## Format

A commit subject that begins with `[AI-assisted]` MUST include both trailers
in the body:

```
[AI-assisted] <type>(<scope>): <subject>

<body describing what changed and why>

- AI Model: <model identifier + version>
- Task:     <what the commit does>
```

Trailers:

- **AI Model** — the model that produced the code, e.g. `MiniMax-M3` or
  `claude-opus-4-6`. Include a version when applicable.
- **Task** — a short description of the task assigned to the model. One
  sentence is usually enough. This mirrors the wording the developer would
  give the model when prompting it.

## Canonical Example

```
[AI-assisted] feat(api): add rate limiting to auth RPC

Adds a per-IP token bucket on the auth RPC entry point. The limit envelope
defaults to 60 requests/minute per IAP tier, configurable via nakama config.

- AI Model: MiniMax-M3
- Task: implement rate limit middleware for auth RPC
```

## Trailer Variants

The hook accepts both markdown-prefixed (`- AI Model:`) and git-style
(`AI Model:`) trailer formats. **Use the markdown form** — it is the
canonical output of both this repo's `make release-notes` and `git log
--pretty=format:` tooling. The hook matches the key case-insensitively
(e.g. `- ai model: foo` and `- TASK: bar` both pass), but the canonical
form documented here is the one reviewers will see in the generated
release notes.

## Escape Hatch — `[skip-ai-check]`

For hotfixes, squash merges, or any other case where rewriting the commit
body is impractical, prefix the subject with `[skip-ai-check]`:

```
[skip-ai-check] chore(release): v1.2.3
[skip-ai-check] fix(auth): revert bad bcrypt salt
```

The trailer check is bypassed for that commit. Do not use this for routine
AI-assisted commits — the trailers belong to the project history, not to
the contributor's workflow.

`--no-verify` is **not** a substitute. The hosted pre-receive check (when
CI is reachable) re-applies this validation; bypassing the local hook does
not bypass the gate.

## Validating Locally

```bash
# Lint a saved commit message file
make commit-check MSG=path/to/COMMIT_EDITMSG

# Or invoke the script directly
./scripts/commit-msg-check-ai-trailer.sh path/to/COMMIT_EDITMSG
```

Non-zero exit means the commit will be rejected by the hook; the script's
stderr explains exactly which trailer(s) are missing or malformed.

## References

- `AGENTS.md:173` — the canonical requirement statement.
- `scripts/commit-msg-check-ai-trailer.sh` — the hook implementation.
- `.githooks/commit-msg` — the git hook wrapper installed by
  `make hooks-install` / `make setup`.
- Issue #1157 — the original ticket that introduced this check.
