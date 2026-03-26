#!/bin/bash
set -e

# Track Mutation Score History in Git
# Records mutation testing metrics over time with git commit info

# Configuration
MUTATION_CONFIG="tests/quality/mutation_config.yaml"
FLAKY_QUARANTINE="../data/flaky-test-quarantine.json"
RUN_MUTATION_SCRIPT="../scripts/run-mutation-tests.sh"

# Default packages to test
DEFAULT_PACKAGES=(
    "internal/combat"
    "internal/matchmaking"
    "internal/rpg"
    "internal/store"
    "internal/season"
    "internal/notifications"
)

# Get package filter from command-line argument
if [ $# -gt 0 ]; then
    IFS=',' read -ra PACKAGES <<< "$1"
else
    PACKAGES=("${DEFAULT_PACKAGES[@]}")
fi

echo "=== Mutation Score History Tracking ==="
echo "Packages: ${PACKAGES[*]}"
echo ""

# Get git info
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Function to get package threshold from config
get_threshold() {
    local package=$1
    local threshold=$(grep -A 2 "^$package:" "$MUTATION_CONFIG" | grep "threshold:" | awk '{print $2}')
    echo "${threshold:-75}"  # Default to 75% if not found
}

# Function to extract score from mutation test output
extract_score_from_output() {
    local package=$1
    local threshold=$(get_threshold "$package")

    echo "Extracting score for: $package (threshold: ${threshold}%)"

    # Extract mutation score from the recent mutation test output
    local output
    output=$(cat /tmp/mutation-test-final.log 2>/dev/null || echo "")

    # Extract mutation score for this specific package
    local score_line=$(echo "$output" | grep -A 1 "Testing package:.*$package" | grep "The mutation score is" || echo "")
    local score=$(echo "$score_line" | grep -oP 'The mutation score is \K\d+\.?\d*' || echo "0")

    if [ -z "$score" ]; then
        echo "Warning: Could not extract mutation score for $package, using 0"
        score=0
    else
        # Convert to percentage
        score=$(echo "scale=2; $score * 100" | bc -l)
        score=$(printf "%.2f" "$score")
    fi

    echo "Score: ${score}%"

    # Compare against threshold
    local score_int=$(echo "$score" | cut -d. -f1)
    local threshold_int=$(echo "$threshold" | cut -d. -f1)

    if [ "$score_int" -lt "$threshold_int" ]; then
        echo "⚠️  Score ${score}% is below threshold ${threshold}%"
        # Check if critical package
        if [[ "$package" =~ (combat|matchmaking) ]]; then
            echo "ERROR: Critical package below threshold"
            return 1
        fi
    else
        echo "✓ Score ${score}% meets threshold ${threshold}%"
    fi

    echo "$score"
}

# Extract scores for each package
declare -A scores
declare -A thresholds
total_score=0
total_weight=0

echo "=== Extracting Mutation Scores ==="
echo ""

for package in "${PACKAGES[@]}"; do
    pkg_name=$(basename "$package")
    thresholds[$pkg_name]=$(get_threshold "$package")

    # Try to get score from recent go-mutesting output
    score=$(extract_score_from_output "$package" 2>/dev/null || echo "0")
    scores[$pkg_name]=$score

    # Weight calculation
    weight=10
    case "$pkg_name" in
        combat) weight=30 ;;
        matchmaking) weight=30 ;;
        rpg) weight=20 ;;
        store|season|notifications) weight=$((20/3)) ;;
    esac

    # Calculate weighted contribution
    weighted_score=$(echo "$score * $weight / 100" | bc -l)
    total_score=$(echo "$total_score + $weighted_score" | bc -l)
    total_weight=$((total_weight + weight))
done

# Calculate overall mutation score
if [ $total_weight -gt 0 ]; then
    overall_score=$(echo "scale=1; $total_score * 100 / $total_weight" | bc -l)
    overall_score=$(printf "%.1f" "$overall_score")
else
    overall_score=0.0
fi

echo ""
echo "=== Overall Mutation Score: ${overall_score}% ==="
echo ""

# Update or create data/coverage-history.json
mkdir -p data

if [ -f data/coverage-history.json ]; then
    # Append to existing array
    tmp=$(mktemp)
    jq --arg commit "$COMMIT" \
       --arg branch "$BRANCH" \
       --arg date "$DATE" \
       --arg overall "$overall_score" \
       --argjson scores_json "$(jq -n '{
         combat: ($combat | tonumber),
         matchmaking: ($matchmaking | tonumber),
         rpg: ($rpg | tonumber),
         store: ($store | tonumber),
         season: ($season | tonumber),
         notifications: ($notifications | tonumber)
       }' \
       --arg combat "${scores[combat]:-0}" \
       --arg matchmaking "${scores[matchmaking]:-0}" \
       --arg rpg "${scores[rpg]:-0}" \
       --arg store "${scores[store]:-0}" \
       --arg season "${scores[season]:-0}" \
       --arg notifications "${scores[notifications]:-0}")" \
       '.history += [{
         commit: $commit,
         branch: $branch,
         date: $date,
         mutation_score: {
           combat: ($scores_json.combat | tonumber),
           matchmaking: ($scores_json.matchmaking | tonumber),
           rpg: ($scores_json.rpg | tonumber),
           store: ($scores_json.store | tonumber),
           season: ($scores_json.season | tonumber),
           notifications: ($scores_json.notifications | tonumber),
           overall: ($overall | tonumber)
         }
       }]' \
       data/coverage-history.json > "$tmp"

    # Keep only last 30 entries
    jq '.history[-30:]' "$tmp" > data/coverage-history.json
    rm "$tmp"
else
    # Create new file
    cat > data/coverage-history.json << EOF
{
  "history": [
    {
      "commit": "$COMMIT",
      "branch": "$BRANCH",
      "date": "$DATE",
      "mutation_score": {
        "combat": ${scores[combat]:-0},
        "matchmaking": ${scores[matchmaking]:-0},
        "rpg": ${scores[rpg]:-0},
        "store": ${scores[store]:-0},
        "season": ${scores[season]:-0},
        "notifications": ${scores[notifications]:-0},
        "overall": $overall_score
      }
    }
  ]
}
EOF
fi

# Output trend analysis (last 5 entries)
echo "=== Mutation Score Trend (last 5 measurements) ==="
jq -r '.history[-5:] | reverse[] | select(.mutation_score != null) | "\(.date): \(.mutation_score.overall)% overall (\(.commit))"' data/coverage-history.json 2>/dev/null || echo "No mutation history available"

echo ""

# Highlight regressions and improvements
if [ $(jq '.history | length' data/coverage-history.json) -ge 2 ]; then
    echo "=== Trend Analysis ==="
    prev_score=$(jq -r '.history[-2].mutation_score.overall // 0' data/coverage-history.json)
    current_score=$overall_score

    diff=$(echo "$current_score - $prev_score" | bc -l)

    if (( $(echo "$diff < -5" | bc -l) )); then
        echo "⚠️  REGRESSION: Score decreased by $(echo "scale=1; $diff * -1" | bc)% ↘"
    elif (( $(echo "$diff > 0" | bc -l) )); then
        echo "✓ IMPROVEMENT: Score increased by $(echo "scale=1; $diff" | bc)% ↗"
    else
        echo "→ STABLE: Score unchanged"
    fi
fi

echo ""

# Check flaky test quarantine
if [ -f "$FLAKY_QUARANTINE" ]; then
    quarantined_count=$(jq 'length' "$FLAKY_QUARANTINE" 2>/dev/null || echo "0")
    if [ "$quarantined_count" -gt 0 ]; then
        echo "=== Flaky Test Quarantine ==="
        echo "Quarantined tests: $quarantined_count"
        echo "Note: Mutation testing respects quarantine - quarantined tests are skipped"
        echo ""
    fi
fi

echo "✅ Mutation history updated successfully"
