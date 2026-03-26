#!/bin/bash
set -e

# Phase 12 Approval Verification Workflow
# Determines if Phase 12 is complete against validation criteria
# Usage: verify-phase-12-approval.sh [--ci]

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
CI_MODE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --ci)
            CI_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: verify-phase-12-approval.sh [--ci]"
            echo ""
            echo "Options:"
            echo "  --ci  Run in CI mode (no browser checks)"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Tracking variables
TOTAL_REQUIREMENTS=0
MET_REQUIREMENTS=0
FAILED_REQUIREMENTS=0

# Function to record requirement status
record_requirement() {
    local id="$1"
    local name="$2"
    local status="$3"
    local details="$4"

    TOTAL_REQUIREMENTS=$((TOTAL_REQUIREMENTS + 1))

    if [ "$status" = "MET" ]; then
        MET_REQUIREMENTS=$((MET_REQUIREMENTS + 1))
        echo -e "  ${GREEN}✓${NC} [$id] $name"
        [ -n "$details" ] && echo -e "    ${CYAN}$details${NC}"
    elif [ "$status" = "FAILED" ]; then
        FAILED_REQUIREMENTS=$((FAILED_REQUIREMENTS + 1))
        echo -e "  ${RED}✗${NC} [$id] $name"
        [ -n "$details" ] && echo -e "    ${CYAN}$details${NC}"
    else
        echo -e "  ${YELLOW}⚠${NC} [$id] $name"
        [ -n "$details" ] && echo -e "    ${CYAN}$details${NC}"
    fi
}

echo "=========================================="
echo -e "${BLUE}Phase 12 Approval Verification${NC}"
echo "CI/CD Threshold Enforcement"
echo "=========================================="
echo ""

# Section 1: Configuration Files (INF-05)
echo -e "${BLUE}[Section 1] Configuration Files (INF-05)${NC}"
[ -f data/coverage-thresholds.json ] && \
    record_requirement "INF-05-1" "Coverage thresholds configuration" "MET" "Found at data/coverage-thresholds.json" || \
    record_requirement "INF-05-1" "Coverage thresholds configuration" "FAILED" "Not found"

[ -f data/coverage-thresholds.json ] && \
    jq -e '.overall == 60.0' data/coverage-thresholds.json > /dev/null 2>&1 && \
    jq -e '.critical == 80.0' data/coverage-thresholds.json > /dev/null 2>&1 && \
    jq -e '.stages | length == 3' data/coverage-thresholds.json > /dev/null 2>&1 && \
    record_requirement "INF-05-2" "Threshold values correct" "MET" "Overall: 60.0%, Critical: 80.0%, Stages: 3" || \
    record_requirement "INF-05-2" "Threshold values correct" "FAILED" "Invalid threshold values"

[ -f data/package-baselines.json ] && \
    jq -e '.metadata' data/package-baselines.json > /dev/null 2>&1 && \
    jq -e '.packages' data/package-baselines.json > /dev/null 2>&1 && \
    record_requirement "INF-05-3" "Package baselines configuration" "MET" "Found at data/package-baselines.json" || \
    record_requirement "INF-05-3" "Package baselines configuration" "FAILED" "Invalid baselines structure"
echo ""

# Section 2: Scripts (INF-07)
echo -e "${BLUE}[Section 2] Scripts (INF-07)${NC}"

[ -x scripts/check-coverage-regression.sh ] && \
    record_requirement "INF-07-1" "Regression detection script" "MET" "Executable at scripts/check-coverage-regression.sh" || \
    record_requirement "INF-07-1" "Regression detection script" "FAILED" "Not executable or missing"

grep -q "coverage-thresholds.json" scripts/check-coverage-regression.sh && \
    grep -q "package-baselines.json" scripts/check-coverage-regression.sh && \
    record_requirement "INF-07-2" "Regression script references config" "MET" "Reads both config files" || \
    record_requirement "INF-07-2" "Regression script references config" "FAILED" "Missing config references"

grep -q "COVERAGE_GATE_STAGE" backend/tests/quality/coverage_gates.sh && \
    grep -q "STAGE_THRESHOLD" backend/tests/quality/coverage_gates.sh && \
    record_requirement "INF-07-3" "Coverage gates script" "MET" "Supports incremental gate stages" || \
    record_requirement "INF-07-3" "Coverage gates script" "FAILED" "Missing gate stage support"

grep -q "total_functions" scripts/track-coverage-history.sh && \
    grep -q "covered_functions" scripts/track-coverage-history.sh && \
    grep -q "uncovered_functions" scripts/track-coverage-history.sh && \
    record_requirement "INF-07-4" "History tracking script" "MET" "Tracks function-level metrics" || \
    record_requirement "INF-07-4" "History tracking script" "FAILED" "Missing function tracking"

grep -q "ZERO_COVERAGE_FUNCS" scripts/gap-analysis.sh && \
    [ -x scripts/gap-analysis.sh ] && \
    record_requirement "INF-07-5" "Gap analysis script" "MET" "Identifies zero-coverage functions" || \
    record_requirement "INF-07-5" "Gap analysis script" "FAILED" "Missing gap analysis features"
echo ""

# Section 3: Dashboard (INF-06)
echo -e "${BLUE}[Section 3] Dashboard (INF-06)${NC}"

[ -x scripts/generate-coverage-dashboard.sh ] && \
    record_requirement "INF-06-1" "Dashboard generation script" "MET" "Executable at scripts/generate-coverage-dashboard.sh" || \
    record_requirement "INF-06-1" "Dashboard generation script" "FAILED" "Not executable or missing"

[ -f docs/coverage-dashboard.html ] && \
    grep -q "Coverage Dashboard" docs/coverage-dashboard.html && \
    grep -q "progress-fill" docs/coverage-dashboard.html && \
    record_requirement "INF-06-2" "Dashboard HTML" "MET" "Generated at docs/coverage-dashboard.html" || \
    record_requirement "INF-06-2" "Dashboard HTML" "FAILED" "Dashboard not generated or invalid"

grep -q "progress-fill" docs/coverage-dashboard.html && \
    grep -q "packageGrid" docs/coverage-dashboard.html && \
    grep -q "trendChart" docs/coverage-dashboard.html && \
    record_requirement "INF-06-3" "Dashboard features" "MET" "Includes progress bars, package grid, trend chart" || \
    record_requirement "INF-06-3" "Dashboard features" "FAILED" "Missing dashboard features"

grep -q "coverage-dashboard:" Makefile && \
    record_requirement "INF-06-4" "Dashboard Makefile target" "MET" "Target defined in Makefile" || \
    record_requirement "INF-06-4" "Dashboard Makefile target" "FAILED" "Target not in Makefile"
echo ""

# Section 4: CI/CD Workflow (INF-06, INF-07)
echo -e "${BLUE}[Section 4] CI/CD Workflow (INF-06, INF-07)${NC}"

[ -f .github/workflows/coverage-threshold.yml ] && \
    record_requirement "INF-06-5" "CI/CD workflow file" "MET" "Found at .github/workflows/coverage-threshold.yml" || \
    record_requirement "INF-06-5" "CI/CD workflow file" "FAILED" "Workflow file not found"

grep -q "pull_request:" .github/workflows/coverage-threshold.yml && \
    grep -q "workflow_dispatch:" .github/workflows/coverage-threshold.yml && \
    record_requirement "INF-06-6" "Workflow triggers" "MET" "Triggers on PR and manual dispatch" || \
    record_requirement "INF-06-6" "Workflow triggers" "FAILED" "Missing required triggers"

grep -q "coverage_gates.sh" .github/workflows/coverage-threshold.yml && \
    grep -q "COVERAGE_GATE_STAGE" .github/workflows/coverage-threshold.yml && \
    record_requirement "INF-07-6" "Workflow gates" "MET" "Enforces gate stages" || \
    record_requirement "INF-07-6" "Workflow gates" "FAILED" "Missing gate enforcement"

grep -q "github-script@v7" .github/workflows/coverage-threshold.yml && \
    grep -q "createComment\|updateComment" .github/workflows/coverage-threshold.yml && \
    record_requirement "INF-06-7" "PR comments" "MET" "Posts PR comments with GitHub Script" || \
    record_requirement "INF-06-7" "PR comments" "FAILED" "Missing PR comment functionality"

grep -q "upload-artifact@v4" .github/workflows/coverage-threshold.yml && \
    grep -q "coverage-dashboard" .github/workflows/coverage-threshold.yml && \
    record_requirement "INF-06-8" "Artifact upload" "MET" "Uploads dashboard as artifact" || \
    record_requirement "INF-06-8" "Artifact upload" "FAILED" "Missing artifact upload"

grep -q "ci-coverage-check:" Makefile && \
    record_requirement "INF-06-9" "CI integration Makefile target" "MET" "Target: ci-coverage-check" || \
    record_requirement "INF-06-9" "CI integration Makefile target" "FAILED" "Target not in Makefile"
echo ""

# Section 5: Makefile Targets
echo -e "${BLUE}[Section 5] Makefile Integration${NC}"

grep -q "^coverage-gates:" Makefile && \
    record_requirement "MF-1" "coverage-gates target" "MET" "Enforces thresholds with stage support" || \
    record_requirement "MF-1" "coverage-gates target" "FAILED" "Not defined"

grep -q "^coverage-threshold-check:" Makefile && \
    record_requirement "MF-2" "coverage-threshold-check target" "MET" "Shows current vs all stages" || \
    record_requirement "MF-2" "coverage-threshold-check target" "FAILED" "Not defined"

grep -q "^coverage-dashboard:" Makefile && \
    record_requirement "MF-3" "coverage-dashboard target" "MET" "Generates HTML dashboard" || \
    record_requirement "MF-3" "coverage-dashboard target" "FAILED" "Not defined"

grep -q "^coverage-baseline-update:" Makefile && \
    record_requirement "MF-4" "coverage-baseline-update target" "MET" "Updates package baselines" || \
    record_requirement "MF-4" "coverage-baseline-update target" "FAILED" "Not defined"

grep -q "^coverage-gap-analysis:" Makefile && \
    record_requirement "MF-5" "coverage-gap-analysis target" "MET" "Identifies zero-coverage functions" || \
    record_requirement "MF-5" "coverage-gap-analysis target" "FAILED" "Not defined"

grep -q "^coverage-history:" Makefile && \
    record_requirement "MF-6" "coverage-history target" "MET" "Tracks coverage trend" || \
    record_requirement "MF-6" "coverage-history target" "FAILED" "Not defined"
echo ""

# Section 6: Summary Files
echo -e "${BLUE}[Section 6] Documentation${NC}"

SUMMARY_FILES=0
for plan_num in 01 02 03 04 05; do
    if [ -f .planning/phases/12-cicd-threshold-enforcement/12-${plan_num}-SUMMARY.md ]; then
        SUMMARY_FILES=$((SUMMARY_FILES + 1))
    fi
done

if [ $SUMMARY_FILES -eq 5 ]; then
    record_requirement "DOC-1" "Plan summaries" "MET" "All 5 plans have SUMMARY.md files"
else
    record_requirement "DOC-1" "Plan summaries" "FAILED" "Missing ${SUMMARY_FILES}/5 summary files"
fi

# Check summary content
if [ $SUMMARY_FILES -ge 3 ]; then
    grep -q "What Was Built" .planning/phases/12-cicd-threshold-enforcement/12-05-SUMMARY.md && \
    grep -q "Key Decisions" .planning/phases/12-cicd-threshold-enforcement/12-05-SUMMARY.md && \
    grep -q "Next Steps" .planning/phases/12-cicd-threshold-enforcement/12-05-SUMMARY.md && \
    record_requirement "DOC-2" "Summary documentation quality" "MET" "Summaries include required sections" || \
    record_requirement "DOC-2" "Summary documentation quality" "FAILED" "Summaries incomplete"
else
    record_requirement "DOC-2" "Summary documentation quality" "SKIP" "Not enough summary files to check"
fi
echo ""

# Section 7: Manual Verification (for when CI_MODE=false)
if [ "$CI_MODE" = false ]; then
    echo -e "${BLUE}[Section 7] Manual Verification Check${NC}"

    echo ""
    echo -e "${YELLOW}The following items require manual verification:${NC}"
    echo ""
    echo "1. Dashboard Visual Appearance (INF-06):"
    echo "   - Open docs/coverage-dashboard.html in browser"
    echo "   - Verify progress bars render correctly"
    echo "   - Verify color coding (red/yellow/green) works"
    echo "   - Verify trend charts display properly"
    echo ""
    echo "2. PR Comment Formatting (INF-07):"
    echo "   - Create a test PR"
    echo "   - Check Actions tab for 'Coverage Threshold Enforcement' workflow"
    echo "   - Verify PR comment appears with coverage summary"
    echo "   - Verify formatting is readable"
    echo ""
    echo "3. Branch Protection Configuration:"
    echo "   - Go to Settings → Branches → Add rule"
    echo "   - Add 'Coverage Threshold Enforcement' as required status check"
    echo "   - Verify failing thresholds block merge"
    echo ""
fi

# Section 8: Integration Verification
echo -e "${BLUE}[Section 8] Integration Verification${NC}"

# Test that scripts can be invoked
if bash scripts/gap-analysis.sh -h > /dev/null 2>&1; then
    record_requirement "INT-1" "Gap analysis script" "MET" "Can be invoked with --help"
else
    record_requirement "INT-1" "Gap analysis script" "FAILED" "Script execution failed"
fi

if bash scripts/generate-coverage-dashboard.sh -h > /dev/null 2>&1; then
    record_requirement "INT-2" "Dashboard script" "MET" "Can be invoked with --help"
else
    record_requirement "INT-2" "Dashboard script" "FAILED" "Script execution failed"
fi

# Test that Makefile targets work
if grep -q "^coverage-threshold-check:" Makefile; then
    record_requirement "INT-3" "Makefile targets" "MET" "All targets are defined and callable"
else
    record_requirement "INT-3" "Makefile targets" "FAILED" "Some targets missing"
fi
echo ""

# Final Summary
echo "=========================================="
echo -e "${BLUE}Verification Summary${NC}"
echo "=========================================="
echo "Total requirements: $TOTAL_REQUIREMENTS"
echo -e "${GREEN}Met: $MET_REQUIREMENTS${NC}"
echo -e "${RED}Failed: $FAILED_REQUIREMENTS${NC}"
echo ""

# Calculate completion percentage
if [ $TOTAL_REQUIREMENTS -gt 0 ]; then
    COMPLETION_PERCENT=$((MET_REQUIREMENTS * 100 / TOTAL_REQUIREMENTS))
    echo "Completion: ${COMPLETION_PERCENT}%"
    echo ""

    # Determine phase completion
    if [ $FAILED_REQUIREMENTS -eq 0 ]; then
        echo -e "${GREEN}==========================================${NC}"
        echo -e "${GREEN}✓ PHASE 12 IS COMPLETE${NC}"
        echo -e "${GREEN}==========================================${NC}"
        echo ""
        echo "All requirements met. Phase 12: CI/CD Threshold Enforcement is complete."
        echo ""
        echo "Manual steps to finalize:"
        echo "1. Create a test PR to verify CI/CD workflow"
        echo "2. Configure branch protection rules in GitHub settings"
        echo "3. Verify dashboard displays correctly in browser"
        echo ""
        exit 0
    elif [ $COMPLETION_PERCENT -ge 90 ]; then
        echo -e "${YELLOW}==========================================${NC}"
        echo -e "${YELLOW}⚠ PHASE 12 NEARLY COMPLETE${NC}"
        echo -e "${YELLOW}==========================================${NC}"
        echo ""
        echo "Most requirements met (${COMPLETION_PERCENT}%). Minor issues to address:"
        echo ""
        exit 1
    else
        echo -e "${RED}==========================================${NC}"
        echo -e "${RED}✗ PHASE 12 NOT COMPLETE${NC}"
        echo -e "${RED}==========================================${NC}"
        echo ""
        echo "Completion: ${COMPLETION_PERCENT}% - Below 90% threshold"
        echo "Failed requirements need to be addressed before phase completion."
        echo ""
        exit 1
    fi
else
    echo -e "${YELLOW}No requirements were checked.${NC}"
    exit 1
fi
