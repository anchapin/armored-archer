# Phase 07: Test Infrastructure Integration (Gap Closure) - Research

**Researched:** 2026-03-20
**Domain:** Test infrastructure integration, cross-phase dependency resolution
**Confidence:** HIGH

## Summary

Phase 07 addresses integration gaps between Phase 02 (Fixtures & Mocks Layer) and Phase 04 (Load Testing Infrastructure). The project has excellent factory functions and builder patterns from Phase 2, but Phase 4 benchmarks use raw SQL INSERT statements for test data setup instead of leveraging these fixtures. Similarly, load tests require manual backend startup instead of using testcontainers for automated database provisioning.

The phase must address two integration requirements (PERF-01 integration, PERF-03 integration) covering Go benchmark refactoring to use factory functions, and load test refactoring to use testcontainers. Current infrastructure includes comprehensive fixture functions (`NewTestPlayer()`, `NewTestGear()`, builder patterns), testcontainers setup (`SetupTestDB()`), and working benchmarks/load tests that need integration.

**Primary recommendation:** Refactor Phase 4 benchmarks to use Phase 2 factory functions for test data setup, and refactor load tests to use testcontainers for automated database provisioning, eliminating manual service startup and ensuring consistent test data across all test types.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 (integration) | Go benchmarks use Phase 02 factory functions instead of raw SQL INSERT | Factory functions exist in `backend/tests/testhelpers/fixtures.go`, benchmarks in `rpc_bench_test.go` use raw SQL |
| PERF-03 (integration) | Load tests use Phase 02 testcontainers for automated database provisioning | testcontainers setup exists in `db_testcontainers.go`, load tests require manual backend startup |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **testcontainers-go** | v0.41.0 | Database isolation for load tests | Already used in Phase 2/4, provides automated PostgreSQL provisioning |
| **Go testing/benchmark** | Go 1.25+ | Benchmark framework for RPC handlers | Built-in to Go, supports b.Run(), b.ResetTimer() |
| **k6** | v0.49.0 | Load testing framework | Industry standard for load testing, already integrated |
| **testhelpers fixtures** | (internal) | Factory functions for test data | Custom implementation from Phase 2, provides NewTestPlayer(), builder pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **testify** | v1.11.1 | Assertion helpers in integration tests | For complex test assertions |
| **github.com/testcontainers/testcontainers-go/modules/postgres** | Latest | PostgreSQL module for testcontainers | Database isolation in load tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testcontainers-go | Manual Docker Compose setup | testcontainers provides automated cleanup, programmatic control, better CI integration |
| Factory functions | Raw SQL INSERT in tests | Factory functions provide consistent defaults, builder pattern, easier maintenance |

**Installation:**
```bash
# All dependencies already installed from Phase 2 and Phase 4
# No new installations required

# Verify testcontainers-go is available
cd backend && go list -m github.com/testcontainers/testcontainers-go

# Verify k6 is available
k6 version
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── internal/
│   └── rpc/
│       ├── rpc_bench_test.go           # REFACTOR: Use testhelpers fixtures
│       └── feedback_bench_test.go      # REFACTOR: Use testhelpers fixtures
├── tests/
│   ├── testhelpers/
│   │   ├── fixtures.go                 # NewTestPlayer(), NewTestGear(), etc.
│   │   ├── fixtures_builder.go         # Builder pattern for fixtures
│   │   └── db_testcontainers.go        # SetupTestDB(), TeardownTestDB()
│   ├── benchmarks/
│   │   └── baseline.txt                # Performance baseline
│   └── load/
│       ├── scenarios/
│       │   ├── smoke.js                # REFACTOR: Use testcontainers setup
│       │   ├── player_stats.js         # REFACTOR: Use testcontainers setup
│       │   └── concurrent_players.js   # REFACTOR: Use testcontainers setup
│       └── load_test_test.go           # REFACTOR: Automated testcontainers startup
└── data/
    └── migrations/                     # Database schema migrations
```

### Pattern 1: Refactor Benchmark to Use Factory Functions
**What:** Replace raw SQL INSERT statements in benchmarks with Phase 2 factory functions.
**When to use:** For all Go benchmarks that create test data (GetPlayerStats, GetLeaderboard, GetInventory benchmarks).
**Example:**
```go
// Source: Integration of Phase 2 fixtures with Phase 4 benchmarks
func BenchmarkGetPlayerStats(b *testing.B) {
    ctx := context.Background()

    // Setup testcontainers PostgreSQL instance (from Phase 2)
    tdb, err := testhelpers.SetupBenchmarkDB(ctx)
    if err != nil {
        b.Fatalf("Failed to setup benchmark DB: %v", err)
    }
    defer testhelpers.TeardownTestDB(ctx, tdb)

    // Create player_stats table
    _, err = tdb.DB.Exec(`
        CREATE TABLE IF NOT EXISTS player_stats (
            user_id TEXT PRIMARY KEY,
            level INTEGER NOT NULL DEFAULT 1,
            experience BIGINT NOT NULL DEFAULT 0,
            ability_points INTEGER NOT NULL DEFAULT 0,
            stats JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `)
    if err != nil {
        b.Fatalf("Failed to create player_stats table: %v", err)
    }

    // REFACTOR: Use Phase 2 factory function instead of raw SQL INSERT
    player := testhelpers.NewPlayerBuilder().
        WithLevel(10).
        WithXP(5000).
        WithStats(50, 45, 30, 25).
        WithID("test-user-id").
        Build()

    // Insert using factory-produced data
    _, err = tdb.DB.Exec(`
        INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
        VALUES ($1, $2, $3, $4, $5)
    `, player.UserID, player.Level, player.XP, 0, player.toJSON())
    if err != nil {
        b.Fatalf("Failed to insert test player stats: %v", err)
    }

    // Create mock logger and NakamaModule
    logger := &mockLogger{}
    nk := new(mockNakamaModule)

    // Reset timer to exclude setup time
    b.ResetTimer()

    // Run benchmark
    for i := 0; i < b.N; i++ {
        _, err := GetPlayerStats(ctx, logger, tdb.DB, nk, "{}")
        if err != nil {
            b.Fatalf("GetPlayerStats failed: %v", err)
        }
    }
}
```

### Pattern 2: Refactor Load Test to Use Testcontainers
**What:** Replace manual backend startup with automated testcontainers provisioning.
**When to use:** For all k6 load tests that require database and backend services.
**Example:**
```go
// Source: Integration of testcontainers with k6 load tests
func TestK6LoadTestsWithTestcontainers(t *testing.T) {
    ctx := context.Background()

    // Setup testcontainers PostgreSQL instance
    tdb, err := testhelpers.SetupTestDB(ctx, t)
    require.NoError(t, err)
    defer testhelpers.TeardownTestDB(ctx, tdb)

    // Run database migrations
    err = testhelpers.RunMigrations(ctx, tdb.DB)
    require.NoError(t, err)

    // Start Nakama server with testcontainers database
    nakamaContainer, err := testhelpers.SetupNakamaServer(ctx, tdb.ConnStr)
    require.NoError(t, err)
    defer testhelpers.TeardownNakamaServer(ctx, nakamaContainer)

    // Get Nakama server URL
    nakamaURL := nakamaContainer.GetEndpoint(ctx)

    // Run k6 load test with testcontainers backend
    cmd := exec.Command("k6", "run",
        "--config", "k6.conf.js",
        "--env", "NAKAMA_URL="+nakamaURL,
        "scenarios/concurrent_players.js")
    cmd.Dir = "../tests/load"

    output, err := cmd.CombinedOutput()
    require.NoError(t, err, "k6 run failed: %s", output)

    // Verify k6 output contains success metrics
    assert.Contains(t, string(output), "checks: 100.00%")
}
```

### Pattern 3: Factory Function for Multiple Test Data
**What:** Use builder pattern to create multiple test entities efficiently.
**When to use:** For benchmarks requiring multiple players (e.g., GetLeaderboard with 100 players).
**Example:**
```go
// Source: Integration of Phase 2 builder pattern with Phase 4 benchmarks
func BenchmarkGetLeaderboard(b *testing.B) {
    ctx := context.Background()

    // Setup testcontainers PostgreSQL instance
    tdb, err := testhelpers.SetupBenchmarkDB(ctx)
    if err != nil {
        b.Fatalf("Failed to setup benchmark DB: %v", err)
    }
    defer testhelpers.TeardownTestDB(ctx, tdb)

    // Create player_stats and users tables
    _, err = tdb.DB.Exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `)
    if err != nil {
        b.Fatalf("Failed to create users table: %v", err)
    }

    _, err = tdb.DB.Exec(`
        CREATE TABLE IF NOT EXISTS player_stats (
            user_id TEXT PRIMARY KEY REFERENCES users(id),
            level INTEGER NOT NULL DEFAULT 1,
            experience BIGINT NOT NULL DEFAULT 0,
            ability_points INTEGER NOT NULL DEFAULT 0,
            stats JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `)
    if err != nil {
        b.Fatalf("Failed to create player_stats table: %v", err)
    }

    // REFACTOR: Use Phase 2 factory functions for 100 test players
    for i := 1; i <= 100; i++ {
        player := testhelpers.NewPlayerBuilder().
            WithLevel(i).
            WithXP(int64(i * 1000)).
            WithID(fmt.Sprintf("user-%d", i)).
            Build()

        // Insert user
        _, err = tdb.DB.Exec(`
            INSERT INTO users (id, username) VALUES ($1, $2)
        `, player.UserID, fmt.Sprintf("Player%d", i))
        if err != nil {
            b.Fatalf("Failed to insert user: %v", err)
        }

        // Insert player stats using factory-produced data
        _, err = tdb.DB.Exec(`
            INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
            VALUES ($1, $2, $3, $4, $5)
        `, player.UserID, player.Level, player.XP, i*5, `{}`)
        if err != nil {
            b.Fatalf("Failed to insert player stats: %v", err)
        }
    }

    // Create mock logger and NakamaModule
    logger := &mockLogger{}
    nk := new(mockNakamaModule)

    // Reset timer to exclude setup time
    b.ResetTimer()

    // Run benchmark
    for i := 0; i < b.N; i++ {
        payload := `{"limit": 100, "offset": 0}`
        _, err := GetLeaderboard(ctx, logger, tdb.DB, nk, payload)
        if err != nil {
            b.Fatalf("GetLeaderboard failed: %v", err)
        }
    }
}
```

### Anti-Patterns to Avoid
- **Duplicating test data setup logic**: Use factory functions instead of rewriting INSERT statements
- **Manual service startup for load tests**: Use testcontainers for automated provisioning
- **Inconsistent test data**: Ensure benchmarks and integration tests use same factory functions
- **Hardcoded test values**: Use builder pattern with sensible defaults instead of magic numbers

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test data factory functions | Custom NewTestPlayer() in benchmark files | testhelpers.NewTestPlayer(), builder pattern | Consistent defaults, easier maintenance, single source of truth |
| Database provisioning for load tests | Manual Docker Compose, manual backend startup | testcontainers.SetupTestDB() | Automated cleanup, programmatic control, CI-friendly |
| Multiple test player creation | Loop with hardcoded SQL INSERT | testhelpers.NewPlayerBuilder().WithLevel(i).Build() | Builder pattern provides consistent data structure, easier customization |

**Key insight:** Phase 2 already provides excellent factory functions and testcontainers setup. Phase 4 benchmarks should leverage this existing infrastructure instead of duplicating logic with raw SQL. This ensures test data consistency across benchmarks, integration tests, and load tests.

## Common Pitfalls

### Pitfall 1: Test Data Inconsistency Across Test Types
**What goes wrong:** Benchmarks use one set of test data patterns, integration tests use another, load tests use yet another.
**Why it happens:** Each test type implements its own data setup logic instead of sharing factory functions.
**How to avoid:** Use Phase 2 factory functions (`NewTestPlayer()`, `NewTestGear()`, builder pattern) for all test data creation.
**Warning signs:** Same test entity created differently in multiple files, inconsistent default values.

### Pitfall 2: Load Tests Require Manual Service Startup
**What goes wrong:** Load tests fail in CI because developers forget to start backend services manually.
**Why it happens:** Load tests assume manually started Nakama/PostgreSQL instead of using testcontainers.
**How to avoid:** Refactor load test setup to use testcontainers for automated database provisioning and Nakama server startup.
**Warning signs:** Load test documentation includes "start backend first" instructions, CI load tests fail with connection errors.

### Pitfall 3: Benchmark Setup Code Duplicates Fixture Logic
**What goes wrong:** Benchmark files contain duplicate test data setup code that already exists in fixtures.
**Why it happens:** Benchmarks were written before Phase 2 fixtures were complete, or developer was unaware of existing fixtures.
**How to avoid:** Always check `backend/tests/testhelpers/fixtures.go` before writing test data setup code.
**Warning signs:** Multiple files have similar INSERT statements or struct initialization code.

### Pitfall 4: Testcontainers Not Integrated with Load Tests
**What goes wrong:** Load tests use external database connection strings, making them environment-dependent.
**Why it happens:** Load tests were designed for manual testing, not automated CI/CD.
**How to avoid:** Use testcontainers to spin up isolated PostgreSQL instances for load tests, just like integration tests.
**Warning signs:** Load test files have hardcoded connection strings, require .env files with database credentials.

## Code Examples

Verified patterns from official sources:

### Refactor Benchmark to Use Factory Functions
```go
// Source: Integration of Phase 2 and Phase 4 patterns
func BenchmarkGetInventory(b *testing.B) {
    ctx := context.Background()

    // Setup testcontainers PostgreSQL instance
    tdb, err := testhelpers.SetupBenchmarkDB(ctx)
    if err != nil {
        b.Fatalf("Failed to setup benchmark DB: %v", err)
    }
    defer testhelpers.TeardownTestDB(ctx, tdb)

    // Create inventory and catalog tables
    _, err = tdb.DB.Exec(`
        CREATE TABLE IF NOT EXISTS catalog (
            gear_id TEXT PRIMARY KEY,
            gear_type TEXT NOT NULL,
            name TEXT NOT NULL,
            rarity TEXT NOT NULL,
            base_stats JSONB NOT NULL DEFAULT '{}',
            modifiers JSONB NOT NULL DEFAULT '[]',
            icon_url TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `)
    if err != nil {
        b.Fatalf("Failed to create catalog table: %v", err)
    }

    _, err = tdb.DB.Exec(`
        CREATE TABLE IF NOT EXISTS inventory (
            inventory_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            gear_id TEXT NOT NULL REFERENCES catalog(gear_id),
            acquired_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, gear_id)
        )
    `)
    if err != nil {
        b.Fatalf("Failed to create inventory table: %v", err)
    }

    // REFACTOR: Use Phase 2 factory functions for test catalog entries
    for i := 1; i <= 20; i++ {
        gear := testhelpers.NewGearBuilder().
            WithID(fmt.Sprintf("gear-%d", i)).
            WithType("bow").
            WithRarity("rare").
            WithStats(i*5, i*3, i*2, 0).
            WithDisplayName(fmt.Sprintf("Bow%d", i)).
            Build()

        baseStats := map[string]int{
            "attack":  gear.Attack,
            "defense": gear.Defense,
            "speed":   gear.Dodge,
        }
        statsJSON, _ := json.Marshal(baseStats)

        _, err = tdb.DB.Exec(`
            INSERT INTO catalog (gear_id, gear_type, name, rarity, base_stats, modifiers)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, gear.ID, gear.Type, gear.DisplayName, gear.Rarity, statsJSON, `[]`)
        if err != nil {
            b.Fatalf("Failed to insert catalog entry: %v", err)
        }
    }

    // Insert test inventory items using factory-produced gear IDs
    for i := 1; i <= 20; i++ {
        inventoryID := fmt.Sprintf("inv-%d", i)
        gearID := fmt.Sprintf("gear-%d", i)

        _, err = tdb.DB.Exec(`
            INSERT INTO inventory (inventory_id, user_id, gear_id, acquired_at)
            VALUES ($1, $2, $3, $4)
        `, inventoryID, "test-user-id", gearID, time.Now().UTC())
        if err != nil {
            b.Fatalf("Failed to insert inventory item: %v", err)
        }
    }

    // Create mock logger and NakamaModule
    logger := &mockLogger{}
    nk := new(mockNakamaModule)

    // Reset timer to exclude setup time
    b.ResetTimer()

    // Run benchmark
    for i := 0; i < b.N; i++ {
        _, err := GetInventory(ctx, logger, tdb.DB, nk, "{}")
        if err != nil {
            b.Fatalf("GetInventory failed: %v", err)
        }
    }
}
```

### Testcontainers Setup for Load Tests
```go
// Source: testcontainers-go documentation
func TestK6LoadTestsWithTestcontainers(t *testing.T) {
    ctx := context.Background()

    // Setup testcontainers PostgreSQL instance
    tdb, err := testhelpers.SetupTestDB(ctx, t)
    require.NoError(t, err)
    defer testhelpers.TeardownTestDB(ctx, tdb)

    // Run database migrations
    migrationFiles, err := filepath.Glob("../../../data/migrations/*.sql")
    require.NoError(t, err)

    for _, file := range migrationFiles {
        migrationSQL, err := os.ReadFile(file)
        require.NoError(t, err)

        _, err = tdb.DB.ExecContext(ctx, string(migrationSQL))
        require.NoError(t, err, "failed to run migration: %s", file)
    }

    // Start Nakama server with testcontainers database
    nakamaContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: testcontainers.ContainerRequest{
            Image:        "ghcr.io/heroiclabs/nakama:latest",
            ExposedPorts: []string{"7350/tcp"},
            Env: map[string]string{
                "NAKAMA_DATABASE_ADDRESS": tdb.ConnStr,
            },
            WaitingFor: wait.ForLog("Startup complete"),
        },
        Started: true,
    })
    require.NoError(t, err)
    defer nakamaContainer.Terminate(ctx)

    // Get Nakama server URL
    host, err := nakamaContainer.Host(ctx)
    require.NoError(t, err)

    port, err := nakamaContainer.MappedPort(ctx, "7350")
    require.NoError(t, err)

    nakamaURL := fmt.Sprintf("http://%s:%s", host, port.Port())

    // Run k6 load test with testcontainers backend
    cmd := exec.Command("k6", "run",
        "--config", "k6.conf.js",
        "--env", "NAKAMA_URL="+nakamaURL,
        "scenarios/concurrent_players.js")
    cmd.Dir = "../tests/load"

    output, err := cmd.CombinedOutput()
    require.NoError(t, err, "k6 run failed: %s", output)

    // Verify k6 output contains success metrics
    assert.Contains(t, string(output), "checks:")
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw SQL INSERT in benchmarks | Factory functions (NewTestPlayer, builder pattern) | Phase 2 | Consistent test data, easier maintenance |
| Manual backend startup for load tests | testcontainers automated provisioning | Phase 2 | CI-friendly, isolated databases, no manual steps |
| Duplicated test data logic | Single source of truth in testhelpers | Phase 2 | Change once, affects all tests consistently |

**Deprecated/outdated:**
- **Raw SQL INSERT in benchmarks**: Use factory functions from `testhelpers/fixtures.go`
- **Manual service startup for load tests**: Use testcontainers for automated provisioning
- **Hardcoded test data values**: Use builder pattern with sensible defaults

## Open Questions

1. **Nakama Server Testcontainers Integration**
   - What we know: testcontainers-go can run Nakama server container, but Phase 4 load tests currently require manual startup
   - What's unclear: Should we implement a `SetupNakamaServer()` helper in testhelpers, or is this over-engineering?
   - Recommendation: Implement `SetupNakamaServer()` in testhelpers if load tests require Nakama server; otherwise use external Nakama instance with testcontainers database only

2. **Load Test Database Migration Strategy**
   - What we know: Load tests require database schema, but currently rely on manually migrated databases
   - What's unclear: Should load tests run migrations automatically via testcontainers, or use pre-migrated snapshots?
   - Recommendation: Use testcontainers snapshot feature to create pre-migrated database snapshots for fast load test setup

3. **Benchmark Factory Function Performance Overhead**
   - What we know: Factory functions add a small allocation overhead compared to raw SQL
   - What's unclear: Is this overhead significant enough to affect benchmark accuracy?
   - Recommendation: Use `b.ResetTimer()` after factory function calls to exclude setup overhead from benchmark measurements

## Validation Architecture

> **Note:** Workflow validation is enabled in `.planning/config.json` (nyquist_validation not explicitly set to false)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing + testify, k6 v0.49.0, testhelpers fixtures |
| Config file | backend/tests/load/k6.conf.js |
| Quick run command | `cd backend && go test -bench=BenchmarkGetPlayerStats -benchmem -run=^$ ./internal/rpc/` |
| Full suite command | `cd backend && go test -bench=. -benchmem -run=^$ ./internal/rpc/... && cd tests/load && k6 run scenarios/concurrent_players.js` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 (integration) | Go benchmarks use factory functions | unit | `grep -n "testhelpers.New" backend/internal/rpc/rpc_bench_test.go` | ✅ Refactor needed |
| PERF-03 (integration) | Load tests use testcontainers | integration | `cd backend/tests/load && go test -v -run TestK6LoadTestsWithTestcontainers` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && go test -bench=. -benchmem -run=^$ ./internal/rpc/... | head -20`
- **Per wave merge:** Full benchmark suite + load test with testcontainers
- **Phase gate:** All benchmarks use factory functions, load tests run with testcontainers without manual service startup

### Wave 0 Gaps
- [ ] `backend/tests/testhelpers/nakama_testcontainers.go` — Nakama server testcontainers setup helper
- [ ] `backend/tests/load/load_test_test.go` — Refactor to use testcontainers for automated setup
- [ ] `backend/internal/rpc/rpc_bench_test.go` — Refactor to use testhelpers.NewTestPlayer() and builder pattern
- [ ] `backend/internal/rpc/feedback_bench_test.go` — Refactor to use testhelpers fixtures

**Existing infrastructure:**
- ✅ testhelpers fixtures: NewTestPlayer(), NewTestGear(), builder pattern
- ✅ testhelpers testcontainers: SetupTestDB(), TeardownTestDB(), ResetTestDB()
- ✅ Go benchmarks: rpc_bench_test.go, feedback_bench_test.go (use raw SQL, need refactoring)
- ✅ k6 load tests: scenarios/*.js (require manual backend startup, need testcontainers integration)

## Sources

### Primary (HIGH confidence)
- **Phase 2 Fixtures Implementation** - `backend/tests/testhelpers/fixtures.go` (factory functions, builder pattern)
- **Phase 2 Testcontainers Implementation** - `backend/tests/testhelpers/db_testcontainers.go` (SetupTestDB, TeardownTestDB)
- **Phase 4 Benchmark Implementation** - `backend/internal/rpc/rpc_bench_test.go` (existing benchmarks using raw SQL)
- **Phase 4 Load Tests** - `backend/tests/load/scenarios/*.js` (k6 load test scenarios)
- **testcontainers-go Documentation** - https://golang.testcontainers.org/ (container lifecycle management)
- **Go testing/benchmark Documentation** - https://pkg.go.dev/testing#hdr-Benchmarks (benchmark best practices)

### Secondary (MEDIUM confidence)
- **k6 Documentation** - https://k6.io/docs/ (load testing patterns)
- **Go Builder Pattern** - Effective Go (https://go.dev/doc/effective_go#initialization)

### Tertiary (LOW confidence)
- **Testcontainers Nakama Integration** - No official documentation, may require custom implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already installed and used in Phase 2/4
- Architecture: HIGH - Refactoring existing code, patterns well-understood
- Pitfalls: HIGH - Based on code analysis of existing integration gaps

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - stable tooling ecosystem)

**Integration Gaps Identified:**
- Go benchmarks use raw SQL INSERT instead of testhelpers.NewTestPlayer() and builder pattern
- Load tests require manual backend startup instead of using testcontainers for automated provisioning
- Test data is inconsistent across benchmarks (raw SQL) and integration tests (factory functions)
- Load tests cannot run in isolation without manual service startup
