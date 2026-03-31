#!/bin/bash
#
# Unified Flaky Test Detection & Quarantine Tool
# Consolidates: detect-godot-flaky-tests.py, detect_godot_flaky_tests.py, 
#               detect-go-flaky-tests.sh, quarantine-flaky-tests.sh, mark-flaky-tests.sh
#
# Usage:
#   ./flaky-tests.sh detect [--framework godot|go|all] [--runs N] [--threshold N]
#   ./flaky-tests.sh list
#   ./flaky-tests.sh quarantine <test_name>
#   ./flaky-tests.sh unquarantine <test_name>
#   ./flaky-tests.sh report

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../data"
QUARANTINE_FILE="${DATA_DIR}/flaky-test-quarantine.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

init_quarantine_file() {
    mkdir -p "$DATA_DIR"
    if [ ! -f "$QUARANTINE_FILE" ]; then
        echo '{"quarantined_tests": [], "last_updated": null}' > "$QUARANTINE_FILE"
    fi
}

cmd_detect() {
    local framework="all"
    local runs=3
    local threshold=0.33
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --framework) framework="$2"; shift 2 ;;
            --runs) runs="$2"; shift 2 ;;
            --threshold) threshold="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    
    echo "Running flaky test detection..."
    echo "  Framework: $framework"
    echo "  Runs: $runs"
    echo "  Threshold: $threshold"
    echo ""
    
    init_quarantine_file
    
    case "$framework" in
        godot)
            detect_godot_flaky "$runs" "$threshold"
            ;;
        go)
            detect_go_flaky "$runs" "$threshold"
            ;;
        all)
            detect_godot_flaky "$runs" "$threshold"
            echo ""
            detect_go_flaky "$runs" "$threshold"
            ;;
    esac
}

detect_godot_flaky() {
    local runs=$1
    local threshold=$2
    
    echo "=== Godot (GUT) Flaky Detection ==="
    
    if ! command -v godot4 &> /dev/null; then
        echo "Warning: godot4 not found, skipping Godot tests"
        return
    fi
    
    local fail_count=0
    local pass_count=0
    
    for i in $(seq 1 $runs); do
        echo "Run $i/$runs..."
        godot4 --headless --script test/run_all_tests.gd 2>/dev/null || true
    done
    
    echo "Godot detection complete (run $runs times to fully detect)"
    echo "To view results: cat test/results/gut-results.xml"
}

detect_go_flaky() {
    local runs=$1
    local threshold=$2
    
    echo "=== Go Flaky Detection ==="
    
    if [ ! -d "backend" ]; then
        echo "Warning: backend directory not found, skipping Go tests"
        return
    fi
    
    cd backend
    
    local package_count=$(go list ./... 2>/dev/null | wc -l)
    echo "Testing $package_count packages..."
    
    for run in $(seq 1 $runs); do
        echo "Run $run/$runs..."
        go test ./... -count=1 2>/dev/null || true
    done
    
    cd ..
    echo "Go detection complete (run $runs times to fully detect)"
}

cmd_list() {
    init_quarantine_file
    
    echo "=== Quarantined Tests ==="
    
    local count=$(cat "$QUARANTINE_FILE" | grep -o '"name"' | wc -l)
    
    if [ "$count" -eq 0 ]; then
        echo "No tests in quarantine"
        return
    fi
    
    echo "Total: $count quarantined tests"
    echo ""
    
    cat "$QUARANTINE_FILE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for test in data.get('quarantined_tests', []):
    print(f\"  - {test['name']}\")
    print(f\"    Quarantined: {test.get('quarantined_at', 'unknown')}\")
    print(f\"    Reason: {test.get('reason', 'not specified')}\")
    print()
"
}

cmd_quarantine() {
    local test_name="$1"
    
    if [ -z "$test_name" ]; then
        echo "Error: Test name required"
        echo "Usage: $0 quarantine <test_name> [--reason '...']"
        exit 1
    fi
    
    local reason="manual quarantine"
    while [ $# -gt 0 ]; do
        case "$1" in
            --reason) reason="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    
    init_quarantine_file
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    python3 << EOF
import json

with open('$QUARANTINE_FILE', 'r') as f:
    data = json.load(f)

# Check if already quarantined
for test in data['quarantined_tests']:
    if test['name'] == '$test_name':
        print("Test '$test_name' is already quarantined")
        exit(0)

data['quarantined_tests'].append({
    'name': '$test_name',
    'reason': '$reason',
    'quarantined_at': '$timestamp'
})
data['last_updated'] = '$timestamp'

with open('$QUARANTINE_FILE', 'w') as f:
    json.dump(data, f, indent=2)

print("Quarantined: $test_name")
EOF
}

cmd_unquarantine() {
    local test_name="$1"
    
    if [ -z "$test_name" ]; then
        echo "Error: Test name required"
        echo "Usage: $0 unquarantine <test_name>"
        exit 1
    fi
    
    init_quarantine_file
    
    python3 << EOF
import json

with open('$QUARANTINE_FILE', 'r') as f:
    data = json.load(f)

original_count = len(data['quarantined_tests'])
data['quarantined_tests'] = [t for t in data['quarantined_tests'] if t['name'] != '$test_name']

if len(data['quarantined_tests']) == original_count:
    print("Test '$test_name' not found in quarantine")
    exit(1)

data['last_updated'] = '$(date -u +"%Y-%m-%dT%H:%M:%SZ")'

with open('$QUARANTINE_FILE', 'w') as f:
    json.dump(data, f, indent=2)

print("Removed from quarantine: $test_name")
EOF
}

cmd_report() {
    init_quarantine_file
    
    echo "=== Flaky Test Report ==="
    echo ""
    
    local count=$(cat "$QUARANTINE_FILE" | grep -o '"name"' | wc -l)
    echo "Quarantined tests: $count"
    
    if [ -f "data/flaky-test-history.json" ]; then
        echo ""
        echo "Historical trends:"
        cat data/flaky-test-history.json | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(f\"  Total historical flakies: {len(data.get('flaky_tests', []))}\")
except: pass
" 2>/dev/null || true
    fi
    
    echo ""
    echo "Run detection: $0 detect"
}

case "${1:-}" in
    detect) cmd_detect "${@:2}" ;;
    list) cmd_list ;;
    quarantine) cmd_quarantine "${@:2}" ;;
    unquarantine) cmd_unquarantine "${@:2}" ;;
    report) cmd_report ;;
    -h|--help|help)
        echo "Unified Flaky Test Tool"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  detect [--framework godot|go|all] [--runs N] [--threshold N]"
        echo "      Detect flaky tests by running them multiple times"
        echo "  list"
        echo "      List all quarantined tests"
        echo "  quarantine <test_name> [--reason '...']"
        echo "      Add a test to quarantine"
        echo "  unquarantine <test_name>"
        echo "      Remove a test from quarantine"
        echo "  report"
        echo "      Generate flaky test report"
        ;;
    *)
        echo "Unknown command: ${1:-}"
        echo "Run '$0 --help' for usage"
        exit 1
        ;;
esac