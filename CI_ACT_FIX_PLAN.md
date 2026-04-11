# CI Act Fix Plan

## Summary
This document outlines issues found when running CI workflows locally using `act` and provides a plan to fix them.

**Status**: Major issues resolved. Most CI jobs now pass successfully.

## Tested Date
2026-04-11

## Act Command Used
```bash
# Build custom Nakama image first (required for jobs with Nakama service)
docker build -t armored-archer/nakama-postgres:3.21.1 .docker/nakama-postgres/

# Run jobs
act -j <job-name> --container-architecture linux/amd64 --pull=false
```

## Results Summary

### Passing Jobs ✅
- `backend-lint` - Passed
- `backend-typecheck` - Passed
- `python-lint` - Passed
- `gdscript-lint` - Passed
- `godot-validate` - Passed
- `dead-code-detection` - Passed
- `agents-md-validation` - Passed
- `backend-test` - Passed (with local Nakama image built)
- `schema-validation` - **FIXED** - Now passes (28/28 tests)
- `dependency-check` - Passed
- `security-audit` - Passed
- `tech-debt-tracking` - Passed

### Failing Jobs ❌
- `godot-tests` (from test.yml) - Times out (requires test runner improvements)

### Jobs with Expected Local Failures ⚠️
- Jobs that upload artifacts (codecov, sonarcloud, etc.) fail locally due to missing GitHub tokens but have `continue-on-error: true`

## Issues and Fixes

### Issue 1: Custom Nakama Docker Image Not Available

**Problem:**
The CI workflows (ci.yml, test.yml) reference `armored-archer/nakama-postgres:3.21.1` which doesn't exist on Docker Hub.

**Error:**
```
Error response from daemon: pull access denied for armored-archer/nakama-postgres, repository does not exist or may require 'docker login'
```

**Temporary Workaround for Act:**
```bash
docker build -t armored-archer/nakama-postgres:3.21.1 .docker/nakama-postgres/
```

**Status**: WORKAROUND APPLIED - Image is built locally before running act.

**Permanent Fixes:**

**Option A: Publish the Image to Docker Hub**
```bash
docker build -t armored-archer/nakama-postgres:3.21.1 .docker/nakama-postgres/
docker push armored-archer/nakama-postgres:3.21.1
```
- Requires Docker Hub account and authentication
- Must keep the image in sync with changes

**Option B: Build the Image in CI**
Modify workflows to build the image as part of the job:
```yaml
- name: Build custom Nakama image
  run: |
    docker build -t armored-archer/nakama-postgres:3.21.1 .docker/nakama-postgres/
```

**Option C: Use Standard Nakama Image with Config**
Replace the custom image with the standard `heroiclabs/nakama:3.21.1` and configure it properly.

**Recommended Fix:** Option B - Build the image in CI before running jobs that need it.

---

### Issue 2: Schema Validation Tests Fail ✅ FIXED

**Problem:**
The `schema-validation` job failed because tests expect a `users` table (created by Nakama) but only PostgreSQL and custom migrations were run.

**Error:**
```
error: relation "users" does not exist
```

**Files:**
- `.github/workflows/ci.yml` (lines 679-747)
- `backend/tests/integration/schema.test.ts` (lines 421-462)

**Fix Applied:**

1. **Created minimal users table migration** (`backend/data/000_create_nakama_users_table.sql`):
   - Added minimal Nakama users table schema
   - Includes necessary columns and indexes
   - Runs before other migrations (prefix 000)

2. **Fixed inventory unique constraint** (`backend/data/003_create_inventory.sql`):
   - Changed from UNIQUE INDEX to UNIQUE CONSTRAINT
   - Test expects constraint from `information_schema.table_constraints`

3. **Fixed loadout foreign key test** (`backend/tests/integration/schema.test.ts`):
   - Updated test to only check gear slot columns
   - Excludes `user_id` which correctly references `users` table

**Result:** All 28 schema validation tests now pass.

---

### Issue 3: Godot Tests Timeout ⏳ PENDING

**Problem:**
The `godot-tests` job from `test.yml` times out after 10 minutes.

**Error:**
```
Exit code 124 (timeout)
```

**Files:**
- `.github/workflows/test.yml` (lines 13-54)
- `test/run_all_tests.gd`

**Analysis:**
The test runner (`run_all_tests.gd`) loads 60+ test files but:
1. Doesn't have proper test execution logic
2. Doesn't have assertions
3. Just loads scripts and waits 2 frames before continuing
4. May hang if any test doesn't complete properly

**Fixes:**

**Option A: Add Timeout to the Step**
Add a timeout to the test step:
```yaml
- name: Run Godot Tests
  timeout-minutes: 5
  run: |
    ./godot4 --headless --script test/run_all_tests.gd
```

**Option B: Fix the Test Runner**
Improve the test runner to have proper test execution and completion detection.

**Option C: Use a Simpler Test Approach**
Run individual test files with proper assertions instead of the batch approach.

**Recommended Fix:** Option A (immediate) + Option C (long-term) - Add timeout and simplify the test approach.

---

## Changes Made

### New Files
- `backend/data/000_create_nakama_users_table.sql` - Minimal Nakama users table for schema validation

### Modified Files
- `backend/data/003_create_inventory.sql` - Changed UNIQUE INDEX to UNIQUE CONSTRAINT
- `backend/tests/integration/schema.test.ts` - Fixed loadout foreign key test to only check gear slots

---

## Act-Specific Notes

### Running Act Successfully

To run act successfully with the current setup:

```bash
# Build the custom Nakama image first
docker build -t armored-archer/nakama-postgres:3.21.1 .docker/nakama-postgres/

# Run specific jobs
act -j backend-lint --container-architecture linux/amd64 --pull=false
act -j backend-typecheck --container-architecture linux/amd64 --pull=false
act -j schema-validation --container-architecture linux/amd64 --pull=false
act -j backend-test --container-architecture linux/amd64 --pull=false
```

### Running Multiple Jobs

```bash
# Run multiple jobs in parallel
act -j backend-lint -j backend-typecheck -j schema-validation --container-architecture linux/amd64 --pull=false
```

---

## Implementation Priority

1. **Completed** ✅
   - Fix schema validation (created minimal users table)
   - Fix inventory unique constraint
   - Fix loadout foreign key test

2. **Medium Priority** (Performance/Reliability):
   - Fix Godot tests timeout

3. **Low Priority** (Nice to have):
   - Improve test runner for better feedback
   - Add more comprehensive coverage reporting
   - Consider publishing Nakama image to Docker Hub

---

## Testing Checklist

After fixes are applied, verify:

- [x] `act -j backend-lint --pull=false` passes
- [x] `act -j backend-typecheck --pull=false` passes
- [x] `act -j python-lint --pull=false` passes
- [x] `act -j gdscript-lint --pull=false` passes
- [x] `act -j godot-validate --pull=false` passes
- [x] `act -j backend-test --pull=false` passes (with local Nakama image)
- [x] `act -j schema-validation --pull=false` passes
- [x] `act -j dependency-check --pull=false` passes
- [x] `act -j security-audit --pull=false` passes
- [x] `act -j tech-debt-tracking --pull=false` passes
- [ ] `act -j godot-tests -W test.yml --pull=false` passes within timeout

---

## Next Steps

1. **Commit the fixes**:
   ```bash
   git add backend/data/000_create_nakama_users_table.sql
   git add backend/data/003_create_inventory.sql
   git add backend/tests/integration/schema.test.ts
   git commit -m "fix: resolve CI schema validation issues

   - Add minimal Nakama users table for schema validation
   - Change inventory UNIQUE INDEX to UNIQUE CONSTRAINT
   - Fix loadout foreign key test to only check gear slots"
   ```

2. **Consider addressing the Nakama image issue** for GitHub Actions CI (not just local act):
   - Either publish the image to Docker Hub
   - Or modify workflows to build it as part of CI

3. **Improve Godot test runner** to avoid timeouts and provide better feedback.
