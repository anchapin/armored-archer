#!/usr/bin/env bash
# Headless stage smoke test (#1464). Boots the stage scene, plays it, and fails on
# script/parse errors or an early player death.
#   GODOT=/path/to/godot scripts/smoke_stage.sh [seconds] [min_alive_seconds]
set -uo pipefail
GODOT="${GODOT:-godot}"
SECONDS_TO_PLAY="${1:-60}"
MIN_ALIVE="${2:-10}"
LOG="$(mktemp)"
cd "$(dirname "$0")/.."
"$GODOT" --headless --import >/dev/null 2>&1 || true
timeout $((SECONDS_TO_PLAY * 4 + 60)) "$GODOT" --headless --fixed-fps 60 -s res://test/smoke/smoke_stage.gd -- \
  --seconds="$SECONDS_TO_PLAY" --min-alive="$MIN_ALIVE" >"$LOG" 2>&1
rc=$?
grep -E "SMOKE" "$LOG"
errors="$(grep -E "SCRIPT ERROR|Parse Error|Failed to load script" "$LOG" | sort | uniq -c)"
if [ -n "$errors" ]; then
  echo "SMOKE FAIL: script or parse errors during play:"; echo "$errors"; rc=1
fi
[ $rc -eq 0 ] || { echo "---- last 40 log lines ----"; tail -40 "$LOG"; }
rm -f "$LOG"
exit $rc
