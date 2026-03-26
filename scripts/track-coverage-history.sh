#!/bin/bash
set -e

# Track coverage history in git
# Records coverage metrics over time with git commit info

# Create data directory
mkdir -p data

# Get current coverage from Go
cd backend
go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./... > /dev/null 2>&1 || true

COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')

# Extract critical path coverage
CRITICAL_PACKAGES="combat matchmaking rpg"
CRITICAL_RAW=$(go tool cover -func=coverage.out | grep -E "($CRITICAL_PACKAGES)" | awk '{gsub(/%/, "", $3); sum+=$3; n++} END {printf "%.1f", n>0 ? sum/n : "0"}')
CRITICAL=${CRITICAL_RAW:-"0.0"}

# Extract package-level coverage for ALL packages
PACKAGE_COVERAGE=$(go tool cover -func=coverage.out | grep -v "^total:" | awk '{
    split($1, parts, ":")
    pkg = parts[1]
    gsub(/\/[^\/]+$/, "", pkg)
    coverage = $3
    gsub(/%/, "", coverage)

    pkg_count[pkg]++
    pkg_total[pkg] += coverage
} END {
    first = 1
    printf "{"
    for (p in pkg_count) {
        avg = pkg_total[p] / pkg_count[p]
        if (!first) printf ", "
        printf "\"%s\": %.1f", p, avg
        first = 0
    }
    printf "}"
}')

# Identify zero-coverage functions
ZERO_COVERAGE_FUNCS=$(go tool cover -func=coverage.out | awk '{
    coverage = $3
    gsub(/%/, "", coverage)
    if (coverage == "0.0") {
        printf "%s\n", $1
    }
}')

# Count functions
TOTAL_FUNCS=$(go tool cover -func=coverage.out | grep -v "^total:" | wc -l)
COVERED_FUNCS=$(go tool cover -func=coverage.out | grep -v "^total:" | awk '{
    coverage = $3
    gsub(/%/, "", coverage)
    if (coverage > "0") count++
} END {print count+0}')
UNCOVERED_FUNCS=$((TOTAL_FUNCS - COVERED_FUNCS))

cd ..

# Get git info
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Check for Godot test pass rate from history
GODOT_PASS_RATE=$(jq -r '.history[-1].godot_pass_rate // 0.0' data/coverage-history.json)
GODOT_TOTAL_TESTS=$(jq -r '.history[-1].godot_total_tests // 0' data/coverage-history.json)

# Update or create data/coverage-history.json
if [ -f data/coverage-history.json ]; then
    # Append to existing array
    tmp=$(mktemp)
    jq --arg commit "$COMMIT" \
       --arg branch "$BRANCH" \
       --arg date "$DATE" \
       --arg cov "$COVERAGE" \
       --arg crit "$CRITICAL" \
       --argjson packages "$PACKAGE_COVERAGE" \
       --arg godot_pass "$GODOT_PASS_RATE" \
       --arg godot_total "$GODOT_TOTAL_TESTS" \
       --arg total_funcs "$TOTAL_FUNCS" \
       --arg covered_funcs "$COVERED_FUNCS" \
       --arg uncovered_funcs "$UNCOVERED_FUNCS" \
       '.history += [{
         commit: $commit,
         branch: $branch,
         date: $date,
         overall: ($cov | tonumber),
         critical: ($crit | tonumber),
         packages: $packages,
         godot_pass_rate: ($godot_pass | tonumber),
         godot_total_tests: ($godot_total | tonumber),
         summary: {
           total_functions: ($total_funcs | tonumber),
           covered_functions: ($covered_funcs | tonumber),
           uncovered_functions: ($uncovered_funcs | tonumber)
         }
       }]' \
       data/coverage-history.json > "$tmp"
    mv "$tmp" data/coverage-history.json
else
    # Create new file
    cat > data/coverage-history.json << EOF
{
  "history": [
    {
      "commit": "$COMMIT",
      "branch": "$BRANCH",
      "date": "$DATE",
      "overall": $COVERAGE,
      "critical": $CRITICAL,
      "packages": $PACKAGE_COVERAGE,
      "godot_pass_rate": $GODOT_PASS_RATE,
      "godot_total_tests": $GODOT_TOTAL_TESTS,
      "summary": {
        "total_functions": $TOTAL_FUNCS,
        "covered_functions": $COVERED_FUNCS,
        "uncovered_functions": $UNCOVERED_FUNCS
      }
    }
  ]
}
EOF
fi

# Output trend analysis (last 5 entries)
echo "=== Coverage Trend (last 5 measurements) ==="
jq -r '.history[-5:] | reverse[] | "\(.date): \(.overall)% overall, \(.critical)% critical (\(.commit))"' data/coverage-history.json

echo ""
echo "=== Summary ==="
echo "Total functions: $TOTAL_FUNCS"
echo "Covered functions: $COVERED_FUNCS"
echo "Uncovered functions: $UNCOVERED_FUNCS"
