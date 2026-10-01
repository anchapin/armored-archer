#!/usr/bin/env bash
#
# check-ports.sh — fail fast when a host port the compose stack binds is
# already in use.
#
# `make backend-start` / `make services-start` previously let `docker compose
# up -d` crash with a confusing "port is already allocated" error after the
# stack had already started partially. This script is the first step of both
# targets: it probes the host ports the compose file binds, prints the
# offending PID + command for each conflict, and exits non-zero so chained
# Make targets and CI see the failure.
#
# It does NOT auto-pick free ports and does NOT prompt interactively.
#
# Scope:
#   Default — game ports only (5433 postgres, 6380 redis, 7349/7350/7351 nakama)
#   --all   — additionally checks the observability stack
#
# Exit codes:
#   0 — every requested port is free
#   1 — at least one port is already bound (printed with PID + command)
#   2 — neither `ss` nor `lsof` is available; cannot inspect ports at all
#
# Usage:
#   scripts/check-ports.sh          # game ports only
#   scripts/check-ports.sh --all    # game + observability
#
# Honors `backend/.env` if present (NAKAMA_SERVER_PORT, NAKAMA_CONSOLE_PORT,
# REDIS_PORT) and falls back to the compose-file defaults. `DB_PORT` describes
# the container port (5432) — compose maps it to host port 5433, which is what
# we check.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/backend/.env"

CHECK_ALL=0
for arg in "$@"; do
    case "$arg" in
        --all) CHECK_ALL=1 ;;
        --help|-h) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown flag: $arg" >&2; exit 2 ;;
    esac
done

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; BLUE=''; NC=''
fi
info() { echo -e "${BLUE}[check-ports]${NC} $*"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
err()  { echo -e "  ${RED}✗${NC} $*"; }

# Read a var from backend/.env (no shell-sourcing, so unset vars still fall
# back to the compose defaults via ${VAR:-default}).
env_value() {
    local v=""
    if [ -f "$ENV_FILE" ]; then
        v=$(grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)
        v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
    fi
    printf '%s' "${v:-$2}"
}

# --- Port list (host-side binds from backend/docker-compose.yml) ------------
# Format: "port:description". The descriptions are printed verbatim in the
# conflict output so operators know which compose service is impacted.
GAME_PORTS=(
    "5433:PostgreSQL (host bind; compose maps 5433:5432)"
    "6380:Redis (host bind; compose maps 6380:6379)"
    "7349:Nakama gRPC"
    "7350:Nakama API (NAKAMA_SERVER_PORT)"
    "7351:Nakama Console (NAKAMA_CONSOLE_PORT)"
)
# Opt-in via --all. Includes the otel-collector / tempo host-port remaps
# documented in backend/docker-compose.yml (issue #895).
OBS_PORTS=(
    "3000:Grafana" "9090:Prometheus" "9093:Alertmanager" "9100:node-exporter"
    "9187:postgres-exporter" "3100:Loki" "3200:Tempo HTTP" "9095:Tempo gRPC"
    "4317:Tempo OTLP HTTP (direct)" "4318:Tempo OTLP gRPC (direct)"
    "14317:otel-collector OTLP gRPC (host remap)" "14318:otel-collector OTLP HTTP (host remap)"
    "14268:otel-collector Jaeger thrift" "14250:Jaeger gRPC"
    "6831:Jaeger thrift compact" "19411:otel-collector Zipkin (host remap)"
    "8888:otel-collector self-metrics" "8889:otel-collector exporter"
    "13133:otel-collector health" "55679:otel-collector Z-pages" "9411:Tempo Zipkin"
)

# --- Tool selection ---------------------------------------------------------
# Prefer ss (always installed on Linux); fall back to lsof. Both can require
# elevated perms to surface PID + command — we handle that gracefully.
inspect_port() {
    if command -v ss >/dev/null 2>&1; then ss -ltnpH "sport = :$1" 2>/dev/null; return; fi
    if command -v lsof >/dev/null 2>&1; then lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | tail -n +2; return; fi
    err "Neither 'ss' nor 'lsof' is installed — cannot inspect host ports."
    echo "    Install iproute2 / lsof or run 'docker compose up' manually." >&2
    exit 2
}
pid_for_port() {
    if command -v ss >/dev/null 2>&1; then
        inspect_port "$1" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2; return
    fi
    inspect_port "$1" | awk 'NR==1{print $2}'
}
# Read /proc/<pid>/cmdline (NUL-separated) and render the last path component.
cmd_for_pid() {
    [ -n "${1:-}" ] && [ -r "/proc/$1/cmdline" ] || return 1
    tr '\0' ' ' < "/proc/$1/cmdline" \
        | sed 's/[[:space:]]*$//' \
        | awk '{ for (i=1;i<=NF;i++) { n=split($i,a,"/"); printf "%s%s", a[n], (i<NF?" ":""); } print "" }'
}

# --- Apply .env overrides for the compose-interpolated ports ----------------
NAKAMA_SERVER_PORT="$(env_value NAKAMA_SERVER_PORT 7350)"
NAKAMA_CONSOLE_PORT="$(env_value NAKAMA_CONSOLE_PORT 7351)"
REDIS_PORT_HOST="$(env_value REDIS_PORT 6380)"
# DB_PORT describes the in-container Postgres port (5432). The host bind is
# always 5433 — that's what collides when something else is listening.

# --- Probe ------------------------------------------------------------------
info "Probing host ports for compose-stack conflicts"
CONFLICTS=()

check_one() {
    local port="${1%%:*}" desc="${1#*:}" pid cmd
    if [ -z "$(inspect_port "$port" || true)" ]; then
        ok "$port  ($desc) — free"
        return
    fi
    pid=$(pid_for_port "$port" || true)
    cmd=$(cmd_for_pid "${pid:-}" 2>/dev/null || true)
    err "$port  ($desc) — IN USE"
    if [ -n "$pid" ]; then
        echo "      pid:   $pid"
        echo "      cmd:   ${cmd:-<unavailable>}"
    else
        echo "      holder: <unable to determine pid (insufficient perms?)>"
    fi
    echo "      fix:   stop the conflicting process, or change the host bind in"
    echo "            backend/docker-compose.yml (and backend/.env if it is env-driven)."
    CONFLICTS+=("$port")
}

for entry in "${GAME_PORTS[@]}"; do
    case "${entry%%:*}" in
        7350) entry="${NAKAMA_SERVER_PORT}:Nakama API (NAKAMA_SERVER_PORT)" ;;
        7351) entry="${NAKAMA_CONSOLE_PORT}:Nakama Console (NAKAMA_CONSOLE_PORT)" ;;
        6380) entry="${REDIS_PORT_HOST}:Redis (host bind; compose maps ${REDIS_PORT_HOST}:6379)" ;;
    esac
    check_one "$entry"
done

if [ "$CHECK_ALL" = "1" ]; then
    for entry in "${OBS_PORTS[@]}"; do check_one "$entry"; done
else
    info "Skipping observability ports (run with --all to include them)"
fi

echo ""
if [ "${#CONFLICTS[@]}" -gt 0 ]; then
    err "Found ${#CONFLICTS[@]} port conflict(s): ${CONFLICTS[*]}"
    echo "    Refusing to start the compose stack until the host ports above are free."
    exit 1
fi
ok "All requested ports are free — safe to run 'make backend-start' or 'make services-start'"
