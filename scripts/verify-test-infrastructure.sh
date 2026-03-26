#!/bin/bash
set -e

echo "======================================="
echo "🔍 Test Infrastructure Verification"
echo "======================================="
echo ""

# Track overall success
ALL_VALID=1

# Check 1: Unified test runner exists and is executable
echo "Checking unified test runner..."
if [ -x "scripts/test-all.sh" ]; then
    echo "✅ scripts/test-all.sh exists and is executable"
else
    echo "❌ scripts/test-all.sh missing or not executable"
    ALL_VALID=0
fi

# Check 2: Unified runner has race detector flag
echo "Checking race detector flag..."
if grep -q "go test.*-race" scripts/test-all.sh; then
    echo "✅ Race detector flag (-race) present in test-all.sh"
else
    echo "❌ Race detector flag missing from test-all.sh"
    ALL_VALID=0
fi

# Check 3: Unified runner has shuffle flag
echo "Checking shuffle flag..."
if grep -q "go test.*-shuffle=on" scripts/test-all.sh; then
    echo "✅ Shuffle flag (-shuffle=on) present in test-all.sh"
else
    echo "❌ Shuffle flag missing from test-all.sh"
    ALL_VALID=0
fi

# Check 4: Pyramid validation script exists
echo "Checking pyramid validation script..."
if [ -x "scripts/check-test-pyramid.sh" ]; then
    echo "✅ scripts/check-test-pyramid.sh exists and is executable"
else
    echo "❌ scripts/check-test-pyramid.sh missing or not executable"
    ALL_VALID=0
fi

# Check 5: Pyramid validation has correct tolerances
echo "Checking pyramid tolerances..."
if grep -q "UNIT_MIN=60" scripts/check-test-pyramid.sh && \
   grep -q "UNIT_MAX=80" scripts/check-test-pyramid.sh && \
   grep -q "INTEGRATION_MIN=10" scripts/check-test-pyramid.sh && \
   grep -q "INTEGRATION_MAX=30" scripts/check-test-pyramid.sh; then
    echo "✅ Pyramid tolerances correct (70±10%, 20±10%, 10±10%)"
else
    echo "❌ Pyramid tolerances incorrect"
    ALL_VALID=0
fi

# Check 6: CI workflow has race detector
echo "Checking CI workflow for race detector..."
if grep -q "go test.*-race" .github/workflows/ci.yml; then
    echo "✅ CI workflow has race detector flag"
else
    echo "❌ CI workflow missing race detector flag"
    ALL_VALID=0
fi

# Check 7: CI workflow has shuffle flag
echo "Checking CI workflow for shuffle flag..."
if grep -q "go test.*-shuffle=on" .github/workflows/ci.yml; then
    echo "✅ CI workflow has shuffle flag"
else
    echo "❌ CI workflow missing shuffle flag"
    ALL_VALID=0
fi

# Check 8: CI workflow has pyramid validation
echo "Checking CI workflow for pyramid validation..."
if grep -q "check-test-pyramid.sh" .github/workflows/ci.yml; then
    echo "✅ CI workflow has pyramid validation step"
else
    echo "❌ CI workflow missing pyramid validation step"
    ALL_VALID=0
fi

# Check 9: Test classification directories exist
echo "Checking test classification directories..."
if [ -d "backend/tests/unit" ] && \
   [ -d "backend/tests/integration" ] && \
   [ -d "backend/tests/e2e" ] && \
   [ -d "test/suites/integration" ] && \
   [ -d "test/suites/e2e" ]; then
    echo "✅ All test classification directories exist"
else
    echo "❌ Some test classification directories missing"
    ALL_VALID=0
fi

# Summary
echo ""
echo "======================================="
if [ $ALL_VALID -eq 1 ]; then
    echo "✅ All checks passed!"
    echo ""
    echo "Requirements satisfied:"
    echo "  FND-03: Unified test runner ✓"
    echo "  FND-04: Test pyramid enforcement ✓"
    echo "  FND-05: Race detector in CI ✓"
    echo "  FND-06: Test isolation via shuffle ✓"
    echo "======================================="
    exit 0
else
    echo "❌ Some checks failed - see details above"
    echo "======================================="
    exit 1
fi
