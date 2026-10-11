#!/usr/bin/env bash
# Configured campaign stage smoke with isolated saves and strict runtime errors.
set -uo pipefail
GODOT="${GODOT:-godot}"
SECONDS_TO_PLAY="${1:-60}"
MIN_ALIVE="${2:-10}"
LOG="$(mktemp)"
SAVE_DIR="$(mktemp -d)"
trap 'rm -f "$LOG"; rm -rf "$SAVE_DIR"' EXIT
export XDG_DATA_HOME="$SAVE_DIR"
cd "$(dirname "$0")/.."
if ! timeout 300 "$GODOT" --headless --quit --import >"$LOG" 2>&1; then
  echo 'SMOKE FAIL: asset import failed'
  tail -40 "$LOG"
  exit 1
fi
if grep -Eq 'SCRIPT ERROR|Parse Error|Failed to load script' "$LOG"; then
  echo 'SMOKE FAIL: import script errors'
  tail -40 "$LOG"
  exit 1
fi
timeout $((SECONDS_TO_PLAY * 4 + 90)) "$GODOT" --headless --fixed-fps 60 -s res://test/smoke/smoke_stage.gd -- \
  --seconds="$SECONDS_TO_PLAY" --min-alive="$MIN_ALIVE" >"$LOG" 2>&1
rc=$?
grep -E 'SMOKE' "$LOG"
errors="$(grep -E 'SCRIPT ERROR|Parse Error|^ERROR:|Failed to load script' "$LOG" | sort | uniq -c)"
if [ -n "$errors" ]; then
  echo 'SMOKE FAIL: runtime errors during play:'; echo "$errors"; rc=1
fi
if ! grep -q '^SMOKE PASS$' "$LOG"; then
  echo 'SMOKE FAIL: missing completion marker'; rc=1
fi
[ "$rc" -eq 0 ] || { echo '---- last 40 log lines ----'; tail -40 "$LOG"; }
exit "$rc"
