#!/usr/bin/env bash
#
# cold-start.sh — robust one-command startup for the Armored Archer backend stack.
#
# Closes the remaining gaps from #883 so that from a truly cold state
# (no containers, no volumes, no cached images), a single invocation reaches
# `make services-health` all-green with zero manual steps.
#
# What it does, in order:
#   1. Validate prerequisites (docker, docker compose, curl)
#   2. Validate .env (copy from .env.example if missing)
#   3. Build the compiled Nakama JS bundle if missing (untracked — issue #996)
#   4. Pre-pull required images so the first `up` doesn't stall on a slow mirror
#   5. `docker compose up -d` — idempotent (no-op if containers already up)
#   6. Wait for postgres to become healthy via Docker healthcheck + pg_isready
#   7. Wait for Nakama to become healthy + API to answer
#   8. Run scripts/assert-cold-start.sh for the final pass/fail summary
#   9. Print the caveat hand-off to issue #891 for game migrations
#
# Exit codes:
#   0 — stack is fully healthy
#   1 — startup failed; container logs printed for diagnosis
#
# Usage:
#   ./scripts/cold-start.sh                 # full cold-start
#   ./scripts/cold-start.sh --skip-pull     # skip image pre-pull (use cached)
#   ./scripts/cold-start.sh --skip-assert   # skip the final assert summary
#   ./scripts/cold-start.sh --no-color      # disable ANSI colors
#
# Companion: scripts/assert-cold-start.sh, Makefile `services-start`.

set -uo pipefail

# --- Paths -------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"
ASSERT_SCRIPT="$SCRIPT_DIR/assert-cold-start.sh"

# --- Required container / port names (single source of truth) ------------
DB_CONTAINER="${DB_CONTAINER:-armored_archer_db}"
SERVER_CONTAINER="${SERVER_CONTAINER:-armored_archer_server}"
NAKAMA_PORT="${NAKAMA_PORT:-7350}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"   # worst-case wall-clock for both checks
PG_HEALTH_TIMEOUT="${PG_HEALTH_TIMEOUT:-60}"

# --- Flags -----------------------------------------------------------------
SKIP_PULL=0
SKIP_ASSERT=0
NO_COLOR=0
FORCE_BOOTSTRAP=0
for arg in "$@"; do
    case "$arg" in
        --skip-pull)       SKIP_PULL=1 ;;
        --skip-assert)     SKIP_ASSERT=1 ;;
        --no-color)        NO_COLOR=1 ;;
        --force-bootstrap) FORCE_BOOTSTRAP=1 ;;
        --help|-h)
            sed -n '2,28p' "$0"
            exit 0
            ;;
        *) echo "Unknown flag: $arg" >&2; exit 2 ;;
    esac
done

if [ -t 1 ] && [ "$NO_COLOR" = "0" ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

info() { echo -e "${BLUE}[cold-start]${NC} $*"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
err()  { echo -e "  ${RED}✗${NC} $*"; }

# --- Trap for Ctrl+C / unexpected exit ------------------------------------
cleanup_on_signal() {
    echo ""
    err "Aborted by user — services may be in a partial start state."
    echo "  Run '$0' again, or 'cd $BACKEND_DIR && docker compose ps' to inspect."
    exit 130
}
trap cleanup_on_signal INT TERM

# --- 1. Prerequisites ------------------------------------------------------
info "1/8 Validating prerequisites"
if ! command -v docker >/dev/null 2>&1; then
    err "docker CLI not found in PATH — install Docker Engine first."
    exit 1
fi
ok "docker CLI present"

if ! docker info >/dev/null 2>&1; then
    err "docker daemon is not running — start Docker and retry."
    exit 1
fi
ok "docker daemon reachable"

if docker compose version >/dev/null 2>&1; then
    ok "docker compose plugin present"
elif command -v docker-compose >/dev/null 2>&1; then
    ok "docker-compose (v1) present"
else
    err "neither 'docker compose' nor 'docker-compose' is installed."
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    err "docker-compose.yml not found at $COMPOSE_FILE"
    exit 1
fi
ok "compose file present ($COMPOSE_FILE)"

if ! command -v curl >/dev/null 2>&1; then
    err "curl not found in PATH — needed to probe Nakama API"
    exit 1
fi
ok "curl present"

# --- 2. .env file ----------------------------------------------------------
# SAFETY: never silently overwrite a working .env. The .env.example ships with
# placeholder values like POSTGRES_PASSWORD=your_postgres_password_here. If we
# copy that into a working dir, `docker compose up -d` would re-create the
# already-running containers with the wrong credentials (the postgres data
# volume keeps the real password — issue #891) and break the healthy stack.
# See https://github.com/anchapin/armored-archer/issues/907 for the rationale.
info "2/8 Validating backend/.env"
cd "$BACKEND_DIR"
if [ -f .env ]; then
    ok ".env present"
else
    if [ ! -f .env.example ]; then
        err ".env missing AND .env.example missing — cannot bootstrap"
        echo "  Create backend/.env manually and re-run."
        exit 1
    fi

    # Heuristic: refuse to auto-bootstrap in a git worktree whose .env was
    # never present. Worktrees share the docker daemon with the parent repo,
    # and the parent's stack may already be running with the parent's .env
    # values. Auto-creating a fresh .env here would re-target those same
    # containers (because backend/docker-compose.yml hardcodes container_name).
    # See backend/docker-compose.yml container_name: armored_archer_db etc.
    if [ "$FORCE_BOOTSTRAP" = "0" ] \
        && git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
        && [ -n "$(git rev-parse --git-common-dir 2>/dev/null)" ] \
        && [ "$(git rev-parse --git-common-dir 2>/dev/null)" != "$(git rev-parse --git-dir 2>/dev/null)" ]; then
        err ".env is missing AND $(pwd) is a git worktree."
        echo ""
        echo "  Worktrees share the docker daemon with the parent repo, and the"
        echo "  parent's stack may already be running. Auto-creating a fresh"
        echo "  .env here would re-target those containers with placeholder"
        echo "  credentials and break the existing healthy stack."
        echo ""
        echo "  Fix: copy the parent's .env into this worktree first:"
        echo "    cp <repo-root>/backend/.env backend/.env"
        echo ""
        echo "  Or, if you genuinely want a fresh cold-start in this worktree:"
        echo "    cd backend && docker compose down -v"
        echo "    cd ../.. && scripts/cold-start.sh --force-bootstrap"
        exit 1
    fi

    warn ".env not found — copying from .env.example"
    cp .env.example .env
    ok ".env created from .env.example"
    warn ".env exists with example-template placeholder values (your_*_here) — fill in"
    warn "POSTGRES_PASSWORD, NAKAMA_SERVER_KEY, and HMAC_SECRET before 'docker compose up'."
    warn "Issue #1096: leaving them blank triggers a fail-fast in the nakama entrypoint"
    warn "(see backend/docker-compose.yml 'security guards')."
fi

# Issue #1096: refuse to boot the stack if a credential is still the
# `__SET_VIA_DOTENV__` sentinel — the docker-compose default swaps the old
# guessable placeholder ('changeme', 'defaultkey') for this sentinel so an
# operator who forgets to override gets a fail-fast in the nakama entrypoint.
# Mirroring that check here catches the mistake at the entry-script layer
# before `docker compose up` even starts (cheaper, earlier, and lists every
# bad var at once instead of one at a time inside a crash-looping container).
sentinel_vars=$(grep -E '^[[:space:]]*[^#[:space:]]+[[:space:]]*=[[:space:]]*__SET_VIA_DOTENV__[[:space:]]*$' .env 2>/dev/null || true)
if [ -n "$sentinel_vars" ]; then
    err "BACKEND/.ENV STILL CONTAINS __SET_VIA_DOTENV__ PLACEHOLDERS (issue #1096)"
    echo "$sentinel_vars" | sed 's/^/    /'
    echo ""
    echo "  These are docker-compose.yml's fail-fast markers. Replace each"
    echo "  placeholder above with a real value, e.g.:"
    echo "    POSTGRES_PASSWORD=\$(openssl rand -hex 16)"
    echo "    NAKAMA_SERVER_KEY=\$(openssl rand -hex 24)"
    echo "    HMAC_SECRET=\$(openssl rand -hex 32)"
    echo ""
    echo "  Then re-run this script."
    exit 1
fi

# --- 3. Compiled Nakama bundle (issue #996) ---------------------------------
# backend/data/modules/ is build output (npm run build:full) and is no longer
# tracked in git. On a fresh checkout the bundle is absent, while
# docker-compose.yml mounts ./data/modules into the Nakama container — without
# it, Nakama boots "healthy" but without the game module. Build it here so a
# single `make services-start` still reaches all-green from a fresh clone.
# (cwd is $BACKEND_DIR since step 2.)
info "3/9 Ensuring compiled Nakama bundle (data/modules/index.js)"
if [ -f data/modules/index.js ]; then
    ok "bundle already present"
else
    if ! command -v npm >/dev/null 2>&1; then
        err "data/modules/index.js is missing and npm is not available to build it."
        echo "  Fresh checkouts must build it first: cd backend && npm install && npm run build:full"
        exit 1
    fi
    warn "bundle missing (fresh checkout) — building via npm run build:full"
    if [ ! -d node_modules ]; then
        info "  node_modules missing — running npm install (log: /tmp/cold-start-npm-install.log)"
        npm install --no-audit --no-fund >/tmp/cold-start-npm-install.log 2>&1 || {
            err "npm install failed — see /tmp/cold-start-npm-install.log"
            exit 1
        }
    fi
    npm run build:full >/tmp/cold-start-build.log 2>&1 || {
        err "npm run build:full failed — see /tmp/cold-start-build.log"
        exit 1
    }
    ok "bundle built at data/modules/index.js"
fi

# --- 4. Image pre-pull (idempotent) ---------------------------------------
# We pre-pull only the *application* images (postgres, redis, nakama) — the
# observability stack is already addressable in #895 / #923 and is not on the
# cold-start critical path (they don't gate the Nakama <-> postgres link).
if [ "$SKIP_PULL" = "0" ]; then
    info "4/9 Pre-pulling critical images (idempotent — skips cached)"
    pull_one() {
        local img="$1"
        if docker image inspect "$img" >/dev/null 2>&1; then
            ok "$img (cached)"
        else
            info "  pulling $img"
            if docker pull "$img" >/dev/null 2>&1; then
                ok "$img pulled"
            else
                warn "failed to pull $img — 'docker compose up' will retry"
            fi
        fi
    }
    # Read images straight from the compose file so we don't drift.
    pg_image=$(grep -E '^[[:space:]]*image:' "$COMPOSE_FILE" | awk -F: '/postgres:/{print $2":"$3; exit}' | tr -d '"' | tr -d "'")
    redis_image=$(grep -E '^[[:space:]]*image:' "$COMPOSE_FILE" | awk -F: '/redis:/{print $2":"$3; exit}' | tr -d '"' | tr -d "'")
    nakama_image=$(grep -E '^[[:space:]]*image:' "$COMPOSE_FILE" | awk -F: '/heroiclabs\/nakama:/{print $2":"$3; exit}' | tr -d '"' | tr -d "'")
    [ -n "$pg_image" ]    && pull_one "$pg_image"
    [ -n "$redis_image" ] && pull_one "$redis_image"
    [ -n "$nakama_image" ] && pull_one "$nakama_image"
else
    info "4/9 Skipping image pre-pull (--skip-pull)"
fi

# --- 5. docker compose up -d ----------------------------------------------
info "5/9 docker compose up -d"
if docker compose up -d >/tmp/cold-start-up.log 2>&1; then
    ok "compose up completed"
else
    err "compose up failed — see /tmp/cold-start-up.log"
    tail -20 /tmp/cold-start-up.log
    exit 1
fi
# Quick container presence check so we fail fast on totally missing images.
if ! docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    err "expected container '$DB_CONTAINER' was not created — check 'docker compose ps'"
    docker compose ps
    exit 1
fi
ok "$DB_CONTAINER created"

# --- 6. Wait for PostgreSQL health -----------------------------------------
info "6/9 Waiting for PostgreSQL to become healthy (timeout ${PG_HEALTH_TIMEOUT}s)"
wait_for_pg() {
    local waited=0 status
    while [ "$waited" -lt "$PG_HEALTH_TIMEOUT" ]; do
        # Docker healthcheck is the source of truth (compose service_healthy
        # depends on it). Fall back to pg_isready if no healthcheck is set.
        status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$DB_CONTAINER" 2>/dev/null)
        if [ "$status" = "healthy" ]; then
            ok "Docker healthcheck = healthy"
            return 0
        fi
        if docker exec "$DB_CONTAINER" pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nakama}" >/dev/null 2>&1; then
            ok "pg_isready reports accepting connections"
            return 0
        fi
        # If the container exited, bail — no point waiting on a crash-loop.
        if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
            err "$DB_CONTAINER is no longer running"
            docker logs "$DB_CONTAINER" --tail 30 2>&1 | sed 's/^/    /'
            return 1
        fi
        sleep 3
        waited=$((waited + 3))
        printf "."
    done
    echo ""
    err "PostgreSQL did not become healthy within ${PG_HEALTH_TIMEOUT}s"
    docker logs "$DB_CONTAINER" --tail 30 2>&1 | sed 's/^/    /'
    return 1
}
if ! wait_for_pg; then
    exit 1
fi

# --- 7. Wait for Nakama ----------------------------------------------------
info "7/9 Waiting for Nakama to become healthy + API ready (timeout ${HEALTH_TIMEOUT}s)"
wait_for_nakama() {
    local waited=0 status api_code deadline
    deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
    while [ "$(date +%s)" -lt "$deadline" ]; do
        status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$SERVER_CONTAINER" 2>/dev/null)
        api_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:${NAKAMA_PORT}/" 2>/dev/null || echo "000")
        if [ "$status" = "healthy" ] && [ -n "$api_code" ] && [ "$api_code" != "000" ]; then
            ok "Docker healthcheck = healthy AND API HTTP $api_code"
            return 0
        fi
        if ! docker ps --format '{{.Names}}' | grep -qx "$SERVER_CONTAINER"; then
            err "$SERVER_CONTAINER is no longer running"
            docker logs "$SERVER_CONTAINER" --tail 30 2>&1 | sed 's/^/    /'
            return 1
        fi
        sleep 3
        waited=$((waited + 3))
        printf "."
    done
    echo ""
    err "Nakama did not become healthy + API-ready within ${HEALTH_TIMEOUT}s"
    docker logs "$SERVER_CONTAINER" --tail 30 2>&1 | sed 's/^/    /'
    return 1
}
if ! wait_for_nakama; then
    exit 1
fi

# --- 8. Final pass/fail assertion -----------------------------------------
info "8/9 Final all-green assertion"
if [ "$SKIP_ASSERT" = "1" ]; then
    warn "--skip-assert set — running without final assertion"
elif [ -x "$ASSERT_SCRIPT" ]; then
    if "$ASSERT_SCRIPT"; then
        ok "assert-cold-start.sh reports PASS"
    else
        err "assert-cold-start.sh reports FAIL despite the warm-up above — investigate"
        exit 1
    fi
elif [ -f "$ASSERT_SCRIPT" ]; then
    if bash "$ASSERT_SCRIPT"; then
        ok "assert-cold-start.sh reports PASS"
    else
        err "assert-cold-start.sh reports FAIL"
        exit 1
    fi
else
    warn "assert-cold-start.sh not found at $ASSERT_SCRIPT — skipping"
fi

# --- 9. Caveat hand-off ----------------------------------------------------
info "9/9 Caveat hand-off"
warn "Game schema migrations are NOT verified by this script."
warn "Issue #891 (and PR #919) own the 'apply game SQL to local volume' task."
warn "Until that lands, 'psql \\dt' inside $DB_CONTAINER may show the 16 core"
warn "Nakama tables but no game tables (player_stats, catalog, inventory, loadout)."
warn "Run 'cd backend && npm run test:integration' to exercise the migration path."

echo ""
echo -e "${GREEN}✓ Cold-start complete — stack is all-green${NC}"
echo "  Nakama API:     http://localhost:${NAKAMA_PORT}"
echo "  Nakama Console: http://localhost:7351  (admin:password)"
echo "  PostgreSQL:     localhost:5432  (mapped 5433→5432)"
echo ""
echo "Re-verify any time with: ./scripts/assert-cold-start.sh"