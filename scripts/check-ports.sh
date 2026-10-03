#!/usr/bin/env bash
#
# check-ports.sh — fail fast when a host port the compose stack binds is
# already in use.
#
# `make backend-start` / `make services-start` / `make ci-services-start`
# previously let `docker compose up -d` crash with a confusing "port is
# already allocated" error after the stack had already started partially.
# This script is the first step of those targets: it probes the host ports
# the compose file binds, prints the offending PID + command for each
# conflict, and exits non-zero so chained Make targets and CI see the
# failure.
#
# It does NOT auto-pick free ports and does NOT prompt interactively.
#
# Two compose stacks ship with this repo and they bind deliberately
# different host ports:
#
#   Dev  — backend/docker-compose.yml (default profile)
#         Postgres 5433 (compose maps 5433:5432), Redis 6380 (6380:6379),
#         Nakama API 7350, Nakama Console 7351, Nakama gRPC 7349, plus
#         the observability stack (see --all).
#
#   CI   — .github/docker-compose.yml (--profile ci)
#         Postgres 5432 (compose maps 5432:5432), Nakama API 7350,
#         Nakama Console 7351. No Redis, no observability stack.
#
# Profiles:
#   --profile dev  (default) — checks the dev compose port set; honors
#         backend/.env (NAKAMA_SERVER_PORT, NAKAMA_CONSOLE_PORT, REDIS_PORT).
#         --all additionally checks the dev observability stack.
#   --profile ci   — checks only the CI compose port set (5432, 7350, 7351).
#         Does NOT source backend/.env — the CI compose hardcodes those
#         ports inline (issue: CI profile binds the standard Postgres port).
#         --all is accepted as a no-op with a warning because the CI compose
#         has no observability services to check.
#
# Exit codes:
#   0 — every requested port is free
#   1 — at least one port is already bound (printed with PID + command)
#   2 — neither `ss` nor `lsof` is available; cannot inspect ports at all
#
# Usage:
#   scripts/check-ports.sh                  # dev profile, game ports only
#   scripts/check-ports.sh --all            # dev profile + observability
#   scripts/check-ports.sh --profile ci     # CI compose port set
#   scripts/check-ports.sh --profile ci --all   # CI ports only (warns)
#
# Honors `backend/.env` if present (NAKAMA_SERVER_PORT, NAKAMA_CONSOLE_PORT,
# REDIS_PORT) and falls back to the compose-file defaults. `DB_PORT` describes
# the container port (5432) — compose maps it to host port 5433, which is what
# we check (dev profile only).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/backend/.env"

CHECK_ALL=0
PROFILE="dev"
while [ $# -gt 0 ]; do
    arg="$1"
    case "$arg" in
        --all) CHECK_ALL=1; shift ;;
        --profile)
            if [ $# -lt 2 ]; then
                echo "Missing value for --profile (expected 'dev' or 'ci')" >&2; exit 2
            fi
            case "$2" in
                dev|ci) PROFILE="$2" ;;
                *) echo "Unknown --profile value: $2 (expected 'dev' or 'ci')" >&2; exit 2 ;;
            esac
            shift 2
            ;;
        --profile=*)
            case "${arg#--profile=}" in
                dev|ci) PROFILE="${arg#--profile=}" ;;
                *) echo "Unknown --profile value: ${arg#--profile=} (expected 'dev' or 'ci')" >&2; exit 2 ;;
            esac
            shift
            ;;
        --help|-h) sed -n '2,52p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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
# conflict output so operators know which compose stack + port is impacted.
GAME_PORTS=(
    "5433:PostgreSQL — dev compose host bind (compose maps 5433:5432)"
    "6380:Redis — dev compose host bind (compose maps 6380:6379)"
    "7349:Nakama gRPC — dev compose"
    "7350:Nakama API — dev compose (NAKAMA_SERVER_PORT)"
    "7351:Nakama Console — dev compose (NAKAMA_CONSOLE_PORT)"
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
# CI compose (.github/docker-compose.yml) — Postgres intentionally claims
# the standard 5432 host port (no ${POSTGRES_PORT} substitution), and there
# is no Redis or observability stack. Ports here are NOT overridden by
# backend/.env — the CI compose hardcodes them.
CI_PORTS=(
    "5432:PostgreSQL — CI compose host bind (compose maps 5432:5432)"
    "7350:Nakama API — CI compose"
    "7351:Nakama Console — CI compose"
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
# Only meaningful for the dev profile — the CI compose hardcodes its ports
# inline (see .github/docker-compose.yml), so backend/.env never affects it.
if [ "$PROFILE" = "dev" ]; then
    NAKAMA_SERVER_PORT="$(env_value NAKAMA_SERVER_PORT 7350)"
    NAKAMA_CONSOLE_PORT="$(env_value NAKAMA_CONSOLE_PORT 7351)"
    REDIS_PORT_HOST="$(env_value REDIS_PORT 6380)"
    # DB_PORT describes the in-container Postgres port (5432). The host bind is
    # always 5433 — that's what collides when something else is listening.
else
    # CI compose ports are hardcoded; explicitly do NOT source backend/.env.
    NAKAMA_SERVER_PORT=7350
    NAKAMA_CONSOLE_PORT=7351
    REDIS_PORT_HOST=6380  # unused for ci; kept so unset detection below works.
fi

# --- Probe ------------------------------------------------------------------
info "Probing host ports for compose-stack conflicts (profile: $PROFILE)"
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
    if [ "$PROFILE" = "ci" ]; then
        echo "      fix:   stop the conflicting process, or change the host bind in"
        echo "            .github/docker-compose.yml (the CI compose hardcodes ports — backend/.env is NOT read for this profile)."
    else
        echo "      fix:   stop the conflicting process, or change the host bind in"
        echo "            backend/docker-compose.yml (and backend/.env if it is env-driven)."
    fi
    CONFLICTS+=("$port")
}

if [ "$PROFILE" = "ci" ]; then
    # CI compose: hardcoded ports, no Redis, no observability stack. Do NOT
    # source backend/.env — the file describes the dev stack and using its
    # values here would mislead the operator (and the CI compose does not
    # interpolate them anyway).
    for entry in "${CI_PORTS[@]}"; do
        check_one "$entry"
    done
    if [ "$CHECK_ALL" = "1" ]; then
        info "--all has no extra ports to check on the CI profile (no Redis, no observability stack)"
    fi
else
    for entry in "${GAME_PORTS[@]}"; do
        case "${entry%%:*}" in
            7350) entry="${NAKAMA_SERVER_PORT}:Nakama API — dev compose (NAKAMA_SERVER_PORT)" ;;
            7351) entry="${NAKAMA_CONSOLE_PORT}:Nakama Console — dev compose (NAKAMA_CONSOLE_PORT)" ;;
            6380) entry="${REDIS_PORT_HOST}:Redis — dev compose host bind (compose maps ${REDIS_PORT_HOST}:6379)" ;;
        esac
        check_one "$entry"
    done

    if [ "$CHECK_ALL" = "1" ]; then
        for entry in "${OBS_PORTS[@]}"; do check_one "$entry"; done
    else
        info "Skipping observability ports (run with --all to include them)"
    fi
fi

echo ""
if [ "${#CONFLICTS[@]}" -gt 0 ]; then
    err "Found ${#CONFLICTS[@]} port conflict(s): ${CONFLICTS[*]}"
    if [ "$PROFILE" = "ci" ]; then
        echo "    Refusing to start the CI compose stack until the host ports above are free."
    else
        echo "    Refusing to start the compose stack until the host ports above are free."
    fi
    exit 1
fi
if [ "$PROFILE" = "ci" ]; then
    ok "All requested ports are free — safe to run 'make ci-services-start'"
else
    ok "All requested ports are free — safe to run 'make backend-start' or 'make services-start'"
fi
