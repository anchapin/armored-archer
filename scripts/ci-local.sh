#!/bin/bash
# Local CI Runner for Armored Archer
#
# Optimized for speed with:
#   - Parallel job execution (4 workers)
#   - Service persistence option
#   - Fast health checks (2s intervals)
#   - Better caching
#   - Progress reporting
#
# Usage:
#   ./scripts/ci-local.sh                  # Run all checks (optimized mode)
#   ./scripts/ci-local.sh <job>            # Run specific job
#   ./scripts/ci-local.sh --parallel       # Run all jobs in parallel
#   ./scripts/ci-local.sh --persist        # Keep services running after
#   ./scripts/ci-local.sh --clean          # Stop services and cleanup
#   ./scripts/ci-local.sh --fast           # Use fast docker-compose (default)
#

set -euo pipefail

# Color output for better readability
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly GRAY='\033[0;90m'
readonly NC='\033[0m'

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Docker compose file selection
FAST_COMPOSE="${PROJECT_ROOT}/.github/docker-compose-ci-fast.yml"
REGULAR_COMPOSE="${PROJECT_ROOT}/.github/docker-compose.yml"
DOCKER_COMPOSE="${REGULAR_COMPOSE}"

# Service variables
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-nakama}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme}"

# Nakama connection variables
export NAKAMA_HOST="${NAKAMA_HOST:-localhost}"
export NAKAMA_PORT="${NAKAMA_PORT:-7350}"
export NAKAMA_SERVER_KEY="${NAKAMA_SERVER_KEY:-defaultkey}"

# Test database variables
export TEST_DB_HOST="${TEST_DB_HOST:-localhost}"
export TEST_DB_PORT="${TEST_DB_PORT:-5432}"
export TEST_DB_USER="${TEST_DB_USER:-postgres}"
export TEST_DB_PASSWORD="${TEST_DB_PASSWORD:-changeme}"
export TEST_DB_NAME="${TEST_DB_NAME:-nakama}"

# Runtime flags
USE_FAST_COMPOSE=false
USE_PARALLEL=false
PERSIST_SERVICES=false
VERBOSE=false

# Host memory guard (issue #993): act Node-job containers plus concurrent
# native local-godot-tests.sh suites can exhaust host RAM and OOM-kill jobs
# (act reports exitcode '137' with no error output). Before each act job we
# warn/wait while available memory is below this threshold (MB).
ACT_MIN_FREE_MB="${ACT_MIN_FREE_MB:-2048}"
ACT_MEM_WAIT_SECS="${ACT_MEM_WAIT_SECS:-60}"

# Process-wide act invocation lock (issue #992): concurrent act processes
# (e.g. PR-verification matrices in different worktrees) share ~/.cache/act,
# where act git-clones action refs (actions/checkout, setup-node, ...).
# Simultaneous clones of the same ref corrupt the cache and fail jobs with
# "Non-terminating error while running 'git clone': some refs were not
# updated". Every act invocation (and act cache clear) is serialized via
# flock on this shared lock file. The per-user suffix avoids /tmp permission
# clashes on multi-user hosts.
ACT_LOCK_FILE="${ACT_LOCK_FILE:-${XDG_RUNTIME_DIR:-/tmp}/act-invocation-$(id -u).lock}"

# Job categories
ACT_JOBS=(
    "backend-lint"
    "backend-typecheck"
    "backend-complexity"
    "backend-dead-flags"
    "security-audit"
    "python-lint"
    "gdscript-lint"
    "log-scrubbing"
    "dependency-check"
    "bundle-size-check"
    "godot-validate"
    "n-plus-one-detection"
    "duplicate-code-detection"
    "tech-debt-tracking"
    "dead-code-detection"
    "agents-md-validation"
    # schema-validation runs via act: the ci.yml job starts its own postgres
    # service container on unique host port 5437, installs psql under act, and
    # applies backend/data/*.sql migrations before jest — everything the old
    # direct-host service path below lacked (it never started services because
    # check_services exits 0 on an empty compose project, and never migrated),
    # so tests hit ECONNREFUSED 127.0.0.1:5432 against a schema-less DB.
    "schema-validation"
)

SERVICE_JOBS=(
    # backend-test (unit tests, jest roots=src/) needs no database; it runs
    # on the host via npm for speed.
    "backend-test"
)

ALL_JOBS=("${ACT_JOBS[@]}" "${SERVICE_JOBS[@]}")

# Fast jobs (can run quickly, good for early feedback)
FAST_JOBS=(
    "godot-validate"
    "python-lint"
    "gdscript-lint"
    "backend-lint"
    "backend-typecheck"
)

# Slow jobs (run later)
SLOW_JOBS=(
    "backend-test"
    "schema-validation"
    "sonarcloud"
    "security-audit"
)

# Progress tracking
declare -A JOB_STATUS
declare -A JOB_TIME
TOTAL_START_TIME=$(date +%s)
PROCESSED_JOBS=0
TOTAL_JOBS=0

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[FAIL]${NC} $*"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $*"; }
log_timing() {
    local duration=$(( $(date +%s) - $1 ))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    if [ $minutes -gt 0 ]; then
        echo "${minutes}m ${seconds}s"
    else
        echo "${seconds}s"
    fi
}

# Service management
start_services() {
    log_step "Starting services..."
    cd "${PROJECT_ROOT}"

    local compose_file="${USE_FAST_COMPOSE}" && echo "$FAST_COMPOSE" || echo "$DOCKER_COMPOSE"
    local compose_opts="-f ${compose_file}"

    if [ "${USE_FAST_COMPOSE}" = true ]; then
        compose_opts="-f ${FAST_COMPOSE} -p ci-fast"
        log_info "Using fast docker-compose (optimized health checks)"
    else
        compose_opts="-f ${REGULAR_COMPOSE} -p ci-armored-archer"
    fi

    docker compose $compose_opts up -d postgres redis nakama 2>&1 || {
        log_error "Failed to start services"
        return 1
    }

    # Fast health check for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    local pg_ready=false
    for i in {1..15}; do
        if docker exec $(docker ps -q -f name=postgres) pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
            log_success "PostgreSQL ready in ${i}s"
            pg_ready=true
            break
        fi
        sleep 1
    done

    if [ "$pg_ready" = false ]; then
        log_warning "PostgreSQL not fully ready, continuing..."
    fi

    # Fast health check for Nakama
    log_info "Waiting for Nakama..."
    local nakama_ready=false
    for i in {1..30}; do
        if curl -s -f http://localhost:${NAKAMA_PORT} >/dev/null 2>&1; then
            log_success "Nakama ready in ${i}s"
            nakama_ready=true
            break
        fi
        sleep 1
    done

    if [ "$nakama_ready" = false ]; then
        log_warning "Nakama not fully ready, tests may fail..."
    fi

    log_success "Services started"
    return 0
}

stop_services() {
    log_step "Stopping services..."
    cd "${PROJECT_ROOT}"

    if [ "${USE_FAST_COMPOSE}" = true ]; then
        docker compose -f "${FAST_COMPOSE}" -p ci-fast down 2>&1 || true
    else
        docker compose -f "${REGULAR_COMPOSE}" -p ci-armored-archer down 2>&1 || true
    fi

    log_success "Services stopped"
}

check_services() {
    if [ "${USE_FAST_COMPOSE}" = true ]; then
        docker compose -f "${FAST_COMPOSE}" -p ci-fast ps 2>/dev/null
    else
        docker compose -f "${REGULAR_COMPOSE}" -p ci-armored-archer ps 2>/dev/null
    fi
}

# --- Host memory guard (issue #993) ---

# Print available host memory in MB (empty when it cannot be determined).
available_mem_mb() {
    if command -v free >/dev/null 2>&1; then
        free -m | awk '/^Mem:/ {print $7}'
    elif command -v vm_stat >/dev/null 2>&1; then
        vm_stat | awk '
            /page size of/ { gsub(/[^0-9]/, "", $0); ps = $0 + 0 }
            /^Pages free/ { gsub(/[^0-9]/, "", $3); p = $3 + 0 }
            /^Pages inactive/ { gsub(/[^0-9]/, "", $3); p += $3 + 0 }
            END { if (ps > 0) printf "%d", (p * ps) / 1048576 }
        '
    fi
}

# Warn and wait (up to ACT_MEM_WAIT_SECS) for host memory to recover before
# an act job launches. Advisory only — never blocks the CI run indefinitely.
wait_for_memory() {
    local avail
    avail="$(available_mem_mb || true)"
    [[ "${avail}" =~ ^[0-9]+$ ]] || return 0
    [ "${avail}" -ge "${ACT_MIN_FREE_MB}" ] && return 0

    log_warning "Low host memory: ${avail}MB available (< ${ACT_MIN_FREE_MB}MB) — concurrent local-godot-tests.sh run? (issue #993)"
    local waited=0
    while [ "${waited}" -lt "${ACT_MEM_WAIT_SECS}" ]; do
        sleep 5
        waited=$((waited + 5))
        avail="$(available_mem_mb || true)"
        [[ "${avail}" =~ ^[0-9]+$ ]] || return 0
        if [ "${avail}" -ge "${ACT_MIN_FREE_MB}" ]; then
            log_info "Host memory recovered: ${avail}MB available"
            return 0
        fi
    done
    log_warning "Proceeding with ${avail}MB free — the act job may be OOM-killed (exitcode '137')"
}

# --- Act invocation lock (issue #992) ---

# Run a command while holding the process-wide act lock, blocking until any
# concurrent act invocation finishes. Within a single ci-local.sh process act
# jobs already run sequentially, so this only contends across processes.
# Falls back to running unlocked (with a warning) on hosts without flock
# (e.g. macOS without util-linux installed).
run_with_act_lock() {
    if ! command -v flock >/dev/null 2>&1; then
        log_warning "flock not found — running without act cache lock (issue #992 race possible)"
        "$@"
        return
    fi
    if ! flock -n "${ACT_LOCK_FILE}" true 2>/dev/null; then
        log_warning "Another act invocation is running — waiting for ${ACT_LOCK_FILE} to avoid ~/.cache/act races (issue #992)"
    fi
    flock "${ACT_LOCK_FILE}" "$@"
}

# Job execution
run_act_job() {
    local job="$1"
    local job_start=$(date +%s)

    log_step "Running: ${CYAN}${job}${NC}"

    cd "${PROJECT_ROOT}"

    # Host memory guard (issue #993): warn/wait while free memory is low so
    # concurrent native Godot suites don't OOM-kill this container job.
    wait_for_memory

    # Use .actrc-local if it exists
    local act_opts="-W .github/workflows/ci.yml"
    if [ -f "${PROJECT_ROOT}/.actrc-local" ]; then
        act_opts="-P .actrc-local ${act_opts}"
    fi

    # Disable cache server in parallel mode to prevent npm cache corruption
    # when multiple act instances run simultaneously
    if [ "${USE_PARALLEL}" = true ]; then
        act_opts="${act_opts} --no-cache-server"
    fi

    local _rc=0
    # Serialize act invocations process-wide (issue #992): concurrent act
    # processes share ~/.cache/act and their action git clones race.
    run_with_act_lock act -j "${job}" ${act_opts} 2>&1 || _rc=$?
    JOB_TIME[$job]=$(log_timing $job_start)

    if [ "${_rc}" -eq 0 ]; then
        JOB_STATUS[$job]="pass"
        log_success "${job} completed in ${JOB_TIME[$job]}"
        return 0
    fi

    JOB_STATUS[$job]="fail"
    log_error "${job} failed after ${JOB_TIME[$job]} (exit ${_rc})"
    if [ "${_rc}" -eq 137 ]; then
        log_warning "exit 137 = SIGKILL, likely host OOM (concurrent local-godot-tests.sh?) — re-run in isolation before debugging (issue #993)"
    else
        log_warning "If the act log above shows exitcode '137' with no error output, suspect host OOM — re-run in isolation before debugging (issue #993)"
    fi
    return 1
}

run_service_job() {
    local job="$1"
    local job_start=$(date +%s)
    local test_cmd=""

    # Map job to command
    case "${job}" in
        "schema-validation") test_cmd="test:schema" ;;
        "backend-test") test_cmd="test:coverage" ;;
    esac

    log_step "Running: ${CYAN}${job}${NC} (requires services)"

    # Start services if not running
    if ! check_services >/dev/null 2>&1; then
        log_info "Services not running, starting..."
        if ! start_services; then
            JOB_STATUS[$job]="fail"
            return 1
        fi
    fi

    cd "${PROJECT_ROOT}"

    # Set environment variables
    local env_vars="NAKAMA_HOST=${NAKAMA_HOST} NAKAMA_PORT=${NAKAMA_PORT} NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY} TEST_DB_HOST=${TEST_DB_HOST} TEST_DB_PORT=${TEST_DB_PORT} TEST_DB_USER=${TEST_DB_USER} TEST_DB_PASSWORD=${TEST_DB_PASSWORD} TEST_DB_NAME=${TEST_DB_NAME}"

    cd backend
    if eval "$env_vars npm run ${test_cmd}" 2>&1; then
        JOB_STATUS[$job]="pass"
        JOB_TIME[$job]=$(log_timing $job_start)
        log_success "${job} completed in ${JOB_TIME[$job]}"
        return 0
    else
        JOB_STATUS[$job]="fail"
        JOB_TIME[$job]=$(log_timing $job_start)
        log_error "${job} failed after ${JOB_TIME[$job]}"
        return 1
    fi
}

# Parallel job execution
# Note: act (Docker) jobs run sequentially to avoid container conflicts.
# Service jobs run in parallel since they execute directly on the host.
run_jobs_parallel() {
    local jobs=("$@")
    local max_service_parallel=4
    local pids=()
    local failed=0

    for job in "${jobs[@]}"; do
        TOTAL_JOBS=$((TOTAL_JOBS + 1))
    done

    # Separate act jobs (sequential) from service jobs (parallel)
    local act_jobs=()
    local svc_jobs=()
    for job in "${jobs[@]}"; do
        if [[ " ${SERVICE_JOBS[@]} " =~ " $job " ]]; then
            svc_jobs+=("$job")
        else
            act_jobs+=("$job")
        fi
    done

    log_info "Running ${#act_jobs[@]} act jobs (sequential) + ${#svc_jobs[@]} service jobs (parallel)"

    # Create a temporary directory for job exit codes and timing
    local tmpdir=$(mktemp -d)

    # Start service jobs in background (parallel)
    for job in "${svc_jobs[@]}"; do
        echo "$(date +%s)" > "${tmpdir}/${job}.start"
        (
            local _rc=0
            run_service_job "$job" || _rc=$?
            echo "$_rc" > "${tmpdir}/${job}.exit"
            echo "$(date +%s)" > "${tmpdir}/${job}.end"
        ) &
        pids+=($!)
    done

    # Run act jobs sequentially (Docker containers conflict when parallel)
    for job in "${act_jobs[@]}"; do
        local job_start=$(date +%s)
        echo "$job_start" > "${tmpdir}/${job}.start"
        local _rc=0
        run_act_job "$job" || _rc=$?
        echo "$_rc" > "${tmpdir}/${job}.exit"
        echo "$(date +%s)" > "${tmpdir}/${job}.end"
    done

    # Wait for all service jobs
    for pid in "${pids[@]}"; do
        wait "$pid" || true
    done

    # Collect results from temp files
    for job in "${jobs[@]}"; do
        local exit_file="${tmpdir}/${job}.exit"
        if [ -f "$exit_file" ]; then
            local exit_code=$(cat "$exit_file")
            if [ "$exit_code" = "0" ]; then
                JOB_STATUS[$job]="pass"
            else
                JOB_STATUS[$job]="fail"
                failed=1
            fi
            if [ -f "${tmpdir}/${job}.start" ] && [ -f "${tmpdir}/${job}.end" ]; then
                local _start=$(cat "${tmpdir}/${job}.start")
                local _end=$(cat "${tmpdir}/${job}.end")
                local _duration=$(( _end - _start ))
                local _minutes=$(( _duration / 60 ))
                local _seconds=$(( _duration % 60 ))
                if [ $_minutes -gt 0 ]; then
                    JOB_TIME[$job]="${_minutes}m ${_seconds}s"
                else
                    JOB_TIME[$job]="${_seconds}s"
                fi
            else
                JOB_TIME[$job]="unknown"
            fi
        else
            JOB_STATUS[$job]="fail"
            JOB_TIME[$job]="unknown"
            failed=1
        fi
    done

    rm -rf "$tmpdir"

    return $failed
}

# Sequential job execution
run_jobs_sequential() {
    local jobs=("$@")
    local failed=0

    log_info "Running ${#jobs[@]} jobs sequentially"

    for job in "${jobs[@]}"; do
        TOTAL_JOBS=$((TOTAL_JOBS + 1))

        if [[ " ${SERVICE_JOBS[@]} " =~ " $job " ]]; then
            run_service_job "$job" || failed=1
        else
            run_act_job "$job" || failed=1
        fi

        PROCESSED_JOBS=$((PROCESSED_JOBS + 1))
    done

    return $failed
}

# Summary report
print_summary() {
    local total_time=$(log_timing $TOTAL_START_TIME)
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}                    CI RUN SUMMARY${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Total time: ${CYAN}${total_time}${NC}"
    echo -e "  Total jobs: ${CYAN}${TOTAL_JOBS}${NC}"
    echo ""

    local passed=0
    local failed=0

    echo -e "${GREEN}PASSED:${NC}"
    for job in "${!JOB_STATUS[@]}"; do
        if [ "${JOB_STATUS[$job]}" = "pass" ]; then
            echo -e "  ${GREEN}✓${NC} ${job} ${GRAY}(${JOB_TIME[$job]:-unknown})${NC}"
            passed=$((passed + 1))
        fi
    done

    if [ $failed -gt 0 ] || [ ${#JOB_STATUS[@]} -gt $passed ]; then
        echo ""
        echo -e "${RED}FAILED:${NC}"
        for job in "${!JOB_STATUS[@]}"; do
            if [ "${JOB_STATUS[$job]}" = "fail" ]; then
                echo -e "  ${RED}✗${NC} ${job} ${GRAY}(${JOB_TIME[$job]:-unknown})${NC}"
                failed=$((failed + 1))
            fi
        done
    fi

    echo ""
    echo -e "  ${GREEN}Passed:${NC} ${passed}  ${RED}Failed:${NC} ${failed}  ${CYAN}Total:${NC} ${TOTAL_JOBS}"
    echo ""

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All jobs passed!${NC}"
        return 0
    else
        echo -e "${RED}✗ ${failed} job(s) failed${NC}"
        return 1
    fi
}

# CLI
show_usage() {
    cat << 'EOF'
Local CI Runner for Armored Archer

Usage:
  ./scripts/ci-local.sh                  Run all jobs sequentially (optimized)
  ./scripts/ci-local.sh <job>            Run specific job
  ./scripts/ci-local.sh --parallel       Run all jobs in parallel (4 workers)
  ./scripts/ci-local.sh --persist        Keep services running after completion
  ./scripts/ci-local.sh --fast           Use fast docker-compose (optimal health checks)
  ./scripts/ci-local.sh --clean          Stop services and cleanup
  ./scripts/ci-local.sh --clear-cache   Clear act action cache (fixes git clone errors)
  ./scripts/ci-local.sh --status         Show service status

Act-compatible jobs (no services required):
EOF

    printf "\n  ${BLUE}Fast Jobs (run first for quick feedback):${NC}\n"
    for job in "${FAST_JOBS[@]}"; do
        printf "    ${YELLOW}%s${NC}\n" "${job}"
    done

    printf "\n  ${BLUE}Other Act Jobs:${NC}\n"
    for job in "${ACT_JOBS[@]}"; do
        if [[ ! " ${FAST_JOBS[@]} " =~ " $job " ]]; then
            printf "    ${YELLOW}%s${NC}\n" "${job}"
        fi
    done

    printf "\n  ${BLUE}Service Jobs (need PostgreSQL/Nakama):${NC}\n"
    for job in "${SERVICE_JOBS[@]}"; do
        printf "    ${YELLOW}%s${NC}\n" "${job}"
    done

    cat << 'EOF'

Examples:
  # Run fast jobs first for quick feedback
  ./scripts/ci-local.sh godot-validate

  # Run all jobs in parallel (fastest overall)
  ./scripts/ci-local.sh --parallel --fast

  # Run services once and keep them running
  ./scripts/ci-local.sh --persist --fast
  ./scripts/ci-local.sh backend-test  # Services already running
  ./scripts/ci-local.sh --clean

  # Fix corrupted act cache (git clone errors)
  ./scripts/ci-local.sh --clear-cache

Optimizations:
  - Faster health checks (2s intervals vs 10s)
  - Parallel job execution (4 workers)
  - Service persistence (don't stop/start between jobs)
  - Alpine images (smaller, faster pull)
  - .actrc-local configuration (cached containers)
EOF
}

main() {
    local command="all"
    local job=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_usage
                exit 0
                ;;
            --parallel)
                USE_PARALLEL=true
                shift
                ;;
            --fast)
                USE_FAST_COMPOSE=true
                shift
                ;;
            --persist)
                PERSIST_SERVICES=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --clean)
                stop_services
                log_info "Cleanup complete"
                exit 0
                ;;
            --clear-cache)
                log_step "Clearing act cache..."
                # Hold the act lock: wiping ~/.cache/act under a running act
                # invocation causes the same corruption (issue #992).
                run_with_act_lock rm -rf ~/.cache/act/* 2>/dev/null || run_with_act_lock rm -rf ~/Library/Caches/act/* 2>/dev/null || true
                log_success "Act cache cleared"
                exit 0
                ;;
            --status)
                check_services
                exit $?
                ;;
            -j|--job)
                job="$2"
                shift 2
                ;;
            *)
                # Check if it's a valid job name
                if [[ " ${ALL_JOBS[@]} " =~ " $1 " ]]; then
                    job="$1"
                    shift
                else
                    command="$1"
                    shift
                fi
                ;;
        esac
    done

    # Single job mode
    if [[ -n "$job" ]]; then
        TOTAL_JOBS=1
        if [[ " ${SERVICE_JOBS[@]} " =~ " $job " ]]; then
            run_service_job "$job"
        else
            run_act_job "$job"
        fi
        print_summary
        [ "$PERSIST_SERVICES" = true ] || stop_services
        exit $?
    fi

    # Job category mode
    if [[ " ${ALL_JOBS[@]} " =~ " $command " ]]; then
        TOTAL_JOBS=1
        if [[ " ${SERVICE_JOBS[@]} " =~ " $command " ]]; then
            run_service_job "$command"
        else
            run_act_job "$command"
        fi
        print_summary
        [ "$PERSIST_SERVICES" = true ] || stop_services
        exit $?
    fi

    # Full CI run
    if [[ "$command" == "all" ]]; then
        echo ""
        echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${MAGENTA}║           ARMORED ARCHER - LOCAL CI RUNNER                   ║${NC}"
        echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""

        # Show configuration
        if [ "$USE_FAST_COMPOSE" = true ]; then
            log_info "Mode: FAST (optimized health checks)"
        else
            log_info "Mode: STANDARD"
        fi

        if [ "$USE_PARALLEL" = true ]; then
            log_info "Execution: PARALLEL (4 workers)"
        else
            log_info "Execution: SEQUENTIAL"
        fi

        if [ "$PERSIST_SERVICES" = true ]; then
            log_info "Services: WILL PERSIST after run"
        else
            log_info "Services: WILL STOP after run"
        fi

        echo ""

        # Run fast jobs first for quick feedback
        log_step "Phase 1: Fast jobs (quick feedback)"
        if [ "$USE_PARALLEL" = true ]; then
            run_jobs_parallel "${FAST_JOBS[@]}" || true
        else
            run_jobs_sequential "${FAST_JOBS[@]}" || true
        fi

        # Run remaining act jobs
        log_step "Phase 2: Remaining act jobs"
        local remaining_act=()
        for job in "${ACT_JOBS[@]}"; do
            if [[ ! " ${FAST_JOBS[@]} " =~ " $job " ]]; then
                remaining_act+=("$job")
            fi
        done

        if [ ${#remaining_act[@]} -gt 0 ]; then
            if [ "$USE_PARALLEL" = true ]; then
                run_jobs_parallel "${remaining_act[@]}" || true
            else
                run_jobs_sequential "${remaining_act[@]}" || true
            fi
        fi

        # Run service-dependent jobs
        log_step "Phase 3: Service-dependent jobs"
        if [ "$USE_PARALLEL" = true ]; then
            run_jobs_parallel "${SERVICE_JOBS[@]}" || true
        else
            run_jobs_sequential "${SERVICE_JOBS[@]}" || true
        fi

        # Print summary
        print_summary
        local exit_code=$?

        # Cleanup
        if [ "$PERSIST_SERVICES" = false ]; then
            echo ""
            log_step "Cleaning up..."
            stop_services
        else
            echo ""
            log_info "Services left running (use --clean to stop them)"
            log_info "Run additional jobs without service startup overhead"
        fi

        exit $exit_code
    fi

    show_usage
    exit 1
}

main "$@"
