#!/bin/bash
# Run SeasonManager coverage tests and generate coverage reports

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
GODOT_BINARY="$PROJECT_ROOT/Godot_v4.0.3-stable_linux.x86_64"
TEST_SCENE="res://test/suites/autoloads/test_season_manager_coverage.gd"

echo "=========================================="
echo "Running SeasonManager Coverage Tests"
echo "=========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Godot Binary: $GODOT_BINARY"
echo "Test Scene: $TEST_SCENE"
echo ""

# Check if Godot binary exists
if [ ! -f "$GODOT_BINARY" ]; then
    echo "ERROR: Godot binary not found at $GODOT_BINARY"
    exit 1
fi

cd "$PROJECT_ROOT"

# Run the tests
echo "Starting Godot test runner..."
"$GODOT_BINARY" --headless --script "$TEST_SCENE" 2>&1 | tee test_output.log

echo ""
echo "=========================================="
echo "Test Execution Complete"
echo "=========================================="

# Check for coverage.json
if [ -f "test/coverage/json/coverage.json" ]; then
    echo "✓ coverage.json generated successfully"
    echo ""
    echo "SeasonManager coverage data:"
    python3 -c "
import json
with open('test/coverage/json/coverage.json') as f:
    data = json.load(f)
    if 'res://autoloads/SeasonManager.gd' in data:
        sm = data['res://autoloads/SeasonManager.gd']
        print(f'  File: {sm[\"file\"]}')
        print(f'  Coverage: {sm[\"covered_count\"]}/{sm[\"total_count\"]} ({sm[\"percentage\"]}%)')
        print(f'  Executed Lines: {sm[\"executed_lines\"]}')
    else:
        print('  ERROR: SeasonManager not in coverage.json')
" 2>/dev/null || echo "  (Could not parse coverage data)"
else
    echo "✗ coverage.json not generated"
fi

echo ""
echo "Test Results:"
if [ -f "test/results/gut-results.xml" ]; then
    echo "✓ Test results saved to test/results/gut-results.xml"
else
    echo "✗ Test results file not found"
fi
