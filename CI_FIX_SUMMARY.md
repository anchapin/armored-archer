# CI Fix Summary

## Date
2026-04-14

## Overview
This document summarizes the issues found when running CI workflows locally using `act` and the fixes applied.

## Issues Found

### 1. Custom Docker Image Not Publicly Available
**Issue**: The CI workflow references a custom Docker image `armored-archer/nakama-postgres:3.21.1` that doesn't exist in a public Docker registry.

**Error**:
```
Error response from daemon: pull access denied for armored-archer/nakama-postgres,
repository does not exist or may require 'docker login': denied
```

**Root Cause**: The custom image was built locally but never published to a public registry. GitHub Actions and `act` both try to pull images from the registry by default.

### 2. npm Cache Integrity Issues (with act cache)
**Issue**: When using act's npm cache, there were integrity checksum mismatches.

**Error**:
```
npm error Invalid response body while trying to fetch https://registry.npmjs.org/@typescript-eslint%2fscope-manager:
sha512 checksum failed when using sha512: wanted... but got...
```

**Root Cause**: The cached npm packages had different checksums than what was expected.

## Fixes Applied

### Fix 1: Build Custom Nakama Image Locally
Created a local Docker image for Nakama with PostgreSQL integration:

```bash
docker build -t armored-archer/nakama-postgres:3.21.1 \
  .docker/nakama-postgres/
```

This image includes:
- Base: `heroiclabs/nakama:3.21.1`
- Custom entrypoint script that:
  1. Waits for PostgreSQL to be ready
  2. Runs Nakama migrations
  3. Starts Nakama with PostgreSQL connection

### Fix 2: Create `.actrc` Configuration File
Created a `.actrc` file in the project root to configure act for local testing:

```
# Act configuration for local CI testing
# Use local images instead of pulling from registry
-P ubuntu-latest=catthehacker/ubuntu:full-latest
# Don't force pull images - use local cache
--pull=false
```

**Purpose**:
- Maps the `ubuntu-latest` runner to the pre-configured catthehacker image
- Prevents act from forcing image pulls, allowing use of local images

### Fix 3: Use `--no-cache-server` Flag
When running act, use the `--no-cache-server` flag to bypass the npm cache integrity issues:

```bash
act -W .github/workflows/ci.yml --no-cache-server
```

## Current CI Status

### Jobs Passing (18/20)
- ✅ Backend Lint
- ✅ Backend Type Check
- ✅ Security Audit
- ✅ Log Scrubbing Tests
- ✅ N+1 Query Detection (Blocking)
- ✅ N+1 Query Detection (Non-Blocking)
- ✅ Duplicate Code Detection
- ✅ Dependency Check
- ✅ Bundle Size Tracking
- ✅ Godot Project Validation
- ✅ Python Lint
- ✅ GDScript Lint
- ✅ Tech Debt Tracking
- ✅ Dead Code Detection
- ✅ Schema Validation
- ✅ AGENTS.md Validation
- ✅ Cyclomatic Complexity Analysis
- ✅ Dead Feature Flag Detection

### Jobs Failing (2/20)

#### 1. Backend Tests with Coverage
**Status**: Failing (4 tests out of 2758, coverage threshold not met)

**Failing Tests**:
- `src/modules/__tests__/rpg_system.test.ts` - 4 test failures:
  - `should respec stats with valid allocation`
  - `should use free respec when available`
  - `should return error when free respecs exhausted`
  - `should calculate cost correctly based on gem balance`
  - `should enforce maximum cost cap`

**Issue**: Tests expect `parsed.success` to be `true` but receive `undefined`. This suggests the `rpcRespecStats` function is returning an error response instead of success, likely due to data parsing issues in `safeParse` or mock configuration.

**Coverage**: 78.98% branches (threshold: 80%)

#### 2. SonarCloud Code Quality
**Status**: Failing (same test failures as Backend Tests)

**Note**: This job includes the same test suite and therefore has the same failures.

## Remaining Work

### Test Failures Investigation
The failing tests in `rpg_system.test.ts` need to be debugged:

1. Investigate `safeParse` function behavior in test context
2. Verify mock data structure matches what `loadPlayerStats` expects
3. Check if there's a TypeScript compilation issue causing the tests to behave differently

### Coverage Threshold
The coverage is at 78.98% for branches, just slightly below the 80% threshold. This may be:
- Fluctuation due to test environment
- Missing edge case coverage
- Or could improve if test failures are fixed

## Commands for Running CI Locally

```bash
# Run all CI jobs
act -W .github/workflows/ci.yml --no-cache-server

# Run specific job
act -j backend-lint --no-cache-server
act -j backend-test --no-cache-server

# Run with verbose output for debugging
act -j backend-test --no-cache-server -v

# View available jobs
act -l
```

## Files Modified

1. `.actrc` - Created for act configuration
2. `.github/workflows/ci.yml` - Modified Nakama service configuration (later reverted)

## Notes

- The custom Nakama Docker image needs to be rebuilt if the Dockerfile changes
- The `.actrc` file should be committed to the repository for team use
- For actual CI runs on GitHub Actions, the custom image would need to be published to a registry or the workflow updated to use the standard image with proper configuration
