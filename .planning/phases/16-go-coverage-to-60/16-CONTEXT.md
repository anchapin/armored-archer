# Phase 16: Go Coverage to 60% - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Increase overall Go test coverage from 34.5% to 60% across all 27 packages using systematic gap targeting, incremental threshold enforcement, gap analysis automation, and leveraging existing factory fixtures and testcontainers.

Scope: coverage gap analysis, test writing for uncovered functions, incremental CI/CD gates (45% → 52.5% → 60%), progression/matchmaking/store/season/notification package coverage improvements.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase focused on test coverage improvement. The scope, requirements, and success criteria are clearly defined:

- **Coverage targets**: Overall 60%, progression 50% → 75%, matchmaking 65% → 80%, store/season/notifications 30-35% → 50-55%
- **Incremental gates**: 45% → 52.5% → 60% to prevent overwhelming developers
- **Gap analysis automation**: Script to identify zero-coverage functions systematically
- **Test infrastructure leverage**: Use existing factory fixtures (testhelpers) and testcontainers for fast, isolated test execution

Implementation approach follows established patterns from v2.3.0/v2.4.0:
- Table-driven tests for edge cases
- Statistical validation for coverage measurements
- CI/CD threshold enforcement with PR feedback
- Focus on critical path packages first

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/tests/testhelpers/fixtures_builder.go` — factory pattern for Player and Gear test data
- `backend/tests/testcontainers/` — testcontainers-go integration for PostgreSQL isolation in tests
- Existing test infrastructure from v2.3.0/v2.4.0 — 89,588 lines of test code, 60 benchmarks, coverage measurement

### Established Patterns
- Go testing via `go test` with coverage reports (`go test -coverprofile=coverage.out`)
- Coverage calculation via `go tool cover -func` for package-level metrics
- Table-driven tests for multiple scenarios
- Testcontainers for database isolation (eliminates external dependencies)
- PR coverage integration via GitHub Actions

### Integration Points
- Coverage reports in `.gitignore` to prevent test artifacts in version control
- CI/CD workflows in `.github/workflows/` (coverage.yml, test.yml)
- Makefile targets for local test execution (`make backend-test`, `make backend-coverage`)
- Test data generation patterns from `testhelpers` package

### Current Coverage State
- Baseline: 34.5% overall (post v2.4.0)
- Critical path achieved: combat 83.7%, matchmaking 80%+, progression 80%+ (v2.4.0)
- Progression: 50% current
- Matchmaking: 65% current
- Store/season/notifications: 30-35% current

</code_context>

<specifics>
## Specific Ideas

From ROADMAP phase 16 requirements:

**Overall Coverage Goal (COV-01)**:
- Target: 60% overall across 27 packages
- Current: 34.5% (25.5% gap)
- Approach: Systematic test writing for uncovered functions

**Incremental Gates (COV-02)**:
- Gate 1: 45% (12.5% increase from current 34.5%)
- Gate 2: 52.5% (8% increase)
- Gate 3: 60% (final goal)
- Purpose: Prevent overwhelming developers with 25.5% jump

**Package-Specific Targets**:
- Progression: 50% → 75% (25% gap)
- Matchmaking: 65% → 80% (15% gap)
- Store/season/notifications: 30-35% → 50-55% (20-25% gap)

**Gap Analysis Automation (COV-06)**:
- Script to identify zero-coverage functions
- Prioritized recommendations by package and function complexity
- Integration with test writing workflow

**Test Infrastructure Leverage (COV-07)**:
- Factory fixtures from `testhelpers` package
- testcontainers for fast, isolated execution
- Reuse existing coverage measurement infrastructure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All requirements are technical infrastructure tasks with clear implementation paths.

</deferred>
