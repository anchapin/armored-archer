#!/bin/bash
# Headless Client Performance Benchmark Runner (issue #1073)
#
# Generates the real-measurement snapshot consumed by the backend benchmark
# gate (cd backend && npm run test:benchmark). Runs the actual gameplay scene
# (scenes/main.tscn) in headless Godot and exports a PerformanceProfiler
# snapshot with real frame times, FPS, and static-memory usage.
#
# Usage:
#   ./scripts/run-headless-performance-benchmark.sh
#
# Environment:
#   GODOT_BINARY           - Godot 4.6 binary (default: godot4)
#   BENCHMARK_OUTPUT_PATH  - override snapshot output path
#   BENCHMARK_MIN_SECONDS  - override measurement window (default 10s)
#   ...see test/benchmark/headless_benchmark.gd for the full list

set -euo pipefail

GODOT_BINARY="${GODOT_BINARY:-godot4}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HARNESS_SCRIPT="$PROJECT_ROOT/test/benchmark/headless_benchmark.gd"
DEFAULT_OUTPUT="$PROJECT_ROOT/backend/tests/fixtures/performance/generated/headless_benchmark.snapshot.json"
OUTPUT_PATH="${BENCHMARK_OUTPUT_PATH:-$DEFAULT_OUTPUT}"

log_info()    { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_error()   { echo "❌ $1" >&2; }

if ! command -v "$GODOT_BINARY" &> /dev/null; then
    log_error "Godot binary '$GODOT_BINARY' not found in PATH."
    log_error "Set GODOT_BINARY or install Godot 4.6 (see AGENTS.md)."
    exit 1
fi

# Ensure the .godot import cache exists before any headless Godot run
# (fresh worktrees lack it; issue #991). Idempotent.
if [ ! -f "$PROJECT_ROOT/.godot/global_script_class_cache.cfg" ]; then
    log_info "Import cache missing - importing project assets once..."
    "$GODOT_BINARY" --headless --quit --import 2>&1 | tail -5 || true
fi

log_info "Running headless benchmark (this takes ~15-30s)..."
cd "$PROJECT_ROOT"
BENCHMARK_OUTPUT_PATH="$OUTPUT_PATH" \
    "$GODOT_BINARY" --headless --script "$HARNESS_SCRIPT"

if [ ! -f "$OUTPUT_PATH" ]; then
    log_error "Benchmark did not produce a snapshot at $OUTPUT_PATH"
    exit 1
fi

log_success "Snapshot written: $OUTPUT_PATH"
log_info "Now run the gate: cd backend && npm run test:benchmark"
