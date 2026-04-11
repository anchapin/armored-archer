# CI Workflow Act Summary

## Overview
This document summarizes how to run CI workflows locally using `act` (GitHub Actions local runner) and documents the configuration required for successful execution.

## Act Configuration

### Installation
```bash
# Install act via Homebrew
brew install act

# Or download from GitHub releases
curl -sL https://github.com/nektos/act/releases/latest/download/act_Linux_x86_64.tar.gz -o act.tar.gz
tar xzf act.tar.gz
```

### Project Configuration (.actrc)
The project includes a `.actrc` file with the following configuration:

```
# Godot Environment Variables
--env GODOT_HEADLESS=true
--env DISPLAY=:99

# Container architecture
--container-architecture linux/amd64

# Docker container options for Godot (volumes and shm-size)
--container-options --volume=/home/runner/.local/share/godot:/root/.local/share/godot
--container-options --volume=/home/runner/.config/godot:/root/.config/godot
--container-options --shm-size=2gb
```

**Note:** The original `.actrc` file used `--volume` and `--shm-size` flags directly, which are not supported by act version 0.2.87. These were changed to use `--container-options` instead.

## Custom Nakama Docker Image

### Why a Custom Image?
The Nakama game server defaults to CockroachDB but requires PostgreSQL for this project. GitHub Actions service containers don't support passing custom command-line arguments to configure Nakama, so a custom Docker image was created.

### Custom Image Location
- **Dockerfile**: `.docker/nakama-postgres/Dockerfile`
- **Image Name**: `armored-archer/nakama-postgres:3.21.1`

### Building the Custom Image
```bash
docker build -t armored-archer/nakama-postgres:3.21.1 -f .docker/nakama-postgres/Dockerfile .
```

### Custom Image Features
The custom Nakama image includes:
1. **PostgreSQL Wait Logic**: Waits for PostgreSQL to be ready before starting
2. **Automatic Migrations**: Runs Nakama database migrations automatically
3. **PostgreSQL Configuration**: Pre-configured with PostgreSQL connection settings

### Custom Image Entrypoint
```dockerfile
# Wrapper script that:
# 1. Waits for PostgreSQL (up to 60 retries)
# 2. Runs Nakama migrations
# 3. Starts Nakama with PostgreSQL config
ENTRYPOINT ["/usr/local/bin/nakama-entrypoint.sh"]
```

## CI Job Test Results

### ✅ Passing Jobs

| Job | Status | Notes |
|------|--------|--------|
| python-lint | ✅ Passes | Ruff linter with Python 3.10 |
| backend-lint | ✅ Passes | ESLint validates TypeScript code |
| backend-typecheck | ✅ Passes | TypeScript compilation succeeds |
| backend-complexity | ✅ Passes | Cyclomatic complexity within threshold |
| godot-validate | ✅ Passes | project.godot and autoload scripts valid |
| duplicate-code-detection | ✅ Passes | Duplicate code threshold 3 lines |
| backend-test | ✅ Passes | All 2405 tests pass with custom Nakama image |
| bundle-size-check | ✅ Passes | Bundle size tracking works |
| tech-debt-tracking | ✅ Passes | Technical debt tracking functional |
| backend-n-plus-one | ✅ Passes | N+1 query detection working |
| backend-dead-flags | ✅ Passes | Dead feature flag detection working |
| security-audit | ✅ Passes | Security audit runs successfully |
| log-scrubbing | ✅ Passes | Log scrubbing tests pass |
| n-plus-one-detection | ✅ Passes | N+1 detection with Nakama works |
| agents-md-validation | ✅ Passes | AGENTS.md validation passes |
| dead-code-detection | ✅ Passes | Dead code detection works |

### ⚠️ Jobs with Coverage Threshold Failures

| Job | Status | Issue | Details |
|------|--------|--------|---------|
| backend-test | ⚠️ Threshold Failures | Coverage thresholds not met | All tests pass, but some files below thresholds: |
| | | `src/config/index.ts` | Functions: 73.33% (required 78%) |
| | | `src/modules/stage_tracking.ts` | Statements: 66.86%, Branches: 63.85%, Lines: 66.46% (all require 80%) |

### 🔧 Jobs Requiring Special Configuration

| Job | Requirements | Notes |
|------|-------------|--------|
| sonarcloud | SONAR_TOKEN | Requires environment variables and SonarCloud setup |

## Running Act

### List Jobs
```bash
# List all available jobs
ACT_TELEMETRY_DISABLED=1 act -l

# List jobs for a specific workflow
ACT_TELEMETRY_DISABLED=1 act -l -W .github/workflows/ci.yml
```

### Run Specific Job
```bash
# Single job (uses default platform image)
ACT_TELEMETRY_DISABLED=1 act -j backend-lint

# Run backend-test with custom Nakama image
ACT_TELEMETRY_DISABLED=1 act -j backend-test --container-architecture linux/amd64 --pull=false
```

### Run with Custom Platform Image
```bash
# Use specific Docker image
ACT_TELEMETRY_DISABLED=1 act -P ubuntu-latest=node:20-bullseye -j <job-name>

# For Python-based jobs
ACT_TELEMETRY_DISABLED=1 act -P ubuntu-latest=python:3.10 -j python-lint
```

### Important Flags for Service Jobs
```bash
# --pull=false: Use local images (needed for custom Nakama image)
# --container-architecture: Specify container platform (linux/amd64 for compatibility)
act -j backend-test --pull=false --container-architecture linux/amd64
```

## Issues Found and Fixed

### 1. Nakama PostgreSQL Configuration
**Issue:** Nakama defaults to CockroachDB and was unable to connect to PostgreSQL. Service containers don't support passing custom command-line arguments.

**Fix:** Created custom Nakama Docker image (`.docker/nakama-postgres/Dockerfile`) that:
- Pre-configures PostgreSQL connection settings
- Waits for PostgreSQL to be ready
- Runs migrations automatically before starting

### 2. Nakama Health Check Failures
**Issue:** Nakama container became unhealthy because it started before PostgreSQL was ready.

**Fix:**
- Increased health check retries to 60
- Increased health start period to 60s
- Added PostgreSQL wait logic in entrypoint script

### 3. .actrc Configuration
**Issue:** Original `.actrc` used `--volume` and `--shm-size` flags not supported by act 0.2.87

**Fix:** Changed to use `--container-options` for Docker volume and shm-size configuration

### 4. benchmark-regression.yml YAML
**Issue:** Multi-line commit message causing YAML parsing error

**Fix:** Changed to single-line commit message format

### 5. ESLint Errors in gear_system.ts
**Issue:** Prettier formatting errors on lines 480 and 601

**Fix:** Applied `eslint --fix` to resolve formatting issues

### 6. Unused Variable in stage_tracking.ts
**Issue:** Unused `payload` parameter in `rpcGetCampaignProgress` function

**Fix:** Prefixed with underscore: `_payload`

### 7. Jest Duplicate Mock Warnings
**Issue:** Integration tests using `jest.integration.config.js` picked up duplicate mock files from both `src/__mocks__/` and `data/modules/__mocks__/` directories, causing Jest haste-map warnings.

**Fix:** Updated `jest.integration.config.js` to use `roots: ['<rootDir>/src']` instead of `roots: ['<rootDir>']` to exclude the `data/modules/__mocks__/` directory.

### 8. cd.yml Workflow Compatibility
**Issue:** Uses `environment` job property not supported by act

**Fix:** Act doesn't support this feature - workflow can only be run on GitHub CI

## GitHub Actions Deployment

### Pushing Custom Image to Registry
For GitHub Actions CI to work with the custom Nakama image, it must be available in a registry:

```bash
# Login to registry
docker login ghcr.io

# Tag image for GitHub Container Registry
docker tag armored-archer/nakama-postgres:3.21.1 ghcr.io/your-org/armored-archer/nakama-postgres:3.21.1

# Push to registry
docker push ghcr.io/your-org/armored-archer/nakama-postgres:3.21.1
```

Then update workflows to use the registry image:
```yaml
services:
  nakama:
    image: ghcr.io/your-org/armored-archer/nakama-postgres:3.21.1
```

## Limitations of Act vs GitHub Actions

1. **Environment Jobs**: Act doesn't support the `environment` job property
2. **Secrets**: Act secrets are read from `.secrets` file, not GitHub Secrets
3. **Context Variables**: Some GitHub context variables (e.g., `github.sha`, `github.event.inputs`) may need to be mocked
4. **Custom Images**: Local images require `--pull=false` flag
5. **Service Container Networking**: Service container networking may differ slightly from GitHub Actions

## Quick Reference

### Common Act Commands
```bash
# List all jobs
act -l

# Run all jobs in a workflow
act -W .github/workflows/ci.yml

# Run a specific job
act -j backend-test

# Run with dry run (no execution)
act -n -j backend-test

# Run with verbose output
act -v -j backend-test
```

### Environment Variables
```bash
# Disable act telemetry
ACT_TELEMETRY_DISABLED=1

# Set GitHub context variables (for testing)
GITHUB_SHA=$(git rev-parse HEAD) act -j <job>
```

## Recommendations

1. **For Local Development**: Use act for quick linting, type-checking, and validation before pushing
2. **For Full CI**: Push to GitHub to run complete CI pipeline with all services
3. **For Testing Changes**: Rebuild the custom Nakama image after any changes to `.docker/nakama-postgres/Dockerfile`
4. **For Service Jobs**: Always use `--pull=false` when running jobs that depend on local custom images
5. **For Debugging**: Use `-v` (verbose) and `-n` (dry run) flags to debug workflow issues

## Coverage Threshold Remediation

The following files need additional test coverage to meet thresholds:

### src/config/index.ts
- **Target**: Increase function coverage from 73.33% to 78%
- **Action**: Add tests for uncovered function paths

### src/modules/stage_tracking.ts
- **Target**: Increase all metrics to 80%
  - Statements: 66.86% → 80%
  - Branches: 63.85% → 80%
  - Lines: 66.46% → 80%
- **Action**: Add comprehensive tests for stage tracking logic
