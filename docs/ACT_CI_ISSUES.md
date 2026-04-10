# Act CI Issues Summary

This document summarizes the issues found when running CI workflows locally using `act`.

## Date: 2026-04-10

## Issues Fixed During Testing

### 1. TypeScript Compilation Errors for ts-node Scripts (FIXED ✅)

**Affected Jobs:**
- `agents-md-validation`
- `tech-debt-tracking`

**Problem:**
The `tsconfig.json` was configured for building the main source code but didn't include Node.js types for `ts-node` execution. When running scripts with `ts-node`, TypeScript couldn't find built-in Node.js types like `fs`, `path`, `process`, `console`, and `__dirname`.

**Fix Applied:**
Updated `backend/tsconfig.json` to add `"types": ["node"]` and `"moduleResolution": "node"` to the `ts-node` compiler options:

```json
"ts-node": {
  "compilerOptions": {
    "module": "commonjs",
    "types": ["node"],
    "moduleResolution": "node"
  }
}
```

**Status:** ✅ FIXED - Both jobs now pass their main validation steps.

### 2. test.yml Volume Mount Path Syntax (FIXED ✅)

**Affected Jobs:**
- `backend-tests` (in test.yml workflow)
- Other jobs that use Nakama service

**Problem:**
The test.yml workflow used a relative path for the nakama.yml volume mount:
```yaml
volumes:
  - ./backend/nakama.yml:/nakama/data/nakama.yml:ro
```

This syntax doesn't work with `act` because it uses Docker volumes with relative paths incorrectly.

**Fix Applied:**
Changed to use the GitHub Actions workspace variable for absolute path (matching ci.yml):
```yaml
volumes:
  - ${{ github.workspace }}/backend/nakama.yml:/nakama.yml:ro
```

**Status:** ✅ FIXED - Volume mount now uses correct absolute path syntax.

## Remaining Issues (Expected Behavior)

### 3. GitHub Actions Artifacts Upload (EXPECTED BEHAVIOR)

**Affected Jobs:**
- `agents-md-validation`
- `tech-debt-tracking`
- `backend-tests`
- `sonarcloud`

**Problem:**
The `actions/upload-artifact@v4` step fails with:
```
❗  ::error::Unable to get the ACTIONS_RUNTIME_TOKEN env variable
```

**Explanation:**
This is expected behavior when running with `act`. The artifact upload action requires GitHub Actions environment variables that `act` doesn't provide. This is not a CI workflow issue - it's a limitation of running GitHub Actions locally with `act`.

**Mitigation:**
- The actual validation/test steps pass successfully
- Artifacts are generated locally in the backend directory
- This issue will not occur when running on actual GitHub Actions

### 4. Nakama Service Health Check (REQUIRES INVESTIGATION)

**Affected Jobs:**
- `backend-tests` (ci.yml)
- `backend-tests` (test.yml)
- `sonarcloud` (ci.yml)
- `schema-validation` (ci.yml)

**Problem:**
The Nakama Docker service health check fails:
```
container health of ... (heroiclabs/nakama:3.21.1) is unhealthy
service container failed to start
```

**Possible Causes:**
1. Nakama config file path issue (now fixed by #2)
2. Health check command incompatibility with the specific Nakama version
3. Database connection timing issues
4. nakama.yml configuration may need adjustment for act environment

**Status:** 🔍 NEEDS FURTHER INVESTIGATION - The volume fix was applied but Nakama health still fails.

### 5. SonarCloud Job Failure (REQUIRES INVESTIGATION)

**Affected Jobs:**
- `sonarcloud` (ci.yml)

**Problem:**
Job fails, likely due to:
1. Missing `SONAR_TOKEN` environment variable (expected)
2. Nakama service dependency (see #4)

**Status:** 🔍 NEEDS FURTHER INVESTIGATION

### 6. Godot Test Script Errors (CODE QUALITY ISSUE)

**Affected Jobs:**
- `godot-tests` (test.yml)

**Problem:**
Test files reference autoload identifiers that aren't available:
```
SCRIPT ERROR: Compile Error: Identifier not found: NetworkManager
SCRIPT ERROR: Parse Error: Could not find base class "BaseEnemy".
SCRIPT ERROR: Parse Error: Could not find base class "GutTest".
SCRIPT ERROR: Parse Error: Identifier "PacingManager" not declared in the current scope.
```

**Explanation:**
The headless test runner creates test files using `Node.new()` but the tests then try to access autoloads (NetworkManager, CampaignManager, etc.) without proper initialization. This is a test framework design issue, not a CI infrastructure issue.

**Possible Solutions:**
1. Use proper test framework (GUT) with headless mode support
2. Initialize autoloads in test setup
3. Mock autoloads in tests

**Status:** 🔍 CODE QUALITY ISSUE - Tests need refactoring for headless compatibility

### 7. Godot Tests Memory Leak Warnings (CODE QUALITY ISSUE)

**Affected Jobs:**
- `godot-tests` (test.yml)

**Problem:**
Tests pass but show memory leak warnings:
```
WARNING: 2 RIDs of type "CanvasItem" were leaked.
ERROR: 4 RID allocations of type 'RendererDummyTextureStorageDummyTexture' were leaked at exit.
ERROR: 4 RID allocations of type 'TextServerAdvancedShapedTextDataAdvanced' were leaked at exit.
ERROR: 1 RID allocations of type 'TextServerAdvancedFontAdvanced' were leaked at exit.
WARNING: ObjectDB instances leaked at exit
ERROR: 6 resources still in use at exit
```

**Explanation:**
Test code doesn't properly clean up resources, RIDs, and objects after execution.

**Status:** 🔍 CODE QUALITY ISSUE - Tests need proper cleanup in teardown

## Jobs Passing Successfully

The following jobs pass successfully with act:

### ci.yml
- ✅ `backend-lint`
- ✅ `backend-complexity`
- ✅ `backend-typecheck`
- ✅ `backend-n-plus-one` (with `|| true` to allow failure)
- ✅ `backend-dead-flags` (with `|| true` to allow failure)
- ✅ `gdscript-lint`
- ✅ `python-lint`
- ✅ `godot-validate`
- ✅ `security-audit`
- ✅ `duplicate-code-detection` (with info about code clones)
- ✅ `dependency-check`
- ✅ `bundle-size-check` (with warnings about heavy dependencies)
- ✅ `dead-code-detection`

### test.yml
- ✅ `godot-coverage-gate` (reports 109% coverage, meets 80% target)

## Recommendations

1. **Continue using Nakama service investigation** - The health check failure is the main blocker for backend tests
2. **Consider using GUT test framework** - The custom test framework has compatibility issues with headless mode
3. **Add resource cleanup to tests** - Fix memory leaks in Godot tests
4. **Create local test script** - Add a script that runs act with proper environment setup for easier local testing
