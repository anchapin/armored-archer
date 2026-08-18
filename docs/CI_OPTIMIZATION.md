# CI Optimization for Local Development

This document describes the optimizations made to speed up local CI runs using `act` and Docker Compose.

## Overview

The CI pipeline has been optimized for faster local development iterations with the following improvements:

1. **Fast docker-compose configuration** with optimized health checks
2. **Local act configuration** (`.actrc-local`) for better caching
3. **Parallel job execution** support (up to 4 workers)
4. **Service persistence** to avoid startup overhead
5. **Phased execution** - run fast jobs first for quick feedback

## Files Added

### 1. `.actrc-local` (local, not committed)
Local act configuration with optimized settings for faster runs.

**Features:**
- `--reuse` - Reuse containers between runs
- `--pull=missing` - Only pull images not already cached
- Container volume mounts for npm cache
- Reduced resource requirements
- Parallel execution support

**Usage:**
```bash
# Copy the template to your local file
cp .actrc .actrc-local
# Edit .actrc-local to enable optimizations
act -j backend-test -P .actrc-local
```

### 2. `.github/docker-compose-ci-fast.yml`
Optimized docker-compose file for CI services.

**Optimizations:**
- Faster health checks (2s intervals vs 10s)
- Fewer retries (10 vs 30-60)
- No persistent volumes (stateless, faster startup)
- Alpine images where possible
- Reduced PostgreSQL sync settings for CI

**Service timings:**
- PostgreSQL: Ready in ~5-10s (vs 30-60s)
- Nakama: Ready in ~20-40s (vs 60-120s)

### 3. `scripts/ci-local.sh`
New fast CI runner with advanced features.

**Features:**
- Parallel job execution (4 workers by default)
- Service persistence option
- Phased execution (fast jobs first)
- Better progress reporting
- Colored output for readability
- Detailed summary with timing

## Usage

### Basic Usage

```bash
# Run all jobs with default settings
./scripts/ci-local.sh

# Run specific job
./scripts/ci-local.sh backend-lint

# Show help
./scripts/ci-local.sh --help
```

### Fast Mode (Recommended for Development)

```bash
# Use fast docker-compose with optimized health checks
./scripts/ci-local.sh --fast

# Combine with parallel execution for maximum speed
./scripts/ci-local.sh --fast --parallel
```

### Service Persistence

```bash
# Keep services running after completion (useful for multiple runs)
./scripts/ci-local.sh --fast --persist

# Now run individual jobs without startup overhead
./scripts/ci-local.sh backend-test
./scripts/ci-local.sh schema-validation

# Stop services when done
./scripts/ci-local.sh --clean
```

### Service Management

```bash
# Check service status
./scripts/ci-local.sh --status

# Stop and cleanup
./scripts/ci-local.sh --clean
```

## Comparison: Before vs After

### Service Startup Times

| Service | Before | After | Improvement |
|---------|--------|-------|-------------|
| PostgreSQL | 30-60s | 5-10s | **75-85% faster** |
| Nakama | 60-120s | 20-40s | **67-75% faster** |
| Total startup | 90-180s | 25-50s | **70-75% faster** |

### Full CI Run Times

| Mode | Before | After | Improvement |
|------|--------|-------|-------------|
| Sequential | 10-15 min | 4-6 min | **50-60% faster** |
| Parallel | N/A | 2-3 min | **New capability** |

### Job Categories

**Fast Jobs (2-10s each):**
- `godot-validate`
- `python-lint`
- `gdscript-lint`
- `backend-lint`
- `backend-typecheck`

**Service Jobs (30-60s each):**
- `backend-test`
- `schema-validation`

**Service Jobs with bundle mount (45-90s each):**
- `backend-integration-test` — boots PostgreSQL on **5438** + Nakama on **7352**/**7353** and mounts the compiled game bundle (`./backend/data/modules`) read-only into the Nakama container at `/nakama/data/modules`. Prerequisite: `cd backend && npm run build:full`. Local mirror: `make ci-services-start` (prefights bundle, then asserts `--require-nakama-bundle`); `make ci-services-status` fails fast when `/nakama/data/modules` is empty. (Pass-2 of issue #1126.)

**Slow Jobs (1-3 min each):**
- `security-audit`
- `sonarcloud`
- `bundle-size-check`

## Configuration Options

### Environment Variables

```bash
# Service ports
export NAKAMA_PORT=7350
export TEST_DB_PORT=5432

# Service credentials
export POSTGRES_PASSWORD=changeme
export NAKAMA_SERVER_KEY=defaultkey
```

### Act Configuration

Edit `.actrc-local` to customize:

```bash
# Enable parallel execution
--parallel

# Use slim images
-P ubuntu-latest=node:20-slim

# Set memory limit
--container-options --memory=2g
```

## Troubleshooting

### Services not starting

```bash
# Check service logs
docker compose -f .github/docker-compose-ci-fast.yml -p ci-fast logs

# Reset services
./scripts/ci-local.sh --clean
./scripts/ci-local.sh --fast
```

### Port conflicts

```bash
# Check what's using the ports
lsof -i :5432  # PostgreSQL
lsof -i :7350  # Nakama

# Use different ports in environment variables
export TEST_DB_PORT=5433
export NAKAMA_PORT=7351
```

### Act cache issues

```bash
# Clear act cache
rm -rf ~/.act-cache/
rm -rf act-cache/

# Rebuild containers
act -P ubuntu-latest=node:20 -j backend-test --rebuild
```

## Best Practices

1. **Use `--fast --persist` for development**: Keeps services running for repeated runs
2. **Run fast jobs first**: Get quick feedback before running expensive tests
3. **Use parallel mode for full CI**: `--fast --parallel` for fastest complete run
4. **Clean up periodically**: Run `--clean` to free disk space
5. **Monitor service status**: Use `--status` before running service-dependent jobs

## Integration with CI

The fast configurations are designed to match GitHub Actions CI behavior while being much faster locally. All tests pass the same way in both environments.

### CI vs Local Matrix

| Feature | GitHub Actions | Local (fast) |
|---------|---------------|--------------|
| Service startup | ~60s | ~30s |
| Job parallelization | Yes (8 workers) | Yes (4 workers) |
| Artifact uploads | Yes | No (not needed locally) |
| Coverage upload | Yes | Skipped (detected) |
| SonarCloud scan | Yes | Skipped (needs token) |

## Future Improvements

Potential areas for further optimization:

1. **Pre-built Docker images**: Build and cache custom images with all dependencies
2. **Shared npm cache across jobs**: Use external cache directory
3. **Incremental test running**: Only run tests for changed files
4. **Test sharding**: Split tests across parallel workers
5. ** smarter job scheduling**: Run fast jobs in parallel, slow jobs sequentially

## References

- [act Documentation](https://github.com/nektos/act)
- [Docker Compose Healthchecks](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
