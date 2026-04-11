# CI Fix Plan - Act Local Testing

## Summary of Issues Found

After running CI workflows locally with `act`, the following issues were identified:

### Critical Issues (Block CI)

1. **PostgreSQL Client Tools Missing**
   - **Error**: `pg_isready: command not found` and `psql: command not found`
   - **Affected Jobs**:
     - `schema-validation` - FAILS (28 tests fail because migrations don't run)
     - `sonarcloud` - FAILS (wait step fails)
     - `backend-test` - PASSES but shows warnings (tests work because services are managed by act)
   - **Root Cause**: The `catthehacker/ubuntu:act-latest` container doesn't include PostgreSQL client tools
   - **Impact**: Database migrations don't run, causing tests to fail

### Non-Critical Issues (Expected in Act)

2. **Codecov Upload Failure**
   - **Error**: Git worktree issue when running `git config --global --add safe.directory`
   - **Status**: Expected in act environment, job continues with error (`continue-on-error: true`)
   - **Impact**: None - coverage still generated locally

3. **Artifact Upload Failure**
   - **Error**: `Unable to get the ACTIONS_RUNTIME_TOKEN env variable`
   - **Status**: Expected in act environment
   - **Impact**: None - artifacts can still be found in local filesystem

### Jobs Tested Status

| Job | Status | Notes |
|-----|--------|-------|
| `backend-lint` | ✅ PASSED | |
| `python-lint` | ✅ PASSED | |
| `gdscript-lint` | ✅ PASSED | |
| `backend-typecheck` | ✅ PASSED | |
| `backend-test` | ✅ PASSED | 2473 tests passed, `pg_isready` warnings |
| `security-audit` | ✅ PASSED | |
| `tech-debt-tracking` | ✅ PASSED | Artifact upload failed (expected) |
| `dead-code-detection` | ✅ PASSED | |
| `duplicate-code-detection` | ✅ PASSED | |
| `dependency-check` | ✅ PASSED | |
| `bundle-size-check` | ✅ PASSED | |
| `agents-md-validation` | ✅ PASSED | Artifact upload failed (expected) |
| `schema-validation` | ❌ FAILED | `psql` not found, 28 tests fail |
| `sonarcloud` | ❌ FAILED | `pg_isready` not found |

## Proposed Solutions

### Solution 1: Use a Docker Image with PostgreSQL Client Tools

**Option A**: Use a PostgreSQL image for the runner
- Create a custom act image based on `catthehacker/ubuntu:act-latest` with PostgreSQL clients
- Or use an existing image like `postgres` as the base

**Option B**: Install PostgreSQL clients in the workflow steps
- Add a step to install `postgresql-client` package before using `pg_isready`/`psql`

**Recommended**: Option B (install in workflow steps) as it's:
- More explicit in the workflow
- Doesn't require maintaining custom images
- Works across different platforms

### Solution 2: Use Docker Exec for Database Operations

Instead of using `psql` from the runner, use `docker exec` to run commands inside the PostgreSQL service container:

```yaml
# Instead of:
PGPASSWORD=changeme psql -h localhost -U postgres -d nakama -f "$migration"

# Use:
docker exec ${{ job.services.postgres.id }} psql -U postgres -d nakama -f "$migration"
```

This approach:
- Doesn't require PostgreSQL clients in the runner
- Is more reliable (direct communication with container)
- Works in both GitHub Actions and act

### Solution 3: Use Network Reachability Check Instead of pg_isready

Replace `pg_isready` with a more portable check:

```yaml
# Instead of:
for i in {1..30}; do
  if pg_isready -h localhost -p 5432 -U postgres; then
    echo "PostgreSQL is ready"
    break
  fi
  sleep 2
done

# Use:
for i in {1..30}; do
  if docker exec ${{ job.services.postgres.id }} pg_isready -U postgres 2>/dev/null; then
    echo "PostgreSQL is ready"
    break
  fi
  sleep 2
done
```

## Implementation Plan

### Phase 1: Fix `schema-validation` Job (High Priority)

1. Update `.github/workflows/ci.yml`:
   - Add step to install `postgresql-client` before database operations
   - OR modify migration step to use `docker exec`

### Phase 2: Fix `sonarcloud` Job (High Priority)

1. Update `.github/workflows/ci.yml`:
   - Add step to install `postgresql-client` before PostgreSQL wait step
   - OR modify wait step to use `docker exec`

### Phase 3: Update `backend-test` Job (Medium Priority)

1. Clean up `pg_isready` warnings by using `docker exec` approach

### Phase 4: Test and Verify

1. Run all affected jobs with act
2. Verify all jobs pass
3. Run full CI workflow

## Recommended Changes

### Change 1: Add PostgreSQL Client Installation Step

Add this step before any PostgreSQL operations:

```yaml
- name: Install PostgreSQL client
  run: |
    apt-get update && apt-get install -y postgresql-client
```

### Change 2: Use docker exec for Database Migrations

Replace the current migration step:

```yaml
- name: Run database migrations
  working-directory: ./backend/data
  run: |
    for migration in $(ls -1 *.sql 2>/dev/null | sort); do
      echo "Running migration: $migration"
      docker exec ${{ job.services.postgres.id }} psql -U postgres -d nakama -f - < "$migration"
    done
```

### Change 3: Use docker exec for PostgreSQL Readiness Check

Replace the current wait step:

```yaml
- name: Wait for PostgreSQL to be ready
  run: |
    for i in {1..30}; do
      if docker exec ${{ job.services.postgres.id }} pg_isready -U postgres 2>/dev/null; then
        echo "PostgreSQL is ready"
        break
      fi
      echo "Waiting for PostgreSQL... ($i/30)"
      sleep 2
    done
```

## Alternative: Create Act-Specific Workflows

For better local testing experience, create act-specific workflows that:

1. Skip steps that require GitHub-specific features (artifact uploads, Codecov)
2. Use docker exec approach for database operations
3. Have reduced timeouts for faster testing

## Next Steps

1. ✅ Analyze CI issues (completed)
2. ✅ Create fix plan (this document)
3. ✅ Implement fixes in CI workflows
4. ✅ Test fixes with act
5. ✅ Verify all jobs pass
6. ✅ Document changes

## Implementation Results

### Changes Made
Modified `.github/workflows/ci.yml` to use `docker exec` for database operations in three jobs:
1. `backend-test` (lines 169-186)
2. `sonarcloud` (lines 605-622)
3. `schema-validation` (lines 727-744)

### Solution Implemented
Used a hybrid approach that works in both GitHub Actions and act:

```yaml
# In GitHub Actions, use job.services.postgres.id; in act, find container by name
if [ -n "${{ job.services.postgres.id }}" ]; then
  POSTGRES_CONTAINER="${{ job.services.postgres.id }}"
else
  # Find PostgreSQL container by image name (act environment)
  POSTGRES_CONTAINER=$(docker ps --filter ancestor=postgres:14-alpine --format '{{.ID}}' | head -1)
fi
```

### Test Results After Fix

| Job | Status | Tests |
|-----|--------|-------|
| `backend-lint` | ✅ PASSED | - |
| `python-lint` | ✅ PASSED | - |
| `gdscript-lint` | ✅ PASSED | - |
| `backend-typecheck` | ✅ PASSED | - |
| `backend-test` | ✅ PASSED | 2473 tests |
| `security-audit` | ✅ PASSED | - |
| `tech-debt-tracking` | ✅ PASSED | - |
| `dead-code-detection` | ✅ PASSED | - |
| `duplicate-code-detection` | ✅ PASSED | - |
| `dependency-check` | ✅ PASSED | - |
| `bundle-size-check` | ✅ PASSED | - |
| `agents-md-validation` | ✅ PASSED | - |
| `schema-validation` | ✅ PASSED | 28 tests |
| `sonarcloud` | ✅ PASSED | 2473 tests |

### Remaining Non-Critical Issues
- **Codecov upload fails** - Due to git worktree issue (expected in act, continues with error)
- **Artifact upload fails** - Due to missing `ACTIONS_RUNTIME_TOKEN` env variable (expected in act)

## Notes

- The `backend-test` job now passes cleanly without `pg_isready` warnings
- The `schema-validation` and `sonarcloud` jobs now pass successfully
- Using `docker exec` with fallback to container lookup is the most portable solution as it works in both GitHub Actions and act environments
- The solution doesn't require PostgreSQL client tools to be installed in the runner container
- All jobs that were previously failing due to missing PostgreSQL client tools now pass
