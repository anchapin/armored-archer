# CI Testing with Act

This directory contains resources for running GitHub Actions workflows locally using [act](https://github.com/nektos/act).

## Quick Start

```bash
# 1. Start CI services (PostgreSQL + Nakama on CI ports)
make ci-services-start

# 2. Run the test workflow
act -W .github/workflows/test.yml

# 3. Run other CI workflows
act -W .github/workflows/ci.yml

# 4. Stop CI services when done
make ci-services-stop
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

## CI Services

The project includes a CI-specific Docker Compose setup that matches the CI environment exactly:

| Service | CI Port | Dev Port | Note |
|---------|---------|----------|------|
| PostgreSQL | `5432` | `5433` | CI uses standard port |
| Nakama | `7350` | `7350` | Same port |

### Why Different Ports?

The CI uses port `5432` for PostgreSQL because GitHub Actions services bind directly to the host, not through Docker networking. This matches how GitHub Actions runs services.

### Starting CI Services

```bash
# Using make (recommended)
make ci-services-start

# Or directly with docker compose
docker compose -f .github/docker-compose.yml -p ci-armored-archer up -d

# Or using the helper script
.github/run-ci-services.sh start
```

### Stopping CI Services

```bash
make ci-services-stop
# or
docker compose -f .github/docker-compose.yml -p ci-armored-archer down
# or
.github/run-ci-services.sh stop
```

## Running Workflows

### Test Workflow

```bash
# Run all test jobs
act -W .github/workflows/test.yml

# Run specific job
act -W .github/workflows/test.yml -j godot-tests

# Run with verbose output
act -W .github/workflows/test.yml -v

# Run without cache
act -W .github/workflows/test.yml --no-cached

# Force container architecture (for Apple Silicon)
act -W .github/workflows/test.yml --container-architecture linux/amd64
```

### Main CI Workflow

```bash
# Run all CI jobs
act -W .github/workflows/ci.yml

# Run specific jobs
act -W .github/workflows/ci.yml -j backend-lint
act -W .github/workflows/ci.yml -j python-lint
act -W .github/workflows/ci.yml -j gdscript-lint
```

### List Available Jobs

```bash
act -W .github/workflows/test.yml --list
act -W .github/workflows/ci.yml --list
```

## Expected Local CI Limitations

Some steps will show "Failed but continue next step" when running locally. These are **expected** and don't indicate actual workflow issues:

- **Artifact uploads**: Missing `ACTIONS_RUNTIME_TOKEN` environment variable
- **Codecov uploads**: Missing GitHub API tokens
- **External service integrations**: GitHub-specific features

These steps have `continue-on-error: true` and don't cause the job to fail.

## Troubleshooting

### Services Not Ready

If you see database connection errors:

```bash
# Check CI services status
make ci-services-status

# Check service health
docker compose -f .github/docker-compose.yml -p ci-armored-archer ps

# View service logs
docker compose -f .github/docker-compose.yml -p ci-armored-archer logs
```

### Port Conflicts

If you get port conflicts (e.g., PostgreSQL already on 5432):

```bash
# Stop any dev services that might be using the ports
make services-stop

# Or check what's using the port
lsof -i :5432
lsof -i :7350
```

### Architecture Issues (Apple Silicon)

If you're on Apple Silicon (M1/M2/M3), add the architecture flag:

```bash
act -W .github/workflows/test.yml --container-architecture linux/amd64
```

### Godot Tests Failing

If Godot tests fail due to missing assets:

```bash
# Check that the asset import step ran
# Look for "Importing Godot assets..." in the output

# The workflow now automatically imports assets before running tests
```

## Files in This Directory

- `docker-compose.yml` - CI-specific services configuration
- `run-ci-services.sh` - Helper script for managing CI services
- `CI-README.md` - This file

## Comparison: CI Services vs Dev Services

| Feature | CI Services | Dev Services |
|---------|-------------|--------------|
| Location | `.github/docker-compose.yml` | `backend/docker-compose.yml` |
| PostgreSQL Port | `5432` | `5433` |
| Purpose | Local CI testing with act | Development |
| Start Command | `make ci-services-start` | `make services-start` |
| Additional Services | PostgreSQL, Nakama only | Includes Redis, Prometheus, Grafana, Loki, Tempo, Alertmanager, etc. |

## Advanced Usage

### Using Custom Secrets

```bash
# Create a .secrets file
echo "NAKAMA_SERVER_KEY=your_key" > .secrets

# Run with secrets
act --secret-file .secrets
```

### Dry Run

```bash
# Show what would run without executing
act -n -W .github/workflows/test.yml
```

### Environment Variables

```bash
# Set environment variables
ACT_TELEMETRY_DISABLED=1 act -W .github/workflows/test.yml
```

## References

- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
