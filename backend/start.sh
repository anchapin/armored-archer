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

# Start services
if command -v docker-compose &> /dev/null; then
    docker-compose up -d "$@"
else
    docker compose up -d "$@"
fi

echo ""
echo -e "${GREEN}✓ Services started successfully${NC}"
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
