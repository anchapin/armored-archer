# CI Fixes Plan

## Summary
Analysis of CI workflows using `act` CLI tool identified several issues preventing CI from running successfully.

## Issues Found

### 1. cd.yml Workflow Validation Errors
**Severity:** Critical
**Impact:** Prevents act from listing or running any workflows in the repository

**Root Cause:**
- Uses `slackapi/slack-github-action` third-party action that act doesn't support
- Uses `workflow_url` variable which is not a standard GitHub Actions context variable

**Affected Files:**
- `.github/workflows/cd.yml` (lines 122-124, 152, 270-271)

**Suggested Fix:**
Option A: Add act support/workaround for unsupported actions
Option B: Modify workflow to skip Slack notification step when running in act (use `if: env.ACT != 'true'`)
Option C: Use act-compatible approach or remove unsupported actions for local testing

### 2. Python Setup Jobs Failing (Permission Denied)
**Severity:** High
**Impact:** Jobs requiring Python fail completely

**Affected Jobs:**
- `python-lint`
- `gdscript-lint`
- `dead-code-detection`

**Root Cause:**
- `actions/setup-python@v5` tries to create `/opt/hostedtoolcache/Python` directory
- Container runs as non-root user (1001:1001) but lacks write permissions to system directory
- This is a known issue with act when using GitHub Actions setup-python@v5

**Suggested Fix:**
Option A: Add `--userns=host` flag to act command to use host user namespace
Option B: Use a different Python version or older setup-python@v4
Option C: Pre-install Python in the container image or use a custom container
Option D: Add a pre-run step to fix permissions (requires running as root)

### 3. Security Audit Failing (Lodash Vulnerability)
**Severity:** High
**Impact:** Security audit job fails, blocking CI

**Root Cause:**
- High severity vulnerability in lodash package (<= 4.17.23)
- Issues: Code Injection via `_.template` imports key names (GHSA-r5fr-rjxr-66jc)
- Issues: Prototype Pollution via array path bypass in `_.unset` and `_.omit` (GHSA-f23m-r3pf-42rh)

**Affected Files:**
- `backend/package-lock.json` (transitive dependency)

**Suggested Fix:**
```bash
cd backend
npm audit fix
# or specifically update lodash to >=4.17.21
npm install lodash@^4.17.21
```

### 4. Dependency Check Failing (Unused Dependencies)
**Severity:** Medium
**Impact:** Dependency hygiene check fails

**Root Cause:**
Unused dependencies detected:
- **Production:** @babel/runtime, buffer, process
- **Dev:** @babel/cli, @babel/plugin-transform-runtime, @stryker-mutator/jest-runner, @stryker-mutator/typescript-checker

**Affected Files:**
- `backend/package.json`

**Suggested Fix:**
Remove unused dependencies:
```json
{
  "dependencies": {
    // Remove: @babel/runtime, buffer, process
  },
  "devDependencies": {
    // Remove: @babel/cli, @babel/plugin-transform-runtime,
    //         @stryker-mutator/jest-runner, @stryker-mutator/typescript-checker
  }
}
```

### 5. Jobs Passing Successfully
The following jobs pass without issues:
- `backend-lint`
- `backend-typecheck`
- `godot-validate`
- `backend-complexity` (assumed)
- `duplicate-code-detection` (assumed)
- `tech-debt-tracking` (assumed)
- `agents-md-validation` (assumed)
- `schema-validation` (assumed - requires PostgreSQL/Nakama services)
- `log-scrubbing` (assumed)
- `n-plus-one-detection` (assumed)
- `backend-n-plus-one` (assumed)
- `backend-dead-flags` (assumed)
- `bundle-size-check` (assumed)

## Recommended Fix Order

1. **Fix cd.yml validation errors** (Blocking all workflows)
   - Add act detection to skip unsupported steps

2. **Fix Python permission issues** (Blocking Python jobs)
   - Test with `--userns=host` flag
   - If not working, modify workflows or use alternative Python setup

3. **Fix security vulnerabilities** (Blocking security-audit)
   - Run `npm audit fix` in backend directory
   - Verify with `npm audit --audit-level=high`

4. **Remove unused dependencies** (Blocking dependency-check)
   - Remove identified unused dependencies
   - Run depcheck to verify

5. **Re-run all workflows with act** to verify fixes

## Next Steps

1. Apply fixes in order of priority
2. Re-run `act -l` to verify workflows load
3. Run key jobs to verify they pass
4. Document any remaining issues
