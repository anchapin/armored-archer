#!/bin/bash
# Secrets Generation Script for Alpha Environment
# This script generates secure random values for all required secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Armored Archer - Alpha Secrets Generator"
echo "=========================================="
echo ""

# Function to generate secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 "$length" | tr -d '\n'
}

# Function to generate URL-safe secret
generate_url_safe_secret() {
    local length=${1:-32}
    openssl rand -base64 "$length" | tr -d '/+=' | tr -d '\n'
}

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}✗ openssl not found. Please install openssl.${NC}"
    exit 1
fi

echo -e "${BLUE}Generating secure random secrets for alpha environment...${NC}"
echo ""

# Generate secrets
echo "Generating secrets..."
NAKAMA_SERVER_KEY=$(generate_url_safe_secret 32)
NAKAMA_CONSOLE_PASSWORD=$(generate_secret 24)
POSTGRES_PASSWORD=$(generate_secret 32)
SESSION_ENCRYPTION_KEY=$(generate_url_safe_secret 32)
REFRESH_ENCRYPTION_KEY=$(generate_url_safe_secret 32)
TOKEN_ENCRYPTION_KEY=$(generate_url_safe_secret 32)

echo -e "${GREEN}✓ Secrets generated successfully${NC}"
echo ""

# Display generated secrets
echo "=========================================="
echo "Generated Secrets (DO NOT SHARE)"
echo "=========================================="
echo ""

echo -e "${YELLOW}# Nakama Configuration${NC}"
echo "NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY}"
echo "NAKAMA_CONSOLE_PASSWORD=${NAKAMA_CONSOLE_PASSWORD}"
echo ""

echo -e "${YELLOW}# Database Configuration${NC}"
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "DB_PASSWORD=${POSTGRES_PASSWORD}"
echo ""

echo -e "${YELLOW}# Session Configuration${NC}"
echo "SESSION_ENCRYPTION_KEY=${SESSION_ENCRYPTION_KEY}"
echo "REFRESH_ENCRYPTION_KEY=${REFRESH_ENCRYPTION_KEY}"
echo "TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}"
echo ""

# Create .env.alpha file if it doesn't exist
ENV_FILE=".env.alpha"
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠ $ENV_FILE already exists. Creating backup...${NC}"
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
    echo -e "${GREEN}✓ Backup created${NC}"
fi

# Create .env.alpha file with generated secrets
echo "Creating $ENV_FILE..."
cat > "$ENV_FILE" << EOF
# ============================================
# Alpha Environment Configuration
# Generated: $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# ============================================

NODE_ENV=alpha

# ============================================
# Nakama Server Configuration
# ============================================
NAKAMA_SERVER_URL=localhost
NAKAMA_SERVER_PORT=7350
NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY}
NAKAMA_CONSOLE_PORT=7351
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=${NAKAMA_CONSOLE_PASSWORD}

# ============================================
# Database Configuration
# ============================================
POSTGRES_USER=postgres
POSTGRES_DB=nakama
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_ADDRESS=postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/nakama
DB_HOST=postgres
DB_PORT=5432
DB_NAME=nakama
DB_USER=postgres
DB_PASSWORD=${POSTGRES_PASSWORD}

# ============================================
# Session Configuration
# ============================================
SESSION_ENCRYPTION_KEY=${SESSION_ENCRYPTION_KEY}
REFRESH_ENCRYPTION_KEY=${REFRESH_ENCRYPTION_KEY}
TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
SESSION_EXPIRY_SEC=7200

# ============================================
# RevenueCat Configuration (Sandbox)
# ============================================
REVENUECAT_PUBLIC_API_KEY=your_revenuecat_sandbox_public_key_here
REVENUECAT_SECRET_API_KEY=your_revenuecat_sandbox_secret_key_here
REVENUECAT_PUBLIC_KEY=your_revenuecat_sandbox_public_key_here

# ============================================
# Firebase Configuration
# ============================================
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id_here
FIREBASE_AUTH_DOMAIN=your_project_id_here.firebaseapp.com
FIREBASE_DATABASE_URL=https://your_project_id_here.firebaseio.com
FIREBASE_STORAGE_BUCKET=your_project_id_here.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id_here

# ============================================
# Rate Limiting Configuration
# ============================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT_MAX_REQUESTS=200
RATE_LIMIT_DEFAULT_WINDOW_MS=60000

# ============================================
# Logger Configuration
# ============================================
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_OUTPUT=stdout

# ============================================
# Match Configuration
# ============================================
ALLOW_HOST_LOOPBACK=false

# ============================================
# Metrics Configuration
# ============================================
METRICS_NAMESPACE=nakama
METRICS_PREFIX=nakama
PROMETHEUS_PORT=9100

# ============================================
# Alerting Configuration
# ============================================
ALERTING_ENABLED=false
ALERTING_DEFAULT_PROVIDER=none
ALERTING_MIN_ENV_LEVEL=alpha
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
SLACK_CHANNEL=#alpha-alerts

# ============================================
# Alpha-Specific Configuration
# ============================================
ALPHA_BUILD_ID=alpha-001
ALPHA_VERSION=v2.1.0-alpha.1
ALPHA_DEBUG_ENABLED=true
ALPHA_TEST_USERS_ENABLED=true
ALPHA_MAX_TEST_USERS=100
EOF

echo -e "${GREEN}✓ $ENV_FILE created successfully${NC}"
echo ""

# Verify file is gitignored
echo "Verifying gitignore configuration..."
if git check-ignore -q "$ENV_FILE" 2>/dev/null; then
    echo -e "${GREEN}✓ $ENV_FILE is properly gitignored${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: $ENV_FILE is NOT gitignored!${NC}"
    echo "Add '$ENV_FILE' to .gitignore to prevent accidental commits."
fi
echo ""

# Display security reminder
echo "=========================================="
echo -e "${YELLOW}SECURITY REMINDER${NC}"
echo "=========================================="
echo ""
echo "1. Store this file securely - it contains sensitive secrets"
echo "2. Never commit $ENV_FILE to version control"
echo "3. Share secrets only through secure channels"
echo "4. Rotate secrets regularly (see SECRETS_ROTATION.md)"
echo "5. Use different secrets for each environment"
echo ""
echo "To use these secrets:"
echo "  cp $ENV_FILE .env"
echo "  Edit .env with production values"
echo ""
echo -e "${GREEN}Secret generation complete!${NC}"
