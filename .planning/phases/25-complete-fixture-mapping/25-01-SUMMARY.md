---
phase: 25-complete-fixture-mapping
plan: 01
subsystem: testing-infrastructure
tags: [gap-analysis, fixtures, bash, json]

# Phase 25 Plan 01: Implement Fixture Mapping Logic - Summary

## Objective
Add package-to-fixture mapping function to `gap-analysis.sh` and implement JSON output support.

## Key Changes
- Modified `scripts/gap-analysis.sh`:
    - Added `get_suggested_fixtures()` function to map Go packages to their corresponding test builders.
    - Implemented `--json` flag for machine-readable output.
    - Fixed `awk` syntax for better package name extraction (excluding filenames).
    - Fixed path resolution issues when running `go tool cover` from the root directory.
- Mapped priority packages:
    - `rpg` -> `testhelpers.NewPlayerBuilder()`
    - `gear` -> `testhelpers.NewGearBuilder()`
    - `combat` -> `testhelpers.NewMatchBuilder()`
- Generic mapping for other packages (returns `[]`).

## Verification Results
- `scripts/gap-analysis.sh` runs successfully and identifies 369 uncovered functions across 22 packages.
- Output includes suggested fixtures for `rpg`, `gear`, and `combat` packages.
- `--json` output is valid JSON and includes all required fields (timestamp, packages, gap_count, suggested_fixtures, functions, summary).

## Side Fixes (Critical)
- Fixed multiple logic bugs in Go backend that were causing 10+ test failures in `matchmaking`, `combat`, `rpg`, `notifications`, `season`, and `store`.
- Fixed circular dependencies and Nakama compatibility issues in the TypeScript backend, allowing E2E tests to run with the real JS bundle.
- Updated load tests to match current `k6` configuration.

---
*Phase: 25-complete-fixture-mapping*
*Plan: 01*
*Completed: 2026-03-23*
