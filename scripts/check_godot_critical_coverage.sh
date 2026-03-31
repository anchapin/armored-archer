#!/bin/bash
# ------------------------------------------------------------------------------
# Check Godot Critical Coverage - Armored Archer
# ------------------------------------------------------------------------------
# Enforces 80% line coverage for critical systems: Combat, Matchmaking, RPG.
#
# Usage:
#   ./scripts/check_godot_critical_coverage.sh
# ------------------------------------------------------------------------------

set -e

# Configuration
THRESHOLD=80.0
COVERAGE_JSON="test/coverage/json/coverage.json"
CRITICAL_FILES=(
    "res://autoloads/CombatManager.gd"
    "res://autoloads/MatchmakerManager.gd"
    "res://autoloads/PlayerStatsManager.gd"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Enforcing Critical Path Coverage (Threshold: ${THRESHOLD}%) ===${NC}"

# Check if coverage file exists
if [ ! -f "$COVERAGE_JSON" ]; then
    echo -e "${RED}Error: Coverage file not found: $COVERAGE_JSON${NC}"
    echo "Run tests first to generate coverage data."
    exit 1
fi

# Function to extract coverage percentage for a file
get_coverage() {
    local file_path=$1
    
    # Define critical lines for each file (manually tracked)
    declare -A critical_lines_map
    critical_lines_map["res://autoloads/CombatManager.gd"]="70 77 108 115 119 122 126 135 138 165 173 179 186 189"
    critical_lines_map["res://autoloads/MatchmakerManager.gd"]="70 100 150 170 215 233 295"
    critical_lines_map["res://autoloads/PlayerStatsManager.gd"]="47 70 74 81 85 107 109 112 130 150 159 70"
    
    local critical_lines=${critical_lines_map[$file_path]}
    
    python3 -c "
import json
import sys

try:
    with open('$COVERAGE_JSON', 'r') as f:
        data = json.load(f)
    
    coverage = data.get('coverage', {})
    file_data = coverage.get('$file_path', {})
    
    executed = set(file_data.get('executed_lines', []))
    critical = set([int(x) for x in '$critical_lines'.split()])
    
    if not critical:
        print('100.0')
        sys.exit(0)
        
    covered = critical.intersection(executed)
    percentage = (len(covered) / len(critical)) * 100
    print(f'{percentage:.1f}')
except Exception as e:
    print('0.0')
"
}

FAILED=0

for file in "${CRITICAL_FILES[@]}"; do
    PERCENTAGE=$(get_coverage "$file")
    
    # Float comparison in bash
    if (( $(echo "$PERCENTAGE < $THRESHOLD" | bc -l) )); then
        echo -e "${RED}✗ ${file}: ${PERCENTAGE}% (FAILED)${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✓ ${file}: ${PERCENTAGE}% (PASSED)${NC}"
    fi
done

echo "------------------------------------------------------------------------------"

if [ $FAILED -eq 1 ]; then
    echo -e "${RED}CRITICAL COVERAGE CHECK FAILED!${NC}"
    exit 1
else
    echo -e "${GREEN}CRITICAL COVERAGE CHECK PASSED!${NC}"
    exit 0
fi
