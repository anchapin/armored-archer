# CI Issues and Fixes Plan

Generated on: 2026-04-10

## Summary of Findings

After running CI workflows locally using `act`, the following issues were identified:

## Issue 1: TypeScript moduleResolution Deprecation Warning (HIGH PRIORITY)

**Status**: FAILED - `backend-typecheck` job fails due to deprecation warning

**Error Message**:
```
tsconfig.json(16,25): error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

**Root Cause**:
The `moduleResolution: "node"` option defaults to `node10` which is deprecated in TypeScript 5.x.

**Fix Options**:

**Option A: Update to modern moduleResolution (Recommended)**
1. Update `backend/tsconfig.json`:
   ```json
   "moduleResolution": "bundler",
   // OR for Node.js 20:
   "moduleResolution": "nodenext",
   ```

**Option B: Suppress deprecation warning**
Add to `backend/tsconfig.json`:
```json
"ignoreDeprecations": "6.0"
```

**Option C: Update target and moduleResolution together**
```json
"target": "ES2022",
"module": "node16",
"moduleResolution": "node16"
```

**Recommended Action**: Use Option A with `"moduleResolution": "nodenext"` for Node.js 20 compatibility.

---

## Issue 2: Python Lint Errors (MEDIUM PRIORITY)

**Status**: FAILED - `python-lint` job reports 7 lint errors

**Issues Found**:

1. **C901 - Function too complex**:
   - File: `.claude/skills/godot-task/tools/godot_api_converter.py:152`
   - Issue: `parse_class` function complexity 45 > 15
   - Fix: Refactor into smaller functions or use extraction methods

2. **B007 - Unused loop variable**:
   - File: `.claude/skills/godot-task/tools/godot_api_converter.py:356`
   - Issue: Variable `cvalue` not used
   - Fix: Rename to `_cvalue` or remove if unused

3. **F841 - Assigned but never used**:
   - File: `.planning/milestones/v3.2.0-phases/08-equipment-ui-sprites/generate_equipment_spriteframes.py:64`
   - Issue: Variable `sprite_name` assigned but never used
   - Fix: Remove the assignment

4. **E722 - Bare except**:
   - File: `app_store_assets/generate_screenshots.py:45`
   - Issue: Bare `except` statement
   - Fix: Specify exception type: `except Exception as e:`

5. **F841 - Assigned but never used**:
   - File: `app_store_assets/generate_screenshots.py:65`
   - Issue: Variable `center_y` assigned but never used
   - Fix: Remove the assignment

6. **B007 - Unused loop variable**:
   - File: `app_store_assets/generate_screenshots.py:112`
   - Issue: Variable `i` not used
   - Fix: Rename to `_i` or remove if unused

7. **RUF013 - Implicit Optional**:
   - File: `scripts/analyze_repo.py:124`
   - Issue: Parameter `content_pattern: str = None` should be explicitly `Optional[str]`
   - Fix: Add `from typing import Optional` and change to `content_pattern: Optional[str] = None`

---

## Issue 3: GDScript Lint Errors (LOW PRIORITY)

**Status**: FAILED - `gdscript-lint` job reports 40+ errors

**Root Cause**:
The errors are all from the GUT (Godot Unit Test) third-party addon:
- `./addons/gut/` directory contains test framework code
- Errors are naming convention violations (class-variable-name, enum-name, etc.)
- This is third-party code that should be excluded from linting

**Fix**:
Update `.github/workflows/ci.yml` to exclude GUT addon from linting:
```yaml
- name: Run gdlint
  run: gdlint autoloads/ scripts/ test/ --exclude addons/gut/
```

Alternatively, create a `.gdlintrc` configuration file to exclude the addons directory.

---

## Issue 4: Nakama Service Healthcheck Failure (HIGH PRIORITY)

**Status**: FAILED - `backend-test` job fails due to Nakama service being unhealthy

**Root Cause**:
1. The CI workflow sets `DATABASE_ADDRESS` to `postgres://postgres:changeme@localhost:5432/nakama?sslmode=disable`
2. Docker services communicate via service names, not `localhost`
3. The `nakama.yml` has `address: []` (empty database address)

**Fix**:
Update `.github/workflows/ci.yml` to use the correct database address:
```yaml
- name: Nakama game server service
  image: heroiclabs/nakama:3.21.1
  env:
    NAKAMA_SERVER_KEY: defaultkey
    NAKAMA_SERVER_PORT: 7350
    DATABASE_ADDRESS: postgres://postgres:changeme@postgres:5432/nakama?sslmode=disable  # Changed localhost to postgres
```

---

## Issue 5: Docker Port Conflicts (MEDIUM PRIORITY)

**Status**: BLOCKING - Cannot run `backend-test` job when local Nakama is running

**Root Cause**:
When running `act`, the job tries to bind port 7350 which is already allocated by a locally running Nakama container.

**Fix**:
Either:
1. Stop local Nakama service before running `act`:
   ```bash
   docker stop armored_archer_server armored_archer_db
   ```

2. Configure `act` to use different ports (requires workflow modification)

3. Use Docker network isolation properly in act configuration

---

## Issue 6: GDScript Complexity Threshold (LOW PRIORITY)

**Status**: PASSED - But worth noting

**Findings**:
Duplicate code detection shows:
- GDScript: 2.79% duplicated lines (782 lines)
- 47 clones found
- Most complex duplicate in GearBalanceCalculator.gd and GearRegistry.gd

**Fix**:
Consider refactoring common gear-related code into a shared utility.

---

## Act Configuration Notes

### Current `.actrc` Configuration
The `.actrc` file uses host networking which causes port conflicts:
```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04
```

### For jobs with services (postgres, nakama):
Run with specific platform image:
```bash
act -P ubuntu-latest=catthehacker/ubuntu:act-latest -W .github/workflows/ci.yml -j backend-test
```

---

## Action Items in Priority Order

1. **HIGH**: Fix TypeScript moduleResolution deprecation (Issue 1)
2. **HIGH**: Fix Nakama service DATABASE_ADDRESS (Issue 4)
3. **MEDIUM**: Fix Python lint errors (Issue 2)
4. **LOW**: Exclude GUT from GDScript linting (Issue 3)
5. **LOW**: Consider refactoring GDScript duplicate code (Issue 6)

---

## Testing Strategy

After fixes are applied, verify with:

```bash
# Test individual jobs
act -W .github/workflows/ci.yml -j backend-lint
act -W .github/workflows/ci.yml -j backend-typecheck
act -W .github/workflows/ci.yml -j python-lint
act -W .github/workflows/ci.yml -j gdscript-lint
act -W .github/workflows/ci.yml -j godot-validate

# Test with services (requires stopping local Nakama)
docker stop armored_archer_server armored_archer_db
act -W .github/workflows/ci.yml -j backend-test

# Restart services after testing
docker start armored_archer_db armored_archer_server
```
