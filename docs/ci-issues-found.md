# CI Issues Found During Act Testing

Date: 2026-04-10
Testing Tool: act (GitHub Actions local runner)

## Summary of Findings

### Jobs Tested

| Job | Status | Notes |
|------|----------|--------|
| backend-lint | ✅ PASSED | - |
| backend-typecheck | ✅ PASSED | Fixed tsconfig module issue |
| dead-code-detection | ✅ PASSED | Fixed ESLint ignores for __mocks__ |
| backend-complexity | ✅ PASSED | - |
| security-audit | ✅ PASSED | - |
| bundle-size-check | ✅ PASSED | - |
| godot-validate | ✅ PASSED | - |
| duplicate-code-detection | ✅ PASSED | - |
| python-lint | ❌ FAILED | 16 code quality issues |
| gdscript-lint | ❌ FAILED | 72 problems in GUT addon |
| backend-test | ❌ FAILED | Nakama service health check fails |
| schema-validation | ❌ FAILED | PostgreSQL port conflict |

---

## Issues Fixed

### 1. TypeScript Module Configuration Issue

**File**: `backend/tsconfig.json`

**Problem**: TypeScript compiler error:
```
tsconfig.json(4,15): error TS5110: Option 'module' must be set to 'Node16' when option 'moduleResolution' is set to 'Node16'.
```

**Root Cause**: The `module` was set to `"commonjs"` but `moduleResolution` was set to `"node16"`. TypeScript requires matching settings.

**Fix Applied**:
```json
// Changed from:
"module": "commonjs",

// To:
"module": "Node16",
```

**Status**: ✅ FIXED - backend-typecheck now passes

---

### 2. ESLint Mock Files Issue

**File**: `backend/eslint.config.js`

**Problem**: ESLint was trying to parse mock files that weren't in the TypeScript project:

```
Parsing error: "parserOptions.project" has been provided for @typescript-eslint/parser.
The file was not found in any of the provided project(s): src/__mocks__/nakama.ts
```

**Root Cause**: The `__mocks__` directory wasn't in ESLint's ignores list, so it tried to parse files that tsconfig.json excludes.

**Fix Applied**:
```javascript
// Added to ignores:
'**/__mocks__/**',
```

Also updated tsconfig.json to exclude `__mocks__`:
```json
"exclude": [
  "node_modules",
  "build",
  "**/*.test.ts",
  "**/__mocks__/**",
  "**/utils/eslint-rules/**"
],
```

**Status**: ✅ FIXED - dead-code-detection now passes

---

## Outstanding Issues

### 3. Python Linting Issues

**Job**: `python-lint`

**Count**: 16 errors found

**Error Types**:

1. **Complexity Issues (C901)**:
   - `.claude/skills/godot-task/tools/godot_api_converter.py:152:5` - `parse_class` is too complex (45 > 15)
   - `scripts/generate_report.py:83:5` - `generate_markdown_report` is too complex (16 > 15)
   - `scripts/generate_pixel_art.py:198:9` - `generate_ui_icon` is too complex (16 > 15)

2. **Unused Variables (B007, F841)**:
   - `.claude/skills/godot-task/tools/godot_api_converter.py:356:32` - `cvalue` not used
   - `scripts/generate_pixel_art.py:132:9` - `sway` assigned but never used
   - `scripts/generate_pixel_art.py:290:13` - `palette_key` assigned but never used
   - Multiple other instances...

3. **Deprecated Patterns (UP024)**:
   - `app_store_assets/generate_screenshots.py:45:12` - Replace `(OSError, IOError)` with `OSError`

4. **PEP 484 Violations (RUF013)**:
   - `scripts/analyze_repo.py:124:60` - Implicit `Optional` not allowed in type hints

5. **Code Style Issues**:
   - Multiple formatting issues like tuple concatenation suggestions

**Files Affected**:
- `.claude/skills/godot-task/tools/godot_api_converter.py`
- `app_store_assets/generate_screenshots.py`
- `scripts/analyze_repo.py`
- `scripts/generate_report.py`
- `scripts/generate_pixel_art.py`
- `scripts/godot_auto_fix.py`

**Status**: ❌ PENDING

**Suggested Actions**:
1. Refactor overly complex functions (>15 complexity)
2. Remove or prefix unused variables with underscore
3. Replace deprecated exception patterns
4. Fix PEP 484 type hint violations

---

### 4. GDScript Linting Issues

**Job**: `gdscript-lint`

**Count**: 72 problems found

**Issue Distribution**:
- Most issues are in `addons/gut/` directory (third-party testing framework)
- Some are in test files

**Example Errors in GUT Addon**:
```
./addons/gut/utils.gd:159: Error: Class-scope variable name "Compare" is not valid (class-variable-name)
./addons/gut/utils.gd:162: Error: Class-scope variable name "ResultExporter" is not valid (class-variable-name)
./addons/gut/test.gd:2923: Error: Max allowed file lines num (2500) exceeded (max-file-lines)
./addons/gut/test.gd:182: Error: Function name "_do_datatypes_match__fail_if_not" is not valid (function-name)
./addons/gut/error_tracker.gd:62: Error: Parsing error - unexpected token '='
```

**Root Cause**: GUT (Godot Unit Test) is a third-party testing framework that doesn't fully comply with the project's GDScript linting rules.

**Status**: ❌ PENDING

**Suggested Actions**:
1. **Option A**: Exclude GUT addon from linting (recommended - it's third-party)
2. **Option B**: Fork and fix GUT to comply with project standards
3. **Option C**: Disable problematic linting rules for third-party code

**Recommended Approach**: Add `.gdlintignore` file:
```
addons/gut/
```

---

### 5. Act Service Container Issues

**Jobs Affected**:
- `backend-test` - Nakama service health check fails
- `schema-validation` - PostgreSQL port conflict

#### Backend Test Job Issue

**Error**:
```
service container failed to start
container health of [container-id] (heroiclabs/nakama:3.21.1) is unhealthy
```

**Root Cause**: Act doesn't properly handle service volume mounts with `${{ github.workspace }}` substitution in Docker's volume mounting context.

**Workflow Configuration**:
```yaml
nakama:
  image: heroiclabs/nakama:3.21.1
  volumes:
    - ${{ github.workspace }}/backend/nakama.yml:/nakama/data/nakama.yml:ro
```

#### Schema Validation Job Issue

**Error**:
```
docker: Error response from daemon: failed to set up container networking:
driver failed programming external connectivity on endpoint jovial_ptolemy:
Bind for :::5432 failed: port is already allocated.
```

**Root Cause**: Port 5432 is already in use (possibly from a previous Docker run or local PostgreSQL instance).

**Status**: ❌ PENDING

**Suggested Actions**:
1. **Option A**: Create a separate workflow for local testing (`.github/workflows/ci-local.yml`)
2. **Option B**: Use `act` with specific workarounds:
   - Clean up orphaned Docker containers: `docker rm -f $(docker ps -aq)`
   - Use different port configurations for local testing
3. **Option C**: Skip services for local act testing by using:
   ```yaml
   if: github.event_name != 'pull_request' && github.event_name != 'push'
   ```

---

## Act Configuration Notes

### Current `.actrc` Configuration
```
# Container Architecture
--container-architecture linux/amd64

# Note: Volume mounts in workflows now use ${{ github.workspace }} for compatibility
# Note: For jobs with services (postgres, nakama), run with: act -P ... -W ...
# to use a different base image that doesn't require host networking
```

### Act Version Warning
```
level=error msg=🚨 This version of 'act' is vulnerable to CVE-2026-34041 and CVE-2026-34042
- please upgrade to 0.2.86 or later.
level=info msg=️📣 A newer version of 'act' is available - consider upgrading to 0.2.87.
```

**Action Required**: Update act to version 0.2.87 or later to fix CVEs

---

## Recommended Priority Actions

### High Priority (CI/Act compatibility)
1. Update `act` to latest version (0.2.87+) for security fixes
2. Create `.gdlintignore` to exclude GUT addon from GDScript linting
3. Fix service volume mount issues for act or create workaround

### Medium Priority (Code Quality)
1. Fix Python linting issues (16 errors)
   - Refactor complex functions
   - Remove unused variables
   - Fix PEP 484 violations

### Low Priority (Documentation)
1. Document act usage limitations and workarounds in CONTRIBUTING.md

---

## Passing CI Jobs

The following jobs run successfully with act:
- backend-lint
- backend-typecheck
- dead-code-detection
- backend-complexity
- security-audit
- bundle-size-check
- godot-validate
- duplicate-code-detection

---

## Act Usage Recommendations

### Running Jobs Without Services
For local testing without service dependencies:

```bash
# Skip jobs that require services
act -W .github/workflows/ci.yml --job backend-lint
act -W .github/workflows/ci.yml --job backend-typecheck
```

### Running Jobs With Services (Workaround)

```bash
# Clean up first
docker rm -f $(docker ps -aq)

# Use bind mode
act -j backend-test --bind

# Or skip volume mounts (if workflow supports it)
ACT_WORKSPACE=/var/tmp/vibe-kanban/worktrees/8a6c-armored-archer-b/armored-archer act
```
