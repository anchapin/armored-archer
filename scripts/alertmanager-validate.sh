#!/usr/bin/env bash
# scripts/alertmanager-validate.sh — Alertmanager routing-contract validator
# (issue #1094).
#
# Two layers of validation, both exit non-zero on any failure:
#
#   1. ENTRY-SCRIPT LAYER (cheap, fast, no container churn)
#      Asserts every ALERTMANAGER_* env var sourced from backend/.env is
#      neither empty nor the __SET_VIA_DOTENV__ sentinel. Mirrors the
#      fail-fast pattern from #1096 (postgres / nakama / grafana) — the
#      operator finds out at the script-entry layer, before any container
#      is recreated.
#
#   2. CONTAINER READINESS LAYER (proves the wiring actually worked)
#      Curls http://localhost:9093/-/ready within 10s. /-/ready returns
#      200 only when Alertmanager itself has parsed its config AND all
#      routes resolved. If the container is up but the routing is broken,
#      /-/ready returns 503 and the script fails. /-/healthy is NOT
#      probed here because the docker-compose healthcheck (added in
#      issue #1094) already covers it; the entry-script only needs to
#      confirm the operator-facing contract is satisfied.
#
# Usage:
#   bash scripts/alertmanager-validate.sh            # env + probe (default)
#   bash scripts/alertmanager-validate.sh --env      # only env check
#   bash scripts/alertmanager-validate.sh --probe    # only /-/ready probe
#   bash scripts/alertmanager-validate.sh --help
#
# CI target: can be wired as `make alertmanager-validate` in a follow-up.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
ENV_FILE="$BACKEND_DIR/.env"
ALERTMANAGER_PORT="${ALERTMANAGER_PORT:-9093}"

# --- Color output (TTY only) --------------------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; NC=''
fi
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
err()  { echo -e "  ${RED}✗${NC} $*"; }
hdr()  { echo ""; echo -e "${GREEN}== $* ==${NC}"; }

# --- Flags --------------------------------------------------------------
DO_ENV=1
DO_PROBE=1
for arg in "$@"; do
    case "$arg" in
        --env)   DO_PROBE=0 ;;
        --probe) DO_ENV=0   ;;
        --help|-h)
            sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) err "Unknown flag: $arg"; exit 2 ;;
    esac
done

FAIL=0

# --- 1. Env validation --------------------------------------------------
if [ "$DO_ENV" = "1" ]; then
    hdr "1. ALERTMANAGER_* env validation (issue #1094)"

    # Source backend/.env if it exists. The docker-compose.yml interpolation
    # ${VAR:-__SET_VIA_DOTENV__} runs at compose-config time, not at
    # container boot — the resolved value is what reaches alertmanager, so
    # we validate the resolved values by reading the same .env file the
    # operator edits. If .env is missing, fall back to whatever the caller
    # already exported.
    if [ -f "$ENV_FILE" ]; then
        # shellcheck disable=SC1090
        set -a; . "$ENV_FILE"; set +a
        ok "sourced $ENV_FILE"
    else
        warn "$ENV_FILE not found — validating from current shell env only"
        warn "(copy backend/.env.example → backend/.env and fill in the"
        warn " ALERTMANAGER_* block — see the routing-diagram comment block"
        warn " in backend/docker-compose.yml above the alertmanager entry)"
    fi

    # Discover every ALERTMANAGER_* env var currently in scope. Iterating
    # over `env | grep` instead of a hardcoded name list keeps the script
    # in sync when new ALERTMANAGER_RECEIVER_* vars are added to the
    # compose env block — same trick the entrypoint guard uses (issue
    # #1094 routing-contract parity).
    entries=$(env | grep '^ALERTMANAGER_' || true)
    if [ -z "$entries" ]; then
        err "no ALERTMANAGER_* env vars are set at all"
        echo "    The alertmanager container will refuse to start (issue #1094)."
        FAIL=1
    else
        # The receiver contract is "none of these may be the sentinel".
        # ALERTMANAGER_SMTP_FROM is intentionally allowed to keep its
        # default-ish value (alerts@armored-archer.example.com) — it's
        # documentation, not a credential.
        while IFS='=' read -r var val; do
            [ -z "$var" ] && continue
            if [ "$var" = "ALERTMANAGER_SMTP_FROM" ]; then
                ok "$var (default From address — non-secret)"
                continue
            fi
            if [ -z "$val" ]; then
                err "$var is empty (unset)"
                FAIL=1
            elif [ "$val" = "__SET_VIA_DOTENV__" ]; then
                err "$var is still the __SET_VIA_DOTENV__ placeholder"
                FAIL=1
            else
                ok "$var"
            fi
        done <<EOF
$entries
EOF
    fi

    if [ "$FAIL" = "1" ]; then
        echo ""
        err "Alertmanager routing contract is incomplete (issue #1094)"
        echo "  Copy backend/.env.example → backend/.env and fill in every"
        echo "  ALERTMANAGER_RECEIVER_* line. See the routing-diagram comment"
        echo "  block in backend/docker-compose.yml (above the alertmanager"
        echo "  service entry) for what each receiver does."
    fi
fi

# --- 2. /-/ready probe --------------------------------------------------
if [ "$DO_PROBE" = "1" ]; then
    hdr "2. http://localhost:${ALERTMANAGER_PORT}/-/ready probe (10s timeout)"

    if ! command -v curl >/dev/null 2>&1; then
        err "curl not in PATH — skipping probe"
        FAIL=1
    elif ! command -v wget >/dev/null 2>&1 && ! command -v nc >/dev/null 2>&1; then
        # Fall back to bash /dev/tcp when neither curl nor wget is available.
        if ! (exec 3<>"/dev/tcp/localhost/${ALERTMANAGER_PORT}" && echo -e "GET /-/ready HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3) 2>/dev/null; then
            err "could not open tcp connection to localhost:${ALERTMANAGER_PORT}"
            FAIL=1
        else
            ok "opened tcp connection to localhost:${ALERTMANAGER_PORT}"
        fi
    else
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:${ALERTMANAGER_PORT}/-/ready" 2>/dev/null || echo "000")
        case "$code" in
            200) ok "alertmanager reports /-/ready = 200 (config parsed, routes resolved)" ;;
            503) err "alertmanager /-/ready returned 503 (config or routes broken — check container logs)"; FAIL=1 ;;
            000) err "alertmanager /-/ready timed out or refused connection (container may not be running)"; FAIL=1 ;;
            *)   err "alertmanager /-/ready returned unexpected HTTP $code"; FAIL=1 ;;
        esac

        if [ "$code" = "200" ]; then
            # /-/healthy is also nice to confirm; not fatal because the
            # docker-compose healthcheck already covers it.
            hcode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:${ALERTMANAGER_PORT}/-/healthy" 2>/dev/null || echo "000")
            case "$hcode" in
                200) ok "alertmanager reports /-/healthy = 200 (process alive)" ;;
                *)   warn "alertmanager /-/healthy returned HTTP $hcode (container may be unhealthy)" ;;
            esac
        fi

        if [ "$code" != "200" ]; then
            echo "    Diagnose: docker logs armored_archer_alertmanager --tail 30"
        fi
    fi
fi

# --- Summary -------------------------------------------------------------
hdr "summary"
if [ "$FAIL" = "0" ]; then
    echo -e "${GREEN}✓ Alertmanager routing contract is valid (issue #1094)${NC}"
    exit 0
else
    echo -e "${RED}✗ Alertmanager routing contract is broken (issue #1094)${NC}"
    exit 1
fi
