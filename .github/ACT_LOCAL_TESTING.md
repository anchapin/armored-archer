# Local CI Testing with Act

This document provides guidance for running GitHub Actions CI workflows locally using [act](https://github.com/nektos/act).

## Installation

```bash
# Install act using Homebrew (macOS/Linux)
brew install act

# Or install using Docker
docker pull ghcr.io/nektos/act:latest

# Or install using npm
npm install -g @nektos/act
```

## Basic Usage

### List all available jobs

```bash
act -l
```

### Run a specific job

```bash
# Backend lint
act -j backend-lint --container-architecture linux/amd64

# Godot tests
act -W .github/workflows/test.yml -j godot-tests --container-architecture linux/amd64
```

### Run a specific workflow

```bash
# Run all CI jobs (excludes jobs marked for skip in act)
act -W .github/workflows/ci.yml --container-architecture linux/amd64

# Run all test jobs
act -W .github/workflows/test.yml --container-architecture linux/amd64
```

## Workflow-Specific Notes

### Jobs that Skip in Act

The following jobs are automatically skipped when running with `act`:

1. **SonarCloud** - Requires GitHub context variables and secrets
   - `SONAR_TOKEN` secret
   - `GITHUB_REF`, `GITHUB_SHA` context variables
   - These are not available in local act environment

2. **Codecov Upload** - May fail due to git worktree issues
   - The `CODECOV_SKIP` env var is set when `ACT=true`
   - Tests still run and generate coverage reports locally

### Port Conflicts

When running multiple workflows that use services (PostgreSQL, Nakama), you may encounter port conflicts:

```
Error: Bind for 0.0.0.0:7350 failed: port is already allocated
```

To resolve:

1. **Stop running containers**:
   ```bash
   docker ps -a | grep act | awk '{print $1}' | xargs -r docker rm -f
   ```

2. **Run workflows sequentially** instead of in parallel

3. **Use `--secret-file`** to provide required secrets (if needed):
   ```bash
   echo 'SONAR_TOKEN=your-token' > secrets.txt
   act --secret-file secrets.txt
   ```

## Quick Start

```bash
# Run lint and type checking (fastest)
act -j backend-lint,backend-typecheck,gdscript-lint,python-lint --container-architecture linux/amd64

# Run backend tests (requires services)
act -j backend-test --container-architecture linux/amd64

# Run Godot tests
act -W .github/workflows/test.yml -j godot-tests --container-architecture linux/amd64
```

## Environment Variables

When running with act, the following environment variable is automatically set:

- `ACT=true` - Used by workflows to detect local execution

Workflows check this variable to:
- Skip jobs that require GitHub context (SonarCloud)
- Skip Codecov uploads (due to git worktree issues)
- Adjust test configurations for local environment

## Troubleshooting

### "Image not found" errors

Pull the required images first:

```bash
docker pull ghcr.io/catthehacker/ubuntu:full-latest
docker pull postgres:14-alpine
docker pull postgres:15-alpine
docker pull armored-archer/nakama-postgres:3.21.1
```

### Cache issues

Clear act cache:

```bash
rm -rf ~/.cache/act
```

### Permission denied errors

```bash
# Fix Python hostedtoolcache (handled by workflow)
mkdir -p /opt/hostedtoolcache/Python

# Run with host network
act --container-architecture linux/amd64 --network host
```

## Continuous Testing

For iterative development, use:

```bash
# Watch for changes and re-run (using entr or similar)
while true; do
  act -j backend-lint --container-architecture linux/amd64
  sleep 5
done
```

## Resources

- [act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
