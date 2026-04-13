#!/bin/bash
# Helper script to manage CI services for local act testing
# Usage: .github/run-ci-services.sh [start|stop|status|restart]

set -e

SERVICES_FILE=".github/docker-compose.yml"
PROJECT_NAME="ci-armored-archer"

start_services() {
    echo "🚀 Starting CI services (PostgreSQL + Nakama)..."
    docker compose -f "$SERVICES_FILE" -p "$PROJECT_NAME" up -d
    echo ""
    echo "✅ Services started"
    echo ""
    echo "Services:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Nakama:    localhost:7350"
    echo ""
    echo "Run with act:"
    echo "  act -W .github/workflows/test.yml"
}

stop_services() {
    echo "🛑 Stopping CI services..."
    docker compose -f "$SERVICES_FILE" -p "$PROJECT_NAME" down
    echo "✅ Services stopped"
}

status_services() {
    echo "📊 CI services status:"
    docker compose -f "$SERVICES_FILE" -p "$PROJECT_NAME" ps
}

restart_services() {
    stop_services
    start_services
}

case "${1:-start}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    status)
        status_services
        ;;
    restart)
        restart_services
        ;;
    *)
        echo "Usage: $0 [start|stop|status|restart]"
        echo ""
        echo "  start   - Start CI services (default)"
        echo "  stop    - Stop CI services"
        echo "  status  - Show CI services status"
        echo "  restart - Restart CI services"
        exit 1
        ;;
esac
