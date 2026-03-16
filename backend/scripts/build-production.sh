#!/bin/bash
# ============================================
# Production Build Script for Nakama Go Module
# Armored Archer - Alpha Deployment
# ============================================
# This script builds the Go module for production deployment
# with optimizations and verification steps.
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build configuration
BUILD_DIR="build"
OUTPUT_FILE="server.so"
BUILD_MODE="plugin"
GO_VERSION_REQUIRED="1.21"

# Parse arguments
VERBOSE=false
SKIP_VERIFY=false
OUTPUT_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        -o|--output)
            OUTPUT_NAME="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose      Show verbose output"
            echo "  --skip-verify      Skip post-build verification"
            echo "  -o, --output NAME  Specify output filename (default: server.so)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Set output filename
if [ -n "$OUTPUT_NAME" ]; then
    OUTPUT_FILE="$OUTPUT_NAME"
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Armored Archer - Production Build${NC}"
echo -e "${BLUE}  Go Module for Nakama Server${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function to log messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check Go version
log_step "Checking Go version..."
if ! command -v go &> /dev/null; then
    log_error "Go is not installed. Please install Go ${GO_VERSION_REQUIRED}+"
    exit 1
fi

GO_VERSION=$(go version | awk '{print $3}')
GO_VERSION_NUM=$(echo "$GO_VERSION" | sed 's/go//' | cut -d. -f1,2)

log_info "Go version: $GO_VERSION"

# Compare versions (simple check)
if [[ "$GO_VERSION_NUM" < "$GO_VERSION_REQUIRED" ]]; then
    log_error "Go version ${GO_VERSION_NUM} is below required ${GO_VERSION_REQUIRED}"
    exit 1
fi

# Create build directory
log_step "Creating build directory..."
mkdir -p "$BUILD_DIR"

# Set build environment
log_step "Setting build environment..."
export CGO_ENABLED=1
export GOOS=linux
export GOARCH=amd64

log_info "CGO_ENABLED=$CGO_ENABLED"
log_info "GOOS=$GOOS"
log_info "GOARCH=$GOARCH"

# Clean previous build
if [ -f "$BUILD_DIR/$OUTPUT_FILE" ]; then
    log_step "Removing previous build..."
    rm -f "$BUILD_DIR/$OUTPUT_FILE"
    log_info "Removed $BUILD_DIR/$OUTPUT_FILE"
fi

# Build the module
log_step "Building Go module with production optimizations..."
echo ""

BUILD_START=$(date +%s)

# Build with production flags
# -ldflags="-s -w" strips debug info for smaller binary
go build -buildmode=plugin -ldflags="-s -w" -o "$BUILD_DIR/$OUTPUT_FILE" ./cmd/server

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo ""
log_info "Build completed in ${BUILD_TIME}s"

# Verify build
if [ "$SKIP_VERIFY" = false ]; then
    log_step "Verifying build..."
    
    # Check file exists
    if [ ! -f "$BUILD_DIR/$OUTPUT_FILE" ]; then
        log_error "Build failed: Output file not found"
        exit 1
    fi
    
    # Check file type
    FILE_TYPE=$(file "$BUILD_DIR/$OUTPUT_FILE" | awk -F: '{print $2}' | xargs)
    log_info "File type: $FILE_TYPE"
    
    if [[ ! "$FILE_TYPE" =~ "shared object" ]]; then
        log_error "Build verification failed: Not a shared object file"
        exit 1
    fi
    
    # Get file size
    FILE_SIZE=$(du -h "$BUILD_DIR/$OUTPUT_FILE" | cut -f1)
    FILE_SIZE_BYTES=$(stat -c%s "$BUILD_DIR/$OUTPUT_FILE" 2>/dev/null || stat -f%z "$BUILD_DIR/$OUTPUT_FILE" 2>/dev/null)
    log_info "File size: $FILE_SIZE ($FILE_SIZE_BYTES bytes)"
    
    # Check size is reasonable (should be 5-15MB for Go plugin)
    if [ "$FILE_SIZE_BYTES" -lt 5000000 ] || [ "$FILE_SIZE_BYTES" -gt 15000000 ]; then
        log_warn "File size is outside expected range (5-15MB)"
    fi
    
    # Check binary architecture
    ARCH=$(readelf -h "$BUILD_DIR/$OUTPUT_FILE" 2>/dev/null | grep "Machine:" | awk '{print $2}' || echo "unknown")
    log_info "Architecture: $ARCH"
    
    if [ "$ARCH" != "X86-64" ] && [ "$ARCH" != "unknown" ]; then
        log_warn "Architecture might not match target (expected X86-64, got $ARCH)"
    fi
    
    log_info "Build verification passed"
fi

# Show build summary
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  Build Successful!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Output: ${GREEN}$BUILD_DIR/$OUTPUT_FILE${NC}"
echo -e "Size:   ${GREEN}$FILE_SIZE${NC}"
echo -e "Time:   ${GREEN}${BUILD_TIME}s${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Deploy to server: ./scripts/deploy-alpha.sh"
echo "  2. Or manually copy: scp $BUILD_DIR/$OUTPUT_FILE user@server:/opt/nakama/modules/"
echo "  3. Update Nakama config to load the module"
echo "  4. Restart Nakama service"
echo ""

if [ "$VERBOSE" = true ]; then
    log_info "Build artifacts:"
    ls -lh "$BUILD_DIR/"
    echo ""
    log_info "Go module info:"
    go list -m all | head -20
fi

exit 0
