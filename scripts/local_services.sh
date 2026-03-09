#!/bin/bash
#
# Local Services Management Script
# Manages Nakama and PostgreSQL for local development
#
# Usage:
#   ./local_services.sh start     - Start all services
#   ./local_services.sh stop      - Stop all services
#   ./local_services.sh restart   - Restart all services
#   ./local_services.sh status    - Show service status
#   ./local_services.sh logs      - Tail service logs
#   ./local_services.sh health    - Check service health
#   ./local_services.sh clean     - Stop and remove services + volumes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")/backend"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}Error: docker-compose.yml not found at $COMPOSE_FILE${NC}"
        exit 1
    fi
}

# Start services
start_services() {
    echo -e "${BLUE}Starting local services (Nakama + PostgreSQL)...${NC}"
    cd "$BACKEND_DIR"
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}Services started successfully!${NC}"
    echo ""
    echo "Endpoints:"
    echo "  - Nakama API:     http://localhost:7350"
    echo "  - Nakama Console: http://localhost:7351 (admin:password)"
    echo "  - PostgreSQL:     localhost:5432"
    echo ""
    echo "Run './local_services.sh health' to verify services are healthy."
}

# Stop services
stop_services() {
    echo -e "${BLUE}Stopping local services...${NC}"
    cd "$BACKEND_DIR"
    docker compose down
    echo -e "${GREEN}Services stopped.${NC}"
}

# Restart services
restart_services() {
    echo -e "${BLUE}Restarting local services...${NC}"
    cd "$BACKEND_DIR"
    docker compose restart
    echo -e "${GREEN}Services restarted.${NC}"
}

# Show status
show_status() {
    echo -e "${BLUE}Service Status:${NC}"
    cd "$BACKEND_DIR"
    docker compose ps
}

# Show logs
show_logs() {
    echo -e "${BLUE}Viewing service logs (Ctrl+C to exit)...${NC}"
    cd "$BACKEND_DIR"
    docker compose logs -f
}

# Health check
health_check() {
    echo -e "${BLUE}Running health checks...${NC}"
    echo ""
    
    # Docker container status
    echo -e "${BLUE}Container Status:${NC}"
    docker ps --filter "name=armored" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
    echo ""
    
    # Check Nakama
    echo -n "Checking Nakama API: "
    if curl -s --max-time 5 http://localhost:7350/ > /dev/null 2>&1; then
        echo -e "${GREEN}Healthy${NC}"
    else
        echo -e "${YELLOW}Not responding (may still be starting)${NC}"
    fi
    
    # Check PostgreSQL using the container name
    echo -n "Checking PostgreSQL: "
    if docker exec armored_archer_db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}Healthy${NC}"
    else
        # Try alternative container name
        if docker exec $(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1) pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}Healthy${NC}"
        else
            echo -e "${YELLOW}Not responding (may still be starting)${NC}"
        fi
    fi
    
    echo ""
    echo -e "${BLUE}Endpoints:${NC}"
    echo "  - Nakama API:     http://localhost:7350"
    echo "  - Nakama Console: http://localhost:7351 (admin:password)"
    echo "  - PostgreSQL:     localhost:5432"
}

# Clean up services and volumes
clean_services() {
    echo -e "${YELLOW}WARNING: This will remove all containers and data volumes!${NC}"
    echo -n "Continue? (y/N): "
    read -r confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        echo -e "${BLUE}Cleaning up services and volumes...${NC}"
        cd "$BACKEND_DIR"
        docker compose down -v
        echo -e "${GREEN}All services and volumes removed!${NC}"
    else
        echo -e "${YELLOW}Cancelled.${NC}"
    fi
}

# Main
main() {
    check_prerequisites
    
    case "${1:-}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        health)
            health_check
            ;;
        clean)
            clean_services
            ;;
        *)
            echo "Local Services Management Script"
            echo ""
            echo "Usage: $0 {start|stop|restart|status|logs|health|clean}"
            echo ""
            echo "Commands:"
            echo "  start   - Start Nakama and PostgreSQL containers"
            echo "  stop    - Stop all containers"
            echo "  restart - Restart all containers"
            echo "  status  - Show container status"
            echo "  logs    - Tail and follow container logs"
            echo "  health  - Check service health"
            echo "  clean   - Stop and remove containers + volumes"
            exit 1
            ;;
    esac
}

main "$@"
