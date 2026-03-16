#!/bin/bash
# test-with-docker-compose.sh
# Run backend tests with Docker Compose services (Nakama, PostgreSQL, Redis)
#
# Usage:
#   ./scripts/test-with-docker-compose.sh           # Run all tests
#   ./scripts/test-with-docker-compose.sh unit      # Run only unit tests
#   ./scripts/test-with-docker-compose.sh integration # Run only integration tests
#   ./scripts/test-with-docker-compose.sh clean     # Stop and remove containers
#   ./scripts/test-with-docker-compose.sh health    # Check service health

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="armored_archer_test"
NAKAMA_HOST="localhost"
NAKAMA_PORT="7350"
NAKAMA_SERVER_KEY="defaultkey"
POSTGRES_PORT="5432"
REDIS_PORT="6379"

# Timeout for service startup (seconds)
STARTUP_TIMEOUT=60

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker Compose is available
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        print_error "Docker Compose is not installed"
        exit 1
    fi
}

# Start Docker Compose services
start_services() {
    print_status "Starting Docker Compose services..."
    
    cd "$BACKEND_DIR"
    
    # Start services in detached mode
    $COMPOSE_CMD -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d postgres redis nakama
    
    print_status "Waiting for services to be healthy..."
    wait_for_services
}

# Wait for all services to be healthy
wait_for_services() {
    local start_time=$(date +%s)
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    while ! docker exec -i "${COMPOSE_PROJECT_NAME}_postgres" pg_isready -U postgres -d nakama &> /dev/null; do
        sleep 1
        if [ $(($(date +%s) - start_time)) -gt $STARTUP_TIMEOUT ]; then
            print_error "PostgreSQL failed to start within ${STARTUP_TIMEOUT}s"
            exit 1
        fi
    done
    print_status "PostgreSQL is ready"
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    while ! docker exec -i "${COMPOSE_PROJECT_NAME}_redis" redis-cli ping &> /dev/null; do
        sleep 1
        if [ $(($(date +%s) - start_time)) -gt $STARTUP_TIMEOUT ]; then
            print_error "Redis failed to start within ${STARTUP_TIMEOUT}s"
            exit 1
        fi
    done
    print_status "Redis is ready"
    
    # Wait for Nakama migrations and server
    print_status "Waiting for Nakama..."
    while ! curl -s "http://${NAKAMA_HOST}:${NAKAMA_PORT}/healthcheck" &> /dev/null; do
        sleep 2
        if [ $(($(date +%s) - start_time)) -gt $STARTUP_TIMEOUT ]; then
            print_error "Nakama failed to start within ${STARTUP_TIMEOUT}s"
            print_warning "Check logs with: docker logs ${COMPOSE_PROJECT_NAME}_nakama"
            exit 1
        fi
        print_warning "Waiting for Nakama... ($(($(date +%s) - start_time))s elapsed)"
    done
    print_status "Nakama is ready"
}

# Run Nakama migrations
run_migrations() {
    print_status "Running Nakama migrations..."
    docker exec -i "${COMPOSE_PROJECT_NAME}_nakama" /nakama/nakama migrate up \
        --database.address "postgres://postgres:changeme@postgres:5432/nakama"
}

# Stop Docker Compose services
stop_services() {
    print_status "Stopping Docker Compose services..."
    cd "$BACKEND_DIR"
    $COMPOSE_CMD -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" stop
    print_status "Services stopped"
}

# Clean up (stop and remove containers)
clean_services() {
    print_status "Cleaning up Docker Compose services..."
    cd "$BACKEND_DIR"
    $COMPOSE_CMD -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down
    print_status "Services cleaned up"
}

# Check service health
check_health() {
    echo "Checking service health..."
    
    # PostgreSQL
    if docker exec -i "${COMPOSE_PROJECT_NAME}_postgres" pg_isready -U postgres -d nakama &> /dev/null; then
        print_status "PostgreSQL: healthy"
    else
        print_error "PostgreSQL: unhealthy"
    fi
    
    # Redis
    if docker exec -i "${COMPOSE_PROJECT_NAME}_redis" redis-cli ping &> /dev/null; then
        print_status "Redis: healthy"
    else
        print_error "Redis: unhealthy"
    fi
    
    # Nakama
    if curl -s "http://${NAKAMA_HOST}:${NAKAMA_PORT}/healthcheck" &> /dev/null; then
        print_status "Nakama: healthy"
    else
        print_error "Nakama: unhealthy"
    fi
}

# Run tests
run_tests() {
    local test_type="${1:-all}"
    
    # Set environment variables for tests
    export NAKAMA_HOST="$NAKAMA_HOST"
    export NAKAMA_PORT="$NAKAMA_PORT"
    export NAKAMA_SERVER_KEY="$NAKAMA_SERVER_KEY"
    export NODE_ENV="test"
    export DATABASE_ADDRESS="postgres://postgres:changeme@localhost:${POSTGRES_PORT}/nakama"
    
    cd "$BACKEND_DIR"
    
    case "$test_type" in
        unit)
            print_status "Running unit tests..."
            npm test -- --testPathIgnorePatterns=integration
            ;;
        integration)
            print_status "Running integration tests..."
            npm run test:integration
            ;;
        all|*)
            print_status "Running all tests..."
            npm test
            ;;
    esac
}

# Show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start         Start Docker Compose services"
    echo "  stop          Stop Docker Compose services"
    echo "  clean         Stop and remove containers"
    echo "  health        Check service health"
    echo "  unit          Run only unit tests"
    echo "  integration   Run only integration tests"
    echo "  all           Run all tests (default)"
    echo "  full          Full test run: start → migrate → test → stop"
    echo "  help          Show this help message"
    echo ""
}

# Main script
check_docker_compose

case "${1:-all}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    clean)
        clean_services
        ;;
    health)
        check_health
        ;;
    unit)
        start_services
        run_tests unit
        stop_services
        ;;
    integration)
        start_services
        run_tests integration
        stop_services
        ;;
    all)
        start_services
        run_tests all
        stop_services
        ;;
    full)
        start_services
        run_migrations
        run_tests all
        stop_services
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac

print_status "Done!"
