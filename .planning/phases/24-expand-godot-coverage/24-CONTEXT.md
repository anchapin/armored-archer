# Phase 24: Expand Godot Coverage - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add CoverageTracker.track_execution() calls to priority autoloads (GameManager, PlayerStatsManager, SeasonManager) and integrate with existing GUT testing framework. Generate HTML coverage reports and integrate Godot coverage metrics with the project dashboard.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure instrumentation and testing phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- backend/autoloads/coverage_tracker.gd - CoverageTracker singleton for tracking execution paths
- backend/test/coverage/coverage_tracker_test.gd - Test suite for CoverageTracker functionality
- GUT testing framework (test/coverage/ directory with existing coverage tests)
- scripts/generate_coverage_html.py - Script for generating HTML coverage reports
- data/coverage/coverage.json - Existing coverage data structure

### Established Patterns
- Singleton autoload pattern (CoverageTracker, GameManager, PlayerStatsManager)
- Test structure: autoloads/tests/<module>/ for unit tests
- JSON-based coverage data with coverage.json format
- GitHub Actions integration via .github/workflows/godot-coverage.yml

### Integration Points
- GameManager: Main game state manager - needs coverage tracking in combat calculations
- PlayerStatsManager: Player statistics - needs coverage tracking in stats updates
- SeasonManager: Seasonal content - needs coverage tracking in season progression
- GUT framework: Integration point for running tests and generating reports
- Dashboard: coverage.json connects to frontend coverage dashboard

</code_context>

<specifics>
## Specific Ideas

From ROADMAP.md Phase 24 details:
- Priority autoloads: GameManager, PlayerStatsManager, SeasonManager
- CoverageTracker.track_execution() call points: Game state changes, stat calculations, season progression
- Success criteria: coverage.json populated with actual data, HTML reports generate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
