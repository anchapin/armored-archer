#!/usr/bin/env bash
# Offline PvE demo runner (issue #1765).
#
# One command that: imports assets headlessly (fresh-checkout safe, the #991
# pattern), plays the offline PvE core loop (no login, no server: the build
# ships NetworkConsts.MVP_PVE_ONLY = true), prints one structured summary and
# exits with a meaningful status.
#
# The gameplay itself is NOT re-implemented here: the run reuses the existing
# headless stage harness test/smoke/smoke_stage.gd (the same harness the
# scripts/smoke_stage.sh wrapper drives) and the same import command used by
# scripts/local-godot-tests.sh and the visual-regression workflow:
#
#   godot --headless --quit --import
#
# Usage:
#   ./scripts/run-offline-demo.sh [--timeout SECONDS] [--min-alive SECONDS]
#                                  [--godot PATH] [--keep-log] [--help]
#
# Exit codes:
#   0  the offline run completed successfully (no script/parse errors, no
#      scene-load failure, no early player death)
#   1  the run failed: script/parse errors, scene-load failure, missing
#      completion marker, or the player died inside the first --min-alive
#      seconds of combat (the #1464 failure modes)
#   2  usage error (unknown flag / bad value)
#   3  environment error: no usable Godot binary, or the headless asset
#      import step failed

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARNESS_SCENE="res://test/smoke/smoke_stage.gd"
STAGE_ID="1_1"

TIMEOUT_SECONDS="${OFFLINE_DEMO_TIMEOUT:-60}"   # bounded in-game play time
MIN_ALIVE_SECONDS="${OFFLINE_DEMO_MIN_ALIVE:-10}" # early-death window
GODOT_BIN="${GODOT_BINARY:-}"
KEEP_LOG=false
LOG_FILE=""
SAVE_DIR=""
WORK_DIR=""
GODOT_PID=""
RUN_TIMED_OUT=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[offline-demo]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[offline-demo]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[offline-demo]${NC} $1"; }
log_error() { echo -e "${RED}[offline-demo]${NC} $1" >&2; }

usage() {
    cat <<EOF
Offline PvE demo runner (Armored Archer, issue #1765)

Runs the PvE core loop completely offline and prints a structured report.
No login and no backend/server call is required: the build ships
NetworkConsts.MVP_PVE_ONLY = true (autoloads/const.gd), so the run stays local.

What it does:
  1. Imports assets headlessly when needed (fresh checkouts have no .godot/
     cache):  godot --headless --quit --import        (#991 pattern)
  2. Plays the offline PvE stage harness (test/smoke/smoke_stage.gd) with an
     isolated, throw-away save directory, so your own campaign/tutorial save
     is never touched.
  3. Prints one summary: play time, enemies spawned/killed, wave and boss
     state, and any script/parse errors found in the Godot output.
  4. Always quits Godot (completion, failure or timeout) and starts no
     backend service, so nothing is left running afterwards.

Usage:
  $0 [OPTIONS]

Options:
  --timeout SECONDS   Bounded in-game play time of the demo (default: ${TIMEOUT_SECONDS}).
                      The run stops when the bound is reached or the stage is won.
  --min-alive SECONDS Early-death window. If the player dies within the first
                      SECONDS of combat the run is a failure (default: ${MIN_ALIVE_SECONDS}).
  --godot PATH        Godot 4.6+ binary to use. Overrides \$GODOT_BINARY.
  --keep-log          Keep the Godot log file and print its path.
  --help, -h          Show this help.

Environment:
  GODOT_BINARY        Godot binary used when --godot is not given.
  OFFLINE_DEMO_TIMEOUT / OFFLINE_DEMO_MIN_ALIVE
                      Defaults for --timeout / --min-alive.
  OFFLINE_DEMO_WALL_TIMEOUT
                      Wall-clock safety net in seconds (default: 4x --timeout
                      + 90). When it is reached Godot is terminated and the
                      run is reported as a failure.

Exit codes:
  0  run completed successfully (no script/parse errors, scene loaded, no early death)
  1  run failed: script/parse error, scene-load failure, missing completion marker,
     or player death inside the first --min-alive seconds of combat (#1464)
  2  usage error (unknown flag or invalid value)
  3  environment error (no usable Godot binary, or the headless import failed)

Examples:
  $0                    # 60s offline demo with the default summary
  $0 --timeout 120      # longer offline run
  $0 --godot /opt/godot # use a specific Godot binary
EOF
}

# --- cleanup ---------------------------------------------------------------

cleanup() {
    # Never leave a Godot process behind (completion, failure or timeout).
    if [ -n "$GODOT_PID" ] && kill -0 "$GODOT_PID" 2>/dev/null; then
        kill -TERM "$GODOT_PID" 2>/dev/null
        sleep 1
        kill -KILL "$GODOT_PID" 2>/dev/null
    fi
    if [ -n "$SAVE_DIR" ] && [ -d "$SAVE_DIR" ]; then
        rm -rf "$SAVE_DIR"
    fi
    if [ -n "$WORK_DIR" ] && [ -d "$WORK_DIR" ]; then
        if [ "$KEEP_LOG" = true ]; then
            log_info "Log kept at: $LOG_FILE"
        else
            rm -rf "$WORK_DIR"
        fi
    fi
}
trap cleanup EXIT INT TERM

# --- argument parsing ------------------------------------------------------

while [ $# -gt 0 ]; do
    case "$1" in
        --timeout)
            [ $# -ge 2 ] || { log_error "--timeout needs a value"; exit 2; }
            TIMEOUT_SECONDS="$2"; shift 2 ;;
        --timeout=*)
            TIMEOUT_SECONDS="${1#*=}"; shift ;;
        --min-alive)
            [ $# -ge 2 ] || { log_error "--min-alive needs a value"; exit 2; }
            MIN_ALIVE_SECONDS="$2"; shift 2 ;;
        --min-alive=*)
            MIN_ALIVE_SECONDS="${1#*=}"; shift ;;
        --godot)
            [ $# -ge 2 ] || { log_error "--godot needs a value"; exit 2; }
            GODOT_BIN="$2"; shift 2 ;;
        --godot=*)
            GODOT_BIN="${1#*=}"; shift ;;
        --keep-log)
            KEEP_LOG=true; shift ;;
        --help|-h)
            usage; exit 0 ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 2 ;;
    esac
done

case "$TIMEOUT_SECONDS" in
    ''|*[!0-9]*) log_error "--timeout must be a positive number of seconds"; exit 2 ;;
esac
case "$MIN_ALIVE_SECONDS" in
    ''|*[!0-9]*) log_error "--min-alive must be a positive number of seconds"; exit 2 ;;
esac
if [ "$TIMEOUT_SECONDS" -le 0 ]; then
    log_error "--timeout must be greater than 0"; exit 2
fi

# --- godot binary ----------------------------------------------------------

resolve_godot() {
    if [ -n "$GODOT_BIN" ]; then
        if [ -x "$GODOT_BIN" ] || command -v "$GODOT_BIN" >/dev/null 2>&1; then
            return 0
        fi
        log_error "Godot binary '$GODOT_BIN' is not executable"
        return 1
    fi
    local candidate
    for candidate in godot4 godot "$PROJECT_ROOT/.bin/godot4"; do
        if command -v "$candidate" >/dev/null 2>&1 || [ -x "$candidate" ]; then
            GODOT_BIN="$candidate"
            return 0
        fi
    done
    log_error "No Godot binary found."
    log_error "  Install Godot 4.6+ and put it on PATH, or set GODOT_BINARY=/path/to/godot4,"
    log_error "  or pass --godot /path/to/godot4 (CI downloads 4.6-stable, see .github/workflows/test.yml)."
    log_error "  A local download in .bin/godot4 is also picked up automatically."
    return 1
}

if ! resolve_godot; then
    exit 3
fi
GODOT_VERSION="$("$GODOT_BIN" --version 2>/dev/null | tail -1)"

WORK_DIR="$(mktemp -d "$PROJECT_ROOT/.offline-demo.XXXXXX")" || {
    log_error "Cannot create a temporary work directory"; exit 3; }
LOG_FILE="$WORK_DIR/godot-play.log"
IMPORT_LOG="$WORK_DIR/godot-import.log"
SAVE_DIR="$WORK_DIR/save"
mkdir -p "$SAVE_DIR"

cd "$PROJECT_ROOT" || { log_error "Cannot enter project root"; exit 3; }

log_info "Godot: $GODOT_BIN ($GODOT_VERSION)"
log_info "Project: $PROJECT_ROOT"
log_info "Mode: offline (MVP_PVE_ONLY=true) — no login, no backend, no server calls"

# --- summary helpers -------------------------------------------------------

PLAY_SECONDS="unknown"
WON="unknown"
DIED_AT="unknown"
MAX_ENEMIES="unknown"
STAGE="$STAGE_ID"
KILLS=0
WAVE="unknown"
MAX_WAVES="unknown"
ENEMIES_ACTIVE="unknown"
BOSS_STATE="unknown"
SCRIPT_ERRORS=0
GODOT_RC=0
waited=0
FAIL_REASON=""

print_summary() {
    echo
    echo "================ OFFLINE DEMO SUMMARY ================"
    echo "result              : $([ -z "$FAIL_REASON" ] && echo PASS || echo FAIL)"
    echo "stage               : $STAGE"
    echo "mode                : offline (MVP_PVE_ONLY=true, no login/server)"
    echo "play_time_seconds   : ${PLAY_SECONDS:-unknown}"
    echo "wall_time_seconds   : $waited"
    echo "victory             : ${WON:-unknown}"
    echo "player_died_at      : ${DIED_AT:-unknown} (early-death window: ${MIN_ALIVE_SECONDS}s)"
    echo "wave                : ${WAVE} of ${MAX_WAVES}"
    echo "enemies_spawned_peak: ${MAX_ENEMIES:-unknown} (max concurrent)"
    echo "enemies_killed      : $KILLS"
    echo "enemies_active_end  : $ENEMIES_ACTIVE"
    echo "boss                : $BOSS_STATE"
    echo "script_parse_errors : $SCRIPT_ERRORS"
    echo "godot_exit_code     : $GODOT_RC"
    if [ -n "$FAIL_REASON" ]; then
        echo "failure_reason      : $FAIL_REASON"
    fi
    echo "backend_services    : none started"
    echo "====================================================="
}

# --- step 1: headless asset import (fresh-checkout safe, #991 pattern) ------

log_info "Step 1/2: importing assets headlessly (godot --headless --quit --import)"
IMPORT_TIMEOUT="${OFFLINE_DEMO_IMPORT_TIMEOUT:-600}"
timeout "$IMPORT_TIMEOUT" "$GODOT_BIN" --headless --quit --import >"$IMPORT_LOG" 2>&1
IMPORT_RC=$?
IMPORT_ERRORS="$(grep -Ec 'SCRIPT ERROR|Parse Error|Failed to load script' "$IMPORT_LOG" 2>/dev/null || true)"
IMPORT_ERRORS="${IMPORT_ERRORS:-0}"
if [ "$IMPORT_ERRORS" -gt 0 ]; then
    log_error "Asset import reported script/parse errors:"
    grep -E 'SCRIPT ERROR|Parse Error|Failed to load script' "$IMPORT_LOG" | head -20 >&2
    SCRIPT_ERRORS="$IMPORT_ERRORS"
    FAIL_REASON="script/parse errors during the headless asset import step"
    print_summary
    exit 1
fi
if [ "$IMPORT_RC" -ne 0 ]; then
    log_error "Asset import failed (exit ${IMPORT_RC}) — see $IMPORT_LOG"
    tail -20 "$IMPORT_LOG" >&2
    exit 3
fi
log_ok "Assets imported (no script/parse errors)"

# --- step 2: offline PvE run ------------------------------------------------

log_info "Step 2/2: playing the offline PvE demo (stage ${STAGE_ID}, ${TIMEOUT_SECONDS}s bound, isolated saves)"
export XDG_DATA_HOME="$SAVE_DIR"

# Wall-clock safety net: the harness runs with --fixed-fps 60, so game time
# advances much faster than real time (same budget as scripts/smoke_stage.sh).
WALL_TIMEOUT="${OFFLINE_DEMO_WALL_TIMEOUT:-$((TIMEOUT_SECONDS * 4 + 90))}"

"$GODOT_BIN" --headless --fixed-fps 60 -s "$HARNESS_SCENE" -- \
    "--seconds=$TIMEOUT_SECONDS" "--min-alive=$MIN_ALIVE_SECONDS" >"$LOG_FILE" 2>&1 &
GODOT_PID=$!

waited=0
while kill -0 "$GODOT_PID" 2>/dev/null; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge "$WALL_TIMEOUT" ]; then
        RUN_TIMED_OUT=true
        log_warn "Wall-clock budget (${WALL_TIMEOUT}s) reached — terminating Godot"
        kill -TERM "$GODOT_PID" 2>/dev/null
        sleep 2
        kill -KILL "$GODOT_PID" 2>/dev/null
        break
    fi
done
wait "$GODOT_PID"
GODOT_RC=$?
GODOT_PID=""
unset XDG_DATA_HOME

# --- summary ---------------------------------------------------------------

SCRIPT_ERRORS="$(grep -Ec 'SCRIPT ERROR|Parse Error|Failed to load script|^ERROR:' "$LOG_FILE" 2>/dev/null || true)"
SCRIPT_ERRORS="${SCRIPT_ERRORS:-0}"
RESULT_LINE="$(grep -E '^SMOKE RESULT:' "$LOG_FILE" | tail -1)"
STATE_LINE="$(grep -E '^SMOKE STATE:' "$LOG_FILE" | tail -1)"

# Extract "key=value" from a space-separated key=value line.
field() { echo "$1" | tr ' ' '\n' | grep "^$2=" | head -1 | cut -d= -f2-; }

PLAY_SECONDS="$(field "$RESULT_LINE" 'combat')"
WON="$(field "$RESULT_LINE" 'won')"
DIED_AT="$(field "$RESULT_LINE" 'died_at')"
MAX_ENEMIES="$(field "$RESULT_LINE" 'max_enemies')"
STAGE="$(field "$RESULT_LINE" 'stage')"
[ -n "$STAGE" ] || STAGE="$STAGE_ID"

# Enemy deaths are logged by EnemySpawner._on_enemy_exiting(), which prints the
# remaining enemy list ("  [0] <name>") once per kill.
KILLS="$(grep -cE '^  \[0\] ' "$LOG_FILE" 2>/dev/null || true)"
KILLS="${KILLS:-0}"

WAVE="unknown"; MAX_WAVES="unknown"; ENEMIES_ACTIVE="unknown"
if [ -n "$STATE_LINE" ]; then
    WAVE="$(echo "$STATE_LINE" | sed -n 's/.*"wave":\([0-9]*\).*/\1/p')"
    MAX_WAVES="$(echo "$STATE_LINE" | sed -n 's/.*"max_waves":\([0-9]*\).*/\1/p')"
    ENEMIES_ACTIVE="$(echo "$STATE_LINE" | sed -n 's/.*"enemies":\[\([^]]*\)\].*/\1/p' | tr ',' '\n' | grep -c 'position')"
fi
[ -n "$WAVE" ] || WAVE="unknown"
[ -n "$MAX_WAVES" ] || MAX_WAVES="unknown"
[ -n "$ENEMIES_ACTIVE" ] || ENEMIES_ACTIVE="unknown"

# Boss state for the played stage comes from the campaign data.
BOSS_STATE="unknown"
CAMPAIGN_WAVES=""
if [ -f "$PROJECT_ROOT/data/campaigns.json" ]; then
    STAGE_INFO="$(python3 - "$PROJECT_ROOT/data/campaigns.json" "$STAGE" <<'PY' 2>/dev/null
import json, sys
path, stage = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path))
except Exception:
    sys.exit(0)
for campaign in data.get("campaigns", []):
    for s in campaign.get("stages", []):
        if s.get("id") == stage:
            print("%s|%s" % (s.get("boss") or "", s.get("waves") or ""))
            sys.exit(0)
PY
)"
    BOSS_ID_RAW="${STAGE_INFO%%|*}"
    CAMPAIGN_WAVES="${STAGE_INFO##*|}"
    if [ -z "$BOSS_ID_RAW" ]; then
        BOSS_STATE="not_applicable (stage ${STAGE} has no boss)"
    else
        if [ "$WON" = "true" ]; then
            BOSS_STATE="reached (boss ${BOSS_ID_RAW} defeated)"
        else
            BOSS_STATE="not_reached (boss ${BOSS_ID_RAW} pending)"
        fi
    fi
fi
[ "$MAX_WAVES" = "unknown" ] && [ -n "$CAMPAIGN_WAVES" ] && MAX_WAVES="$CAMPAIGN_WAVES"

# The harness reports its own failure reason (scene-load failure, early death,
# missing configuration, ...).
HARNESS_FAIL="$(grep -E '^SMOKE FAIL:' "$LOG_FILE" | tail -1)"
[ -n "$HARNESS_FAIL" ] || HARNESS_FAIL="$(grep -E '^SMOKE FAIL' "$LOG_FILE" | tail -1)"

FAIL_REASON=""
if [ "$RUN_TIMED_OUT" = true ]; then
    FAIL_REASON="the run exceeded its ${WALL_TIMEOUT}s wall-clock budget and was terminated"
elif [ "$SCRIPT_ERRORS" -gt 0 ]; then
    FAIL_REASON="script/parse errors were reported by Godot"
elif [ -n "$HARNESS_FAIL" ]; then
    FAIL_REASON="${HARNESS_FAIL#SMOKE FAIL: }"
elif [ "$GODOT_RC" -ne 0 ]; then
    FAIL_REASON="Godot exited with code ${GODOT_RC}"
elif ! grep -q '^SMOKE PASS$' "$LOG_FILE"; then
    FAIL_REASON="the harness did not report a successful completion (missing 'SMOKE PASS' marker)"
elif printf '%s' "$DIED_AT" | grep -Eq '^[0-9]+(\.[0-9]+)?$'; then
    if awk "BEGIN{exit !($DIED_AT < $MIN_ALIVE_SECONDS)}" 2>/dev/null; then
        FAIL_REASON="the player died ${DIED_AT}s into combat (before the ${MIN_ALIVE_SECONDS}s early-death window)"
    fi
fi

print_summary

if [ -n "$FAIL_REASON" ]; then
    log_error "Offline demo FAILED: $FAIL_REASON"
    if [ "$SCRIPT_ERRORS" -gt 0 ]; then
        echo "--- Godot error lines ---" >&2
        grep -E 'SCRIPT ERROR|Parse Error|Failed to load script|^ERROR:' "$LOG_FILE" | head -20 >&2
    fi
    echo "--- last 30 log lines ---" >&2
    tail -30 "$LOG_FILE" >&2
    exit 1
fi

log_ok "Offline demo completed successfully"
exit 0
