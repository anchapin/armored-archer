---
phase: 14-mutation-testing-integration
plan: 02
subsystem: Testing Infrastructure
tags:
  - mutation-testing
  - ci-cd
  - github-actions
  - dashboard
  - quality-gates
dependency_graph:
  requires:
    - 14-01: mutation-testing-foundation
  provides:
    - 15-01: property-based-testing-expansion
  affects:
    - CI/CD pipelines
    - quality gates
    - coverage dashboard
tech_stack:
  added:
    - GitHub Actions cron scheduling
    - jq for JSON manipulation
  patterns:
    - Nightly workflow execution
    - Mutation score trend tracking
    - Dashboard extension with new metrics
    - PR comment integration for mutation results
key_files:
  created:
    - .github/workflows/mutation-testing.yml
    - scripts/track-mutation-history.sh
  modified:
    - docs/coverage-dashboard.html
decisions:
  - Daily cron schedule at 2 AM UTC (avoid overlap with flaky tests at 3 AM)
  - 180-minute timeout for full mutation testing execution
  - Weighted mutation score calculation (combat/matchmaking 30%, rpg 20%, others ~7%)
  - Purple color (#9b59b6) for mutation trend line (distinguish from coverage blue #3498db)
  - Package-specific thresholds displayed on dashboard (combat 85%, matchmaking 80%, others 75%)
metrics:
  duration: 278 seconds
  completed_date: "2026-03-22T15:54:47Z"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  commits: 3
---

# Phase 14 Plan 02: Mutation Dashboard and Nightly Workflow Summary

## One-Liner

Implemented nightly GitHub Actions workflow for mutation testing, mutation score history tracking, and extended coverage dashboard with mutation visualization.

## Objective

CI/CD Integration & Dashboard: Nightly workflow, mutation score tracking, dashboard extension

Purpose: Automate mutation testing execution on nightly schedule, track mutation scores over time, extend coverage dashboard to visualize mutation quality metrics, and enforce package-specific thresholds in CI.

Output: GitHub Actions workflow, mutation history tracking script, extended dashboard with mutation visualization

## Tasks Completed

### Task 1: Create nightly GitHub Actions workflow for mutation testing
**Commit:** 2078f9f9
**Files:** .github/workflows/mutation-testing.yml

Created .github/workflows/mutation-testing.yml with:
- Daily cron schedule at 2 AM UTC (avoid overlap with flaky tests at 3 AM)
- workflow_dispatch input for optional package filter
- Go 1.25 setup with caching
- go-mutesting installation via go install
- jq installation for JSON parsing
- testcontainers environment setup/teardown
- 180-minute timeout for full mutation testing
- Mutation score threshold enforcement
- Mutation history tracking via track-mutation-history.sh
- Mutation results artifact upload (30-day retention)
- Mutation report generation with package breakdown
- PR comment on workflow_dispatch with mutation scores and thresholds
- Respects flaky test quarantine via run-mutation-tests.sh

### Task 2: Create mutation history tracking script
**Commit:** cd69e7f5
**Files:** scripts/track-mutation-history.sh

Created scripts/track-mutation-history.sh with:
- Git info extraction (commit, branch, date)
- Mutation score extraction from go-mutesting output per package
- Package-specific threshold checking from mutation_config.yaml
- Weighted overall mutation score calculation:
  - combat: 30% weight
  - matchmaking: 30% weight
  - rpg: 20% weight
  - store, season, notifications: ~7% weight each
- Update data/coverage-history.json with mutation_score field
- Trend analysis with last 5 measurements
- Regression detection (highlight >5% decrease)
- Improvement detection (highlight score increase)
- Flaky test quarantine respect (data/flaky-test-quarantine.json)
- 30-entry history limit for file size management
- Detailed console output for debugging

### Task 3: Extend coverage dashboard with mutation score visualization
**Commit:** 623bfba3
**Files:** docs/coverage-dashboard.html

Extended docs/coverage-dashboard.html with:
- Mutation score summary cards (overall, combat, matchmaking) in summary section
- Mutation thresholds configuration object (combat 85%, matchmaking 80%, others 75%, overall 78%)
- getMutationStatusClass helper function (good/warning/bad based on threshold)
- getMutationStatusText helper function (PASS/WARN/FAIL)
- renderMutationTrendChart function with purple trend line (#9b59b6)
- Extended package cards to show mutation scores alongside coverage
- Mutation testing section with description and trend chart
- mutation-trend-line CSS class with purple stroke
- mutation-badge CSS class for status indicators
- Updated DOMContentLoaded to initialize mutation cards and progress bar
- Handles missing mutation_score data gracefully (shows N/A)
- Threshold line marker on mutation trend chart
- Last 10 entries displayed on mutation trend chart

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps from plan passed:

1. **Workflow file exists with nightly cron schedule** - Confirmed cron '0 2 * * *' at 2 AM UTC
2. **Mutation tracking script is syntactically valid and executable** - bash -n passes, chmod +x applied
3. **Dashboard HTML includes mutation score sections and trend chart** - Confirmed 7 mutation_score, 2 mutationTrendChart references
4. **Workflow has artifact upload** - Confirmed mutation-results artifact with 30-day retention
5. **Workflow tracks mutation history** - Confirmed track-mutation-history.sh execution step
6. **Mutation score tracking integrates with coverage-history.json** - Confirmed jq manipulation for mutation_score field
7. **Package-specific thresholds referenced** - Confirmed mutationThresholds object with 85%/80%/75% thresholds
8. **Flaky test quarantine respected in workflow** - Workflow calls run-mutation-tests.sh which checks data/flaky-test-quarantine.json

## Key Decisions

1. **Daily cron schedule at 2 AM UTC**: Chosen to avoid overlap with flaky tests workflow at 3 AM UTC, spreads load across early morning hours
2. **180-minute timeout**: Full mutation testing can take significant time; 3 hours provides buffer for all packages without blocking CI/CD
3. **Weighted mutation score calculation**: Critical packages (combat, matchmaking) get higher weight (30% each) to reflect business importance
4. **Purple color for mutation trend line**: #9b59b6 distinguishes mutation metrics from coverage (blue #3498db) and Godot (orange #e67e22)
5. **30-entry history limit**: Balances trend visualization depth with file size management for coverage-history.json
6. **PR comment on workflow_dispatch**: Provides immediate feedback when mutation testing is manually triggered on PRs
7. **Graceful N/A handling**: Dashboard shows "N/A" when mutation_score data not yet available, preventing broken UI

## Integration Points

- **GitHub Actions**: Nightly cron schedule triggers mutation testing workflow
- **go-mutesting**: Mutation testing tool installed and executed via run-mutation-tests.sh
- **testcontainers**: Workflow starts PostgreSQL database for database-backed tests
- **flaky-test-quarantine.json**: Mutation testing respects quarantined tests via run-mutation-tests.sh
- **mutation_config.yaml**: Package-specific thresholds (85%/80%/75%) enforced in workflow and script
- **coverage-history.json**: Extended with mutation_score field, updated by track-mutation-history.sh
- **coverage-dashboard.html**: Extended to visualize mutation scores alongside coverage metrics
- **jq**: Used for JSON manipulation in workflow and script for threshold enforcement and history updates

## Files Modified Summary

- `.github/workflows/mutation-testing.yml` (244 lines) - Nightly mutation testing workflow with cron schedule, threshold enforcement, PR comments
- `scripts/track-mutation-history.sh` (232 lines) - Mutation score extraction, weighted calculation, trend analysis, history updates
- `docs/coverage-dashboard.html` (338 lines added, 8 modified) - Extended with mutation score cards, trend chart, package-level scores

## Next Steps

- Phase 15: Property-Based Testing Expansion
  - Add invariant tests for progression, matchmaking, inventory systems
  - Use testing/quick and rapid libraries
  - Target 20+ property tests across 3 systems

- Phase 16: Go Coverage to 60%
  - Leverage mutation testing insights to improve test quality
  - Increase overall coverage from 34.5% to 60%
  - Enforce incremental threshold gates (45% → 52.5% → 60%)

## Auth Gates

None encountered during execution.

## Self-Check: PASSED

All created files exist:
- .github/workflows/mutation-testing.yml
- scripts/track-mutation-history.sh

All modified files exist:
- docs/coverage-dashboard.html

All commits exist:
- 2078f9f9: feat(14-02): create nightly GitHub Actions workflow for mutation testing
- cd69e7f5: feat(14-02): create mutation history tracking script
- 623bfba3: feat(14-02): extend coverage dashboard with mutation score visualization
