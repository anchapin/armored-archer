# CI Local Testing with Act - Issues and Solutions

## Overview

This document describes issues encountered when running GitHub Actions CI workflows locally using the `act` CLI tool, and the solutions implemented to enable successful local CI testing.

## Issues Found

### 1. npm Cache Corruption (Parallel Execution)

**Problem:**
When running multiple CI jobs in parallel with act, all jobs attempt to use the same npm cache directory (`/home/runner/.npm/_cacache`). This causes cache corruption errors:

```
npm error ENOENT: no such file or directory, stat '/home/runner/.npm/_cacache/...'
```

**Root Cause:**
- GitHub Actions runs each job on a separate runner with isolated environments
- With act, jobs run in containers on the same host machine
- The `actions/setup-node@v4` action with `cache: 'npm'` shares the same cache directory across parallel jobs
- Multiple jobs reading/writing to the same cache simultaneously causes corruption

**Affected Jobs:**
- All jobs that use `npm ci` or `npm install`
- Specifically: backend-lint, backend-typecheck, backend-complexity, security-audit, etc.

### 2. PostgreSQL Port Conflicts

**Problem:**
Multiple CI jobs that use PostgreSQL services try to bind to port 5432 simultaneously, causing port conflicts:

```
Error: Bind for 0.0.0.0:5432 failed: port is already allocated
```

**Root Cause:**
- GitHub Actions isolates each job's network - each job gets its own network namespace
- With act, jobs share the host network by default (even with `--bind`)
- Jobs using PostgreSQL services (backend-test, schema-validation, sonarcloud) all use port 5432

**Affected Jobs:**
- backend-test (uses PostgreSQL + Nakama)
- schema-validation (uses PostgreSQL)
- sonarcloud (uses PostgreSQL + Nakama)

## Solutions Implemented

### Solution 1: Sequential Job Execution

The most effective solution for local testing is to run jobs sequentially instead of in parallel. This eliminates both the npm cache corruption and port conflict issues.

**Implementation:**
Created `scripts/run-ci-locally.sh` script that:
1. Defines all CI jobs in an ordered list
2. Runs each job one at a time using `act -j <job-name> --bind`
3. Captures output to log files (`/tmp/act-<job-name>.log`)
4. Tracks and reports pass/fail status

**Usage:**
```bash
./scripts/run-ci-locally.sh
```

### Solution 2: Individual Job Testing

For targeted testing, run individual jobs:
```bash
# Test a specific job
act -W .github/workflows/ci.yml -j backend-lint --bind

# Test a job with services (PostgreSQL)
act -W .github/workflows/ci.yml -j backend-test --bind
```

## Known Limitations

### SonarCloud Job
The SonarCloud job is designed to be skipped in act environments due to:
1. Missing GitHub context variables (GITHUB_TOKEN, secrets.SONAR_TOKEN)
2. Git worktree issues with codecov/git operations

The workflow already includes act-specific handling:
```yaml
- name: Skip SonarCloud for act environment
  if: env.ACT == 'true'
  run: |
    echo "⚠️  Skipping SonarCloud scan when running locally with act"
```

### Codecov Upload
The Codecov action fails in act due to git worktree issues, but is marked as `continue-on-error: true`:
```yaml
- name: Upload coverage to Codecov
  if: success()
  uses: codecov/codecov-action@v4
  continue-on-error: true  # Don't fail the job
  env:
    CODECOV_SKIP: ${{ env.ACT == 'true' && 'true' || '' }}
```

## Recommendations for Local Development

1. **Quick Testing:** Run a single job for the code you're working on
   ```bash
   act -j backend-lint
   ```

2. **Full CI Run:** Use the sequential script before pushing
   ```bash
   ./scripts/run-ci-locally.sh
   ```

3. **Test Pipeline:** After your changes pass locally, push to GitHub for full CI validation

## Job Status

All CI jobs pass successfully when run sequentially with act:

| Job | Status | Notes |
|-----|--------|-------|
| godot-validate | ✅ Pass | - |
| backend-lint | ✅ Pass | - |
| backend-typecheck | ✅ Pass | - |
| backend-complexity | ✅ Pass | - |
| python-lint | ✅ Pass | - |
| gdscript-lint | ✅ Pass | - |
| security-audit | ✅ Pass | - |
| dependency-check | ✅ Pass | - |
| bundle-size-check | ✅ Pass | - |
| tech-debt-tracking | ✅ Pass | - |
| dead-code-detection | ✅ Pass | - |
| duplicate-code-detection | ✅ Pass | - |
| agents-md-validation | ✅ Pass | - |
| backend-n-plus-one | ✅ Pass | - |
| n-plus-one-detection | ✅ Pass | - |
| log-scrubbing | ✅ Pass | - |
| backend-dead-flags | ✅ Pass | - |
| backend-test | ✅ Pass | Tests pass, Codecov skipped |
| schema-validation | ✅ Pass | - |
| sonarcloud | ⚠️ Skipped | Not designed for act |

## Act Configuration

The project includes `.actrc` with configuration for local testing:
- Uses `--pull=false` to use locally built Docker images
- Sets container architecture to `linux/amd64`
- Configures volume mounts for Godot assets
- Sets environment variables for headless Godot

## References

- [act GitHub repository](https://github.com/nektos/act)
- [actions/setup-node documentation](https://github.com/actions/setup-node)
- [PostgreSQL service containers](https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers)
