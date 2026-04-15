#!/bin/bash
# Serve the MVP Burndown Dashboard locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DASHBOARD_FILE="$PROJECT_ROOT/docs/mvp-burndown-dashboard.html"

# Check if dashboard file exists
if [ ! -f "$DASHBOARD_FILE" ]; then
    echo "Error: Dashboard file not found at $DASHBOARD_FILE"
    exit 1
fi

# Default port
PORT=${1:-8080}

echo "=========================================="
echo "  MVP Burndown Dashboard"
echo "=========================================="
echo ""
echo "Dashboard file: $DASHBOARD_FILE"
echo "Serving on: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Try Python 3 first, then Python 2
if command -v python3 &> /dev/null; then
    cd "$PROJECT_ROOT"
    python3 -m http.server "$PORT"
elif command -v python &> /dev/null; then
    cd "$PROJECT_ROOT"
    python -m SimpleHTTPServer "$PORT"
else
    echo "Error: Python is not installed or not in PATH"
    echo "Please install Python or use another HTTP server"
    exit 1
fi
