#!/usr/bin/env bash
#
# assert-cold-start.sh — assert that the local backend stack is fully healthy.
#
# Exit codes:
#   0 — all required services are running and healthy (cold-start success)
#   1 — at least one required service failed the health check
#   2 — prerequisites missing (docker / curl / docker compose)
#
# Usage:
#   ./scripts/assert-cold-start.sh                # default container names
#   ./scripts/assert-cold-start.sh --verbose      # print every check
#   ./scripts/assert-cold-start.sh --require-nakama-bundle
#
# Designed to run locally OR under `act` per issue #907 / #858. CI invocation:
#   act -W .github/workflows/ci.yml -j backend-integration
#
# Companion to scripts/cold-start.sh.

set -uo pipefail

# --- Required containers --------------------------------------------------
DB_CONTAINER="${DB_CONTAINER:-armored_archer_db}"
SERVER_CONTAINER="${SERVER_CONTAINER:-armored_archer_server}"
NAKAMA_PORT="${NAKAMA_PORT:-7350}"
NAKAMA_HEALTH_TIMEOUT="${NAKAMA_HEALTH_TIMEOUT:-120}"

# --- ANSI helpers ---------------------------------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

VERBOSE=0
REQUIRE_BUNDLE=0
for arg in "$@"; do
    case "$arg" in
        --verbose|-v) VERBOSE=1 ;;
        --require-nakama-bundle) REQUIRE_BUNDLE=1 ;;
        --help|-h)
            sed -n '2,18p' "$0"
            exit 0
            ;;
        *) echo "Unknown flag: $arg" >&2; exit 2 ;;
    esac
done

log()  { echo -e "${BLUE}[assert-cold-start]${NC} $*"; }
pass() { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; FAILURES=$((FAILURES + 1)); }
vlog() { [ "$VERBOSE" = "1" ] && echo -e "    $*"; }

FAILURES=0

# --- Prerequisites --------------------------------------------------------
log "Checking prerequisites"
if ! command -v docker >/dev/null 2>&1; then
    fail "docker CLI not found in PATH"
    exit 2
fi
pass "docker CLI present"

if ! command -v curl >/dev/null 2>&1; then
    fail "curl not found in PATH (needed to probe Nakama API)"
    exit 2
fi
pass "curl present"

if ! docker info >/dev/null 2>&1; then
    fail "docker daemon is not running (or current user lacks permissions)"
    exit 2
fi
pass "docker daemon reachable"

# --- Container existence ---------------------------------------------------
log "Checking that required containers are present"
for c in "$DB_CONTAINER" "$SERVER_CONTAINER"; do
    if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
        state=$(docker ps -a --format '{{.Names}} {{.State}}' | awk -v n="$c" '$1==n {print $2}')
        vlog "container $c state=$state"
        if [ "$state" = "running" ]; then
            pass "$c is running"
        else
            fail "$c exists but is not running (state=$state)"
        fi
    else
        fail "$c container does not exist — has 'make services-start' been run?"
    fi
done

# --- Docker healthcheck status --------------------------------------------
log "Checking Docker healthcheck status"
for c in "$DB_CONTAINER" "$SERVER_CONTAINER"; do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$c" 2>/dev/null)
    if [ -z "$status" ]; then
        warn "$c not present — skipping healthcheck probe"
        continue
    fi
    vlog "$c healthcheck status=$status"
    if [ "$status" = "healthy" ]; then
        pass "$c healthcheck = healthy"
    else
        fail "$c healthcheck = ${status} (expected 'healthy')"
    fi
done

# --- PostgreSQL probe via pg_isready --------------------------------------
log "Probing PostgreSQL with pg_isready"
if docker exec "$DB_CONTAINER" pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nakama}" >/dev/null 2>&1; then
    pass "pg_isready reports PostgreSQL is accepting connections"
else
    fail "pg_isready failed inside $DB_CONTAINER"
fi

# --- Nakama API probe -----------------------------------------------------
log "Probing Nakama API on http://localhost:${NAKAMA_PORT}/"
api_code=""
deadline=$(( $(date +%s) + NAKAMA_HEALTH_TIMEOUT ))
while [ "$(date +%s)" -lt "$deadline" ]; do
    api_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:${NAKAMA_PORT}/" || echo "000")
    if [ -n "$api_code" ] && [ "$api_code" != "000" ]; then
        break
    fi
    sleep 2
done

if [ -z "$api_code" ] || [ "$api_code" = "000" ]; then
    fail "Nakama API did not respond on :${NAKAMA_PORT} after ${NAKAMA_HEALTH_TIMEOUT}s"
else
    vlog "Nakama API HTTP $api_code"
    if [ "$api_code" -ge 200 ] && [ "$api_code" -lt 500 ]; then
        pass "Nakama API reachable (HTTP $api_code)"
    else
        fail "Nakama API responded with HTTP $api_code"
    fi
fi

# --- Optional: Nakama bundle readiness (game modules loaded) ---------------
# The Nakama container's `/nakama/data/modules` should contain the bundled
# TypeScript modules. If the bundle is missing the server still reports
# "healthy" but game RPCs will 500. We probe by listing the modules dir.
if [ "$REQUIRE_BUNDLE" = "1" ]; then
    log "Verifying Nakama bundle (--require-nakama-bundle)"
    if docker exec "$SERVER_CONTAINER" test -d /nakama/data/modules >/dev/null 2>&1; then
        module_count=$(docker exec "$SERVER_CONTAINER" sh -c 'ls -1 /nakama/data/modules 2>/dev/null | wc -l' || echo 0)
        vlog "modules dir entries=$module_count"
        if [ "${module_count:-0}" -gt 0 ]; then
            pass "Nakama bundle present ($module_count entries in /nakama/data/modules)"
        else
            fail "Nakama bundle directory is empty — run 'cd backend && npm run build:full'"
        fi
    else
        fail "Nakama /nakama/data/modules directory missing inside container"
    fi
fi

# --- Caveat hand-off -------------------------------------------------------
# Migration application is intentionally NOT part of this assertion. Issue
# #891 owns the "apply game schema to local volume" task. Until that lands,
# game tables (player_stats, catalog, inventory, loadout) may not exist even
# though the stack reports healthy. Integration tests that touch those tables
# will fail; see scripts/cold-start.sh for the pre-flight warning.
if [ "$FAILURES" = "0" ]; then
    warn "Migrations NOT verified — see issue #891. Game tables may be missing."
fi

# --- Summary ---------------------------------------------------------------
echo ""
if [ "$FAILURES" = "0" ]; then
    echo -e "${GREEN}✓ cold-start assertion PASSED — stack is all-green${NC}"
    exit 0
else
    echo -e "${RED}✗ cold-start assertion FAILED — ${FAILURES} check(s) failed${NC}"
    echo "  Run 'make services-start' or 'scripts/cold-start.sh' to bring the stack up."
    echo "  If a container is crash-looping, inspect: docker logs <container> --tail 50"
    exit 1
fi