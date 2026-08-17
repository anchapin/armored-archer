#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# check-game-schema.sh — read-only schema verification for issue #891
#
# PURPOSE
#   Verify that the local Nakama/Postgres stack has the *game* tables applied
#   (player_stats, catalog, inventory, loadout, …) without ever running a
#   migration. This is a pure diagnostic; it never mutates the database.
#
# CONTEXT
#   The local `backend_data` Postgres volume historically only had the 16 core
#   Nakama tables and was missing every game SQL migration in backend/data/.
#   Per AGENTS.md, "database migrations plus security-critical code always
#   require human supervision", so this script intentionally does NOT apply
#   migrations — it only surfaces the current state so a human can decide.
#
# USAGE
#   ./check-game-schema.sh                  # auto-discover via docker
#   ./check-game-schema.sh --verbose        # show every table found
#   ./check-game-schema.sh --no-color       # disable ANSI colors
#   CHECK_REQUIRED_TABLES="a,b" ./check-game-schema.sh
#
# EXIT CODES
#   0 — all required game tables are present
#   1 — at least one required game table is missing OR the DB is unreachable
#   2 — usage / configuration error (missing .env, no docker, etc.)
#
# DEPENDENCIES
#   - bash >= 4 (uses `set -euo pipefail`)
#   - docker (preferred) OR psql client
#   - backend/.env readable by this user (only POSTGRES_* vars are consulted)
#
# This script MUST remain pure-read. Do not add `migrate up` or any mutation.
# ------------------------------------------------------------------------------

set -euo pipefail

# --- Resolve paths -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${BACKEND_DIR}/.env"
ENV_EXAMPLE_FILE="${BACKEND_DIR}/.env.example"

# --- CLI flags ---------------------------------------------------------------
VERBOSE=0
USE_COLOR=1
for arg in "$@"; do
  case "${arg}" in
    --verbose|-v) VERBOSE=1 ;;
    --no-color)    USE_COLOR=0 ;;
    --help|-h)
      sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      exit 2
      ;;
  esac
done

# --- Colors (no-op when not a TTY or --no-color) -----------------------------
if [[ "${USE_COLOR}" == "1" ]] && [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; RESET=''
fi

log() { printf '%b\n' "$*"; }
section() { printf '\n%b== %s ==%b\n' "${BLUE}" "$*" "${RESET}"; }

# Sanity: this script lives under backend/scripts/ — if BACKEND_DIR doesn't
# look like the project's backend/, we were probably invoked from the wrong
# place (e.g. copied into /tmp). Bail with a clear message.
case "${BACKEND_DIR}" in
  /*backend)
    : # OK — looks like the repo's backend/ directory
    ;;
  *)
    if [[ ! -d "${BACKEND_DIR}/data" ]] || [[ ! -f "${BACKEND_DIR}/package.json" ]]; then
      log "${RED}✗ Could not locate backend/ relative to ${BASH_SOURCE[0]}.${RESET}" >&2
      log "  Resolved BACKEND_DIR='${BACKEND_DIR}' does not look like the project's backend/." >&2
      log "  Invoke this script via 'make check-game-schema' from the repo root," >&2
      log "  or run it from inside backend/scripts/." >&2
      exit 2
    fi
    ;;
esac

# --- Load .env (POSTGRES_* only) --------------------------------------------
# We use a strict grep so we never echo full secret values back to the user
# or to logs. Only the values are read into the shell; nothing is printed.
load_postgres_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    set +u
    # shellcheck disable=SC1090
    source <(grep -E '^(POSTGRES_(USER|PASSWORD|DB)|DB_(HOST|PORT|NAME|USER|PASSWORD))=' "${ENV_FILE}")
    set -u
  elif [[ -f "${ENV_EXAMPLE_FILE}" ]]; then
    log "${YELLOW}⚠ ${ENV_FILE} not found — falling back to ${ENV_EXAMPLE_FILE}${RESET}"
    log "${YELLOW}  Values will be placeholders; the script will not be able to connect.${RESET}"
    set +u
    # shellcheck disable=SC1090
    source <(grep -E '^(POSTGRES_(USER|PASSWORD|DB)|DB_(HOST|PORT|NAME|USER|PASSWORD))=' "${ENV_EXAMPLE_FILE}")
    set -u
  else
    log "${RED}✗ Neither ${ENV_FILE} nor ${ENV_EXAMPLE_FILE} exists.${RESET}" >&2
    log "  Run: cp ${ENV_EXAMPLE_FILE} ${ENV_FILE}" >&2
    exit 2
  fi

  : "${POSTGRES_USER:=postgres}"
  : "${POSTGRES_DB:=nakama}"
  : "${DB_HOST:=postgres}"
  : "${DB_PORT:=5432}"
}

# --- Required game tables ----------------------------------------------------
# Issue #891: confirm the canonical 4 game tables are present. Additional
# tables (stage_completion, notifications, boss_defeat_tracking, …) come
# along when 001–007 are applied, so we focus on the four named in the issue.
if [[ -n "${CHECK_REQUIRED_TABLES:-}" ]]; then
  IFS=',' read -r -a REQUIRED_TABLES <<< "${CHECK_REQUIRED_TABLES}"
else
  REQUIRED_TABLES=(player_stats catalog inventory loadout)
fi

# --- Resolve container / host ------------------------------------------------
# Prefer `docker exec armored_archer_db psql` (always present in the local
# stack). Fall back to a host-side `psql` if Docker is unavailable or the
# container is missing — this lets the script also work in CI / GitHub
# Actions runners where the DB might be on localhost.
DB_CONTAINER="${DB_CONTAINER:-armored_archer_db}"

run_psql_query() {
  local query="$1"

  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${DB_CONTAINER}"; then
    docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" \
      "${DB_CONTAINER}" \
      psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -At -c "${query}"
    return $?
  fi

  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${POSTGRES_PASSWORD:-}" \
      psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -At -c "${query}"
    return $?
  fi

  log "${RED}✗ Neither the '${DB_CONTAINER}' Docker container nor a host-side 'psql' is available.${RESET}" >&2
  log "  Start the stack with: make services-start" >&2
  exit 2
}

# --- Main flow ---------------------------------------------------------------
load_postgres_env

section "Game schema verification (read-only)"
log "Backend dir:    ${BACKEND_DIR}"
log "Env file:       ${ENV_FILE}"
log "DB container:   ${DB_CONTAINER}"
log "Required tabs:  ${REQUIRED_TABLES[*]}"
log "Connect as:     ${POSTGRES_USER}@${POSTGRES_DB}"

# 1) List every table currently in the database (public schema only — these
#    are the tables that Nakama + game migrations land in).
section "1/2  Listing tables in database"
ALL_TABLES_RAW="$(run_psql_query "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")" || {
  log "${RED}✗ Failed to query ${POSTGRES_DB}.${RESET}" >&2
  exit 1
}

if [[ -z "${ALL_TABLES_RAW}" ]]; then
  log "${RED}✗ Query returned no tables — connection likely failed.${RESET}" >&2
  exit 1
fi

mapfile -t ALL_TABLES <<< "${ALL_TABLES_RAW}"
log "Found ${#ALL_TABLES[@]} table(s) total."

if [[ "${VERBOSE}" == "1" ]]; then
  for t in "${ALL_TABLES[@]}"; do
    [[ -n "${t}" ]] && log "  - ${t}"
  done
fi

# 2) Diff against required game tables ----------------------------------------
section "2/2  Checking required game tables"
MISSING=()
PRESENT=()
for required in "${REQUIRED_TABLES[@]}"; do
  found=0
  for existing in "${ALL_TABLES[@]}"; do
    if [[ "${existing}" == "${required}" ]]; then
      found=1
      break
    fi
  done
  if [[ "${found}" == "1" ]]; then
    PRESENT+=("${required}")
    log "  ${GREEN}✓${RESET} ${required}"
  else
    MISSING+=("${required}")
    log "  ${RED}✗${RESET} ${required}"
  fi
done

# --- Summary -----------------------------------------------------------------
section "Summary"
log "Required tables: ${#REQUIRED_TABLES[@]}"
log "Present:         ${#PRESENT[@]}"
log "Missing:         ${#MISSING[@]}"

if [[ "${#MISSING[@]}" -eq 0 ]]; then
  log "${GREEN}${BOLD}PASS${RESET} — all required game tables are present in ${POSTGRES_DB}."
  log "No mutation was performed by this script."
  exit 0
fi

log "${RED}${BOLD}FAIL${RESET} — the following required game tables are missing:"
for m in "${MISSING[@]}"; do log "  - ${m}"; done
log ""
log "${YELLOW}Action required (HUMAN SUPERVISION):${RESET}"
log "  1. Read ${BOLD}docs/db/MIGRATIONS.md${RESET} (the runbook)."
log "  2. Have a second engineer review the migration log."
log "  3. Apply migrations with: ${BOLD}make backend-migrate${RESET}"
log "     (or: docker exec armored_archer_server /nakama/nakama migrate up --database.address \"\${DATABASE_ADDRESS}\")"
log "  4. Re-run this script to confirm."
exit 1
