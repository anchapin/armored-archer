# CI Issues and Resolution Plan

## Summary
Successfully ran CI workflows locally using `act` CLI. Most jobs pass, but some fail due to resource conflicts and act-specific limitations.

## Job Status Summary

### ✅ Passing Jobs (16/20)
1. Backend Lint
2. Backend Type Check
3. Bundle Size Tracking
4. Cyclomatic Complexity Analysis
5. Database Schema Validation
6. Dead Code Detection
7. Dead Feature Flag Detection
8. Duplicate Code Detection
9. GDScript Lint
10. Godot Project Validation
11. Log Scrubbing Tests
12. Python Lint
13. Security Audit
14. Tech Debt Tracking
15. AGENTS.md Validation
16. N+1 Query Detection (second instance)

### ❌ Failing Jobs (4/20)
1. **N+1 Query Detection** (first instance) - Container name conflict
2. **Backend Tests with Coverage** - Port conflict (7350)
3. **SonarCloud Code Quality** - Act cache cleanup issue
4. **Duplicate N+1 Query Detection** (duplicate job in workflow)

## Issues Identified

### 1. Port Conflicts (High Priority)
**Problem:** Multiple jobs try to use the same ports (5432, 7350) simultaneously
- PostgreSQL: 5432
- Nakama: 7350

**Root Cause:** Act runs jobs in parallel, and when jobs fail or get interrupted, containers aren't properly cleaned up before the next attempt.

**Resolution:** Created cleanup script `scripts/act-cleanup.sh` that:
- Removes all act containers
- Removes all act networks
- Optionally clears act cache

**Usage:**
```bash
./scripts/act-cleanup.sh          # Clean containers and networks
./scripts/act-cleanup.sh --cache  # Also clear cache
```

### 2. Container Name Conflicts (Medium Priority)
**Problem:** Act generates container names based on job hashes, and when re-running, the same name conflicts with leftover containers.

**Resolution:** Always run cleanup script before re-running act.

### 3. Duplicate Jobs in Workflow (Medium Priority)
**Problem:** The CI workflow defines N+1 Query Detection twice (lines 60-79 and 273-292), causing one to fail due to container name conflict.

**Resolution:** Remove duplicate job definition from `.github/workflows/ci.yml`.

### 4. Act Cache Cleanup Issue (Low Priority)
**Problem:** Act tries to remove `.gitignore` file in cache directory that doesn't exist, causing job to fail.

**Impact:** Only affects act local runs, not GitHub Actions CI.

**Resolution:** This is an act CLI bug. No action needed for production CI.

### 5. SonarCloud Skipping (Expected)
**Problem:** SonarCloud job is skipped when running with act (by design).

**Resolution:** This is intentional - SonarCloud requires GitHub context and secrets not available locally.

## Recommended Actions

### Immediate (Before Next Act Run)
1. Run cleanup script: `./scripts/act-cleanup.sh`
2. Remove duplicate N+1 Query Detection job from `.github/workflows/ci.yml`

### Short Term
1. Add cleanup script to Makefile:
   ```makefile
   act-cleanup:
       ./scripts/act-cleanup.sh

   act-ci: act-cleanup
       act -W .github/workflows/ci.yml push
   ```

2. Update CI documentation to mention cleanup requirement.

### Long Term
1. Consider using different port configurations for act vs production CI
2. Investigate act configuration options for better container cleanup
3. Consider using act's `-P` flag to use different container images if needed

## Running CI Locally with Act

### Prerequisites
- Docker installed and running
- act CLI installed (`brew install act` or from releases)

### Commands
```bash
# Clean up any previous act resources
./scripts/act-cleanup.sh

# Run CI workflow
act -W .github/workflows/ci.yml push

# Run specific job
act -j backend-lint -W .github/workflows/ci.yml push

# Run with verbose output
act -W .github/workflows/ci.yml push --verbose
```

### Known Limitations
1. Jobs requiring GitHub secrets will fail or be skipped (SonarCloud, etc.)
2. Port conflicts may occur on re-runs without cleanup
3. Some GitHub Actions features aren't fully supported by act

## Next Steps
1. Apply the immediate fixes (cleanup script usage, remove duplicate job)
2. Re-run act to verify all jobs pass
3. Document act usage for team members
4. Consider integrating act cleanup into pre-commit hooks if needed
