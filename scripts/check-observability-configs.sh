#!/usr/bin/env bash
# Observability Config Consolidation Guard (issue #1112)
#
# The alerting/prometheus configs used to live in two divergent copies:
#   backend/prometheus.yml      vs backend/config/prometheus.yml
#   backend/alerts.yml          vs backend/config/alert_rules.yml
#   backend/alertmanager.yml    vs backend/config/alertmanager.yml
# docker-compose mounts only the root copies, so the backend/config/ set was
# dead config that claimed to be authoritative and drifted (different alert
# sets, Alertmanager-incompatible env substitution) — the confusion class
# behind the phantom-metric alerts. The dead copies were deleted; this guard
# keeps them from coming back.
#
# Fails (exit 1) when any of these hold:
#   1. A deleted duplicate reappears under backend/config/ (prometheus.yml,
#      alert_rules.yml, alertmanager.yml).
#   2. Any backend/config/*.yml is NOT mounted by backend/docker-compose.yml
#      (dead config accumulating again — loki/promtail/tempo are the only
#      legitimate residents and all three are mounted).
#   3. A yml volume mount declared in backend/docker-compose.yml does not
#      resolve to a file on disk (dangling mount).
#
# Usage:
#   bash scripts/check-observability-configs.sh          # audit this repo
#   bash scripts/check-observability-configs.sh <root>   # audit another checkout
#   bash scripts/check-observability-configs.sh --help
#
# CI target: make obs-config-check (wired in .github/workflows/ci.yml).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

REPO_ROOT="${1:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$REPO_ROOT"

COMPOSE="backend/docker-compose.yml"
fails=0

# --- 1. Deleted duplicates must not reappear -------------------------------
FORBIDDEN=(
  "backend/config/prometheus.yml"
  "backend/config/alert_rules.yml"
  "backend/config/alertmanager.yml"
)
for f in "${FORBIDDEN[@]}"; do
  if [ -e "$f" ]; then
    echo "FAIL: duplicate observability config reappeared: $f" >&2
    echo "      (canonical file lives at backend/$(basename "$f" | sed 's/^alert_rules$/alerts/'))" >&2
    fails=$((fails + 1))
  fi
done

# --- 2. Every backend/config/*.yml must be mounted by compose --------------
if [ ! -f "$COMPOSE" ]; then
  echo "FAIL: $COMPOSE not found" >&2
  exit 1
fi
for f in backend/config/*.yml; do
  [ -e "$f" ] || continue
  rel="${f#backend/}"
  if ! grep -qF "$rel" "$COMPOSE"; then
    echo "FAIL: $f is not mounted by $COMPOSE (dead config — mount it or delete it)" >&2
    fails=$((fails + 1))
  fi
done

# --- 3. Every ./...yml compose mount must resolve ---------------------------
while IFS= read -r rel; do
  if [ ! -f "backend/$rel" ]; then
    echo "FAIL: compose mount ./$rel does not resolve to backend/$rel" >&2
    fails=$((fails + 1))
  fi
done < <(grep -oE '\./[A-Za-z0-9_./-]+\.yml' "$COMPOSE" | sed 's|^\./||' | sort -u)

if [ "$fails" -gt 0 ]; then
  echo "BROKEN OBS CONFIG: $fails" >&2
  exit 1
fi

echo "observability configs consolidated: 0 duplicates, all backend/config/*.yml mounted, all compose yml mounts resolve"
