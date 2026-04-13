# Local Testing Scripts

This directory contains scripts for running CI tests locally using `docker-compose` to work around the limitations of the `act` CLI tool.

## Background

The `act` CLI tool (https://nektosact.com/) has known limitations:
1. **Service container environment variables** - Not properly passed to service containers
2. **Docker volume mounts** - Relative paths not supported
3. **Network isolation** - Service containers on separate networks

These limitations affect jobs that depend on services like:
- `backend-test` (requires PostgreSQL + Nakama)
- `sonarcloud` (requires Nakama for backend analysis)

## Scripts

### `local-test-with-services.sh`

Run tests using local Docker Compose services instead of GitHub Actions service containers.

**Usage:**
```bash
./scripts/local-test-with-services.sh [command] [test_type]
```

**Commands:**
- `migrate` - Run database migrations only
- `unit` - Run unit tests
- `integration` - Run integration tests
- `coverage` - Run tests with coverage report
- `test` - Run all tests (default)
- `backend:dev` - Start backend in development mode

**Examples:**
```bash
# Start services and run unit tests
./scripts/local-test-with-services.sh test unit

# Start backend in development mode
./scripts/local-test-with-services.sh backend:dev

# Run migrations only
./scripts/local-test-with-services.sh migrate
```

**Environment Variables Set:**
```bash
NAKAMA_HOST=localhost
NAKAMA_PORT=7350
NAKAMA_SERVER_KEY=defaultkey
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=changeme
TEST_DB_NAME=nakama
```

## Notes

- The script starts PostgreSQL and Nakama services using `backend/docker-compose.yml`
- It waits for services to become healthy before running tests
- On exit (Ctrl+C or test completion), services are automatically stopped
- Tests are run with the proper environment variables set

## Running Tests Directly

For quick test runs, you can also run directly:

```bash
# Start services in background
docker compose up -d postgres nakama

# Run tests (services must be running first)
cd backend && npm run test

# Stop services when done
docker compose down
```

## Alternatives

If you prefer full CI/CD compatibility, consider:
1. **Self-hosted GitHub Actions runners** - Works exactly like GitHub Actions
2. **Forgejo Actions** - GitHub Actions compatible self-hosted solution
3. **GitHub Codespaces** - Full GitHub Actions environment in browser (free for personal use)

## Related Files

- `backend/docker-compose.yml` - Defines PostgreSQL, Nakama, Redis, and other services
- `backend/nakama.yml` - Nakama server configuration
