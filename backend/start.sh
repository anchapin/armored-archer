#!/bin/bash
# Startup script for Armored Archer Backend with environment validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Armored Archer Backend - Startup Script"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file from .env.example${NC}"
        echo -e "${YELLOW}⚠ Please edit .env file and update the values before starting services.${NC}"
        echo ""
    else
        echo -e "${RED}✗ .env.example not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Load environment variables
set -a
source .env
set +a

# Validate environment variables
echo "Validating environment variables..."
if [ -f validate-env.sh ]; then
    if ./validate-env.sh; then
        echo -e "${GREEN}✓ Environment validation passed${NC}"
    else
        echo -e "${RED}✗ Environment validation failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ validate-env.sh not found, skipping validation${NC}"
fi

echo ""
echo "=========================================="
echo "Starting Docker Compose services..."
echo "=========================================="
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

# Container names used by docker-compose.yml
DB_CONTAINER="armored_archer_db"
SERVER_CONTAINER="armored_archer_server"

# Recovery path (issue #857): if the database container was removed
# (e.g. pruned after a host restart), 'docker compose up -d' recreates it.
# The named volume keeps existing data, so this is safe to run any time.
if ! docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo -e "${YELLOW}⚠ $DB_CONTAINER container is missing (removed or pruned).${NC}"
    echo -e "${YELLOW}  'docker compose up -d' will recreate it; the data volume is preserved.${NC}"
    echo ""
fi

# Start services
if command -v docker-compose &> /dev/null; then
    docker-compose up -d "$@"
else
    docker compose up -d "$@"
fi

# Wait for a container to report a healthy Docker healthcheck.
wait_for_healthy() {
    local container="$1" timeout="${2:-90}" waited=0 status
    while true; do
        status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null)
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}✓ $container is healthy${NC}"
            return 0
        fi
        if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
            echo -e "${RED}✗ $container is not running (exited or crash-looping).${NC}"
            return 1
        fi
        if [ "$waited" -ge "$timeout" ]; then
            echo -e "${RED}✗ $container did not become healthy within ${timeout}s (last status: ${status:-unknown}).${NC}"
            return 1
        fi
        sleep 3
        waited=$((waited + 3))
    done
}

# Fail fast instead of letting the Nakama server crash-loop in the background.
echo ""
echo "Verifying service health..."
if ! wait_for_healthy "$DB_CONTAINER" 60; then
    echo -e "${RED}✗ PostgreSQL ($DB_CONTAINER) is not healthy — aborting.${NC}"
    echo "  Diagnose: docker logs $DB_CONTAINER --tail 50"
    echo "  If the password changed on an existing data volume, run:"
    echo "    docker exec -it $DB_CONTAINER psql -U \${POSTGRES_USER:-postgres} -c \"ALTER USER postgres WITH PASSWORD '<new>';\""
    exit 1
fi

if ! wait_for_healthy "$SERVER_CONTAINER" 120; then
    echo -e "${RED}✗ Nakama server ($SERVER_CONTAINER) is not healthy — aborting.${NC}"
    echo "  Diagnose: docker logs $SERVER_CONTAINER --tail 50"
    echo "  Common causes: database unreachable (see $DB_CONTAINER above) or failed startup migrations."
    exit 1
fi

# Best-effort API reachability check (any HTTP response means it is listening).
if command -v curl &> /dev/null; then
    api_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:${NAKAMA_SERVER_PORT:-7350}/" || true)
    if [ -n "$api_code" ] && [ "$api_code" != "000" ]; then
        echo -e "${GREEN}✓ Nakama API reachable on http://localhost:${NAKAMA_SERVER_PORT:-7350} (HTTP $api_code)${NC}"
    else
        echo -e "${YELLOW}⚠ Nakama API did not answer on localhost:${NAKAMA_SERVER_PORT:-7350} yet — it may still be starting.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✓ Services started and verified healthy${NC}"
echo ""
echo "Nakama Console: http://localhost:7351 (admin:password)"
echo "Nakama API: http://localhost:7350"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
