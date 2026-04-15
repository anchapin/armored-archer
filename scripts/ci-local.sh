#!/bin/bash
# Local CI Runner for Armored Archer
#
# This script runs all CI workflows locally using a combination of:
# - docker compose for service-dependent jobs (PostgreSQL, Nakama, Redis)
# - act for act-compatible jobs
#
# Usage:
#   ./scripts/ci-local.sh              # Run all checks and tests (auto-cleans services)
#   ./scripts/ci-local.sh <job>         # Run specific job
#   ./scripts/ci-local.sh --clean       # Stop services and cleanup
#   ./scripts/ci-local.sh --services     # Start only services (no tests)
#

set -euo pipefail

# Color output for better readability
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Docker compose file location
DOCKER_COMPOSE="${PROJECT_ROOT}/backend/docker-compose.yml"

# Service variables (matching docker-compose.yml)
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-nakama}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme}"

# Nakama connection variables for tests
export NAKAMA_HOST="${NAKAMA_HOST:-localhost}"
export NAKAMA_PORT="${NAKAMA_PORT:-7350}"
export NAKAMA_SERVER_KEY="${NAKAMA_SERVER_KEY:-defaultkey}"

# Test database variables
export TEST_DB_HOST="${TEST_DB_HOST:-localhost}"
export TEST_DB_PORT="${TEST_DB_PORT:-5433}"
export TEST_DB_USER="${TEST_DB_USER:-postgres}"
export TEST_DB_PASSWORD="${TEST_DB_PASSWORD:-changeme}"
export TEST_DB_NAME="${TEST_DB_NAME:-nakama}"

# Act-compatible jobs (can run without services)
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
)

# Service-dependent jobs (need services running)
SERVICE_JOBS=(
    "backend-test"
    "schema-validation"
)

# All jobs
ALL_JOBS=("${ACT_JOBS[@]}" "${SERVICE_JOBS[@]}")

# Service management functions
start_services() {
    echo -e "${BLUE}Starting services...${NC}"
    cd "${PROJECT_ROOT}"
    docker compose -f "${DOCKER_COMPOSE}" up -d postgres nakama redis 2>&1 || {
        echo -e "${RED}Failed to start services${NC}"
        return 1
    }

    # Wait for PostgreSQL to be healthy
    echo -e "${BLUE}Waiting for PostgreSQL to be healthy...${NC}"
    for i in {1..30}; do
        if docker exec armored_archer_db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
            echo -e "${GREEN}PostgreSQL is healthy${NC}"
            break
        fi
        sleep 2
    done

    # Wait for Nakama to be responsive
    echo -e "${BLUE}Waiting for Nakama server to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:7350 >/dev/null 2>&1; then
            echo -e "${GREEN}Nakama is ready${NC}"
            break
        fi
        sleep 2
    done

    echo -e "${GREEN}Services are running${NC}"
    return 0
}

stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"
    cd "${PROJECT_ROOT}"
    docker compose -f "${DOCKER_COMPOSE}" down 2>&1 || {
        echo -e "${RED}Failed to stop services${NC}"
        return 1
    }
    echo -e "${GREEN}Services stopped${NC}"
    return 0
}

cleanup_services() {
    echo -e "${YELLOW}Cleaning up services...${NC}"
    cd "${PROJECT_ROOT}"

    # Remove dangling volumes
    docker volume ls -qf dangling=true | xargs -r docker volume rm 2>/dev/null || true

    docker compose -f "${DOCKER_COMPOSE}" down -v 2>&1 || true

    echo -e "${GREEN}Cleanup complete${NC}"
}

check_services() {
    cd "${PROJECT_ROOT}"
    docker compose -f "${DOCKER_COMPOSE}" ps 2>/dev/null
}

# Act job runner
run_act_job() {
    local job="$1"
    echo -e "${BLUE}Running act job: ${job}${NC}"
    cd "${PROJECT_ROOT}"
    act -j "${job}" -W .github/workflows/ci.yml 2>&1
}

# Service-dependent test runner
run_service_job() {
    local job="$1"
    local test_cmd=""

    # Map job name to npm command
    case "${job}" in
        "schema-validation")
            test_cmd="test:schema"
            ;;
        "backend-test")
            test_cmd="test"
            ;;
    esac

    echo -e "${BLUE}Running service job: ${job}${NC}"

    # Check if services are running
    if ! check_services >/dev/null; then
        echo -e "${YELLOW}Services not running, starting...${NC}"
        if ! start_services; then
            return 1
        fi
    fi

    # Run the test from project root
    cd "${PROJECT_ROOT}"

    case "${job}" in
        "schema-validation")
            cd backend && TEST_DB_HOST="${TEST_DB_HOST}" TEST_DB_PORT="${TEST_DB_PORT}" TEST_DB_USER="${TEST_DB_USER}" TEST_DB_PASSWORD="${TEST_DB_PASSWORD}" TEST_DB_NAME="${TEST_DB_NAME}" npm run "${test_cmd}"
            ;;
        "backend-test")
            cd backend && NAKAMA_HOST="${NAKAMA_HOST}" NAKAMA_PORT="${NAKAMA_PORT}" NAKAMA_SERVER_KEY="${NAKAMA_SERVER_KEY}" TEST_DB_HOST="${TEST_DB_HOST}" TEST_DB_PORT="${TEST_DB_PORT}" TEST_DB_USER="${TEST_DB_USER}" TEST_DB_PASSWORD="${TEST_DB_PASSWORD}" TEST_DB_NAME="${TEST_DB_NAME}" npm run "${test_cmd}"
            ;;
    esac
}

# Main CLI
show_usage() {
    cat << 'EOF'
Local CI Runner for Armored Archer

Usage:
  ./scripts/ci-local.sh              Run all checks and tests (auto-cleans services)
  ./scripts/ci-local.sh <job>        Run specific CI job
  ./scripts/ci-local.sh --clean      Stop services and cleanup
  ./scripts/ci-local.sh --services   Start/stop only services (no tests)
  ./scripts/ci-local.sh --status     Show service status

Act-compatible jobs (no services required):
EOF

    # List act jobs
    printf "\n${BLUE}  Act Jobs:${NC}\n"
    for job in "${ACT_JOBS[@]}"; do
        printf "  ${YELLOW}%s${NC}\n" "${job}"
    done

    # List service jobs
    printf "\n${BLUE} Service Jobs (need PostgreSQL/Nakama):${NC}\n"
    for job in "${SERVICE_JOBS[@]}"; do
        printf "  ${YELLOW}%s${NC}\n" "${job}"
    done
}

main() {
    local command="${1:-all}"
    local job="${2:-}"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_usage
                exit 0
                ;;
            --clean)
                stop_services
                cleanup_services
                echo -e "${GREEN}Cleanup complete. Exiting.${NC}"
                exit 0
                ;;
            --services)
                if [[ "$command" == "services" ]]; then
                    start_services
                    echo -e "${GREEN}Services started. Run with job name to run tests.${NC}"
                    exit 0
                else
                    check_services
                    exit $?
                fi
                ;;
            --status)
                check_services
                exit $?
                ;;
            *)
                # Check if it's a valid job name
                if [[ " ${ALL_JOBS[@]}" =~ " $1 " ]]; then
                    job="$1"
                    shift
                else
                    command="$1"
                fi
                ;;
        esac
    done

    # If specific job requested
    if [[ -n "$job" ]]; then
        run_act_job "$job"
    # If running service-dependent job
    elif [[ " ${SERVICE_JOBS[@]}" =~ " $command " ]]; then
        run_service_job "$command"
    # If --services or running act job for services
    elif [[ "$command" == "all" || "$command" == "services" ]]; then
        # Start services if needed
        if ! check_services >/dev/null; then
            start_services
        fi

        # Run act-compatible jobs
        local failed=0
        for job in "${ACT_JOBS[@]}"; do
            if ! run_act_job "$job"; then
                failed=1
            fi
        done

        # Run service-dependent tests
        for job in "${SERVICE_JOBS[@]}"; do
            if [[ "$command" == "all" ]]; then
                run_service_job "$job"
            fi
        done

        # Show summary
        if [[ $failed -eq 0 ]]; then
            echo -e "${GREEN}✓ All jobs completed successfully${NC}"
        else
            echo -e "${RED}✗ Some jobs failed${NC}"
        fi

        # Cleanup services after running all jobs
        if [[ "$command" == "all" ]]; then
            echo -e "${BLUE}Cleaning up services...${NC}"
            stop_services
        fi

        exit $failed
    else
        show_usage
        exit 1
    fi
}

main "$@"
