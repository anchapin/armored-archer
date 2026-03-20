#!/bin/bash
set -e

# Track coverage history in git
# Records coverage metrics over time with git commit info

# Create data directory
mkdir -p data

# Get current coverage from Go
cd backend
go test -coverprofile=coverage.out -covermode=atomic \
    ./internal/combat \
    ./internal/rng \
    ./internal/circuitbreaker \
    ./internal/config \
    ./cmd/server \
    ./internal/rpc > /dev/null 2>&1 || true

COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
CRITICAL_RAW=$(go tool cover -func=coverage.out | grep -E "combat|matchmaking|rpg" | awk '{sum+=$3; n++} END {printf "%.1f", n>0 ? sum/n : 0}')
CRITICAL=${CRITICAL_RAW:-0.0}
cd ..

# Get git info
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Update or create data/coverage-history.json
if [ -f data/coverage-history.json ]; then
    # Append to existing array
    tmp=$(mktemp)
    jq --arg commit "$COMMIT" \
       --arg branch "$BRANCH" \
       --arg date "$DATE" \
       --arg cov "$COVERAGE" \
       --arg crit "$CRITICAL" \
       '.history += [{commit: $commit, branch: $branch, date: $date, overall: ($cov | tonumber), critical: ($crit | tonumber)}]' \
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
      "critical": $CRITICAL
    }
  ]
}
EOF
fi

# Output trend analysis (last 5 entries)
echo "=== Coverage Trend (last 5 measurements) ==="
jq -r '.history[-5:] | reverse[] | "\(.date): \(.overall)% overall, \(.critical)% critical (\(.commit))"' data/coverage-history.json
