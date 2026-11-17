#!/usr/bin/env bash
# Visual-change evidence capture wrapper (issue #1860).
#
# Builds the standard screenshot evidence artefact for visual-change PRs on
# top of the proven #1766/#1779 xvfb gameplay screenshot loop:
#
#   * runs the offline PvE demo (scripts/gameplay_screenshot_spike.gd, the
#     #1779 spike) under `xvfb-run` so the frames are REAL rendered pixels
#     (a headless run uses Godot's dummy renderer, which cannot read the
#     viewport texture - scripts/screenshot_capture.gd substitutes a 1x1
#     placeholder there),
#   * validates every captured frame independently (scripts/
#     validate_capture_frames.py): size read from the PNG header and the
#     number of distinct colours in the decoded pixels. A frame that is
#     1x1, uniform or unreadable is a PLACEHOLDER and makes this wrapper
#     fail loudly - placeholder frames are never written as evidence,
#   * writes the structured evidence note (command, Godot version, per-frame
#     size/distinct-colour checks, what was observed, what was NOT
#     assessed) next to the frames.
#
# Report-only: this wrapper is NOT a CI gate and adds no required check.
#
# Usage:
#   ./scripts/capture-visual-evidence.sh --slug 1860 [--stage 1_3]
#       [--title "..."] [--observed "..."] [--not-assessed "..."]
#       [--evidence-root production/qa/evidence] [--godot PATH]
#       [--timeout SECONDS] [--help]
#
# Exit codes:
#   0  frames captured, validated as real pixels, and the evidence note
#      written
#   1  capture failed or a frame was a placeholder (1x1 / uniform /
#      unreadable) - nothing is committed as evidence
#   2  usage error
#   3  environment error (no Godot binary, no xvfb-run, import failed)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE_SCRIPT="res://scripts/gameplay_screenshot_spike.gd"
VALIDATOR="${PROJECT_ROOT}/scripts/validate_capture_frames.py"

SLUG=""
TITLE=""
STAGE="1_3"
EVIDENCE_ROOT="${PROJECT_ROOT}/production/qa/evidence"
GODOT_BIN="${GODOT_BINARY:-}"
TIMEOUT_SECONDS=60
WALL_TIMEOUT_SECONDS=180
OBSERVED=()
NOT_ASSESSED=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[evidence]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[evidence]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[evidence]${NC} $1"; }
log_error() { echo -e "${RED}[evidence]${NC} $1" >&2; }

usage() {
    cat <<EOF
Visual-change evidence capture (Armored Archer, issue #1860)

Captures real gameplay frames under xvfb (the proven #1766/#1779 loop),
validates that every frame contains real pixels, and writes the structured
evidence note to production/qa/evidence/<slug>/.

Usage:
  $0 --slug SLUG [OPTIONS]

Options:
  --slug SLUG          Issue or PR id used as the evidence folder name
                       (e.g. --slug 1860 -> production/qa/evidence/1860/).
  --title TEXT         Title of the evidence note.
  --stage STAGE_ID     Campaign stage to play (default: ${STAGE}).
  --observed TEXT      One "what was observed" line (repeatable).
  --not-assessed TEXT  One "what was NOT assessed" line (repeatable).
                       Defaults to the untested Windows path.
  --evidence-root DIR  Evidence root (default: production/qa/evidence).
  --godot PATH         Godot 4.6+ binary to use. Overrides \$GODOT_BINARY.
  --timeout SECONDS    In-game timeout of the demo (default: ${TIMEOUT_SECONDS}).
  --help, -h           Show this help.

Exit codes:
  0  evidence written (all frames validated as real pixels)
  1  capture failed or a placeholder frame was detected - no evidence written
  2  usage error
  3  environment error (no Godot binary, no xvfb-run, import failed)

Notes:
  * xvfb/Linux only. The Windows / real-rendering-host path is NOT assessed
    here (same limitation as the #1766 spike report).
  * Nothing here is a CI gate: no workflow file is touched and no baseline
    or pixel-diff comparison is performed.
EOF
}

# --- argument parsing ------------------------------------------------------

while [ $# -gt 0 ]; do
    case "$1" in
        --slug)
            [ $# -ge 2 ] || { log_error "--slug needs a value"; exit 2; }
            SLUG="$2"; shift 2 ;;
        --slug=*)
            SLUG="${1#*=}"; shift ;;
        --title)
            [ $# -ge 2 ] || { log_error "--title needs a value"; exit 2; }
            TITLE="$2"; shift 2 ;;
        --title=*)
            TITLE="${1#*=}"; shift ;;
        --stage)
            [ $# -ge 2 ] || { log_error "--stage needs a value"; exit 2; }
            STAGE="$2"; shift 2 ;;
        --stage=*)
            STAGE="${1#*=}"; shift ;;
        --observed)
            [ $# -ge 2 ] || { log_error "--observed needs a value"; exit 2; }
            OBSERVED+=("$2"); shift 2 ;;
        --observed=*)
            OBSERVED+=("${1#*=}"); shift ;;
        --not-assessed)
            [ $# -ge 2 ] || { log_error "--not-assessed needs a value"; exit 2; }
            NOT_ASSESSED+=("$2"); shift 2 ;;
        --not-assessed=*)
            NOT_ASSESSED+=("${1#*=}"); shift ;;
        --evidence-root)
            [ $# -ge 2 ] || { log_error "--evidence-root needs a value"; exit 2; }
            EVIDENCE_ROOT="$2"; shift 2 ;;
        --evidence-root=*)
            EVIDENCE_ROOT="${1#*=}"; shift ;;
        --godot)
            [ $# -ge 2 ] || { log_error "--godot needs a value"; exit 2; }
            GODOT_BIN="$2"; shift 2 ;;
        --godot=*)
            GODOT_BIN="${1#*=}"; shift ;;
        --timeout)
            [ $# -ge 2 ] || { log_error "--timeout needs a value"; exit 2; }
            TIMEOUT_SECONDS="$2"; shift 2 ;;
        --timeout=*)
            TIMEOUT_SECONDS="${1#*=}"; shift ;;
        --help|-h)
            usage; exit 0 ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 2 ;;
    esac
done

if [ -z "$SLUG" ]; then
    log_error "--slug is required (the issue or PR id used as folder name)"
    usage
    exit 2
fi
case "$SLUG" in
    */*|.|..) log_error "--slug must be a single path segment"; exit 2 ;;
esac
case "$TIMEOUT_SECONDS" in
    ''|*[!0-9]*) log_error "--timeout must be a positive number of seconds"; exit 2 ;;
esac
if [ "$TIMEOUT_SECONDS" -le 0 ]; then
    log_error "--timeout must be greater than 0"
    exit 2
fi
if [ ${#OBSERVED[@]} -eq 0 ]; then
    OBSERVED=("Frames captured by the #1766/#1779 gameplay screenshot spike (see the table above for the per-frame pixel checks).")
fi
if [ ${#NOT_ASSESSED[@]} -eq 0 ]; then
    NOT_ASSESSED=("Windows / real-rendering-host path: NOT assessed - the #1766 spike never attempted it (no such host is reachable from this environment) and this wrapper was not run there.")
fi

# --- environment -----------------------------------------------------------

resolve_godot() {
    if [ -n "$GODOT_BIN" ]; then
        if [ -x "$GODOT_BIN" ] || command -v "$GODOT_BIN" >/dev/null 2>&1; then
            return 0
        fi
        log_error "Godot binary '$GODOT_BIN' is not executable"
        return 1
    fi
    local candidate
    for candidate in godot4 godot "${PROJECT_ROOT}/.bin/godot4"; do
        if command -v "$candidate" >/dev/null 2>&1 || [ -x "$candidate" ]; then
            GODOT_BIN="$candidate"
            return 0
        fi
    done
    log_error "No Godot binary found."
    log_error "  Install Godot 4.6+ and put it on PATH, or set GODOT_BINARY=/path/to/godot4,"
    log_error "  or pass --godot /path/to/godot4 (scripts/ci/download-godot.sh fetches 4.6-stable)."
    return 1
}

if ! resolve_godot; then
    exit 3
fi
if ! command -v xvfb-run >/dev/null 2>&1; then
    log_error "xvfb-run not found - the capture path needs a real GL context (Linux only)."
    log_error "  A headless run would produce Godot's dummy renderer and a 1x1 placeholder."
    exit 3
fi
if ! command -v python3 >/dev/null 2>&1; then
    log_error "python3 not found - needed to validate the captured frames."
    exit 3
fi

GODOT_VERSION="$("$GODOT_BIN" --version 2>/dev/null | tail -1)"
if ! python3 - "$GODOT_VERSION" <<'PYVERSION'
import re, sys
match = re.match(r"^(\d+)\.(\d+)(?:\.|$)", sys.argv[1])
sys.exit(0 if match and tuple(map(int, match.groups())) >= (4, 6) else 1)
PYVERSION
then
    log_error "Godot 4.6+ required; found: ${GODOT_VERSION}"
    exit 3
fi

# Fresh worktrees have no .godot/ import cache (#991); import once, headless.
if [ ! -f "${PROJECT_ROOT}/.godot/global_script_class_cache.cfg" ]; then
    log_info "Fresh checkout detected - running godot import (one-time)..."
    if ! (cd "$PROJECT_ROOT" && timeout 300 "$GODOT_BIN" --headless --quit --import) >/tmp/evidence-import.log 2>&1; then
        log_error "Godot import failed (see /tmp/evidence-import.log)"
        exit 3
    fi
fi

# --- capture ---------------------------------------------------------------

STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/visual-evidence.XXXXXX")"
FRAMES_DIR="${STAGE_DIR}/frames"
LOG_FILE="${STAGE_DIR}/run.log"
mkdir -p "$FRAMES_DIR"

RUN_ARGS=(timeout "$WALL_TIMEOUT_SECONDS" xvfb-run -a "$GODOT_BIN" --path .
    -s "$SPIKE_SCRIPT" -- --out-dir="$FRAMES_DIR" --stage="$STAGE" --timeout="$TIMEOUT_SECONDS")
printf -v RUN_COMMAND '%q ' "${RUN_ARGS[@]}"

cleanup_stage() {
    rm -rf "$STAGE_DIR"
}
trap cleanup_stage EXIT INT TERM

log_info "Godot: ${GODOT_VERSION}"
log_info "Running: ${RUN_COMMAND}"
GODOT_EXIT=0
(cd "$PROJECT_ROOT" && "${RUN_ARGS[@]}") >"$LOG_FILE" 2>&1 || GODOT_EXIT=$?

if [ "$GODOT_EXIT" -ne 0 ]; then
    FAILED_LOG="/tmp/visual-evidence-failed-${SLUG}.log"
    cp "$LOG_FILE" "$FAILED_LOG" 2>/dev/null || true
    log_error "The capture run failed (exit ${GODOT_EXIT}). Log: ${FAILED_LOG}"
    tail -20 "$LOG_FILE" >&2 || true
    exit 1
fi

SUMMARY_LINE="$(grep -m1 '^SPIKE_SUMMARY ' "$LOG_FILE" || true)"
if [ -z "$SUMMARY_LINE" ]; then
    FAILED_LOG="/tmp/visual-evidence-failed-${SLUG}.log"
    cp "$LOG_FILE" "$FAILED_LOG" 2>/dev/null || true
    log_error "The capture run produced no SPIKE_SUMMARY line. Log: ${FAILED_LOG}"
    exit 1
fi

# The spike script always quits with 0; the authoritative result is the
# SPIKE_SUMMARY line (FAIL when a capture failed or a frame was a
# placeholder), so check it explicitly instead of trusting the exit code.
SUMMARY_JSON="${SUMMARY_LINE#SPIKE_SUMMARY }"
SPIKE_RESULT="$(printf '%s' "$SUMMARY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result", ""))' 2>/dev/null || echo "UNREADABLE")"
if [ "$SPIKE_RESULT" != "PASS" ]; then
    FAILED_LOG="/tmp/visual-evidence-failed-${SLUG}.log"
    cp "$LOG_FILE" "$FAILED_LOG" 2>/dev/null || true
    log_error "The capture run did not PASS (SPIKE_SUMMARY result: ${SPIKE_RESULT}). Log: ${FAILED_LOG}"
    exit 1
fi

# --- validation ------------------------------------------------------------

VALIDATION_JSON="${STAGE_DIR}/validation.json"
if ! python3 "$VALIDATOR" --dir "$FRAMES_DIR" --json >"$VALIDATION_JSON"; then
    FAILED_LOG="/tmp/visual-evidence-failed-${SLUG}.log"
    cp "$LOG_FILE" "$FAILED_LOG" 2>/dev/null || true
    log_error "PLACEHOLDER FRAME DETECTED - refusing to write evidence."
    python3 "$VALIDATOR" --dir "$FRAMES_DIR" || true
    log_error "Log: ${FAILED_LOG}"
    exit 1
fi

# Publish only a complete, validated run. Existing evidence is never overwritten.
PUBLISH_ARGS=(--frames "$FRAMES_DIR" --validation "$VALIDATION_JSON" --log "$LOG_FILE"
    --root "$EVIDENCE_ROOT" --slug "$SLUG" --version "$GODOT_VERSION" --command "$RUN_COMMAND"
    --stage "$STAGE" --title "$TITLE" --summary "$SUMMARY_JSON")
for line in "${OBSERVED[@]}"; do PUBLISH_ARGS+=(--observed "$line"); done
for line in "${NOT_ASSESSED[@]}"; do PUBLISH_ARGS+=(--not-assessed "$line"); done
if ! python3 "$PROJECT_ROOT/scripts/publish_capture_evidence.py" "${PUBLISH_ARGS[@]}"; then
    log_error "Evidence output failed; previous evidence was not replaced."
    exit 1
fi
log_ok "Evidence written: ${EVIDENCE_ROOT}/${SLUG}/note.md (5 complete validated frames)"
