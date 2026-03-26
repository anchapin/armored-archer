# Phase 13: Godot Coverage Tools - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a lightweight line coverage instrumentation system for Godot 4/GDScript that integrates with existing GUT 9.6.0 test framework, generates HTML reports similar to Go's coverage tool, and extends the coverage dashboard to show actual Godot line coverage (replacing the current pass rate proxy).

Scope is limited to autoload scripts (23 files) with a 2-week timebox. If no working prototype emerges, accept pass rate proxy as a documented limitation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. The research provides detailed architectural patterns, code examples, and anti-patterns to avoid. Implement according to the research recommendations with these constraints:
- Timebox to 2 weeks maximum
- Limit scope to autoload scripts only (23 files)
- Target <2x test execution overhead
- Integrate with existing coverage dashboard from Phase 12

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- GUT 9.6.0 test framework in `addons/gut/` - provides `pre_run_script`, `post_run_script` hooks, and signal system (`start_run`, `end_run`, `start_test`, `end_test`)
- Existing test runner: `test/run_all_tests.gd` - runs all autoload tests
- Autoload test suites in `test/suites/autoloads/` - 22 test files, 102 autoload tests
- Autoload-to-test mapping in `data/autoload-to-test-mapping.json` - tracks which autoloads have tests
- Python scripts: `scripts/calculate_godot_coverage.py` - calculates pass rate proxy (keep for comparison)

### Established Patterns
- GUT test configuration via `.gutconfig.json` - add `pre_run_script` and `post_run_script` for coverage plugin integration
- CI/CD workflow in `.github/workflows/coverage.yml` - existing Godot coverage job needs modification
- Coverage dashboard generation via `scripts/generate-coverage-dashboard.sh` - extend to include Godot line coverage metrics
- JSON-based test results and coverage data - coverage.json format for compatibility with dashboard

### Integration Points
- GUT plugin hooks: Add `pre_run_script` and `post_run_script` entries to `.gutconfig.json`
- Coverage data export: Write `test/coverage/json/coverage.json` after test runs
- CI/CD pipeline: Modify godot-coverage job to generate HTML reports and calculate line coverage percentage
- Dashboard extension: Update `docs/coverage-dashboard.html` template to show both Go and Godot line coverage
</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow the research architecture:
- Build coverage tracking singleton (CoverageTracker) in `addons/gut/coverage/`
- Parse autoload scripts to identify executable lines (ScriptLineParser)
- Integrate with GUT via plugin hooks (GutCoveragePlugin)
- Export coverage data to JSON format
- Generate HTML reports using Python/jinja2
- Extend coverage dashboard to show Godot line metrics

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Research identified potential deferred items:
- Full GDScript AST parser for all syntax edge cases (handle as needed)
- Coverage for scene scripts and utility scripts (defer to v2.6.0 if autoload coverage successful)
- Bytecode modification approach (rejected as overkill)

</deferred>
