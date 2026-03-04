# Backend Integration Tests

This directory contains end-to-end integration tests for the Armored Archer backend systems.

## Overview

Integration tests verify that all backend game systems work correctly together using real Nakama server calls. The tests are isolated and clean up after themselves.

### Test Suites

- **health_check.test.ts**: Health check endpoint verification, version checking
- **matchmaker.test.ts**: Match creation, acceptance, listing, and player ranking
- **combat_system.test.ts**: Combat action processing, turn management, damage calculation, match completion
- **rpg_system.test.ts**: XP gain, level progression, and stat allocation
- **gear_system.test.ts**: Gear generation, inventory management, equip/unequip operations
- **season_system.test.ts**: Season info, leaderboard updates, rewards calculation and claiming
- **store.test.ts**: Purchase validation, currency management, gem spending

## Prerequisites

1. **Docker & Docker Compose** - For running Nakama server and PostgreSQL
2. **Node.js & npm** - For running the test suite
3. **Nakama Server** - Must be running on `localhost:7350`

### Nakama Server Setup

The integration tests require a running Nakama instance with the Armored Archer backend module deployed.

1. **Start Nakama using Docker Compose**

   From the `backend/` directory:

   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database on port `5432`
   - Nakama server on port `7350` (gRPC/REST) and `7351` (console)

2. **Wait for Nakama to be ready**

   The tests include a health check that will wait up to 30 seconds for Nakama to become available. You can also manually verify:

   ```bash
   curl http://localhost:7351
   ```

   Nakama console is available at http://localhost:7351 (default credentials: admin / password)

3. **Build and deploy backend module**

   The tests require the backend module to be compiled and available to Nakama:

   ```bash
   npm run build
   ```

   This creates the `build/` directory which is mounted into the Nakama container. The Nakama container will automatically load modules from `/nakama/data/build`.

   If you make code changes, rebuild the module and restart Nakama:

   ```bash
   npm run build
   docker-compose restart nakama
   ```

4. **Environment variables**

   The tests use the following environment variables (with defaults):

   - `NAKAMA_HOST` - Nakama server host (default: `localhost`)
   - `NAKAMA_PORT` - Nakama server port (default: `7350`)
   - `NAKAMA_SERVER_KEY` - Server key for authentication (default: `defaultkey`)

   You can set these in a `.env.test` file or export them in your shell:

   ```bash
   export NAKAMA_HOST=localhost
   export NAKAMA_PORT=7350
   export NAKAMA_SERVER_KEY=defaultkey
   ```

5. **Test database**

   The integration tests use the default Nakama database. The `helpers.ts` includes cleanup functions to remove test data between runs. Test accounts are created with usernames starting with `test_` and are cleaned up automatically.

## Running Tests

From the `backend/` directory:

```bash
# Run all integration tests
npm run test:integration

# Run with watch mode
npm run test:integration -- --watch

# Run a specific test file
npm run test:integration -- rpg_system.test.ts

# Run with verbose output
npm run test:integration -- --verbose
```

### Test Timeouts

Integration tests have a 60-second timeout per test file. They also use up to 120-second timeouts for `beforeAll` setup to allow for Docker container startup.

## Test Isolation

Each test suite follows these isolation practices:

1. **Unique test accounts** - Each test creates fresh user accounts with randomized usernames
2. **Automatic cleanup** - `afterAll` hooks clean all test data using admin credentials
3. **Storage cleanup** - Test data is removed from all collections:
   - `player_stats`
   - `player_inventory`
   - `pvp_matches`
   - `pvp_match_states`
   - `leaderboards`
   - `season_rewards_claimed`
   - `player_currency`
   - `store_purchases`

4. **Per-test reset** - Some suites reset player state in `afterEach` hooks to ensure independence

## Test Account Creation

The `IntegrationTestHelper` class manages test accounts:

```typescript
const helper = testHelper;
const testAccount = await helper.createTestAccount('prefix');
// testAccount.client - authenticated Nakama client
// testAccount.userId - unique user ID
// testAccount.username - generated username
```

## Making Changes

When modifying backend code:

1. Rebuild the module: `npm run build`
2. Restart Nakama: `docker-compose restart nakama`
3. Run integration tests: `npm run test:integration`
4. If tests fail, check Nakama logs: `docker-compose logs nakama`

## Troubleshooting

### Tests fail to connect

- Verify Nakama is running: `docker-compose ps`
- Check logs for errors: `docker-compose logs nakama`
- Ensure the build directory is mounted: `docker-compose exec nakama ls /nakama/data/build`

### "Player stats not found" errors

- Make sure the backend module is built and loaded
- Restart Nakama after building
- Check that the RPC endpoints are registered in `src/index.ts`

### Database errors

- Ensure PostgreSQL is running: `docker-compose ps postgres`
- Check database migrations: `docker-compose logs nakama` should show "migrate up"
- Clear persisted data: `docker-compose down -v && docker-compose up -d`

## CI/CD

Integration tests should be run in CI with:

1. Start Nakama with Docker Compose
2. Wait for healthcheck to pass
3. Build backend module: `npm ci && npm run build`
4. Run tests: `npm run test:integration`
5. Collect results and exit code

Example GitHub Actions workflow:

```yaml
- name: Start Nakama
  run: docker-compose up -d
- name: Wait for Nakama
  run: |
    for i in {1..30}; do
      if curl -s http://localhost:7351 > /dev/null; then
        exit 0
      fi
      sleep 2
    done
    exit 1
- name: Build
  run: npm ci && npm run build
- name: Integration Tests
  run: npm run test:integration
```

## Notes

- Tests use the `@honorlabs/nakama-js` client library for real network communication
- All RPC payloads are JSON-serialized strings (per Nakama convention)
- The `uuid` package generates unique identifiers for test accounts
- Test data is prefixed with `test_` and cleaned via storage API
- Admin client is used for setup/teardown (authenticated with hardcoded admin/admin123)
