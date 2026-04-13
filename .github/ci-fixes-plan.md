# CI Workflow Fixes Plan

## Issues Found via act Local Testing

### 1. Docker-in-Docker Permissions (CRITICAL)
**Affected Jobs**: `schema-validation`, `sonarcloud`, `backend-test`

**Problem**: Migration steps use `docker exec` which fails with:
```
permission denied while trying to connect to the Docker daemon socket
```

**Root Cause**: The act container runs as a non-root user and can't access the Docker socket.

**Fix**: Replace `docker exec` commands with direct `psql` commands using the service container's host/port.

**Before**:
```yaml
- name: Run migrations
  run: |
    POSTGRES_CONTAINER=$(docker ps --filter ancestor=postgres:15-alpine --format '{{.ID}}' | head -1)
    for migration in $(ls -1 *.sql 2>/dev/null | sort); do
      docker exec -i $POSTGRES_CONTAINER psql -U postgres -d nakama < "$migration" || true
    done
```

**After**:
```yaml
- name: Run migrations
  run: |
    for migration in $(ls -1 *.sql 2>/dev/null | sort); do
      echo "Running migration: $migration"
      PGPASSWORD=localdbpassword psql -h localhost -p 5433 -U postgres -d nakama -f "$migration" || true
    done
```

### 2. SonarCloud Port Conflict (HIGH)
**Affected Jobs**: `sonarcloud`, `backend-test`

**Problem**: "Bind for 0.0.0.0:7350 failed: port is already allocated"

**Root Cause**: Multiple jobs use port 7350 for Nakama without proper cleanup.

**Fix**: Use different ports for each job, or add explicit cleanup step.

**Option A**: Different ports per job
- `backend-test`: 7350
- `sonarcloud`: 7351 (already has both ports defined)

**Option B**: Add cleanup before job
```yaml
- name: Cleanup previous containers
  if: env.ACT == 'true'
  run: |
    docker ps -q --filter "publish=7350" | xargs -r docker kill
    docker ps -q --filter "publish=7351" | xargs -r docker kill
```

### 3. Codecov Git Worktree Issue (LOW - Expected)
**Affected Jobs**: `backend-test`

**Problem**: Codecov upload fails due to git worktree.

**Status**: Already handled with `CODECOV_SKIP` env var for act. This is expected behavior.

### 4. Schema Validation Test Failures (CRITICAL)
**Affected Jobs**: `schema-validation`

**Problem**: 28 tests fail with "relation does not exist"

**Root Cause**: Migrations don't run due to Issue 1.

**Fix**: Fix Issue 1.

## Implementation Order

1. Fix Docker-in-Docker permissions (Issue 1) - This fixes Issue 4
2. Add port conflict resolution (Issue 2)
3. Verify all jobs pass with act

## Files to Modify

- `.github/workflows/ci.yml`:
  - `backend-test` job: Update migration step
  - `schema-validation` job: Update migration step
  - `sonarcloud` job: Update migration step, add cleanup
