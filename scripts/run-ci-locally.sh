#!/usr/bin/env bash
# Run CI workflows locally using act sequentially
# This script runs all CI jobs one at a time to avoid:
# 1. npm cache corruption from parallel jobs
# 2. PostgreSQL port conflicts between services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# List of all CI jobs in order
JOBS=(
    "godot-validate"
    "backend-lint"
    "backend-typecheck"
    "backend-complexity"
    "python-lint"
    "gdscript-lint"
    "security-audit"
    "dependency-check"
    "bundle-size-check"
    "tech-debt-tracking"
    "dead-code-detection"
    "duplicate-code-detection"
    "agents-md-validation"
    "backend-n-plus-one"
    "n-plus-one-detection"
    "log-scrubbing"
    "backend-dead-flags"
    "backend-test"
    "schema-validation"
)

# Track results
PASSED=()
FAILED=()

echo "========================================"
echo "Running CI workflows locally with act"
echo "========================================"
echo ""

for job in "${JOBS[@]}"; do
    echo -e "${YELLOW}Running: $job${NC}"
    echo "----------------------------------------"

    if act -W .github/workflows/ci.yml -j "$job" --bind 2>&1 | tee /tmp/act-${job}.log | tail -3; then
        if grep -q "Job succeeded" /tmp/act-${job}.log 2>/dev/null; then
            echo -e "${GREEN}✓ $job PASSED${NC}"
            PASSED+=("$job")
        else
            echo -e "${RED}✗ $job FAILED (no success message)${NC}"
            FAILED+=("$job")
        fi
    else
        echo -e "${RED}✗ $job FAILED (exit code: $?)${NC}"
        FAILED+=("$job")
    fi
    echo ""
done

# Summary
echo "========================================"
echo "CI Run Summary"
echo "========================================"
echo -e "${GREEN}PASSED (${#PASSED[@]}):${NC}"
for job in "${PASSED[@]}"; do
    echo "  ✓ $job"
done

if [ ${#FAILED[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}FAILED (${#FAILED[@]}):${NC}"
    for job in "${FAILED[@]}"; do
        echo "  ✗ $job (see /tmp/act-${job}.log)"
    fi
    echo ""
    echo -e "${RED}Some CI jobs failed!${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}All CI jobs passed!${NC}"
    exit 0
fi
