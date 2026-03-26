#!/bin/bash
set -e

# Gap Analysis Script
# Identifies functions with 0% coverage (ZERO_COVERAGE_FUNCS pattern)
# Identifies functions with 0% coverage by package for targeted testing
# Usage: gap-analysis.sh [--package <name>] [--sort-by <package|count>]

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

COVERAGE_FILE="backend/coverage/coverage.out"

# Parse arguments
TARGET_PACKAGE=""
SORT_BY="count"
OUTPUT_JSON=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --package)
            TARGET_PACKAGE="$2"
            shift 2
            ;;
        --sort-by)
            SORT_BY="$2"
            shift 2
            ;;
        --json)
            OUTPUT_JSON=1
            shift
            ;;
        -h|--help)
            echo "Usage: gap-analysis.sh [--package <name>] [--sort-by package|count] [--json]"
            echo ""
            echo "Options:"
            echo "  --package <name>  Filter by specific package name"
            echo "  --sort-by <type>  Sort output: 'count' (default) or 'package'"
            echo "  --json            Output in JSON format"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ ! -f "$COVERAGE_FILE" ]; then
    echo "ERROR: $COVERAGE_FILE not found. Run coverage generation first."
    echo "Run: cd backend && go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./..."
    exit 1
fi

# Need to run go tool cover from backend directory for module resolution
COVERAGE_FILE_ABS=$(realpath "$COVERAGE_FILE")
cd backend

# Function to get suggested fixtures for a package
get_suggested_fixtures() {
    local pkg=$1
    case $pkg in
        "rpg")
            echo "[\"testhelpers.NewPlayerBuilder()\"]"
            ;;
        "gear")
            echo "[\"testhelpers.NewGearBuilder()\"]"
            ;;
        "combat")
            echo "[\"testhelpers.NewMatchBuilder()\"]"
            ;;
        "matchmaking")
            echo "[\"testhelpers.NewMatchBuilder()\"]"
            ;;
        "store")
            echo "[\"testhelpers.NewTestCurrency()\"]"
            ;;
        *)
            echo "[\"N/A\"]"
            ;;
    esac
}

if [ "$OUTPUT_JSON" = "0" ]; then
    echo "=== Coverage Gap Analysis ==="
    echo ""
fi

# Extract all zero-coverage functions grouped by package
TEMP_GAPS=$(mktemp)

go tool cover -func="$COVERAGE_FILE_ABS" | awk '{
    coverage = $3
    gsub(/%/, "", coverage)

    if (coverage == "0.0") {
        # Extract package path (exclude filename)
        split($1, parts, ":")
        full_path = parts[1]
        split(full_path, pkg_parts, "/")
        package_name = ""
        found_internal = 0
        for (i = 1; i <= length(pkg_parts); i++) {
            if (found_internal) {
                if (i < length(pkg_parts)) {
                    if (package_name != "") package_name = package_name "/"
                    package_name = package_name pkg_parts[i]
                }
            }
            if (pkg_parts[i] == "internal") {
                found_internal = 1
            }
        }
        if (package_name == "") package_name = "internal"

        # Extract function name
        func = $2
        sub(/.*\//, "", func)

        # Count gaps per package
        gap_count[package_name]++
    }
} END {
    first = 1
    for (pkg in gap_count) {
        if (!first) printf "\n"
        printf "%s|%d\n", pkg, gap_count[pkg]
        first = 0
    }
}' > "$TEMP_GAPS"

# Apply package filter if specified
if [ -n "$TARGET_PACKAGE" ]; then
    FILTERED=$(mktemp)
    grep "$TARGET_PACKAGE" "$TEMP_GAPS" > "$FILTERED" || true
    mv "$FILTERED" "$TEMP_GAPS"
fi

# Sort based on --sort-by argument
if [ "$SORT_BY" = "package" ]; then
    sort "$TEMP_GAPS" > "$TEMP_GAPS.sorted"
else
    sort -t'|' -k2 -rn "$TEMP_GAPS" > "$TEMP_GAPS.sorted"
fi

TOTAL_UNCOVERED=0
TOTAL_PACKAGES=0

if [ "$OUTPUT_JSON" = "1" ]; then
    # Use a temporary file for JSON to avoid interleaving with other output
    JSON_TMP=$(mktemp)
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
        echo "  \"packages\": ["
    } > "$JSON_TMP"
fi

# Display results
FIRST_PKG=1
while IFS='|' read -r pkg count; do
    [ -z "$pkg" ] && continue

    TOTAL_UNCOVERED=$((TOTAL_UNCOVERED + count))
    TOTAL_PACKAGES=$((TOTAL_PACKAGES + 1))

    FIXTURES=$(get_suggested_fixtures "$pkg")

    if [ "$OUTPUT_JSON" = "1" ]; then
        if [ "$FIRST_PKG" = "0" ]; then echo "    ," >> "$JSON_TMP"; fi
        {
            echo "    {"
            echo "      \"package\": \"$pkg\","
            echo "      \"gap_count\": $count,"
            echo "      \"suggested_fixtures\": $FIXTURES,"
            echo "      \"functions\": ["
        } >> "$JSON_TMP"
        
        # Extract functions for this package
        go tool cover -func="$COVERAGE_FILE_ABS" | awk -v target="$pkg" '
            BEGIN { first_func = 1 }
            {
                coverage = $3
                gsub(/%/, "", coverage)
                if (coverage == "0.0") {
                    split($1, parts, ":")
                    full_path = parts[1]
                    if (full_path ~ "internal/" target) {
                        func_name = $2
                        sub(/.*\//, "", func_name)
                        if (!first_func) printf ",\n"
                        printf "        \"%s\"", func_name
                        first_func = 0
                    }
                }
            }
            END { printf "\n" }
        ' >> "$JSON_TMP"
        {
            echo "      ]"
            echo "    }"
        } >> "$JSON_TMP"
        FIRST_PKG=0
    else
        PKG_COLOR=$GREEN
        if [ "$count" -gt 10 ]; then
            PKG_COLOR=$RED
        elif [ "$count" -gt 5 ]; then
            PKG_COLOR=$YELLOW
        fi

        echo -e "${PKG_COLOR}${pkg}${NC}: ${count} uncovered functions (Fixtures: ${FIXTURES})"

        # Show individual functions if count <= 10 or in verbose mode
        if [ "$count" -le 10 ] || [ "$VERBOSE" = "1" ]; then
            go tool cover -func="$COVERAGE_FILE_ABS" | awk -v target="$pkg" '{
                coverage = $3
                gsub(/%/, "", coverage)
                if (coverage == "0.0") {
                    split($1, parts, ":")
                    full_path = parts[1]
                    if (full_path ~ "internal/" target) {
                        func = $2
                        sub(/.*\//, "", func)
                        printf "    - %s\n", func
                    }
                }
            }'
        fi
    fi

done < "$TEMP_GAPS.sorted"

if [ "$OUTPUT_JSON" = "1" ]; then
    {
        echo "  ],"
        echo "  \"summary\": {"
        echo "    \"total_packages\": $TOTAL_PACKAGES,"
        echo "    \"total_uncovered_functions\": $TOTAL_UNCOVERED"
        echo "  }"
        echo "}"
    } >> "$JSON_TMP"
    
    # Write to standard location
    mkdir -p coverage
    cp "$JSON_TMP" coverage/gaps.json
    
    # Output to stdout
    cat "$JSON_TMP"
    rm -f "$JSON_TMP"
else
    echo ""
    echo -e "${BLUE}Summary:${NC}"
    echo "  Total packages with gaps: $TOTAL_PACKAGES"
    echo "  Total uncovered functions: $TOTAL_UNCOVERED"

    # Suggest top 5 priority packages
    echo ""
    echo -e "${YELLOW}Top 5 Priority Packages for Testing:${NC}"
    head -5 "$TEMP_GAPS.sorted" | while IFS='|' read -r pkg count; do
        echo "  - $pkg ($count functions)"
    done
fi

# Clean up
rm -f "$TEMP_GAPS" "$TEMP_GAPS.sorted"

exit 0
