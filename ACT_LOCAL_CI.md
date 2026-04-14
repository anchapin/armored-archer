# Local CI Testing with Act

This document summarizes testing of GitHub Actions workflows locally using the `act` CLI tool.

## Act Status

| Component | Version/Status |
|------------|----------------|
| act CLI | v0.2.87 ✓ Working |
| Docker | ✓ Functional |
| workflows | ✓ Configured correctly |

## Running Act Locally

### Basic Usage

```bash
# List all workflows and jobs
act -l

# Run a specific job (recommended for faster iteration)
act -W .github/workflows/ci.yml -j backend-lint

# Run entire workflow (may have port conflicts with service jobs)
act -W .github/workflows/ci.yml push

# Run with cache disabled (recommended)
act -W .github/workflows/ci.yml push --no-cache-server
```

## Known Issues and Workarounds

### 1. Act Cache Server Corruption ⚠️

**Problem**: Docker volumes used by act's cache server contain corrupted npm package cache. This causes `npm ci` to fail with `EINTEGRITY` error when trying to fetch packages like `@typescript-eslint/scope-manager`.

**Error**:
```
npm error Invalid response body while trying to fetch https://registry.npmjs.org/@typescript-eslint%2fscope-manager: sha512-dbL2lwDxYYa+oX3vdekdRwC0c6T/15Jr36A/2WNds0F4WZIsbKfKAbaaBQr72iblkOEHU7xl8xr9nOnC6zpXaQ== integrity checksum failed
```

**Workaround**: Use `--no-cache-server` flag to bypass the cache server:
```bash
act -W .github/workflows/ci.yml push --no-cache-server
```

**Root Cause**: The Docker volumes storing npm cache were not properly cleaned and contain mismatched package checksums.

### 2. Port Conflicts with Service Jobs ⚠️

**Problem**: When running multiple jobs that use service containers (PostgreSQL on port 5432, Nakama on ports 7350/7351) in parallel, port binding conflicts occur.

**Affected Jobs**:
- `backend-test` (uses postgres:5432, nakama:7350)
- `schema-validation` (uses postgres:5433)
- `sonarcloud` (uses postgres:5434, nakama:7351)

**Workarounds**:
1. Run jobs sequentially with `--concurrent-jobs 1`
2. Clean up containers between runs: `docker ps -aq | xargs -r docker rm -f`

### 3. Test Coverage Thresholds Below Target ⚠️

**Problem**: Backend tests pass (2721 tests) but don't meet coverage thresholds configured in Jest.

**Coverage Issues**:
- Global branch coverage: 78.98% (threshold: 80%)
- `rpg_system.ts`: ~40% coverage (threshold: 80%)

**Note**: This is a **code quality issue**, not an act problem. The code needs more test coverage to pass CI.

### 4. Godot Tests Intentionally Skipped ℹ️

**Status**: The workflow explicitly skips Godot tests when running with act.

**Reason**: OOM (Out of Memory) issues in Docker containers with Godot engine.

**Workflow Code**:
```yaml
- name: Skip for act (OOM issue)
  if: env.ACT == 'true'
  run: |
    echo "⚠️  Skipping Godot tests for act (ACT environment detected)"
    echo "❌ Godot tests cause OOM in Docker containers with act"
    echo "✅ Tests must be run with Godot Editor or on GitHub Actions CI"
```

**Alternative**: Run Godot tests locally:
```bash
godot --headless --script test/run_all_tests.gd
```

## Job Testing Results

| Job | Status | Notes |
|------|--------|-------|
| `godot-validate` | ✓ Success | Validates project.godot and autoload scripts |
| `backend-lint` | ✓ Success | ESLint passes with `--no-cache-server` |
| `backend-typecheck` | ✓ Success | TypeScript compilation passes |
| `backend-complexity` | ✓ Success | Cyclomatic complexity within limits |
| `gdscript-lint` | ✓ Success | No GDScript lint issues |
| `python-lint` | ✓ Success | Ruff passes all checks |
| `security-audit` | ✓ Success | No npm vulnerabilities found |
| `dependency-check` | ✓ Success | No unused dependencies |
| `schema-validation` | ✓ Success | PostgreSQL migrations run successfully |
| `duplicate-code-detection` | ✓ Success | 2.43% duplication (below 3% threshold) |
| `backend-test` | ✗ Coverage Gate | Tests pass (2721) but coverage at 78.98% (needs 80%) |
| `agents-md-validation` | ✗ Cache Error | Failed due to npm cache corruption (fixable with `--no-cache-server`) |

## Recommendations for Local CI Testing

1. **Always use `--no-cache-server` flag** to avoid cache corruption:
   ```bash
   act -W .github/workflows/ci.yml push --no-cache-server
   ```

2. **For faster iteration**, run specific jobs instead of full workflow:
   ```bash
   act -W .github/workflows/ci.yml -j backend-lint --no-cache-server
   ```

3. **Clean up Docker artifacts** periodically:
   ```bash
   # Stop and remove all act containers
   docker ps -aq | xargs -r docker stop && docker ps -aq | xargs -r docker rm

   # Remove old act networks
   docker network ls -q | grep act- | xargs -r docker network rm
   ```

4. **Run tests with coverage locally** before pushing:
   ```bash
   cd backend
   npm run test:coverage
   ```

5. **For service-based jobs**, run sequentially to avoid port conflicts:
   ```bash
   act -W .github/workflows/ci.yml push --concurrent-jobs 1 --no-cache-server
   ```

## Conclusion

Act is working correctly for this project. The main issues encountered are:

1. **Cache corruption** - solved by using `--no-cache-server`
2. **Coverage thresholds** - code quality issue (needs more tests in `rpg_system.ts`)
3. **Port conflicts** - can be managed by running jobs sequentially

The CI workflows are well-structured and will work properly on GitHub Actions CI. For local testing with act, use `--no-cache-server` and be aware that service-based jobs may need sequential execution.
