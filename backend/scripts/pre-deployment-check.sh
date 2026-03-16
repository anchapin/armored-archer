#!/bin/bash
# ============================================
# Pre-Deployment Checklist Script
# Armored Archer - Go Module Deployment
# ============================================
# This script runs all pre-deployment checks to ensure
# the system is ready for Go module deployment.
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
GO_VERSION_REQUIRED="1.21"
MIN_DISK_SPACE_MB=1000
MIN_MEMORY_MB=512
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Parse arguments
VERBOSE=false
SKIP_NETWORK=false
QUIET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-network)
            SKIP_NETWORK=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Run pre-deployment checks for Go module deployment"
            echo ""
            echo "Options:"
            echo "  -v, --verbose       Show detailed output"
            echo "  --skip-network      Skip network connectivity checks"
            echo "  -q, --quiet         Only show failures"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Function to log messages
log_info() {
    [ "$QUIET" = true ] && return
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    [ "$QUIET" = true ] && return
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((CHECKS_WARNING++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((CHECKS_FAILED++))
}

log_step() {
    [ "$QUIET" = true ] && return
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_check() {
    local status=$1
    local message=$2
    
    if [ "$status" = "PASS" ]; then
        [ "$QUIET" = true ] && return
        echo -e "  ${GREEN}✓${NC} $message"
        ((CHECKS_PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "  ${RED}✗${NC} $message"
        ((CHECKS_FAILED++))
    elif [ "$status" = "WARN" ]; then
        [ "$QUIET" = true ] && return
        echo -e "  ${YELLOW}⚠${NC} $message"
        ((CHECKS_WARNING++))
    fi
}

log_success() {
    [ "$QUIET" = true ] && return
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Pre-Deployment Checklist${NC}"
echo -e "${BLUE}  Armored Archer - Go Module${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check 1: Go Version
log_step "Checking Go installation..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | awk '{print $3}')
    GO_VERSION_NUM=$(echo "$GO_VERSION" | sed 's/go//' | cut -d. -f1,2)
    
    if [[ "$GO_VERSION_NUM" >= "$GO_VERSION_REQUIRED" ]]; then
        log_check "PASS" "Go version: $GO_VERSION (required: $GO_VERSION_REQUIRED)"
    else
        log_check "FAIL" "Go version $GO_VERSION is below required $GO_VERSION_REQUIRED"
    fi
else
    log_check "FAIL" "Go is not installed"
fi

# Check 2: Build Directory
log_step "Checking build directory..."
if [ -d "build" ]; then
    log_check "PASS" "Build directory exists"
else
    log_check "FAIL" "Build directory not found"
fi

# Check 3: Go Module File
log_step "Checking Go module source..."
if [ -f "cmd/server/main.go" ]; then
    log_check "PASS" "Go module source found"
    
    # Check for InitModule function
    if grep -q "func InitModule" cmd/server/main.go; then
        log_check "PASS" "InitModule entry point found"
    else
        log_check "FAIL" "InitModule entry point not found"
    fi
else
    log_check "FAIL" "Go module source not found: cmd/server/main.go"
fi

# Check 4: Go Dependencies
log_step "Checking Go dependencies..."
if [ -f "go.mod" ]; then
    if go mod verify &> /dev/null; then
        log_check "PASS" "Go module dependencies verified"
    else
        log_check "FAIL" "Go module dependencies verification failed"
    fi
else
    log_check "FAIL" "go.mod not found"
fi

# Check 5: Build Script
log_step "Checking build scripts..."
if [ -x "scripts/build-production.sh" ]; then
    log_check "PASS" "Production build script exists and is executable"
elif [ -f "scripts/build-production.sh" ]; then
    log_check "WARN" "Production build script exists but not executable"
else
    log_check "FAIL" "Production build script not found"
fi

# Check 6: Environment Configuration
log_step "Checking environment configuration..."
if [ -f ".env.alpha" ]; then
    log_check "PASS" "Alpha environment file exists"
    
    # Check for required variables
    REQUIRED_VARS=("NAKAMA_SERVER_KEY" "SESSION_ENCRYPTION_KEY" "DATABASE_ADDRESS")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" .env.alpha 2>/dev/null; then
            value=$(grep "^$var=" .env.alpha | cut -d'=' -f2)
            if [[ "$value" == *"<"* ]] || [[ "$value" == *"CHANGE"* ]] || [[ "$value" == *"change"* ]]; then
                log_check "WARN" "Environment variable $var needs to be configured"
            else
                log_check "PASS" "Environment variable $var is set"
            fi
        else
            log_check "WARN" "Environment variable $var not found in .env.alpha"
        fi
    done
else
    log_check "WARN" ".env.alpha not found (using .env.alpha.example as reference)"
fi

# Check 7: Nakama Configuration
log_step "Checking Nakama configuration..."
if [ -f "data/nakama.alpha.yml" ]; then
    log_check "PASS" "Alpha Nakama configuration found"
    
    # Check for Go module entry point
    if grep -q "go_entrypoint" data/nakama.alpha.yml; then
        log_check "PASS" "Go module entry point configured"
    else
        log_check "WARN" "Go module entry point not found in config"
    fi
else
    log_check "WARN" "nakama.alpha.yml not found"
fi

# Check 8: Docker Configuration
log_step "Checking Docker configuration..."
if command -v docker &> /dev/null; then
    log_check "PASS" "Docker is installed"
    
    if docker compose version &> /dev/null || docker-compose version &> /dev/null; then
        log_check "PASS" "Docker Compose is installed"
    else
        log_check "WARN" "Docker Compose not found"
    fi
else
    log_check "WARN" "Docker not installed (skipping Docker checks)"
fi

# Check 9: Disk Space
log_step "Checking disk space..."
AVAILABLE_DISK=$(df -m . | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_DISK" -gt "$MIN_DISK_SPACE_MB" ]; then
    log_check "PASS" "Disk space: ${AVAILABLE_DISK}MB available (minimum: ${MIN_DISK_SPACE_MB}MB)"
else
    log_check "FAIL" "Disk space: ${AVAILABLE_DISK}MB available (minimum: ${MIN_DISK_SPACE_MB}MB)"
fi

# Check 10: Memory
log_step "Checking available memory..."
if command -v free &> /dev/null; then
    AVAILABLE_MEM=$(free -m | awk '/^Mem:/ {print $7}')
    if [ "$AVAILABLE_MEM" -gt "$MIN_MEMORY_MB" ]; then
        log_check "PASS" "Memory: ${AVAILABLE_MEM}MB available (minimum: ${MIN_MEMORY_MB}MB)"
    else
        log_check "WARN" "Memory: ${AVAILABLE_MEM}MB available (minimum: ${MIN_MEMORY_MB}MB)"
    fi
else
    log_check "WARN" "Cannot determine available memory"
fi

# Check 11: Network Connectivity (optional)
if [ "$SKIP_NETWORK" = false ]; then
    log_step "Checking network connectivity..."
    
    # Check if we can reach common endpoints
    if command -v curl &> /dev/null; then
        if curl -s --connect-timeout 5 https://github.com &> /dev/null; then
            log_check "PASS" "Internet connectivity verified"
        else
            log_check "WARN" "Cannot reach external endpoints (may be expected in restricted environments)"
        fi
    else
        log_check "WARN" "curl not available for network checks"
    fi
fi

# Check 12: SSH Access (if deploying to remote)
log_step "Checking SSH configuration..."
if command -v ssh &> /dev/null; then
    log_check "PASS" "SSH client is available"
    
    # Check for SSH keys
    if [ -f "$HOME/.ssh/id_ed25519.pub" ] || [ -f "$HOME/.ssh/id_rsa.pub" ]; then
        log_check "PASS" "SSH key found"
    else
        log_check "WARN" "No SSH key found (may be needed for deployment)"
    fi
else
    log_check "WARN" "SSH not available"
fi

# Check 13: Test Suite
log_step "Checking test suite..."
if [ -d "tests" ] || [ -d "test" ]; then
    log_check "PASS" "Test directory found"
else
    log_check "WARN" "Test directory not found"
fi

# Check 14: Deployment Scripts
log_step "Checking deployment scripts..."
DEPLOY_SCRIPTS=("deploy-alpha.sh" "health-check.sh" "verify-module-load.sh")
for script in "${DEPLOY_SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ]; then
        log_check "PASS" "Deployment script found: $script"
    else
        log_check "WARN" "Deployment script missing: $script"
    fi
done

# Summary
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Pre-Deployment Check Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "  Passed:   ${GREEN}$CHECKS_PASSED${NC}"
echo -e "  Warnings: ${YELLOW}$CHECKS_WARNING${NC}"
echo -e "  Failed:   ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ "$CHECKS_FAILED" -gt 0 ]; then
    echo -e "${RED}✗ Pre-deployment checks FAILED${NC}"
    echo ""
    echo "Please fix the failed checks before proceeding with deployment."
    exit 1
elif [ "$CHECKS_WARNING" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Pre-deployment checks passed with warnings${NC}"
    echo ""
    echo "You can proceed with deployment, but review the warnings above."
    exit 0
else
    echo -e "${GREEN}✓ All pre-deployment checks passed!${NC}"
    echo ""
    echo "System is ready for deployment."
    exit 0
fi
