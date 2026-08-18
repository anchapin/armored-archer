# CI Testing with Act

This directory contains resources for running GitHub Actions workflows locally using [act](https://github.com/nektos/act).

## Quick Start

```bash
# Clean up any previous act resources (if needed)
docker rm -f $(docker ps -aq -f "name=act-") 2>/dev/null || true

# Run specific jobs
act -j backend-lint
act -j backend-typecheck

# Run jobs with services (PostgreSQL, Nakama)
act -j backend-test --job-timeout=30m
act -j schema-validation

# Run all CI jobs
act -W .github/workflows/ci.yml
```

## What is Act?

`act` is a tool for running GitHub Actions locally. It uses Docker to run the workflow jobs in a containerized environment that closely matches GitHub's runners.

### Installation

```bash
# macOS (Homebrew)
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Or download from releases
wget https://github.com/nektos/act/releases/latest/download/act_linux_amd64.tar.gz
tar xzf act_linux_amd64.tar.gz
sudo mv act /usr/local/bin/
```

## Running Workflows

### Quick Checks (No Services)

```bash
# Backend linting
act -j backend-lint

# Type checking
act -j backend-typecheck

# GDScript linting
act -j gdscript-lint

# Python linting
act -j python-lint

# Dependency check
act -j dependency-check

# Godot project validation
act -j godot-validate
```

### Jobs with Database Services

These jobs automatically start PostgreSQL and Nakama services:

```bash
# Backend tests (includes PostgreSQL + Nakama)
act -j backend-test --job-timeout=30m

# Backend integration tests (includes PostgreSQL + Nakama + game bundle)
# PREREQUISITE: cd backend && npm run build:full
# Services run on PostgreSQL:5438, Nakama:7352/7353 (host port overrides so
# they don't clash with the dev stack at :5432/:7350). The bundle is mounted
# read-only into the container, mirroring the hosted runner.
act -j backend-integration-test --job-timeout=30m

# Schema validation (includes PostgreSQL)
act -j schema-validation

# SonarCloud setup (skips actual scan in act)
act -j sonarcloud
```

### Running Multiple Jobs

```bash
# Run all jobs in CI workflow
act -W .github/workflows/ci.yml

# List all available jobs
act -W .github/workflows/ci.yml --list

# Run specific jobs
act -W .github/workflows/ci.yml -j backend-lint
act -W .github/workflows/ci.yml -j backend-test
```

## Test Results

All CI jobs are tested and working with act:

| Job | Test Date | Status |
|-----|-----------|--------|
| backend-lint | 2026-04-12 | ✅ Passed |
| backend-typecheck | 2026-04-12 | ✅ Passed |
| backend-test | 2026-04-12 | ✅ Passed (2473 tests) |
| gdscript-lint | 2026-04-12 | ✅ Passed |
| python-lint | 2026-04-12 | ✅ Passed |
| duplicate-code-detection | 2026-04-12 | ✅ Passed |
| dependency-check | 2026-04-12 | ✅ Passed |
| godot-validate | 2026-04-12 | ✅ Passed |
| schema-validation | 2026-04-12 | ✅ Passed |

## Troubleshooting

### Port Conflicts

If you get "port is already allocated" errors:

```bash
# Clean up leftover act containers
docker rm -f $(docker ps -aq -f "name=act-") 2>/dev/null || true

# Also clean up networks
docker network prune -f
```

### Services Not Starting

If services fail to start:

```bash
# Check container status
docker ps -a --filter "name=act-"

# Check specific container logs
docker logs <container-id>

# Verify Docker is running
docker ps
```

### Job Timeout

For jobs with services that take longer:

```bash
act -j backend-test --job-timeout=30m
```

### Architecture Issues (Apple Silicon)

If you're on Apple Silicon (M1/M2/M3):

```bash
act -j backend-test --container-architecture linux/amd64
```

## Act Compatibility Features

The workflows include several features for act compatibility:

### 1. Automatic Codecov Skip

```yaml
- if: success() && steps.detect-worktree.outputs.is_worktree == '0'
  # Only runs in GitHub Actions, skipped for act
```

### 2. SonarCloud Skip

```yaml
- if: env.ACT != 'true'
  # Only runs in GitHub Actions, skipped for act
```

### 3. Godot Tests Skip

```yaml
- if: env.ACT != 'true'
  # Only runs in GitHub Actions, skipped for act (OOM issues in containers)
```

### 4. Service Port Allocation

Different jobs use different ports to avoid conflicts:
- `backend-test`: PostgreSQL on 5432, Nakama on 7350
- `backend-integration-test`: PostgreSQL on 5438, Nakama on 7352 (API) / 7353 (console); also mounts `./backend/data/modules` into the Nakama container at `/nakama/data/modules:ro` (the compiled game bundle — built via `cd backend && npm run build:full` before the job runs)
- `schema-validation`: PostgreSQL on 5433
- `sonarcloud`: PostgreSQL on 5434, Nakama on 7351

## Advanced Usage

### Verbose Output

```bash
act -j backend-test -v
```

### Dry Run

```bash
act -n -W .github/workflows/ci.yml
```

### Without Cache

```bash
act -j backend-test --no-cached
```

### Environment Variables

```bash
# Disable telemetry
ACT_TELEMETRY_DISABLED=1 act -j backend-test
```

## Best Practices

### Development Workflow

```bash
# 1. Make changes

# 2. Run quick checks
act -j backend-lint
act -j backend-typecheck

# 3. Run full test suite if checks pass
act -j backend-test --job-timeout=30m

# 4. Clean up
docker rm -f $(docker ps -aq -f "name=act-") 2>/dev/null || true
```

### Before Committing

```bash
# Run a quick validation
act -j backend-lint
act -j backend-typecheck
act -j gdscript-lint
```

### Before Pushing

```bash
# Run full test suite
act -j backend-test --job-timeout=30m
act -j schema-validation
```

## Expected Limitations

Some steps are automatically skipped when running with act:

- **Codecov uploads** - Skipped (requires GitHub context)
- **SonarCloud scans** - Skipped (requires GitHub secrets)
- **Godot tests** - Skipped (OOM issues in Docker containers)
- **Artifact uploads** - May show warnings (non-critical)

These skips are expected and don't affect the validity of local testing.

## References

- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [See also: `docs/ACT_CI_SUMMARY.md`](../docs/ACT_CI_SUMMARY.md) for detailed test results
