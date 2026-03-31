#!/bin/bash

# Profiling Script - Backend Performance Profiling
# This script provides easy access to various profiling tools for the backend
#
# Usage:
#   ./profile.sh [command] [options]
#
# Commands:
#   flame     - Run with 0x flame graph profiler
#   doctor    - Run with clinic doctor
#   bubble    - Run with clinic bubbleprof
#   inspect   - Run with Node inspector (for Chrome DevTools)
#   report    - Generate profiling report from running server
#
# Examples:
#   ./profile.sh flame     # Start server with 0x profiling
#   ./profile.sh doctor   # Start server with clinic doctor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_PORT=9229

# Load environment
if [ -f "$BACKEND_DIR/.env" ]; then
    export $(cat "$BACKEND_DIR/.env" | grep -v '^#' | xargs)
fi

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Check if required tools are installed
check_dependencies() {
    local missing=()

    if ! command -v node &> /dev/null; then
        missing+=("node")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        print_msg "$RED" "Error: Missing dependencies: ${missing[*]}"
        print_msg "$YELLOW" "Please install Node.js to use profiling tools."
        exit 1
    fi
}

# Build the backend first
build_backend() {
    print_msg "$BLUE" "Building backend..."
    cd "$BACKEND_DIR"
    npm run build
    print_msg "$GREEN" "Build complete."
}

# Run with 0x flame graph profiler
run_flame() {
    print_msg "$BLUE" "Starting server with 0x flame graph profiler..."
    print_msg "$YELLOW" "This will open a browser with flame graphs when the server starts."
    print_msg "$YELLOW" "Press Ctrl+C to stop."
    
    # Check if 0x is installed
    if ! npx 0x --version &> /dev/null; then
        print_msg "$YELLOW" "Installing 0x..."
        npm install -g 0x
    fi
    
    cd "$BACKEND_DIR"
    PROFILING_ENABLED=true npx 0x npm run dev
}

# Run with clinic doctor
run_doctor() {
    print_msg "$BLUE" "Starting server with clinic doctor..."
    print_msg "$YELLOW" "Doctor will analyze performance and provide recommendations."
    print_msg "$YELLOW" "Press Ctrl+C to stop and view report."
    
    # Check if clinic is installed
    if ! npx clinic doctor --version &> /dev/null; then
        print_msg "$YELLOW" "Installing clinic.js..."
        npm install -g clinic
    fi
    
    cd "$BACKEND_DIR"
    PROFILING_ENABLED=true npx clinic doctor -- node build/index.js
}

# Run with clinic flame
run_clinic_flame() {
    print_msg "$BLUE" "Starting server with clinic flame profiler..."
    print_msg "$YELLOW" "This will generate flame graph visualizations."
    print_msg "$YELLOW" "Press Ctrl+C to stop and view flame graph."
    
    # Check if clinic is installed
    if ! npx clinic flame --version &> /dev/null; then
        print_msg "$YELLOW" "Installing clinic.js..."
        npm install -g clinic
    fi
    
    cd "$BACKEND_DIR"
    PROFILING_ENABLED=true npx clinic flame -- node build/index.js
}

# Run with clinic bubbleprof
run_bubble() {
    print_msg "$BLUE" "Starting server with clinic bubbleprof..."
    print_msg "$YELLOW" "Bubbleprof shows async operations and event loop delays."
    print_msg "$YELLOW" "Press Ctrl+C to stop and view report."
    
    # Check if clinic is installed
    if ! npx clinic bubbleprof --version &> /dev/null; then
        print_msg "$YELLOW" "Installing clinic.js..."
        npm install -g clinic
    fi
    
    cd "$BACKEND_DIR"
    PROFILING_ENABLED=true npx clinic bubbleprof -- node build/index.js
}

# Run with Node inspector for Chrome DevTools
run_inspect() {
    print_msg "$BLUE" "Starting server with Node inspector..."
    print_msg "$YELLOW" "Connect Chrome DevTools to:"
    print_msg "$GREEN" "  chrome://inspect"
    print_msg "$YELLOW" "Or use the following command:"
    print_msg "$GREEN" "  node --inspect=0.0.0.0:$PROFILE_PORT build/index.js"
    print_msg "$YELLOW" "Press Ctrl+C to stop."
    
    cd "$BACKEND_DIR"
    PROFILING_ENABLED=true node --inspect=0.0.0.0:$PROFILE_PORT build/index.js
}

# Run with built-in V8 profiler
run_v8_profiler() {
    print_msg "$BLUE" "Starting server with V8 profiler..."
    print_msg "$YELLOW" "Logs will be written to *.log files."
    print_msg "$YELLOW" "Use --prof-process to analyze logs."
    
    cd "$BACKEND_DIR"
    PROFILING_ENABLED=true node --prof build/index.js
}

# Show help
show_help() {
    echo "Backend Profiling Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  flame        Run with 0x flame graph profiler"
    echo "  doctor      Run with clinic doctor"
    echo "  flame2      Run with clinic flame profiler"
    echo "  bubble      Run with clinic bubbleprof"
    echo "  inspect     Run with Node inspector for Chrome DevTools"
    echo "  v8          Run with V8 built-in profiler"
    echo "  help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PROFILING_ENABLED=true    Enable profiling instrumentation"
    echo "  PROFILING_SLOW_THRESHOLD_MS=100  Log operations slower than this"
    echo ""
    echo "Examples:"
    echo "  $0 flame          # Start with 0x profiling"
    echo "  $0 doctor        # Start with clinic doctor"
    echo "  $0 inspect       # Start with Node inspector"
}

# Main
main() {
    check_dependencies
    
    # Build first (except for help)
    if [ "$1" != "help" ] && [ "$1" != "-h" ] && [ "$1" != "--help" ]; then
        build_backend
    fi
    
    case "$1" in
        flame)
            run_flame
            ;;
        doctor)
            run_doctor
            ;;
        flame2)
            run_clinic_flame
            ;;
        bubble)
            run_bubble
            ;;
        inspect)
            run_inspect
            ;;
        v8)
            run_v8_profiler
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            print_msg "$RED" "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
