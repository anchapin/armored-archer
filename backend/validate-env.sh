#!/bin/bash
# Environment Variable Validation Script for Armored Archer Backend
# This script checks that all required environment variables are set before starting services

set -e

echo "Validating environment variables..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation status
VALIDATION_FAILED=false

# Function to check if variable is set and not empty
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local is_required=$2

    if [ -z "$var_value" ]; then
        if [ "$is_required" = "true" ]; then
            echo -e "${RED}✗ Required variable missing: $var_name${NC}"
            VALIDATION_FAILED=true
        else
            echo -e "${YELLOW}⚠ Optional variable not set: $var_name${NC}"
        fi
    else
        # Issue #1096: __SET_VIA_DOTENV__ is the docker-compose default that
        # fails loudly at nakama container startup; refuse it here too so
        # operators find out at the script-entry layer (cheaper, faster, no
        # container churn).
        if [ "$var_value" = "__SET_VIA_DOTENV__" ]; then
            echo -e "${RED}✗ $var_name is still the __SET_VIA_DOTENV__ placeholder (issue #1096)${NC}"
            VALIDATION_FAILED=true
        elif [[ "$var_value" == *"default"* ]] || [[ "$var_value" == *"changeme"* ]]; then
            echo -e "${YELLOW}⚠ Variable set with default value (change in production): $var_name${NC}"
        else
            echo -e "${GREEN}✓ $var_name${NC}"
        fi
    fi
}

# Check Nakama Configuration
echo ""
echo "Checking Nakama Configuration..."
check_var "NAKAMA_SERVER_KEY" "true"
check_var "NAKAMA_SERVER_PORT" "true"
check_var "NAKAMA_CONSOLE_PORT" "true"

# Check Database Configuration
echo ""
echo "Checking Database Configuration..."
check_var "POSTGRES_USER" "true"
check_var "POSTGRES_PASSWORD" "true"
check_var "POSTGRES_DB" "true"
check_var "DATABASE_ADDRESS" "true"

# Check Session Configuration
echo ""
echo "Checking Session Configuration..."
check_var "SESSION_ENCRYPTION_KEY" "true"
check_var "REFRESH_ENCRYPTION_KEY" "true"

# Check RevenueCat Configuration (optional)
echo ""
echo "Checking RevenueCat Configuration..."
check_var "REVENUECAT_PUBLIC_API_KEY" "false"
check_var "REVENUECAT_SECRET_API_KEY" "false"

# Check Firebase Configuration (optional)
echo ""
echo "Checking Firebase Configuration..."
check_var "FIREBASE_API_KEY" "false"
check_var "FIREBASE_PROJECT_ID" "false"

# Check Environment
echo ""
echo "Checking Environment..."
check_var "NODE_ENV" "true"

# Exit with error if validation failed
if [ "$VALIDATION_FAILED" = true ]; then
    echo ""
    echo -e "${RED}✗ Environment validation failed. Please set all required variables.${NC}"
    echo ""
    echo "Required variables:"
    echo "  NAKAMA_SERVER_KEY"
    echo "  NAKAMA_SERVER_PORT"
    echo "  NAKAMA_CONSOLE_PORT"
    echo "  POSTGRES_USER"
    echo "  POSTGRES_PASSWORD"
    echo "  POSTGRES_DB"
    echo "  DATABASE_ADDRESS"
    echo "  SESSION_ENCRYPTION_KEY"
    echo "  REFRESH_ENCRYPTION_KEY"
    echo "  NODE_ENV"
    echo ""
    echo "Copy .env.example to .env and fill in the required values:"
    echo "  cp .env.example .env"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Environment validation passed!${NC}"
exit 0
