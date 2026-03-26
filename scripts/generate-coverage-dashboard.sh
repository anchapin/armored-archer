#!/bin/bash
set -e

# Coverage Dashboard Generation Script
# Generates static HTML dashboard from coverage history JSON
# Usage: generate-coverage-dashboard.sh [--output <path>]

cd "$(dirname "$0")/.."

# Parse arguments
OUTPUT_FILE="docs/coverage-dashboard.html"

while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: generate-coverage-dashboard.sh [--output <path>]"
            echo ""
            echo "Options:"
            echo "  --output <path>  Output file path (default: docs/coverage-dashboard.html)"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Ensure output directory exists
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
mkdir -p "$OUTPUT_DIR"

# Helper functions for bash
function check_status() {
    local coverage=$1
    local threshold=$2
    if (( $(echo "$coverage >= $threshold" | bc -l) )); then
        echo "good"
    elif (( $(echo "$coverage >= $threshold * 0.8" | bc -l) )); then
        echo "warning"
    else
        echo "bad"
    fi
}

function check_class() {
    local coverage=$1
    local threshold=$2
    if (( $(echo "$coverage >= $threshold" | bc -l) )); then
        echo ""
    elif (( $(echo "$coverage >= $threshold * 0.8" | bc -l) )); then
        echo "warning"
    else
        echo "bad"
    fi
}

# Configuration files
HISTORY_FILE="data/coverage-history.json"
THRESHOLDS_FILE="data/coverage-thresholds.json"
GODOT_COVERAGE_FILE="test/coverage/json/coverage.json"

if [ ! -f "$HISTORY_FILE" ]; then
    echo "ERROR: $HISTORY_FILE not found"
    exit 1
fi

if [ ! -f "$THRESHOLDS_FILE" ]; then
    echo "ERROR: $THRESHOLDS_FILE not found"
    exit 1
fi

# Function: calculate_godot_coverage
# Calculate overall Godot line coverage percentage from coverage.json
function calculate_godot_coverage() {
    if [ ! -f "$GODOT_COVERAGE_FILE" ]; then
        echo "0.0"
        return
    fi

    TOTAL_COVERED=0
    TOTAL_LINES=0

    # Parse coverage.json and sum up covered/total lines
    while IFS= read -r line; do
        # Extract covered_count
        if echo "$line" | grep -q '"covered_count"'; then
            covered=$(echo "$line" | grep -oP '(?<="covered_count": )\d+')
            TOTAL_COVERED=$((TOTAL_COVERED + covered))
        fi

        # Extract total_count
        if echo "$line" | grep -q '"total_count"'; then
            total=$(echo "$line" | grep -oP '(?<="total_count": )\d+')
            TOTAL_LINES=$((TOTAL_LINES + total))
        fi
    done < "$GODOT_COVERAGE_FILE"

    # Calculate percentage
    if [ "$TOTAL_LINES" -eq 0 ]; then
        echo "0.0"
    else
        python3 -c "print(round($TOTAL_COVERED / $TOTAL_LINES * 100, 2))"
    fi
}

# Function: update_coverage_history
# Update coverage-history.json with latest Godot coverage
function update_coverage_history() {
    if [ ! -f "$GODOT_COVERAGE_FILE" ]; then
        echo "Warning: $GODOT_COVERAGE_FILE not found, skipping Godot coverage update"
        return
    fi

    # Calculate Godot coverage
    GODOT_PERCENTAGE=$(calculate_godot_coverage)

    # Get timestamp
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Read existing history
    HISTORY=$(cat "$HISTORY_FILE")

    # Get current latest entry
    LATEST=$(echo "$HISTORY" | jq '.history[-1]')

    # Create new entry with Godot coverage
    NEW_ENTRY=$(echo "$LATEST" | jq --arg timestamp "$TIMESTAMP" --argjson godot_coverage "$GODOT_PERCENTAGE" \
        '. + {timestamp: $timestamp, godot_line_coverage: $godot_coverage}')

    # Append new entry to history
    UPDATED_HISTORY=$(echo "$HISTORY" | jq --argjson new_entry "$NEW_ENTRY" '.history + [$new_entry]')

    # Maintain 10-entry window
    UPDATED_HISTORY=$(echo "$UPDATED_HISTORY" | jq 'if length > 10 then .[1:] else . end')

    # Write back to file
    jq -n --argjson history "$UPDATED_HISTORY" '{"history": $history}' > "$HISTORY_FILE"

    echo "Updated coverage history with Godot coverage: ${GODOT_PERCENTAGE}%"
}

# Load data into JSON for embedding
HISTORY_DATA=$(cat "$HISTORY_FILE")
THRESHOLDS_DATA=$(cat "$THRESHOLDS_FILE")

# Get latest coverage entry
LATEST=$(echo "$HISTORY_DATA" | jq '.history[-1]')
COMMIT=$(echo "$LATEST" | jq -r '.commit')
DATE=$(echo "$LATEST" | jq -r '.date')
OVERALL=$(echo "$LATEST" | jq -r '.overall')
CRITICAL=$(echo "$LATEST" | jq -r '.critical')
GODOT_PASS=$(echo "$LATEST" | jq -r '.godot_pass_rate // 0')

# Load thresholds
OVERALL_THRESHOLD=$(echo "$THRESHOLDS_DATA" | jq -r '.overall')
CRITICAL_THRESHOLD=$(echo "$THRESHOLDS_DATA" | jq -r '.critical')
GODOT_PASS_THRESHOLD=$(echo "$THRESHOLDS_DATA" | jq -r '.godot_pass_rate_threshold')
GODOT_LINE_THRESHOLD=$(echo "$THRESHOLDS_DATA" | jq -r '.godot_line_coverage_threshold')

# Calculate Godot line coverage
GODOT_LINE_COVERAGE=$(calculate_godot_coverage)

# Update coverage history with Godot coverage
update_coverage_history

# Reload history after update
HISTORY_DATA=$(cat "$HISTORY_FILE")
LATEST=$(echo "$HISTORY_DATA" | jq '.history[-1]')

# Calculate summary stats
TOTAL_FUNCS=$(echo "$LATEST" | jq -r '.summary.total_functions // 0')
COVERED_FUNCS=$(echo "$LATEST" | jq -r '.summary.covered_functions // 0')
UNCOVERED_FUNCS=$(echo "$LATEST" | jq -r '.summary.uncovered_functions // 0')

# Generate timestamp
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Generate HTML dashboard
cat > "$OUTPUT_FILE" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Dashboard - Armored Archer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }

        .meta {
            font-size: 14px;
            color: #bdc3c7;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .summary-card h3 {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 10px;
        }

        .summary-value {
            font-size: 32px;
            font-weight: bold;
        }

        .summary-value.good {
            color: #27ae60;
        }

        .summary-value.warning {
            color: #f39c12;
        }

        .summary-value.bad {
            color: #e74c3c;
        }

        .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .section h2 {
            font-size: 18px;
            margin-bottom: 15px;
            color: #2c3e50;
        }

        .progress-bar {
            width: 100%;
            height: 30px;
            background: #ecf0f1;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .progress-fill {
            height: 100%;
            background: #27ae60;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
        }

        .progress-fill.warning {
            background: #f39c12;
        }

        .progress-fill.bad {
            background: #e74c3c;
        }

        .threshold-marker {
            position: absolute;
            height: 30px;
            width: 2px;
            background: #2c3e50;
            z-index: 10;
        }

        .threshold-label {
            position: absolute;
            font-size: 12px;
            color: #2c3e50;
            top: 32px;
            transform: translateX(-50%);
        }

        .package-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }

        .package-card {
            border: 1px solid #ecf0f1;
            border-radius: 6px;
            padding: 15px;
        }

        .package-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            word-break: break-all;
        }

        .package-coverage {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .trend-chart {
            height: 200px;
            margin-top: 20px;
        }

        .trend-line {
            fill: none;
            stroke: #3498db;
            stroke-width: 2;
        }

        .trend-axis text {
            font-size: 12px;
            fill: #7f8c8d;
        }

        .trend-grid line {
            stroke: #ecf0f1;
            stroke-width: 1;
        }

        .footer {
            text-align: center;
            margin-top: 20px;
            color: #7f8c8d;
            font-size: 14px;
        }

        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }

        .badge.good {
            background: #d4edda;
            color: #155724;
        }

        .badge.warning {
            background: #fff3cd;
            color: #856404;
        }

        .badge.bad {
            background: #f8d7da;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Coverage Dashboard</h1>
            <div class="meta">
                <span>Generated: ${GENERATED_AT}</span> |
                <span>Last Update: ${DATE}</span> |
                <span>Commit: ${COMMIT}</span>
            </div>
        </header>

        <div class="summary">
            <div class="summary-card">
                <h3>Overall Coverage</h3>
                <div class="summary-value $(check_status ${OVERALL} ${OVERALL_THRESHOLD})">${OVERALL}%</div>
                <div>Threshold: ${OVERALL_THRESHOLD}%</div>
            </div>
            <div class="summary-card">
                <h3>Critical Path</h3>
                <div class="summary-value $(check_status ${CRITICAL} ${CRITICAL_THRESHOLD})">${CRITICAL}%</div>
                <div>Threshold: ${CRITICAL_THRESHOLD}%</div>
            </div>
            <div class="summary-card">
                <h3>Godot Pass Rate</h3>
                <div class="summary-value $(check_status ${GODOT_PASS} ${GODOT_PASS_THRESHOLD})">${GODOT_PASS}%</div>
                <div>Threshold: ${GODOT_PASS_THRESHOLD}%</div>
            </div>
            <div class="summary-card">
                <h3>Godot Line Coverage</h3>
                <div class="summary-value $(check_status ${GODOT_LINE_COVERAGE} ${GODOT_LINE_THRESHOLD})">${GODOT_LINE_COVERAGE}%</div>
                <div>Threshold: ${GODOT_LINE_THRESHOLD}%</div>
            </div>
            <div class="summary-card">
                <h3>Functions</h3>
                <div class="summary-value">${COVERED_FUNCS}/${TOTAL_FUNCS}</div>
                <div>Uncovered: ${UNCOVERED_FUNCS}</div>
            </div>
        </div>

        <div class="section">
            <h2>Overall Coverage Progress</h2>
            <div style="position: relative; margin-bottom: 30px;">
                <div class="progress-bar">
                    <div class="progress-fill $(check_class ${OVERALL} ${OVERALL_THRESHOLD})" style="width: ${OVERALL}%">${OVERALL}%</div>
                </div>
                <div class="threshold-marker" style="left: ${OVERALL_THRESHOLD}%"></div>
                <div class="threshold-label" style="left: ${OVERALL_THRESHOLD}%">Target: ${OVERALL_THRESHOLD}%</div>
            </div>
            <div id="trendChart" class="trend-chart"></div>
        </div>

        <div class="section">
            <h2>Godot Line Coverage</h2>
            <div style="position: relative; margin-bottom: 30px;">
                <div class="progress-bar">
                    <div class="progress-fill $(check_class ${GODOT_LINE_COVERAGE} ${GODOT_LINE_THRESHOLD})" style="width: ${GODOT_LINE_COVERAGE}%">${GODOT_LINE_COVERAGE}%</div>
                </div>
                <div class="threshold-marker" style="left: ${GODOT_LINE_THRESHOLD}%"></div>
                <div class="threshold-label" style="left: ${GODOT_LINE_THRESHOLD}%">Target: ${GODOT_LINE_THRESHOLD}%</div>
            </div>
            <div id="godotTrendChart" class="trend-chart"></div>
        </div>

        <div class="section">
            <h2>Package Coverage</h2>
            <div class="package-grid" id="packageGrid">
                <!-- Packages will be inserted here by JavaScript -->
            </div>
        </div>

        <div class="footer">
            <p>Generated by generate-coverage-dashboard.sh</p>
        </div>
    </div>

    <script>
        // Configuration data from JSON
        const historyData = ${HISTORY_DATA};
        const thresholdsData = ${THRESHOLDS_DATA};
        const latestData = ${LATEST};

        // Helper functions
        function getStatusClass(coverage, threshold) {
            if (coverage >= threshold) return 'good';
            if (coverage >= threshold * 0.8) return 'warning';
            return 'bad';
        }

        function getStatusText(coverage, threshold) {
            if (coverage >= threshold) return 'PASS';
            if (coverage >= threshold * 0.8) return 'WARNING';
            return 'FAIL';
        }

        function createProgressBar(coverage, threshold) {
            const status = getStatusClass(coverage, threshold);
            return \`
                <div class="progress-bar">
                    <div class="progress-fill \${status}" style="width: \${coverage}%">\${coverage}%</div>
                </div>
            \`;
        }

        // Render package grid
        function renderPackages() {
            const grid = document.getElementById('packageGrid');
            const packages = latestData.packages || {};

            Object.entries(packages)
                .sort((a, b) => b[1] - a[1])
                .forEach(([pkg, coverage]) => {
                    const pkgName = pkg.split('/').pop();
                    const status = getStatusClass(coverage, thresholdsData.overall);

                    const card = document.createElement('div');
                    card.className = 'package-card';
                    card.innerHTML = \`
                        <div class="package-name">\${pkgName}</div>
                        <div class="package-coverage \${status}">\${coverage}%</div>
                        \${createProgressBar(coverage, thresholdsData.overall)}
                        <span class="badge \${status}">\${getStatusText(coverage, thresholdsData.overall)}</span>
                    \`;
                    grid.appendChild(card);
                });
        }

        // Render trend chart
        function renderTrendChart() {
            const container = document.getElementById('trendChart');
            const history = historyData.history || [];

            if (history.length < 2) {
                container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 80px 0;">Insufficient data for trend chart</p>';
                return;
            }

            // Get last 10 entries
            const recent = history.slice(-10);

            // Calculate scales
            const minCoverage = Math.min(...recent.map(h => h.overall)) - 5;
            const maxCoverage = Math.max(...recent.map(h => h.overall)) + 5;
            const width = container.offsetWidth;
            const height = 200;
            const padding = 30;

            // Generate SVG
            let svg = \`<svg width="\${width}" height="\${height}">\`;

            // Grid lines
            for (let i = 0; i <= 4; i++) {
                const y = padding + (height - 2 * padding) * i / 4;
                const value = maxCoverage - (maxCoverage - minCoverage) * i / 4;
                svg += \`<line class="trend-grid" x1="\${padding}" y1="\${y}" x2="\${width - padding}" y2="\${y}"/>\`;
                svg += \`<text class="trend-axis" x="5" y="\${y + 4}">\${value.toFixed(0)}%</text>\`;
            }

            // Trend line
            let points = '';
            recent.forEach((entry, i) => {
                const x = padding + (width - 2 * padding) * i / (recent.length - 1);
                const y = padding + (height - 2 * padding) * (1 - (entry.overall - minCoverage) / (maxCoverage - minCoverage));
                points += \`\${x},\${y} \`;

                // Date labels
                const date = new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                svg += \`<text class="trend-axis" x="\${x}" y="\${height - 5}">\${date}</text>\`;
            });

            svg += \`<polyline class="trend-line" points="\${points.trim()}"/>\`;
            svg += '</svg>';

            container.innerHTML = svg;
        }

        // Render Godot trend chart
        function renderGodotTrendChart() {
            const container = document.getElementById('godotTrendChart');
            const history = historyData.history || [];

            if (history.length < 2) {
                container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 80px 0;">Insufficient data for trend chart</p>';
                return;
            }

            // Get last 10 entries
            const recent = history.slice(-10);

            // Filter entries with godot_line_coverage
            const godotHistory = recent.filter(h => h.godot_line_coverage !== undefined && h.godot_line_coverage !== null);

            if (godotHistory.length < 2) {
                container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 80px 0;">Insufficient Godot coverage data for trend chart</p>';
                return;
            }

            // Calculate scales
            const minCoverage = Math.min(...godotHistory.map(h => h.godot_line_coverage)) - 5;
            const maxCoverage = Math.max(...godotHistory.map(h => h.godot_line_coverage)) + 5;
            const width = container.offsetWidth;
            const height = 200;
            const padding = 30;

            // Generate SVG
            let svg = \`<svg width="\${width}" height="\${height}">\`;

            // Grid lines
            for (let i = 0; i <= 4; i++) {
                const y = padding + (height - 2 * padding) * i / 4;
                const value = maxCoverage - (maxCoverage - minCoverage) * i / 4;
                svg += \`<line class="trend-grid" x1="\${padding}" y1="\${y}" x2="\${width - padding}" y2="\${y}"/>\`;
                svg += \`<text class="trend-axis" x="5" y="\${y + 4}">\${value.toFixed(0)}%</text>\`;
            }

            // Trend line
            let points = '';
            godotHistory.forEach((entry, i) => {
                const x = padding + (width - 2 * padding) * i / (godotHistory.length - 1);
                const y = padding + (height - 2 * padding) * (1 - (entry.godot_line_coverage - minCoverage) / (maxCoverage - minCoverage));
                points += \`\${x},\${y} \`;

                // Date labels
                const date = new Date(entry.timestamp || entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                svg += \`<text class="trend-axis" x="\${x}" y="\${height - 5}">\${date}</text>\`;
            });

            svg += \`<polyline class="trend-line" points="\${points.trim()}"/>\`;
            svg += '</svg>';

            container.innerHTML = svg;
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            renderPackages();
            renderTrendChart();
            renderGodotTrendChart();
        });
    </script>
</body>
</html>
EOF

echo "Coverage dashboard generated: $OUTPUT_FILE"
