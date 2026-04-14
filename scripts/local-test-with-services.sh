#!/bin/bash
# Local testing script using docker-compose for services
# This works around act's limitations with service container environment variables

set -e

echo "🚀 Starting local testing with docker-compose..."

# Change to backend directory
cd "$(dirname "$0")/.." || exit 1

# Parse command line arguments
COMMAND="${1:-test}"
TEST_TYPE="${2:-unit}"

echo "📋 Command: $COMMAND"
echo "📋 Test type: $TEST_TYPE"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    docker compose down 2>/dev/null || true
}
trap cleanup EXIT

# Start services
echo ""
echo "🐳 Starting services (PostgreSQL, Nakama)..."
docker compose up -d postgres nakama

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."

# Wait for PostgreSQL
MAX_WAIT=30
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker compose exec postgres pg_isready -U postgres -d nakama 2>/dev/null; then
        echo "✅ PostgreSQL is healthy"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo "  Waiting for PostgreSQL... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 2
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ PostgreSQL failed to become healthy within ${MAX_WAIT}s"
    exit 1
fi

# Wait for Nakama
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker compose exec nakama /nakama/nakama healthcheck 2>/dev/null; then
        echo "✅ Nakama is healthy"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo "  Waiting for Nakama... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 2
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ Nakama failed to become healthy within ${MAX_WAIT}s"
    exit 1
fi

echo ""
echo "🎉 All services are healthy!"

# Set environment for tests
export NAKAMA_HOST=localhost
export NAKAMA_PORT=7350
export NAKAMA_SERVER_KEY=defaultkey
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=changeme
export TEST_DB_NAME=nakama

echo ""
echo "🔧 Test environment:"
echo "  NAKAMA_HOST=$NAKAMA_HOST"
echo "  NAKAMA_PORT=$NAKAMA_PORT"
echo "  TEST_DB_HOST=$TEST_DB_HOST"
echo "  TEST_DB_PORT=$TEST_DB_PORT"

# Run migrations if needed
if [ "$COMMAND" = "migrate" ] || [ "$COMMAND" = "test" ]; then
    echo ""
    echo "📜 Running database migrations..."
    for migration in backend/data/*.sql 2>/dev/null; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            echo "  Running: $filename"
            docker compose exec postgres psql -U postgres -d nakama < "$migration" || echo "  ⚠️  Migration had errors (may be expected)"
        fi
    done
fi

# Run the specified command
echo ""
case "$COMMAND" in
    migrate)
        echo "✅ Migrations complete"
        ;;

    unit)
        echo "🧪 Running unit tests..."
        cd backend && npm run test
        ;;

    integration)
        echo "🔗 Running integration tests..."
        cd backend && npm run test:integration 2>/dev/null || npm run test
        ;;

    coverage)
        echo "📊 Running tests with coverage..."
        cd backend && npm run test:coverage
        ;;

    test)
        echo "🧪 Running tests..."
        cd backend && npm run test
        ;;

    backend:dev)
        echo "🔧 Starting backend in development mode..."
        cd backend && npm run dev
        ;;

    *)
        echo "❓ Usage: $0 [command] [test_type]"
        echo ""
        echo "Commands:"
        echo "  migrate       - Run database migrations only"
        echo "  unit          - Run unit tests"
        echo "  integration   - Run integration tests"
        echo "  coverage      - Run tests with coverage report"
        echo "  test          - Run all tests (default)"
        echo "  backend:dev   - Start backend in development mode"
        echo ""
        echo "Test types (for integration/coverage):"
        echo "  unit, integration, coverage"
        echo ""
        echo "Example:"
        echo "  $0 test integration"
        echo "  $0 coverage"
        echo "  $0 backend:dev"
        exit 1
        ;;
esac

echo ""
echo "✅ Done!"
