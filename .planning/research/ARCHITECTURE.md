# Architecture Research: Comprehensive Testing Infrastructure

**Domain:** Game Backend (Go/Nakama) & Client (Godot 4) Testing Infrastructure
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Armored Archer has a solid testing foundation with 234 existing Go integration tests and basic Godot test coverage. The current architecture uses custom test helpers, GitHub Actions CI/CD, and Docker-based service orchestration. This research identifies integration points for comprehensive test infrastructure expansion, including test fixtures, data management, mocking strategies, and load testing capabilities.

**Key Finding:** The project has mature testing patterns but lacks systematic test data management, comprehensive mocking infrastructure, and automated load testing. The Go backend uses testify helpers and table-driven tests, while Godot uses a custom test framework. Integration points are well-defined through Nakama RPC handlers and autoloads.

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CI/CD Layer (GitHub Actions)                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Godot Tests  │  │ Go Tests     │  │ Load Tests   │          │
│  │ (headless)   │  │ (unit/int)   │  │ (k6)         │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
├─────────┼──────────────────┼──────────────────┼───────────────────┤
│         ↓                  ↓                  ↓                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Test Infrastructure Layer                   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │    │
│  │  │ Fixtures   │  │ Mocks      │  │ Test Data  │        │    │
│  │  │ (Postgres) │  │ (Testify)  │  │ Manager    │        │    │
│  │  └────────────┘  └────────────┘  └────────────┘        │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                         Application Layer                       │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │   Go Backend         │  │   Godot Client       │           │
│  │   (Nakama Modules)   │  │   (Autoloads)        │           │
│  │  ┌────────────────┐  │  │  ┌────────────────┐ │           │
│  │  │ Combat         │  │  │  │ CombatManager  │ │           │
│  │  │ Gear           │  │  │  │ GearManager    │ │           │
│  │  │ Matchmaking    │  │  │  │ NetworkManager │ │           │
│  │  │ Player Stats   │  │  │  │ PlayerStats    │ │           │
│  │  └────────────────┘  │  │  └────────────────┘ │           │
│  └──────────────────────┘  └──────────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                      Data & Services Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │ Nakama       │  │ Redis        │          │
│  │ (testcontainers)│  │ (RPC/Socket) │  │ (caching)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Test Fixtures** | Database state setup/teardown, test data seeding | testcontainers-go, SQL migrations, factory patterns |
| **Mock Layer** | Isolate unit tests from external dependencies | testify/mock, interface-based mocks, HTTP stubs |
| **Test Data Manager** | Centralized test data generation and cleanup | Factory functions, builders, test data pools |
| **Load Test Runner** | Performance benchmarking and stress testing | k6 scripts, artillery scenarios, custom benchmarks |
| **Coverage Reporter** | Track test coverage across backend and frontend | go test -cover, custom Godot coverage parser |
| **CI/CD Orchestrator** | Run tests in pipeline, enforce quality gates | GitHub Actions workflows, coverage thresholds |

## Recommended Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go              # Nakama module entry point
├── internal/                     # Internal Go packages
│   ├── combat/                  # Combat system logic
│   │   ├── combat.go
│   │   └── combat_test.go       # Unit tests (table-driven)
│   ├── gear/                    # Gear generation & inventory
│   ├── player/                  # Player stats & progression
│   └── ...
├── tests/                        # Integration tests
│   ├── testhelpers/             # Existing test helper library
│   │   ├── helpers.go           # Assertion helpers, mock timer
│   │   └── fixtures.go          # NEW: Fixture management
│   ├── mocks/                   # NEW: Mock implementations
│   │   ├── nakama_client.go     # Mock Nakama runtime
│   │   └── database.go          # Mock database wrapper
│   ├── fixtures/                # NEW: Test fixtures & data
│   │   ├── players.go           # Player factory functions
│   │   ├── gear.go              # Gear test data builders
│   │   └── matches.go           # Match state fixtures
│   ├── load/                    # NEW: Load testing scripts
│   │   ├── combat_load_test.go  # Benchmark combat calculations
│   │   ├── matchmaking_load_test.go
│   │   └── k6_scenarios/        # k6 load test scripts
│   ├── combat/                  # Integration test suites
│   ├── gear/
│   └── ...
├── data/                         # Database migrations
│   ├── 001_create_player_stats.sql
│   ├── 002_create_gear_catalog.sql
│   └── test/                    # NEW: Test-specific migrations
│       └── seed_test_data.sql
├── testutils/                    # NEW: Shared test utilities
│   ├── testcontainers.go        # PostgreSQL container setup
│   ├── nakama_test_server.go    # Test Nakama instance wrapper
│   └── coverage.go              # Coverage reporting utilities
├── go.mod
└── go.sum

test/                             # Godot tests
├── frameworks/                   # NEW: Test framework extensions
│   ├── gut_extensions.gd       # GUT framework enhancements
│   └── mock_helpers.gd          # Mock autoload utilities
├── fixtures/                     # NEW: Godot test fixtures
│   ├── player_fixtures.gd       # Test player data
│   └── match_fixtures.gd        # Test match states
├── unit/                         # NEW: Unit test organization
│   ├── autoloads/               # Autoload tests
│   │   ├── combat_manager_test.gd
│   │   └── gear_manager_test.gd
│   └── scenes/                  # Scene tests
├── integration/                  # NEW: Integration test organization
│   ├── network_integration_test.gd
│   └── combat_flow_test.gd
├── performance/                  # NEW: Performance tests
│   └── benchmark_test.gd
├── test_combat_manager.gd        # Existing tests (refactor later)
├── test_network_manager.gd
└── run_all_tests.gd              # Main test runner

.github/
└── workflows/
    ├── test.yml                  # Existing: Unit & integration tests
    ├── load-test.yml             # NEW: Load testing workflow
    └── coverage-report.yml       # NEW: Coverage reporting workflow
```

### Structure Rationale

- **`tests/testhelpers/`**: Existing helper library with assertions and mock timers — expand with fixture management
- **`tests/mocks/`**: Centralized mock implementations for Nakama client and database — prevent duplication across test files
- **`tests/fixtures/`**: Factory functions and builders for test data — consistent test data, reduce maintenance
- **`tests/load/`**: Load testing infrastructure — separate from unit/integration tests, run on schedule not every commit
- **`testutils/`**: Shared utilities like testcontainers setup — bridge between integration tests and infrastructure
- **`test/frameworks/`**: Godot test framework extensions — custom assertions, mock helpers for autoloads
- **`test/fixtures/`**: Godot-specific test data — separate from Go fixtures, use GDScript-friendly format
- **`test/unit/` & `test/integration/`**: Organize existing tests by type — easier to find and run specific test categories

## Architectural Patterns

### Pattern 1: Table-Driven Tests (Go)

**What:** Define test cases as a table (slice of structs) and iterate over them in a single test function. Each row represents a test case with inputs and expected outputs.

**When to use:**
- Testing the same function with multiple input combinations
- Validating edge cases alongside happy paths
- Reducing code duplication in test files

**Trade-offs:**
- ✅ Pros: Compact, easy to add new cases, clear test documentation
- ❌ Cons: Can obscure test intent if table grows too large, harder to debug individual failures

**Example:**
```go
func TestCalculateDamage(t *testing.T) {
    tests := []struct {
        name     string
        attack   int
        defense  int
        expected int
        hasError bool
    }{
        {"normal damage", 20, 10, 10, false},
        {"zero attack", 0, 10, 0, false},
        {"high defense", 10, 100, 1, false}, // minimum damage
        {"negative attack", -5, 10, 0, true}, // error case
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            attacker := &combat.PlayerStats{Stats: game.Stats{Attack: tt.attack}}
            defender := &combat.PlayerStats{Stats: game.Stats{Defense: tt.defense}}

            result, err := combat.CalculateDamage(attacker, defender)

            if tt.hasError {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
                assert.Equal(t, tt.expected, result)
            }
        })
    }
}
```

### Pattern 2: Testcontainers for Database Isolation

**What:** Spin up disposable Docker containers (PostgreSQL, Nakama) for integration tests. Each test suite gets a clean database instance.

**When to use:**
- Integration tests requiring real database interactions
- Tests that need to verify schema migrations
- Preventing test pollution between test runs

**Trade-offs:**
- ✅ Pros: Real database behavior, isolated test environments, no manual cleanup
- ❌ Cons: Slower than mocks, requires Docker, resource-intensive

**Example:**
```go
// testutils/testcontainers.go
package testutils

import (
    "context"
    "testing"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/wait"
)

func SetupPostgres(t *testing.T) (string, func()) {
    ctx := context.Background()

    req := testcontainers.ContainerRequest{
        Image:        "postgres:14-alpine",
        ExposedPorts: []string{"5432/tcp"},
        Env: map[string]string{
            "POSTGRES_USER":     "test",
            "POSTGRES_PASSWORD": "test",
            "POSTGRES_DB":       "testdb",
        },
        WaitingFor: wait.ForLog("database system is ready to accept connections"),
    }

    container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: req,
        Started:          true,
    })
    if err != nil {
        t.Fatalf("Failed to start postgres container: %v", err)
    }

    host, _ := container.Host(ctx)
    port, _ := container.MappedPort(ctx, "5432")
    connStr := fmt.Sprintf("postgres://test:test@%s:%s/testdb?sslmode=disable", host, port.Port())

    cleanup := func() {
        if err := container.Terminate(ctx); err != nil {
            t.Logf("Failed to terminate container: %v", err)
        }
    }

    return connStr, cleanup
}

// Usage in test:
func TestPlayerStorage(t *testing.T) {
    dbConn, cleanup := testutils.SetupPostgres(t)
    defer cleanup()

    // Run migrations
    // Run tests against dbConn
}
```

### Pattern 3: Factory Pattern for Test Fixtures

**What:** Create factory functions that generate consistent test data with sensible defaults. Use builder pattern for customization.

**When to use:**
- Reducing test setup boilerplate
- Ensuring test data consistency across test suites
- Generating complex objects with many optional fields

**Trade-offs:**
- ✅ Pros: Less test code duplication, easy to customize, centralized defaults
- ❌ Cons: Initial setup time, abstraction can hide test data details

**Example:**
```go
// tests/fixtures/players.go
package fixtures

import "github.com/anchapin/armored-archer/backend/internal/player"

type PlayerBuilder struct {
    player *player.Player
}

func NewPlayer() *PlayerBuilder {
    return &PlayerBuilder{
        player: &player.Player{
            UserID:    "test_user_123",
            Level:     1,
            XP:        0,
            Stats: &game.Stats{
                Attack:  10,
                Defense: 10,
                Speed:   10,
            },
        },
    }
}

func (b *PlayerBuilder) WithLevel(level int) *PlayerBuilder {
    b.player.Level = level
    b.player.XP = player.XPForLevel(level)
    return b
}

func (b *PlayerBuilder) WithStats(attack, defense, speed int) *PlayerBuilder {
    b.player.Stats.Attack = attack
    b.player.Stats.Defense = defense
    b.player.Stats.Speed = speed
    return b
}

func (b *PlayerBuilder) Build() *player.Player {
    return b.player
}

// Usage in test:
func TestLevelUp(t *testing.T) {
    p := fixtures.NewPlayer().
        WithLevel(5).
        WithStats(20, 15, 18).
        Build()

    // Test level up logic
}
```

### Pattern 4: Interface-Based Mocking

**What:** Define interfaces for external dependencies (Nakama client, database). Create mock implementations that record calls and return predefined values.

**When to use:**
- Unit tests that need to isolate from Nakama/database
- Testing error handling paths
- Speeding up tests that would otherwise hit the network

**Trade-offs:**
- ✅ Pros: Fast tests, deterministic behavior, can test error cases
- ❌ Cons: Mocks can drift from real implementation, maintenance overhead

**Example:**
```go
// tests/mocks/nakama_client.go
package mocks

import (
    "github.com/stretchr/testify/mock"
    "github.com/heroiclabs/nakama-common/runtime"
)

type MockNakamaRuntime struct {
    mock.Mock
}

func (m *MockNakamaRuntime) StorageWrite(ctx context.Context, key string, value string) error {
    args := m.Called(ctx, key, value)
    return args.Error(0)
}

func (m *MockNakamaRuntime) StorageRead(ctx context.Context, key string) (string, error) {
    args := m.Called(ctx, key)
    return args.String(0), args.Error(1)
}

// Usage in test:
func TestCombatActionStorage(t *testing.T) {
    mockRuntime := new(MockNakamaRuntime)
    mockRuntime.On("StorageWrite", mock.Anything, "match_123", mock.Anything).Return(nil)

    err := combat.SubmitAction(mockRuntime, "match_123", action)

    assert.NoError(t, err)
    mockRuntime.AssertExpectations(t)
}
```

### Pattern 5: Godot Autoload Mocking

**What:** Replace autoload singletons with mock implementations during tests. Use dependency injection or test-specific autoload initialization.

**When to use:**
- Testing autoload-dependent code in isolation
- Simulating network conditions (offline, high latency)
- Avoiding side effects in unit tests

**Trade-offs:**
- ✅ Pros: Test autoload logic without real network, faster tests
- ❌ Cons: Godot's autoload system makes swapping difficult, requires careful setup

**Example:**
```gdscript
// test/frameworks/mock_helpers.gd
extends Node

# Mock NetworkManager for testing
class MockNetworkManager:
    signal rpc_called(method: String, params: Array)
    var should_fail: bool = false
    var simulated_latency: int = 0

    func send_rpc(method: String, params: Array):
        if simulated_latency > 0:
            await get_tree().create_timer(simulated_latency / 1000.0).timeout

        rpc_called.emit(method, params)
        if should_fail:
            push_error("Simulated network failure")
            return false
        return true

# Usage in test:
func test_network_failure_handling():
    var mock_network = MockNetworkManager.new()
    mock_network.should_fail = true

    # Inject mock (requires autoload to support injection)
    # Or temporarily replace autoload instance
    var original = NetworkManager
    Engine.set_singleton("NetworkManager", mock_network)

    # Test failure handling
    var cm = CombatManager.new()
    cm.submit_combat_action("match123", "shoot", 0.5)

    # Restore original
    Engine.set_singleton("NetworkManager", original)
```

## Data Flow

### Test Execution Flow

```
[Developer Push]
    ↓
[GitHub Actions Triggered]
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Parallel Test Execution                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Godot Tests]          [Go Unit Tests]       [Load Tests]  │
│       ↓                       ↓                     ↓        │
│  Run headless           go test ./...        k6 run        │
│  Parse output           -cover              scenarios/      │
│       ↓                       ↓                     ↓        │
│  [Results]             [Coverage]           [Metrics]      │
└─────────────────────────────────────────────────────────────┘
    ↓                           ↓                     ↓
[Coverage Gate Check] ← [Upload to Codecov] ← [Compare to baseline]
    ↓
[Quality Gate Decision]
    ↓ (pass)
[Merge Allowed]
```

### Test Data Setup Flow

```
[Test Suite Start]
    ↓
[Setup Testcontainers]
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Test Fixture Initialization                                  │
├─────────────────────────────────────────────────────────────┤
│  1. Start PostgreSQL container                              │
│  2. Run database migrations                                 │
│  3. Seed test data (fixtures/*.go)                          │
│  4. Initialize mock Nakama runtime                          │
│  5. Create test players using factories                     │
└─────────────────────────────────────────────────────────────┘
    ↓
[Run Tests]
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Test Execution (Each Test)                                  │
├─────────────────────────────────────────────────────────────┤
│  1. Create test-specific data (builders)                    │
│  2. Execute test logic                                      │
│  3. Assert results                                          │
│  4. Cleanup test-specific data                              │
└─────────────────────────────────────────────────────────────┘
    ↓
[Test Suite End]
    ↓
[Teardown]
    - Stop containers
    - Clean up artifacts
    - Generate coverage reports
```

### Integration Test Data Flow

```
[Go Integration Test]
    ↓
[Testcontainers Setup]
    - PostgreSQL container
    - Test Nakama instance (optional)
    ↓
[Migration Runner]
    - Apply schema migrations (data/*.sql)
    - Apply test seeds (data/test/*.sql)
    ↓
[Test Execution]
    - Use fixtures to create test players
    - Call RPC handlers via Nakama client
    - Verify database state
    - Verify Nakama storage writes
    ↓
[Cleanup]
    - Delete test data (WHERE user_id LIKE 'test_%')
    - Truncate test tables
    - Stop containers
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Monolithic test suite, testcontainers for isolation, local CI |
| 1k-100k users | Parallel test execution, test sharding, cached fixtures, separate load test environment |
| 100k+ users | Distributed test runners, test result aggregation, load testing as service, synthetic monitoring |

### Scaling Priorities

1. **First bottleneck:** Test execution time in CI
   - **Fix:** Parallelize test execution (`go test -parallel`), run Godot and Go tests in parallel, use test caching
   - **Target:** Keep full test suite under 10 minutes

2. **Second bottleneck:** Flaky integration tests due to shared state
   - **Fix:** Testcontainers for database isolation, unique test IDs per test run, cleanup between tests
   - **Target:** < 1% flaky test rate

3. **Third bottleneck:** Load test execution cost
   - **Fix:** Run load tests on schedule (nightly) not on every commit, use lightweight smoke tests for PRs
   - **Target:** < 5 minute PR validation, comprehensive load tests nightly

## Anti-Patterns

### Anti-Pattern 1: Shared Test Database

**What people do:** Use a single PostgreSQL instance for all tests, relying on test data cleanup and transaction rollback

**Why it's wrong:**
- Tests can pollute each other's state causing flakiness
- Parallel test execution is unsafe
- Hard to debug which test left orphaned data
- Slow cleanup operations (DELETE vs DROP DATABASE)

**Do this instead:**
- Use testcontainers to create isolated database per test suite
- Or use transaction rollback pattern with proper cleanup
- Or use unique test IDs (test_ + timestamp) and cleanup after suite

### Anti-Pattern 2: Testing Implementation Details

**What people do:** Testing private functions, checking internal state, mocking extensively

**Why it's wrong:**
- Tests break when implementation changes (even if behavior is correct)
- False confidence — tests pass but system doesn't work
- High maintenance cost

**Do this instead:**
- Test public interfaces and observable behavior
- Use black-box testing for integration tests
- Only mock external dependencies (Nakama, database), not internal code

### Anti-Pattern 3: Godot Tests That Require UI

**What people do:** Writing tests that click buttons, wait for animations, verify visual elements

**Why it's wrong:**
- Extremely slow tests (seconds vs milliseconds)
- Brittle — breaks with UI changes
- Can't run headless in CI

**Do this instead:**
- Test autoload logic directly (create instance, call methods)
- Test scene scripts in isolation
- Use signal-based testing for async operations
- Keep UI testing manual or use visual regression tools

### Anti-Pattern 4: Load Testing in PR CI

**What people do:** Running full load test suite on every pull request

**Why it's wrong:**
- Extends PR validation time dramatically (10+ minutes)
- Expensive — consumes CI minutes
- Unnecessary — load tests rarely fail on small changes

**Do this instead:**
- Run lightweight smoke tests (10 users, 10 seconds) on PRs
- Run comprehensive load tests nightly or on demand
- Use performance regression detection (compare to baseline)

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **PostgreSQL** | testcontainers-go | Spin up fresh container per test suite, run migrations, cleanup on teardown |
| **Nakama** | Mock runtime OR test container | Unit tests: Mock Nakama runtime. Integration tests: Test Nakama container or use existing instance |
| **GitHub Actions** | Workflow matrix | Parallelize Godot/Go/load tests, separate jobs for coverage reporting |
| **Codecov** | Coverage upload | Upload after test runs, enforce thresholds in quality gate |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Go Tests ↔ Godot Tests** | Separate workflows, shared test data | Go tests run in backend/, Godot tests run in test/. Share fixture data via common format (JSON/Protobuf) |
| **Unit Tests ↔ Integration Tests** | Same test framework, different setup | Unit tests use mocks. Integration tests use testcontainers. Both use testify assertions |
| **Load Tests ↔ Functional Tests** | Separate CI jobs, shared scenarios | Load tests use k6 scripts that mirror functional test flows but with concurrency |

### Test Data Management Integration

```
┌─────────────────────────────────────────────────────────────┐
│ Test Data Management                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Fixtures Layer]                                           │
│  ├── Go fixtures (tests/fixtures/*.go)                     │
│  └── Godot fixtures (test/fixtures/*.gd)                   │
│       ↓                                                     │
│  [Data Definitions]                                         │
│  ├── JSON schemas for cross-language sharing              │
│  └── Protobuf for backend communication                    │
│       ↓                                                     │
│  [Seed Scripts]                                             │
│  ├── SQL migrations (data/test/*.sql)                      │
│  └── Nakama storage seeds                                  │
│       ↓                                                     │
│  [Cleanup Utilities]                                        │
│  ├── Truncate tables (testutils/cleanup.go)                │
│  └── Delete test users (WHERE user_id LIKE 'test_%')      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Build Order for Test Infrastructure

Based on dependencies and incremental value:

### Phase 1: Foundation (Week 1)
1. **Expand test helpers** (`tests/testhelpers/fixtures.go`)
   - Add fixture management functions
   - Add database cleanup utilities
   - Add test ID generation

2. **Create test utilities** (`testutils/`)
   - testcontainers-go setup for PostgreSQL
   - Migration runner for test databases
   - Coverage reporting utilities

3. **Standardize Go test patterns**
   - Document table-driven test template
   - Create testify mock templates
   - Add test file boilerplate

### Phase 2: Fixtures & Mocks (Week 1-2)
4. **Build fixture library** (`tests/fixtures/`)
   - Player factory and builder
   - Gear factory with rarities
   - Match state fixtures
   - Combat action fixtures

5. **Create mock layer** (`tests/mocks/`)
   - Mock Nakama runtime
   - Mock database wrapper
   - Mock storage layer

6. **Organize existing tests**
   - Move tests to unit/integration structure
   - Refactor to use fixtures
   - Add table-driven test patterns

### Phase 3: Godot Test Framework (Week 2)
7. **Extend Godot test framework** (`test/frameworks/`)
   - Mock autoload helpers
   - Signal testing utilities
   - Async operation testing patterns

8. **Create Godot fixtures** (`test/fixtures/`)
   - Player data fixtures
   - Match state fixtures
   - Network simulation helpers

9. **Organize Godot tests**
   - Separate unit vs integration tests
   - Create test suite structure
   - Add test utilities

### Phase 4: Load Testing (Week 2-3)
10. **Set up load testing infrastructure** (`tests/load/`)
    - k6 scenario scripts
    - Benchmark Go tests
    - Load test CI workflow

11. **Create load test scenarios**
    - Combat action throughput
    - Matchmaking capacity
    - Leaderboard query performance

12. **Integrate load tests in CI**
    - Nightly load test workflow
    - Performance regression detection
    - Baseline metrics

### Phase 5: Coverage & Reporting (Week 3)
13. **Enhance coverage reporting**
    - Unified coverage dashboard
    - Coverage trend tracking
    - Missing coverage alerts

14. **Create quality gates**
    - Coverage thresholds (backend: 80%, critical paths: 90%)
    - Flaky test detection
    - Performance regression checks

15. **Documentation**
    - Test writing guide
    - Fixture usage documentation
    - CI/CD testing handbook

## Key Integration Points for New Components

### New Components (Additions)

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| `tests/testhelpers/fixtures.go` | Fixture lifecycle management | Existing testhelpers package |
| `tests/fixtures/*.go` | Test data factories | Internal packages (player, gear, combat) |
| `tests/mocks/*.go` | Mock implementations | testify, Nakama common interfaces |
| `tests/load/*.go` | Load testing & benchmarks | k6, Go testing/benchmark |
| `testutils/*.go` | Shared test infrastructure | testcontainers-go, docker |
| `test/frameworks/*.gd` | Godot test extensions | Existing test framework |
| `test/fixtures/*.gd` | Godot test data | autoloads |
| `.github/workflows/load-test.yml` | Load test CI | Existing test.yml patterns |

### Modifications to Existing Code

| File | Modification | Reason |
|------|--------------|--------|
| `backend/tests/testhelpers/helpers.go` | Add fixture cleanup functions | Extend existing helper library |
| `backend/go.mod` | Add testcontainers-go dependency | Support database containers in tests |
| `test/run_all_tests.gd` | Add coverage reporting | Track test coverage for Godot |
| `Makefile` | Add test infrastructure commands | Convenient test runner commands |
| `.github/workflows/test.yml` | Add parallel execution | Speed up CI test runs |

### No Changes Required

- **Backend internal packages** (`internal/combat/`, `internal/player/`, etc.) — Tests live alongside code, no production code changes
- **Autoloads** — Test via existing public interfaces, no modifications needed
- **Database schema** — Use existing migrations, no schema changes for testing
- **Nakama configuration** — Tests use test instance or mocks, no production config changes

## Sources

**HIGH Confidence (Official Documentation):**
- Existing codebase analysis (234 Go integration tests, Godot test framework)
- Go testing best practices (table-driven tests, testify)
- Testcontainers official documentation
- testify mock framework documentation

**MEDIUM Confidence (Established Patterns):**
- GitHub Actions workflow patterns from existing `.github/workflows/test.yml`
- Database fixture patterns from PostgreSQL best practices
- Load testing approaches (k6, artillery) — standard industry tools

**LOW Confidence (Requires Validation):**
- Specific k6 scripting patterns for Nakama — may need experimentation
- Godot autoload mocking techniques — Godot's autoload system constraints
- Optimal test sharding for GitHub Actions — depends on repo size

**Gaps to Address:**
- Godot-specific test framework best practices (GUT vs GdUnit4 vs custom)
- Nakama load testing patterns (limited official documentation)
- Test data sharing between Go and GDScript (JSON vs Protobuf vs custom)

---
*Architecture research for: Comprehensive Testing Infrastructure*
*Researched: 2026-03-19*
