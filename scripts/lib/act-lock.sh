#!/bin/bash
# Shared act invocation lock (issue #992; extracted for issue #1028).
#
# Concurrent act processes share ~/.cache/act, where act git-clones action
# refs (actions/checkout, setup-node, ...). Simultaneous clones of the same
# ref corrupt the cache and fail jobs with "Non-terminating error while
# running 'git clone': some refs were not updated". Every act invocation
# (and act cache wipe) must be serialized via flock on a shared lock file.
# The per-user suffix avoids /tmp permission clashes on multi-user hosts.
#
# Source this file (do NOT execute it), then wrap act invocations and
# ~/.cache/act wipes with:
#   run_with_act_lock act -j my-job -W .github/workflows/ci.yml
#
# Used by scripts/ci-local.sh, scripts/run-ci-locally.sh, and
# scripts/act-cleanup.sh so all act entrypoints share one lock.

# Lock file path (override with ACT_LOCK_FILE).
ACT_LOCK_FILE="${ACT_LOCK_FILE:-${XDG_RUNTIME_DIR:-/tmp}/act-invocation-$(id -u).lock}"

# Warn via the caller's log_warning (ci-local.sh) when defined, else plain
# stderr, so sourcing scripts keep their own logging style.
_act_lock_warn() {
    if type log_warning >/dev/null 2>&1; then
        log_warning "$@"
    else
        echo "[WARN] $*" >&2
    fi
}

# Run a command while holding the process-wide act lock, blocking until any
# concurrent act invocation finishes. Within a single caller process act
# jobs already run sequentially, so this only contends across processes.
# Falls back to running unlocked (with a warning) on hosts without flock
# (e.g. macOS without util-linux installed).
run_with_act_lock() {
    if ! command -v flock >/dev/null 2>&1; then
        _act_lock_warn "flock not found — running without act cache lock (issue #992 race possible)"
        "$@"
        return
    fi
    if ! flock -n "${ACT_LOCK_FILE}" true 2>/dev/null; then
        _act_lock_warn "Another act invocation is running — waiting for ${ACT_LOCK_FILE} to avoid ~/.cache/act races (issue #992)"
    fi
    flock "${ACT_LOCK_FILE}" "$@"
}
