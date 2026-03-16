#!/bin/bash
# TypeScript Backup Module Verification Script
# Verifies TypeScript module is available and can be built
# Usage: ./verify-typescript-backup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "TypeScript Backup Module Verification"
echo "=========================================="
echo ""

BACKUP_DIR="/opt/nakama/backup"
BUILD_DIR="./build"
SOURCE_DIR="./src"

# Check if running from backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ Error: Must run from backend directory${NC}"
    exit 1
fi

# Track verification status
VERIFICATION_PASSED=true

echo -e "${BLUE}Checking TypeScript source files...${NC}"
if [ -d "$SOURCE_DIR" ]; then
    echo -e "${GREEN}✓ TypeScript source directory exists${NC}"
    SOURCE_FILES=$(find "$SOURCE_DIR" -name "*.ts" | wc -l)
    echo "  Source files: $SOURCE_FILES"
else
    echo -e "${RED}✗ TypeScript source directory not found${NC}"
    VERIFICATION_PASSED=false
fi

echo ""
echo -e "${BLUE}Checking build directory...${NC}"
if [ -d "$BUILD_DIR" ]; then
    echo -e "${GREEN}✓ Build directory exists${NC}"
    BUILD_FILES=$(find "$BUILD_DIR" -name "*.js" | wc -l)
    echo "  Build files: $BUILD_FILES"
    
    # Check for main entry point
    if [ -f "$BUILD_DIR/index.js" ]; then
        echo -e "${GREEN}✓ Main entry point exists: $BUILD_DIR/index.js${NC}"
    else
        echo -e "${YELLOW}⚠ Main entry point not found (will be created on build)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Build directory not found (will be created on build)${NC}"
fi

echo ""
echo -e "${BLUE}Checking Node.js dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ node_modules directory exists${NC}"
else
    echo -e "${YELLOW}⚠ node_modules not found (run: npm install)${NC}"
fi

if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓ package-lock.json exists${NC}"
else
    echo -e "${YELLOW}⚠ package-lock.json not found${NC}"
fi

echo ""
echo -e "${BLUE}Verifying TypeScript configuration...${NC}"
if [ -f "tsconfig.json" ]; then
    echo -e "${GREEN}✓ tsconfig.json exists${NC}"
    
    # Check TypeScript compiler version
    if command -v npx &> /dev/null; then
        TS_VERSION=$(npx tsc --version 2>/dev/null || echo "unknown")
        echo "  TypeScript version: $TS_VERSION"
    fi
else
    echo -e "${RED}✗ tsconfig.json not found${NC}"
    VERIFICATION_PASSED=false
fi

echo ""
echo -e "${BLUE}Verifying webpack configuration...${NC}"
if [ -f "webpack.nakama.config.js" ]; then
    echo -e "${GREEN}✓ Webpack Nakama config exists${NC}"
else
    echo -e "${RED}✗ Webpack Nakama config not found${NC}"
    VERIFICATION_PASSED=false
fi

if [ -f "babel.config.js" ]; then
    echo -e "${GREEN}✓ Babel config exists${NC}"
else
    echo -e "${RED}✗ Babel config not found${NC}"
    VERIFICATION_PASSED=false
fi

echo ""
echo "=========================================="
echo "Build Test"
echo "=========================================="
echo ""

# Test build (optional - can be skipped)
if [ -t 1 ]; then
    read -p "Run test build? (y/n): " RUN_BUILD
    if [ "$RUN_BUILD" = "y" ] || [ "$RUN_BUILD" = "Y" ]; then
        echo -e "${BLUE}Running TypeScript build...${NC}"
        
        if npm run build 2>&1 | tee /tmp/build.log; then
            echo -e "${GREEN}✓ Build completed successfully${NC}"
            
            # Verify build output
            if [ -f "$BUILD_DIR/index.js" ]; then
                echo -e "${GREEN}✓ Build output verified${NC}"
            else
                echo -e "${RED}✗ Build output not found${NC}"
                VERIFICATION_PASSED=false
            fi
        else
            echo -e "${RED}✗ Build failed${NC}"
            VERIFICATION_PASSED=false
        fi
    else
        echo -e "${YELLOW}⊘ Build test skipped${NC}"
    fi
else
    # Non-interactive mode - skip build test
    echo -e "${YELLOW}⊘ Non-interactive mode, skipping build test${NC}"
fi

echo ""
echo "=========================================="
echo "Backup Directory Setup"
echo "=========================================="
echo ""

# Check/create backup directory
echo -e "${BLUE}Checking backup directory: $BACKUP_DIR${NC}"

if [ -d "$BACKUP_DIR" ]; then
    echo -e "${GREEN}✓ Backup directory exists${NC}"
    
    # List existing backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.ts" -o -name "*.js" 2>/dev/null | wc -l)
    echo "  Existing backup files: $BACKUP_COUNT"
else
    echo -e "${YELLOW}⚠ Backup directory does not exist${NC}"
    echo "  To create backup directory, run:"
    echo "  sudo mkdir -p $BACKUP_DIR"
    echo "  sudo chown \$USER:\$USER $BACKUP_DIR"
fi

echo ""
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""

if [ "$VERIFICATION_PASSED" = true ]; then
    echo -e "${GREEN}✓ TypeScript backup module verification PASSED${NC}"
    echo ""
    echo "TypeScript module is ready for rollback."
    echo ""
    echo "To create backup for rollback:"
    echo "  ./scripts/backup-typescript-module.sh"
    echo ""
    exit 0
else
    echo -e "${RED}✗ TypeScript backup module verification FAILED${NC}"
    echo ""
    echo "Issues detected that need to be resolved before rollback."
    echo "Review the errors above and fix them."
    echo ""
    exit 1
fi
