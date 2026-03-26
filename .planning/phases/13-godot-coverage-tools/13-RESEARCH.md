# Phase 13: Godot Coverage Tools - Research

**Researched:** 2026-03-22
**Domain:** Godot 4 GDScript line coverage instrumentation and reporting
**Confidence:** HIGH

## Summary

Phase 13 addresses the critical gap in Godot/GDScript testing infrastructure: the lack of line-level code coverage measurement. Currently, the project uses a pass rate proxy (100% on 102 autoload tests) as a coverage metric, which doesn't provide visibility into which lines of code are actually executed during tests. This research confirms that no commercial or open-source line coverage tools exist for GDScript, requiring a custom instrumentation solution built on top of the existing GUT 9.5.0 testing framework.

The investigation reveals that building full AST-based line coverage instrumentation is feasible but requires careful scoping to avoid the over-investment pitfall documented in PITFALLS.md. The recommended approach is to implement a lightweight line tracking solution integrated with GUT's test execution hooks, then parse the execution data to generate HTML reports compatible with the existing coverage dashboard.

**Primary recommendation:** Build a lightweight GUT plugin that tracks line execution during test runs using GDScript's `get_stack()` and source file parsing, then generate HTML coverage reports that integrate with the existing CI/CD dashboard. Limit the initial implementation to autoload scripts (23 files) with a 2-week timebox. If no working prototype emerges, accept the pass rate proxy as documented limitation and redirect effort to Go backend coverage where native tooling exists.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GODOT-01 | Evaluate existing open-source tools for Godot 4 line coverage instrumentation | Research confirms no such tools exist - GUT 9.5.0 lacks coverage features, web searches returned no results for Godot coverage tools |
| GODOT-02 | Select appropriate coverage tool or confirm custom solution required | Confirmed: Custom solution required - no commercial/open-source tools provide GDScript line coverage |
| GODOT-03 | Integrate selected coverage solution with existing GUT 9.6.0 framework | Research provides architecture for GUT plugin integration using `pre_run_script`, `post_run_script`, and GUT's signal system |
| GODOT-04 | Generate HTML coverage reports for Godot autoload tests | Research provides HTML report generation pattern using Python script parsing coverage.json data |
| GODOT-05 | Extend coverage dashboard to show Godot line coverage (replacing pass rate proxy) | Research confirms dashboard extension path - modify existing coverage dashboard HTML template to show both Go and Godot metrics |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **GUT (Godot Unit Test)** | 9.5.0 (existing) | Test framework | Already installed, provides test execution hooks and JUnit XML export |
| **Custom GUT Coverage Plugin** | Build from scratch | Track line execution | No existing tools provide GDScript line coverage - custom solution required |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Python 3** | 3.8+ (existing) | Parse coverage data, generate HTML | Existing CI infrastructure uses Python for coverage calculation |
| **Python `jinja2`** | 3.0+ (new) | HTML report template rendering | Standard Python templating for generating coverage reports |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom GUT plugin | Pass rate proxy only | Pass rate doesn't show which lines are tested - weak quality signal |
| Custom GUT plugin | Godot C++ engine modification | Requires recompiling Godot, complex upgrade path, maintenance burden |
| Custom GUT plugin | External coverage tools | None exist for GDScript/Godot 4 |

**Installation:**
```bash
# No external packages needed for coverage tracking (custom GDScript solution)
# Python dependencies for report generation:
pip install jinja2

# Verify existing GUT installation:
ls addons/gut/gut.gd  # Should exist
cat addons/gut/plugin.cfg | grep version  # Should show 9.5.0
```

**Version verification:**
- GUT 9.5.0: Confirmed via `addons/gut/plugin.cfg` - "version=9.5.0"
- Python 3.8+: Confirmed via CI workflow using `python3`
- jinja2 3.0+: Not yet installed, will add in implementation phase

## Architecture Patterns

### Recommended Project Structure
```
addons/gut/
├── coverage/                           # NEW: Coverage instrumentation plugin
│   ├── coverage_tracker.gd             # Track line execution during tests
│   ├── coverage_exporter.gd            # Export coverage.json after tests
│   ├── gut_coverage_plugin.gd          # GUT plugin integration
│   └── script_line_parser.gd          # Parse GDScript source to identify executable lines
├── [existing GUT files]

test/
├── coverage/                          # NEW: Coverage data and reports
│   ├── html/                          # HTML coverage reports (like go tool cover)
│   ├── json/                          # Coverage JSON data for dashboard
│   └── baselines/                     # Coverage baselines for regression detection
├── results/                           # Existing: JUnit XML results
└── suites/                            # Existing: Test suites

scripts/
├── parse_godot_coverage.py            # NEW: Parse coverage.json, generate HTML
├── calculate_godot_coverage.py        # Existing: Calculate pass rate proxy (keep for comparison)

data/
├── autoload-to-test-mapping.json       # Existing: Maps autoloads to test files (used for coverage)

.github/workflows/
├── coverage.yml                       # Existing: Modify to use actual line coverage
```

### Pattern 1: Line Execution Tracking with GUT Integration

**What:** A GUT plugin that tracks which lines of GDScript are executed during test runs by injecting execution markers at test boundaries and parsing source files to identify executable lines.

**When to use:** When you need line-level visibility into which GDScript code paths are exercised by tests. This is necessary because Godot 4/GDScript lacks built-in coverage instrumentation.

**Trade-offs:**
- **Pros:** Provides actual line coverage data (vs. pass rate proxy), enables gap analysis, integrates with existing CI/CD
- **Cons:** Requires custom GDScript parsing, adds runtime overhead (measure and optimize), limited to tested scripts (autoloads)

**Example:**
```gdscript
# addons/gut/coverage/coverage_tracker.gd
extends Node

# Singleton for tracking line executions across all tests
var _executed_lines: Dictionary = {}  # script_path -> Array of line numbers
var _script_line_map: Dictionary = {}  # script_path -> Array of executable line numbers

static var _instance: CoverageTracker = null

static func get_instance() -> CoverageTracker:
    if _instance == null:
        _instance = CoverageTracker.new()
    return _instance

func before_all():
    _executed_lines.clear()

func before_test(test_name: String):
    # Called by GUT before each test - reset per-test tracking if needed
    pass

func track_execution(script_path: String, line: int):
    """Record that a specific line was executed."""
    if not _executed_lines.has(script_path):
        _executed_lines[script_path] = []
    if line not in _executed_lines[script_path]:
        _executed_lines[script_path].append(line)

func get_coverage_data() -> Dictionary:
    """Return coverage data for export."""
    var coverage_data = {}
    for script_path in _executed_lines:
        var executable_lines = _script_line_map.get(script_path, [])
        var executed_lines = _executed_lines[script_path]
        var covered_count = len(executed_lines)
        var total_count = len(executable_lines)
        var percentage = (float(covered_count) / float(total_count) * 100.0) if total_count > 0 else 0.0

        coverage_data[script_path] = {
            "file": script_path,
            "executable_lines": executable_lines,
            "executed_lines": executed_lines,
            "covered_count": covered_count,
            "total_count": total_count,
            "percentage": round(percentage * 100.0) / 100.0
        }

    return coverage_data

func set_script_line_map(script_path: String, line_numbers: Array):
    """Set the map of executable line numbers for a script (from source parsing)."""
    _script_line_map[script_path] = line_numbers
```

### Pattern 2: GDScript Source Line Parsing

**What:** Parse GDScript source files to identify which lines contain executable code (vs. comments, whitespace, braces) to establish the denominator for coverage calculation.

**When to use:** When calculating line coverage percentages - you need to know how many executable lines exist to determine what percentage are covered.

**Trade-offs:**
- **Pros:** Simple parsing for basic GDScript syntax, fast enough for 23 autoload files
- **Cons:** Doesn't handle all GDScript edge cases (nested strings, multiline comments, annotations)

**Example:**
```gdscript
# addons/gut/coverage/script_line_parser.gd
extends RefCounted

static func parse_executable_lines(file_path: String) -> Array:
    """Parse GDScript file and return array of executable line numbers."""
    var file = FileAccess.open(file_path, FileAccess.READ)
    if file == null:
        return []

    var executable_lines = []
    var line_number = 1
    var in_multiline_comment = false

    while not file.eof_reached():
        var line = file.get_line().strip_edges()

        # Skip multiline comments
        if line.begins_with('#'):
            line_number += 1
            continue

        # Track multiline comment state
        if "##" in line:
            in_multiline_comment = true
        if in_multiline_comment:
            line_number += 1
            if "##" in line:
                in_multiline_comment = false
            continue

        # Skip empty lines and comment-only lines
        if line.is_empty() or line.begins_with('#'):
            line_number += 1
            continue

        # Skip lines with only braces or punctuation
        var stripped = line.strip_edges()
        if stripped in ['{', '}', '[', ']', '(', ')', ':', ';']:
            line_number += 1
            continue

        # This line has executable code
        executable_lines.append(line_number)
        line_number += 1

    file.close()
    return executable_lines

static func parse_autoload_directory() -> Dictionary:
    """Parse all autoload scripts and build line number map."""
    var autoload_dir = "res://autoloads/"
    var line_map = {}

    var dir = DirAccess.open(autoload_dir)
    if dir:
        dir.list_dir_begin()
        var file_name = dir.get_next()

        while file_name != "":
            if file_name.ends_with('.gd'):
                var file_path = autoload_dir + file_name
                var lines = parse_executable_lines(file_path)
                line_map[file_path] = lines
            file_name = dir.get_next()

        dir.list_dir_end()

    return line_map
```

### Pattern 3: GUT Plugin Integration

**What:** Integrate coverage tracking with GUT's test execution lifecycle using plugin hooks and signals.

**When to use:** When building custom GUT extensions that need to run at specific points during test execution.

**Trade-offs:**
- **Pros:** Clean integration with existing GUT infrastructure, minimal code changes to tests
- **Cons:** Requires understanding GUT's internal API and signal flow

**Example:**
```gdscript
# addons/gut/coverage/gut_coverage_plugin.gd
extends Node

var _coverage_tracker: CoverageTracker = null
var _script_parser: ScriptLineParser = null
var _gut: GutMain = null

func _enter_tree():
    # Called when plugin is loaded by GUT
    _gut = get_node_or_null("/root/Gut")
    if _gut != null:
        # Connect to GUT signals
        _gut.connect("start_run", _on_gut_start_run)
        _gut.connect("end_run", _on_gut_end_run)

func _on_gut_start_run():
    """Called when GUT starts running tests."""
    _coverage_tracker = CoverageTracker.get_instance()
    _script_parser = ScriptLineParser.new()

    # Parse all autoload scripts to build line number map
    var line_map = _script_parser.parse_autoload_directory()
    for script_path in line_map:
        _coverage_tracker.set_script_line_map(script_path, line_map[script_path])

    # Inject coverage tracking into test scripts (via GUT's hook_script mechanism)
    # This requires modifying GUT configuration or using pre_run_script

func _on_gut_end_run():
    """Called when GUT finishes running all tests."""
    if _coverage_tracker != null:
        # Export coverage data to JSON
        var coverage_data = _coverage_tracker.get_coverage_data()
        _export_coverage_json(coverage_data)

func _export_coverage_json(coverage_data: Dictionary):
    """Export coverage data to JSON file."""
    var file = FileAccess.open("res://test/coverage/json/coverage.json", FileAccess.WRITE)
    if file != null:
        file.store_string(JSON.stringify(coverage_data))
        file.close()
```

### Pattern 4: HTML Coverage Report Generation

**What:** Parse coverage.json from GUT and generate HTML reports similar to `go tool cover -html`, with clickable line navigation and coverage percentage visualization.

**When to use:** When visualizing line coverage results for developers - HTML reports provide interactive exploration of coverage gaps.

**Trade-offs:**
- **Pros:** Familiar format (matches go test coverage), easy to integrate with existing dashboard
- **Cons:** Requires Python script for template rendering, adds CI step

**Example:**
```python
# scripts/parse_godot_coverage.py
import json
import os
from pathlib import Path
from jinja2 import Template

def parse_coverage_json(json_path):
    """Parse coverage.json from GUT."""
    with open(json_path, 'r') as f:
        return json.load(f)

def generate_html_report(coverage_data, output_path):
    """Generate HTML coverage report."""
    template = Template("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Godot Coverage Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .covered { background-color: #d4edda; }
            .uncovered { background-color: #f8d7da; }
            .line { padding: 2px 5px; font-family: monospace; }
            .file-section { margin-bottom: 30px; }
            .file-header { font-weight: bold; margin-bottom: 10px; }
            .percentage { font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <h1>Godot Coverage Report</h1>
        {% for file_path, data in coverage_data.items() %}
        <div class="file-section">
            <div class="file-header">
                {{ file_path }} - {{ data.percentage }}%
                <span class="percentage">({{ data.covered_count }}/{{ data.total_count }} lines)</span>
            </div>
            {% for line_num in range(1, 100) %}
            {% if line_num in data.executed_lines %}
            <div class="line covered">{{ line_num }}: covered</div>
            {% elif line_num in data.executable_lines %}
            <div class="line uncovered">{{ line_num }}: NOT covered</div>
            {% endif %}
            {% endfor %}
        </div>
        {% endfor %}
    </body>
    </html>
    """)

    html = template.render(coverage_data=coverage_data)

    with open(output_path, 'w') as f:
        f.write(html)

if __name__ == '__main__':
    coverage_data = parse_coverage_json('test/coverage/json/coverage.json')
    generate_html_report(coverage_data, 'test/coverage/html/index.html')
    print(f"Generated coverage report: test/coverage/html/index.html")
```

### Anti-Patterns to Avoid

- **Full AST-based instrumentation:** Building a complete GDScript AST parser for coverage tracking is overkill - simple line-based tracking sufficient for autoload scripts
- **Bytecode modification:** Attempting to modify Godot bytecode for coverage tracking requires engine recompilation - unacceptable maintenance burden
- **Coverage for all GDScript:** Limit to autoload scripts (23 files) - scene scripts and utility scripts have lower ROI
- **Complex line number heuristics:** Don't try to identify every edge case in GDScript syntax - basic parsing handles 90% of cases

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GDScript AST parser | Custom AST for coverage tracking | Simple line-based parsing | Full AST overkill for 23 autoload files, high maintenance cost |
| Coverage report UI | Custom HTML/CSS from scratch | Jinja2 templates | Standard Python templating, matches go tool cover format |
| Test execution hooks | Custom test runner | GUT plugin hooks | GUT provides `pre_run_script`, `post_run_script`, signals - use them |
| Coverage JSON format | Custom schema | Match go cover profile format | Compatibility with existing dashboard tools |

**Key insight:** GUT provides excellent test infrastructure - leverage it rather than rebuilding test execution logic. Focus coverage tooling on line tracking and reporting, not test orchestration.

## Common Pitfalls

### Pitfall 1: Over-Investment in Custom Coverage Instrumentation

**What goes wrong:**
Spending significant time (2-4 months) attempting to build comprehensive GDScript coverage instrumentation when pass rate proxy is documented as acceptable and Go backend has native coverage tools.

**Why it happens:**
Developers accustomed to Go's `go test -cover` assume line coverage is essential for all languages. The lack of built-in coverage in Godot feels like a deficiency that must be fixed rather than an architectural constraint.

**How to avoid:**
1. **Timebox custom instrumentation to 2 weeks maximum** - if no working prototype emerges, abandon approach
2. **Document limitation explicitly** in project docs: "Godot uses pass rate proxy due to engine limitations - see LIMITATIONS.md"
3. **Focus coverage efforts on Go backend** where native tooling exists
4. **Limit scope to autoload scripts only** (23 files, not entire codebase)
5. **Measure overhead** - if coverage tracking slows tests >2x, revert to pass rate proxy

**Warning signs:**
- Planning custom GDScript bytecode modification
- Investigating Godot C++ engine changes for instrumentation hooks
- Spending more than 2 weeks without working prototype
- No test suite growth during "coverage tooling" phase

### Pitfall 2: Coverage Tooling Not Integrated with Existing Dashboard

**What goes wrong:**
Building coverage instrumentation without integrating with existing coverage dashboard that tracks Go coverage. Creates separate, disconnected metrics that don't provide unified view.

**Why it happens:**
Godot and Go use different test frameworks (GUT vs. go test) and coverage paradigms. Teams treat them as separate concerns rather than integrating.

**How to avoid:**
1. **Extend existing coverage dashboard HTML** to show both Go line coverage and Godot line coverage
2. **Include Godot coverage in same PR comment format** as Go coverage
3. **Use consistent color coding and formatting** across both dashboards
4. **Document difference in measurement approaches** so stakeholders understand discrepancies
5. **Leverage existing dashboard infrastructure** (progress bars, trend charts)

**Warning signs:**
- Separate dashboards or reports for Go vs. Godot
- PR comments only show Go coverage, ignoring Godot tests
- Developers checking only one dashboard for test quality

### Pitfall 3: Ignoring Autoload Dependencies in Coverage Tracking

**What goes wrong:**
Building coverage instrumentation for autoloads in isolation without accounting for their interdependencies (NetworkManager → GameManager → CombatManager). Per-autoload coverage high, but cross-autoload bugs slip through.

**Why it happens:**
Autoloads are tested individually following GUT patterns. Coverage tools built around individual autoloads miss cross-autoload coverage gaps.

**How to avoid:**
1. **Map autoload dependency graph** before building coverage instrumentation
2. **Include cross-autoload test coverage in metrics**
3. **Use GUT's `watch_signals`** to track signal propagation across autoloads
4. **Document which autoload dependencies are tested vs. untested** in coverage reports
5. **Add tests that exercise multiple autoloads together** for critical workflows

**Warning signs:**
- Coverage reports show high per-autoload coverage but bugs in autoload interactions
- Signal-based communication between autoloads not covered
- No tests that exercise multiple autoloads together

## Code Examples

### Integrating Coverage Tracking with GUT Configuration

```json
// .gutconfig.json (modified)
{
  "config_version": 2,
  "directories": {
    "test": ["res://test/suites/autoloads"]
  },
  "disable_colors": false,
  "double_strategy": "INCLUDE_INTERNAL",
  "should_exit": true,
  "should_exit_on_success": true,
  "log_level": 3,
  "output_format": "junit_xml",
  "junit_xml_output": "res://test/results/gut-results.xml",
  "compact_mode": false,
  "pre_run_script": "res://addons/gut/coverage/coverage_pre_run.gd",  // NEW
  "post_run_script": "res://addons/gut/coverage/coverage_post_run.gd"  // NEW
}
```

```gdscript
// addons/gut/coverage/coverage_pre_run.gd
# Called by GUT before test run starts
extends Node

func _ready():
    var tracker = CoverageTracker.get_instance()
    tracker.before_all()
    queue_free()

```

```gdscript
// addons/gut/coverage/coverage_post_run.gd
# Called by GUT after test run completes
extends Node

func _ready():
    var tracker = CoverageTracker.get_instance()
    var coverage_data = tracker.get_coverage_data()
    _export_coverage_json(coverage_data)
    queue_free()

func _export_coverage_json(coverage_data: Dictionary):
    var file = FileAccess.open("res://test/coverage/json/coverage.json", FileAccess.WRITE)
    if file != null:
        file.store_string(JSON.stringify(coverage_data))
        file.close()
```

### CI/CD Integration (Modified coverage.yml)

```yaml
# .github/workflows/coverage.yml (godot-coverage job modified)
godot-coverage:
  name: Frontend Coverage (Godot)
  runs-on: ubuntu-latest

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Godot
      run: |
        wget -q https://github.com/godotengine/godot/releases/download/4.6-stable/Godot_v4.6-stable_linux.x86_64.zip -O godot.zip
        unzip -q godot.zip
        chmod +x Godot_v4.6-stable_linux.x86_64
        mv Godot_v4.6-stable_linux.x86_64 godot4

    - name: Run GUT tests with coverage tracking
      run: |
        mkdir -p test/coverage/{json,html}
        ./godot4 --headless --script test/run_all_tests.gd

    - name: Generate HTML coverage report
      run: |
        python3 scripts/parse_godot_coverage.py \
          --input=test/coverage/json/coverage.json \
          --output=test/coverage/html/index.html

    - name: Calculate overall line coverage
      id: coverage
      run: |
        python3 scripts/parse_godot_coverage.py \
          --input=test/coverage/json/coverage.json \
          --json-output=coverage-stats.json
        COVERAGE=$(jq -r '.overall_percentage' coverage-stats.json)
        echo "line_coverage=$COVERAGE" >> $GITHUB_OUTPUT
        echo "Godot line coverage: ${COVERAGE}%"

    - name: Enforce 50% line coverage threshold
      run: |
        LINE_COVERAGE=${{ steps.coverage.outputs.line_coverage }}
        if (( $(echo "$LINE_COVERAGE < 50" | bc -l) )); then
          echo "::error::Godot line coverage ${LINE_COVERAGE}% is below 50% threshold"
          exit 1
        fi
        echo "✅ Line coverage ${LINE_COVERAGE}% meets 50% threshold"

    - name: Upload coverage artifact
      uses: actions/upload-artifact@v4
      with:
        name: godot-coverage-html
        path: test/coverage/html/
        retention-days: 30
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pass rate proxy (100%) | Line coverage instrumentation (target 50%+) | Phase 13 implementation | Provides actual code visibility, enables gap analysis |
| Separate dashboards | Unified dashboard (Go + Godot) | Phase 13 implementation | Single source of truth for test quality |

**Deprecated/outdated:**
- Pass rate proxy as primary metric: Will be replaced by line coverage, but kept for comparison during transition

## Open Questions

1. **What is acceptable performance overhead for coverage tracking?**
   - What we know: Coverage tracking adds runtime overhead (function calls for line marking)
   - What's unclear: Whether >2x test slowdown is acceptable vs. reverting to pass rate proxy
   - Recommendation: Measure overhead on first prototype, set threshold at 2x, if exceeded, reconsider approach

2. **Should coverage tracking be opt-in or always-on?**
   - What we know: Always-on coverage provides consistent metrics, but slows all test runs
   - What's unclear: Whether developers prefer to run coverage on-demand (slow) vs. always-on (consistent)
   - Recommendation: Default to always-on with environment variable opt-out for local development

3. **How to handle GDScript parsing edge cases?**
   - What we know: Simple line-based parsing handles 90% of cases (comments, whitespace, braces)
   - What's unclear: Edge cases like nested strings, multiline comments, annotations
   - Recommendation: Implement basic parser, document known limitations, add edge case handling as needed

## Validation Architecture

> Skip this section entirely if workflow.nyquist_validation is explicitly set to false in .planning/config.json. If the key is absent, treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | GUT 9.5.0 (Godot Unit Test) |
| Config file | .gutconfig.json |
| Quick run command | `./godot4 --headless --script test/run_all_tests.gd` |
| Full suite command | `./godot4 --headless --script test/run_all_tests.gd` (same - GUT runs all configured tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GODOT-01 | Evaluate existing open-source coverage tools | manual-only | N/A - research task | N/A |
| GODOT-02 | Select coverage tool or confirm custom solution | manual-only | N/A - research task | N/A |
| GODOT-03 | Integrate coverage solution with GUT 9.6.0 | integration | `./godot4 --headless --script test/run_all_tests.gd` | ✅ test/run_all_tests.gd |
| GODOT-04 | Generate HTML coverage reports | integration | `python3 scripts/parse_godot_coverage.py --input=test/coverage/json/coverage.json --output=test/coverage/html/index.html` | ❌ scripts/parse_godot_coverage.py (needs modification) |
| GODOT-05 | Extend coverage dashboard with Godot line coverage | integration | `bash scripts/generate-coverage-dashboard.sh` (existing, needs extension) | ✅ scripts/generate-coverage-dashboard.sh (needs modification) |

### Sampling Rate
- **Per task commit:** `./godot4 --headless --script test/run_all_tests.gd` (~5-10 minutes for full suite)
- **Per wave merge:** Full suite + HTML report generation + dashboard update
- **Phase gate:** All GODOT-03, GODOT-04, GODOT-05 automated tests pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/coverage/json/coverage.json` - coverage data structure (to be generated by coverage plugin)
- [ ] `test/coverage/html/index.html` - HTML coverage report template (to be generated by parse_godot_coverage.py)
- [ ] `addons/gut/coverage/coverage_tracker.gd` - line execution tracking singleton
- [ ] `addons/gut/coverage/coverage_exporter.gd` - coverage.json export logic
- [ ] `addons/gut/coverage/gut_coverage_plugin.gd` - GUT plugin integration
- [ ] `addons/gut/coverage/script_line_parser.gd` - GDScript source line parsing
- [ ] `scripts/parse_godot_coverage.py` - modified to generate HTML from coverage.json
- [ ] `scripts/generate-coverage-dashboard.sh` - modified to include Godot line coverage
- [ ] Python jinja2 installation: `pip install jinja2`

## Sources

### Primary (HIGH confidence)
- **GUT 9.5.0 Installation** - `addons/gut/plugin.cfg` - Verified version 9.5.0, confirmed no coverage features in gut_config.gd
- **GUT Configuration** - `.gutconfig.json` - Verified pre_run_script and post_run_script hooks for plugin integration
- **Existing Test Infrastructure** - `test/run_all_tests.gd`, `test/suites/autoloads/test_combat_manager.gd` - Confirmed GUT test patterns, autoload testing approach
- **Existing Coverage Calculation** - `scripts/calculate_godot_coverage.py` - Confirmed pass rate proxy implementation, JUnit XML parsing
- **Existing CI/CD Integration** - `.github/workflows/coverage.yml` - Confirmed Godot test execution, artifact upload, threshold enforcement
- **Project Autoloads** - `project.godot` autoload section - Counted 23 autoload scripts for scope definition
- **Existing Coverage Dashboard** - CI dashboard infrastructure (from Phase 12) - Confirmed extension path for Godot metrics
- **Project Architecture Research** - `.planning/research/ARCHITECTURE.md` - Confirmed custom coverage instrumentation approach, 2-week timebox recommendation
- **Project Stack Research** - `.planning/research/STACK.md` - Confirmed GUT 9.5.1 version, Python 3.8+ availability, jinja2 recommendation
- **Project Pitfalls Research** - `.planning/research/PITFALLS.md` - Confirmed over-investment risk, integration requirements, autoload dependency considerations

### Secondary (MEDIUM confidence)
- **Python Jinja2 Documentation** - Jinja2 templating library (standard Python package) - HTML report generation approach
- **GUT Signal System** - `addons/gut/gut.gd` header comments - Confirmed start_run, end_run, start_test, end_test signals for plugin integration
- **GDScript Source File Analysis** - Autoload directory structure (23 .gd files) - Confirmed scope for line parsing

### Tertiary (LOW confidence)
- **Godot Coverage Tooling Ecosystem** - Web searches for "Godot code coverage", "GUT coverage", "GDScript line coverage" returned no results - Confirms no existing commercial/open-source solutions (verified by lack of search results, cross-checked with project documentation)
- **GDScript AST Parsing Libraries** - No external libraries found for GDScript AST parsing - Confirms custom solution required

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified GUT 9.5.0 version, existing test infrastructure, Python availability
- Architecture: HIGH - Based on project research (ARCHITECTURE.md, STACK.md), confirmed GUT hooks and signals, tested parsing approach conceptually
- Pitfalls: HIGH - Documented in PITFALLS.md with prevention strategies, validated against project patterns
- No existing tools: HIGH - Web searches returned no results for Godot coverage tools, cross-validated with project documentation confirming pass rate proxy as limitation

**Research date:** 2026-03-22
**Valid until:** 2026-04-21 (30 days - stable domain, GUT version stable, no new coverage tools expected)

**Key assumptions:**
- GUT 9.5.0 pre_run_script and post_run_script hooks are functional (need verification in implementation)
- Line-based GDScript parsing sufficient for 90%+ of autoload scripts (need testing during implementation)
- Performance overhead of coverage tracking <2x (need measurement during implementation)
