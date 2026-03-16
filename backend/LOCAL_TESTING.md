# Local Integration Testing with Docker Compose

This guide explains how to run integration tests locally with Docker Compose services (Nakama, PostgreSQL, Redis).

## Quick Start

### Run All Tests with Docker Compose

```bash
# Start services, run all tests, stop services
npm run test:all:local
```

### Run Integration Tests Only

```bash
# Start services, run integration tests, stop services
npm run test:integration:local
```

### Keep Services Running After Tests

```bash
# Services stay running for subsequent test runs
npm run test:integration:keep
```

## Manual Service Management

### Start Services

```bash
npm run test:services:start
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Nakama (ports 7350, 7351)

### Check Service Health

```bash
npm run test:services:health
```

### Stop Services

```bash
npm run test:services:stop
```

### Clean Up (Remove Containers)

```bash
npm run test:services:clean
```

## Using the Test Script Directly

The shell script provides more control:

```bash
# Start services only
./scripts/test-with-docker-compose.sh start

# Run unit tests (services must be running)
./scripts/test-with-docker-compose.sh unit

# Run integration tests (services must be running)
./scripts/test-with-docker-compose.sh integration

# Run all tests (services must be running)
./scripts/test-with-docker-compose.sh all

# Full workflow: start → migrate → test → stop
./scripts/test-with-docker-compose.sh full

# Stop services
./scripts/test-with-docker-compose.sh stop

# Clean up containers
./scripts/test-with-docker-compose.sh clean

# Check service health
./scripts/test-with-docker-compose.sh health
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_TEST` | `false` | Set to `true` to enable Docker Compose management |
| `KEEP_SERVICES` | `false` | Keep services running after tests complete |
| `NAKAMA_HOST` | `localhost` | Nakama host |
| `NAKAMA_PORT` | `7350` | Nakama port |
| `NAKAMA_SERVER_KEY` | `defaultkey` | Nakama server key |
| `DATABASE_ADDRESS` | `postgres://postgres:changeme@localhost:5432/nakama` | Database connection string |

## CI/CD Integration

In CI environments, services are managed externally. The test setup automatically detects CI mode:

```bash
# CI mode - assumes services are already running
CI=true npm test
```

## Troubleshooting

### Services Won't Start

1. Check Docker is running: `docker ps`
2. Check Docker Compose: `docker compose version`
3. View service logs: `docker logs armored_archer_test_nakama`

### Port Conflicts

If ports are already in use, stop conflicting services:

```bash
# Check what's using the ports
lsof -i :7350
lsof -i :5432
lsof -i :6379

# Clean up old containers
npm run test:services:clean
```

### Nakama Migrations Fail

Run migrations manually:

```bash
docker exec -it armored_archer_test_nakama /nakama/nakama migrate up \
  --database.address postgres://postgres:changeme@postgres:5432/nakama
```

### Tests Timeout

Increase timeout in `jest.integration.config.js`:

```javascript
testTimeout: 120000, // Increase to 120 seconds
```

## Test Data Cleanup

Integration tests automatically clean up test data between runs. The test helper:

1. Creates unique test accounts per test
2. Cleans storage collections after each test
3. Disconnects all clients on teardown

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Local Test Run                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Jest Tests  │───▶│  jest.integration.setup  │   │
│  └──────────────┘    └──────────────────────────┘   │
│                            │                         │
│                            ▼                         │
│                    ┌───────────────┐                │
│                    │ Docker Compose │                │
│                    └───────────────┘                │
│                            │                         │
│         ┌──────────────────┼──────────────────┐     │
│         ▼                  ▼                  ▼     │
│  ┌────────────┐    ┌────────────┐    ┌──────────┐  │
│  │  Nakama    │    │ PostgreSQL │    │  Redis   │  │
│  │  :7350     │    │   :5432    │    │  :6379   │  │
│  └────────────┘    └────────────┘    └──────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Best Practices

1. **Use unique test accounts**: Each test should create its own account with a unique username
2. **Clean up after tests**: Use the test helper's cleanup methods
3. **Keep services running during development**: Use `KEEP_SERVICES=true` to avoid restart overhead
4. **Run full test suite before commits**: Use `npm run test:all:local`
5. **Check service health**: Use `npm run test:services:health` if tests fail unexpectedly
