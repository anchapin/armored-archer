# Act Local Testing Summary

**Date**: 2026-04-12
**Act Version**: 0.2.87
**Project**: Armored Archer (Godot 4 + Nakama)

## Summary

Act local testing is **mostly functional**. Most CI jobs pass successfully with act, but there are a few limitations and issues to be aware of.

## Jobs Tested Status

### Passing Jobs ✅

| Job | Status | Notes |
|-----|--------|-------|
| `backend-lint` | ✅ PASSED | ESLint passed with 0 errors |
| `python-lint` | ✅ PASSED | Ruff passed |
| `gdscript-lint` | ✅ PASSED | GDLint passed |
| `backend-typecheck` | ✅ PASSED | TypeScript compilation passed |
| `backend-test` | ✅ PASSED | 2473 tests passed |
| `security-audit` | ✅ PASSED | NPM audit passed |
| `schema-validation` | ✅ PASSED | 28 tests passed |
| `sonarcloud` | ✅ PASSED | 2473 tests passed (SonarCloud scan skipped as expected) |

### Failing Jobs ❌

| Job | Status | Issue |
|-----|--------|-------|
| `godot-tests` (test.yml) | ❌ FAILED | 41 test failures (actual test failures, not detection issue) |

### Issues with Service Containers

**Status**: ✅ RESOLVED

Previous issues with service containers (PostgreSQL, Nakama) have been resolved in recent commits. The docker exec approach with fallback to container lookup works correctly in act.

**Remaining Issue**: Act panic on dry-run (`-n` flag)
- When using `act -n` for dry-run with workflows that have service containers with health check options, act crashes with:
  ```
  panic: runtime error: invalid memory address or nil pointer dereference
  [signal SIGSEGV: segmentation violation code=0x1 addr=0xa0 pc=0xc7fdea]
  ```
- This is a bug in act itself (version 0.2.87)
- Workaround: Don't use `-n` flag with workflows containing service containers

## Known Act Limitations

### 1. Codecov Upload (Expected)
- **Error**: Git worktree issue when running `git config --global --add safe.directory`
- **Impact**: Artifact upload fails with exit code 128
- **Status**: Handled with `continue-on-error: true` in workflow
- **Workaround**: Not needed for local testing; coverage reports are still generated

### 2. GitHub Context Variables (Expected)
- **Error**: `ACTIONS_RUNTIME_TOKEN` and other GitHub-specific variables not available
- **Impact**: Artifact uploads, Codecov uploads fail
- **Status**: Handled with conditional checks (`if: env.ACT != 'true'`)
- **Workaround**: Not needed for local testing

### 3. SonarCloud Scan (Expected)
- **Error**: Requires GitHub context variables and secrets
- **Impact**: SonarCloud scan cannot run
- **Status**: Handled with explicit skip step
- **Workaround**: Not needed for local testing

### 4. Act Dry-Run with Service Containers (Bug)
- **Error**: Act panic when using `-n` flag with service containers
- **Impact**: Cannot do dry-run validation of workflows with services
- **Status**: Known bug in act 0.2.87
- **Workaround**: Use `act -l` to list jobs, or run jobs without `-n` flag

## Godot Test Failures (41 Total)

The `godot-tests` job in `test.yml` reports 41 actual test failures. These are **not** false positives from the failure detection logic - the tests are genuinely failing.

### Failure Distribution

```
CampaignManager: 5 failures
SeasonManager: 1 failure
ShootingManager: 1 failure
Low-End Device Performance: 1 failure
Performance Benchmarks: 2 failures
Arrow Script: 1 failure
DamagePopup Script: 1 failure
BaseEnemy: 3 failures
EnemySpawner: 2 failures
MeleeEnemy: 4 failures
RangedEnemy: 4 failures
TankEnemy: 2 failures
SpeedEnemy: 4 failures
ScoutEnemy: 1 failure
BruteEnemy: 1 failure
GuardianEnemy: 1 failure
SwarmerEnemy: 4 failures
NecromancerEnemy: 2 failures
Boss Basic: 1 failure
Boss Fire: 1 failure
Gear Data: 1 failure
Gear Slot: 1 failure
Modular Character Sprite: 1 failure
UI Components: 4 failures
```

### Example Failure
```
[FAIL] test_update_campaign_progress_signal: Should emit progress signal
```

This suggests issues with async signal emission in the test framework when running in headless mode.

## Recommendations

### For CI Maintenance

1. **Fix Godot Test Failures**: Investigate and fix the 41 failing Godot tests
   - Focus on async signal emission tests
   - Check if tests need updated expectations or code changes
   - Consider test framework improvements for async scenarios

2. **Monitor Act Updates**: Watch for new versions of act that fix the dry-run panic with service containers
   - Current version: 0.2.87
   - Issue: Panic on dry-run with service containers

3. **Keep Workaround Code**: Maintain the conditional checks for act environment
   - `if: env.ACT == 'true'`
   - Docker exec fallback for PostgreSQL operations

### For Developers Using Act

1. **Dry-Run Limitation**: Avoid using `act -n` for workflows with service containers
2. **Expected Failures**: Codecov and artifact upload failures are expected in act
3. **Service Containers**: PostgreSQL and Nakama services work correctly with act
4. **Test Locally**: Use act for fast feedback before pushing

## Commands to Run Tests Locally

```bash
# Run all CI jobs (may take a while)
act -W .github/workflows/ci.yml

# Run specific job
act -W .github/workflows/ci.yml -j backend-test
act -W .github/workflows/test.yml -j godot-tests

# Run multiple lint jobs in parallel
act -W .github/workflows/ci.yml -j backend-lint -j python-lint -j gdscript-lint

# List all available jobs
act -l

# Use the local Godot test script (no Docker required)
./scripts/local-godot-tests.sh
```

## Conclusion

Act local testing is **working well** for this project. The recent fixes for service container compatibility have resolved the main issues. The remaining failures are:

1. **Expected limitations** (Codecov, SonarCloud, artifacts) - handled in workflows
2. **Godot test failures** (41 tests) - actual test issues that need investigation
3. **Act bug** (dry-run panic) - upstream issue with act

The CI workflows are well-configured for act compatibility with appropriate conditional checks and fallback mechanisms.
