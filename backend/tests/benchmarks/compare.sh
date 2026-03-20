#!/bin/bash
set -e

# Benchmark Comparison Script
# Compares benchmark results against baseline using benchstat
# Usage: ./compare.sh [baseline.txt] [new.txt]
# Defaults: ./compare.sh (uses baseline.txt and new.txt in current directory)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default files
BASELINE_FILE="${1:-baseline.txt}"
NEW_FILE="${2:-new.txt}"
COMPARISON_FILE="comparison.txt"

echo -e "${BLUE}Benchmark Comparison Script${NC}"
echo "=============================="

# Check if files exist
if [ ! -f "$BASELINE_FILE" ]; then
    echo -e "${RED}Error: Baseline file '$BASELINE_FILE' not found${NC}"
    echo "Run benchmarks first: go test -bench=. -benchmem -run=^$ ./internal/rpc/... > baseline.txt"
    exit 1
fi

if [ ! -f "$NEW_FILE" ]; then
    echo -e "${RED}Error: New results file '$NEW_FILE' not found${NC}"
    echo "Run benchmarks first: go test -bench=. -benchmem -run=^$ ./internal/rpc/... > new.txt"
    exit 1
fi

# Install benchstat if not already installed
echo -e "${BLUE}Installing benchstat...${NC}"

# Add Go bin directory to PATH for benchstat
export PATH=$PATH:$HOME/go/bin

if ! command -v benchstat &> /dev/null; then
    echo "Installing benchstat from golang.org/x/perf/cmd/benchstat..."
    go install golang.org/x/perf/cmd/benchstat@latest
    echo -e "${GREEN}✓ benchstat installed${NC}"
else
    echo -e "${GREEN}✓ benchstat already installed${NC}"
fi

# Run benchstat comparison
echo ""
echo -e "${BLUE}Comparing benchmark results...${NC}"
echo "Baseline: $BASELINE_FILE"
echo "New:      $NEW_FILE"
echo ""

# Save comparison to file
benchstat "$BASELINE_FILE" "$NEW_FILE" > "$COMPARISON_FILE"
cat "$COMPARISON_FILE"

# Check for performance regressions (>10%)
echo ""
echo -e "${BLUE}Checking for performance regressions...${NC}"

# Parse benchstat output for regressions
# benchstat uses ~ to indicate statistically significant changes
# Look for lines with ~ followed by +XX% (regression)
if grep "~" "$COMPARISON_FILE" | grep -E "\+\s*[1-9][0-9]\.\d+%|+\s*100\.\d+%|+\s*[1-9][0-9][0-9]\.\d+%" > /dev/null 2>&1; then
    echo -e "${RED}✗ Performance regression detected!${NC}"
    echo ""
    echo "Regressed benchmarks:"
    grep "~" "$COMPARISON_FILE" | grep -E "\+\s*[1-9][0-9]\.\d+%|+\s*100\.\d+%|+\s*[1-9][0-9][0-9]\.\d+%" | while read -r line; do
        echo -e "${RED}  $line${NC}"
    done
    echo ""
    echo -e "${YELLOW}Performance regression threshold: >10%${NC}"
    echo "Please investigate before merging."
    exit 1
elif grep "~" "$COMPARISON_FILE" | grep -E "\+\s*[1-9]\.\d+%|+\s*10\.0+%|+\s*10\.\d+%|+\s*11\.\d+%|+\s*12\.\d+%|+\s*13\.\d+%|+\s*14\.\d+%|+\s*15\.\d+%|+\s*16\.\d+%|+\s*17\.\d+%|+\s*18\.\d+%|+\s*19\.\d+%" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Warning: Performance regression detected (>10%)${NC}"
    echo ""
    echo "Regressed benchmarks:"
    grep "~" "$COMPARISON_FILE" | grep -E "\+\s*[1-9]\.\d+%|+\s*10\.0+%|+\s*10\.\d+%|+\s*11\.\d+%|+\s*12\.\d+%|+\s*13\.\d+%|+\s*14\.\d+%|+\s*15\.\d+%|+\s*16\.\d+%|+\s*17\.\d+%|+\s*18\.\d+%|+\s*19\.\d+%" | while read -r line; do
        echo -e "${YELLOW}  $line${NC}"
    done
    echo ""
    echo -e "${YELLOW}Performance regression threshold: >10%${NC}"
    echo "Please investigate before merging."
    exit 1
else
    echo -e "${GREEN}✓ No significant performance regressions detected${NC}"
    echo ""
    # Show improvements if any
    if grep "~" "$COMPARISON_FILE" | grep -E "\-\s*[1-9]\.\d+%|-\s*[1-9][0-9]\.\d+%" > /dev/null 2>&1; then
        echo "Performance improvements:"
        grep "~" "$COMPARISON_FILE" | grep -E "\-\s*[1-9]\.\d+%|-\s*[1-9][0-9]\.\d+%" | while read -r line; do
            echo -e "${GREEN}  $line${NC}"
        done
    fi
fi

echo ""
echo -e "${GREEN}✓ Benchmark comparison complete${NC}"
echo "Comparison saved to: $COMPARISON_FILE"

# Function to update baseline (called manually or on main branch)
update_baseline() {
    echo -e "${BLUE}Updating baseline...${NC}"
    cp "$NEW_FILE" "$BASELINE_FILE"
    echo -e "${GREEN}✓ Baseline updated${NC}"
    echo "New baseline: $BASELINE_FILE"
}

# Export function for use in other scripts
export -f update_baseline
