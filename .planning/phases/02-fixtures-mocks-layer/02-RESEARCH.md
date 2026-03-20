# Phase 2: Fixtures & Mocks Layer - Research

**Researched:** 2026-03-20
**Domain:** Test isolation, fixtures, factory/builder patterns, interface-based mocking
**Confidence:** HIGH

## Summary

Phase 2 focuses on building robust test isolation infrastructure through testcontainers-go for PostgreSQL, enhancing test fixtures with factory/builder patterns, and implementing interface-based mocking with uber-go/mock. This phase addresses 13 requirements covering database isolation, test fixtures, mock infrastructure, and setup/teardown lifecycle management.

**Primary recommendation:** Use testcontainers-go with PostgreSQL module for database isolation, implement builder pattern on existing fixtures, extract interfaces from database and Nakama runtime layers, and generate mocks with uber-go/mock.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testcontainers-go | latest | PostgreSQL containerized test instances | Industry standard for database test isolation; supports snapshot/restore for fast tests |
| testcontainers-postgres | latest | PostgreSQL-specific testcontainers module | Provides pre-configured PostgreSQL containers with connection helpers |
| uber-go/mock | latest | Interface-based mocking for Go | Official Go mocking tool; type-safe; generates mocks from interfaces |
| testify | v1.11.1 (already installed) | Assertions, test suites, mock assertions | Already in project; provides assertion library compatible with mocks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqlmock | v1.x (if needed) | SQL query mocking for unit tests | For testing database layer without PostgreSQL; use sparingly |
| go-sqlmock | latest | Mock sql.Driver interface | Alternative to testcontainers for pure unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testcontainers-go | Dockertest | testcontainers-go has better Go API, official PostgreSQL module, snapshot support |
| uber-go/mock | testify/mock | uber-go/mock generates mocks from interfaces (less boilerplate), better IDE support |
| Builder pattern | Functional options | Builder pattern is more readable for complex fixtures with many fields |

**Installation:**
```bash
# Install testcontainers-go with PostgreSQL module
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres

# Install uber-go/mock CLI for code generation
go install go.uber.org/mock/mockgen@latest

# Add to go.mod (already has testify v1.11.1)
go mod tidy
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── tests/
│   ├── testhelpers/
│   │   ├── fixtures.go           # Factory/builder functions (enhance existing)
│   │   ├── helpers.go            # Existing helpers (keep as-is)
│   │   ├── db_testcontainers.go  # NEW: testcontainers setup/teardown
│   │   └── mocks/                # NEW: Generated mocks
│   │       ├── nakama_runtime_mock.go
│   │       ├── database_mock.go
│   │       └── logger_mock.go
│   └── integration/
│       ├── db_suite_test.go      # Database test suite with setup/teardown
│       └── fixtures_test.go      # Fixture tests
├── internal/
│   ├── database/
│   │   ├── database.go           # Extract Database interface
│   │   └── database_mock.go      # Generated mock
│   └── ...
```

### Pattern 1: testcontainers-go PostgreSQL Setup
**What:** Create isolated PostgreSQL instances per test suite using Docker containers
**When to use:** All integration tests requiring database access
**Example:**
```go
// Source: https://golang.testcontainers.org/modules/postgres/
package testhelpers

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	_ "github.com/lib/pq"
)

// TestDB wraps testcontainers PostgreSQL container with lifecycle management
type TestDB struct {
	Container *postgres.PostgresContainer
	DB        *sql.DB
	ConnStr   string
	Snapshot  string // For fast reset
}

// SetupTestDB creates a new PostgreSQL container for testing
// Returns TestDB with connection and snapshot support
func SetupTestDB(ctx context.Context, t *testing.T) *TestDB {
	// Create PostgreSQL container with migrations
	pgContainer, err := postgres.Run(ctx,
		"docker.io/postgres:16-alpine",
		postgres.WithDatabase("test_db"),
		postgres.WithUsername("test_user"),
		postgres.WithPassword("test_password"),
		postgres.WithInitScripts("../../../backend/data/migrations/"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}

	// Get connection string
	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("failed to get connection string: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("failed to connect to database: %v", err)
	}

	// Create initial snapshot for fast reset
	snapshot := "initial_snapshot"
	if err := pgContainer.Snapshot(ctx, snapshot); err != nil {
		t.Fatalf("failed to create snapshot: %v", err)
	}

	return &TestDB{
		Container: pgContainer,
		DB:        db,
		ConnStr:   connStr,
		Snapshot:  snapshot,
	}
}

// TeardownTestDB stops the PostgreSQL container
func TeardownTestDB(ctx context.Context, tdb *TestDB, ctx context.Context) error {
	if tdb.DB != nil {
		if err := tdb.DB.Close(); err != nil {
			return err
		}
	}
	if tdb.Container != nil {
		return tdb.Container.Terminate(ctx)
	}
	return nil
}

// ResetTestDB restores database to initial snapshot (fast reset)
func ResetTestDB(ctx context.Context, tdb *TestDB) error {
	if tdb.Snapshot != "" {
		return tdb.Container.Restore(ctx, tdb.Snapshot)
	}
	return nil
}
```

**Usage in tests:**
```go
func TestPlayerRepository(t *testing.T) {
	ctx := context.Background()
	tdb := testhelpers.SetupTestDB(ctx, t)
	defer testhelpers.TeardownTestDB(ctx, tdb)

	// Test code using tdb.DB
	repo := NewPlayerRepository(tdb.DB)
	player := repo.CreatePlayer(ctx, testhelpers.NewTestPlayer())

	// Reset for next test (faster than recreating container)
	testhelpers.ResetTestDB(ctx, tdb)
}
```

### Pattern 2: Builder Pattern for Fixtures
**What:** Fluent builder API for creating test data with sensible defaults
**When to use:** Creating complex test objects (players, gear, matches) with custom fields
**Example:**
```go
// Enhanced fixtures.go with builder pattern
package testhelpers

import (
	"time"
)

// PlayerBuilder provides fluent API for building test players
type PlayerBuilder struct {
	player *TestPlayer
}

// NewPlayerBuilder creates a new player builder with defaults
func NewPlayerBuilder() *PlayerBuilder {
	return &PlayerBuilder{
		player: NewTestPlayer(),
	}
}

// WithLevel sets player level
func (b *PlayerBuilder) WithLevel(level int) *PlayerBuilder {
	b.player.Level = level
	// Auto-scale stats based on level
	b.player.Attack = 10 + level
	b.player.Defense = 10 + level
	b.player.Dodge = 10 + (level / 2)
	b.player.CritRate = 5 + (level / 5)
	return b
}

// WithStats sets custom stats
func (b *PlayerBuilder) WithStats(attack, defense, dodge, critRate int) *PlayerBuilder {
	b.player.Attack = attack
	b.player.Defense = defense
	b.player.Dodge = dodge
	b.player.CritRate = critRate
	return b
}

// WithGear adds gear to player
func (b *PlayerBuilder) WithGear(gear ...TestGear) *PlayerBuilder {
	b.player.Gear = append(b.player.Gear, gear...)
	return b
}

// WithID sets custom user ID
func (b *PlayerBuilder) WithID(userID string) *PlayerBuilder {
	b.player.UserID = userID
	return b
}

// WithXP sets player XP
func (b *PlayerBuilder) WithXP(xp int) *PlayerBuilder {
	b.player.XP = xp
	return b
}

// Build returns the constructed player
func (b *PlayerBuilder) Build() *TestPlayer {
	return b.player
}

// Usage in tests:
// player := testhelpers.NewPlayerBuilder().
//     WithLevel(10).
//     WithStats(25, 20, 15, 8).
//     WithGear(*testhelpers.NewTestGearWithType("bow", "epic")).
//     Build()
```

### Pattern 3: Interface Extraction for Mocking
**What:** Extract interfaces from concrete implementations to enable mocking
**When to use:** Testing code that depends on external dependencies (database, Nakama runtime)
**Example (database layer):**
```go
// internal/database/database.go - Add interface
package database

import (
	"context"
	"database/sql"
)

// Database defines the interface for database operations
// This interface is extracted to enable mocking in unit tests
type Database interface {
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
	Close() error
}

// DBWrapper implements Database interface (existing implementation)
type DBWrapper struct {
	db *sql.DB
}

// Ensure DBWrapper implements Database interface
var _ Database = (*DBWrapper)(nil)

// Existing methods remain unchanged...
func (w *DBWrapper) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return w.db.QueryContext(ctx, query, args...)
}

// ... other methods
```

### Pattern 4: Mock Generation with uber-go/mock
**What:** Generate type-safe mocks from interfaces using mockgen
**When to use:** Creating mocks for any interface-based dependency
**Example:**
```bash
# Generate mock for Database interface
mockgen -source=internal/database/database.go \
	 -destination=tests/testhelpers/mocks/database_mock.go \
	 -package=mocks

# Generate mock for Nakama runtime.Logger
mockgen -source=vendor/github.com/heroiclabs/nakama-common/runtime/logger.go \
	 -destination=tests/testhelpers/mocks/nakama_runtime_mock.go \
	 -package=mocks
```

**Generated mock usage:**
```go
package main_test

import (
	"testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"

	"your-project/tests/testhelpers/mocks"
	"your-project/internal/database"
)

func TestPlayerService_CreatePlayer(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	mockDB := mocks.NewMockDatabase(ctrl)

	// Set up expectations
	mockDB.EXPECT().
		ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(sql.Result{}, nil)

	// Use mock in test
	service := NewPlayerService(mockDB)
	err := service.CreatePlayer(context.Background(), player)

	require.NoError(t, err)
}
```

### Pattern 5: Nakama Runtime Mocking
**What:** Mock Nakama runtime interfaces for RPC handler testing
**When to use:** Unit testing RPC handlers without Nakama server
**Example:**
```go
// tests/testhelpers/mocks/nakama_runtime_mock.go
// Generated via mockgen from nakama-common/runtime interfaces

package mocks

import (
	"go.uber.org/mock/gomock"
	"github.com/heroiclabs/nakama-common/runtime"
)

// MockNakamaLogger is a mock of runtime.Logger
type MockNakamaLogger struct {
	ctrl     *gomock.Controller
	recorder *MockNakamaLoggerMockRecorder
}

// MockNakamaLoggerMockRecorder is the mock recorder for MockNakamaLogger
type MockNakamaLoggerMockRecorder struct {
	mock *MockNakamaLogger
}

// NewMockNakamaLogger creates a new mock instance
func NewMockNakamaLogger(ctrl *gomock.Controller) *MockNakamaLogger {
	mock := &MockNakamaLogger{ctrl: ctrl}
	mock.recorder = &MockNakamaLoggerMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockNakamaLogger) EXPECT() *MockNakamaLoggerMockRecorder {
	return m.recorder
}

// Info mocks base method
func (m *MockNakamaLogger) Info(format string, v ...interface{}) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "Info", []interface{}{format, v})
}

// Info indicates an expected call of Info
func (mr *MockNakamaLoggerMockRecorder) Info(format interface{}, v ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Info", reflect.TypeOf((*MockNakamaLogger)(nil).Info), append([]interface{}{format}, v...))
}

// ... other methods (Debug, Error, Warn, etc.)
```

**Usage in RPC handler tests:**
```go
func TestRpcHandler_GetPlayerStats(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Mock Nakama logger
	mockLogger := mocks.NewMockNakamaLogger(ctrl)
	mockLogger.EXPECT().Info(gomock.Any()).AnyTimes()

	// Mock Nakama runtime (if needed)
	mockRuntime := mocks.NewMockNakamaRuntime(ctrl)

	// Test RPC handler with mocks
	handler := NewRpcHandler(mockRuntime, mockLogger)
	result, err := handler.GetPlayerStats(ctx, userID)

	require.NoError(t, err)
	assert.NotNil(t, result)
}
```

### Pattern 6: Test Suite Lifecycle Management
**What:** Organize tests with setup/teardown lifecycle using testify/suite
**When to use:** Integration tests requiring shared setup/teardown
**Example:**
```go
package integration_test

import (
	"testing"
	"github.com/stretchr/testify/suite"
	"your-project/tests/testhelpers"
)

type DatabaseTestSuite struct {
	suite.Suite
	ctx      context.Context
	testDB   *testhelpers.TestDB
	repo     *PlayerRepository
}

// SetupSuite runs once before all tests
func (s *DatabaseTestSuite) SetupSuite() {
	s.ctx = context.Background()
	s.testDB = testhelpers.SetupTestDB(s.ctx, s.T())
	s.repo = NewPlayerRepository(s.testDB.DB)
}

// TearDownSuite runs once after all tests
func (s *DatabaseTestSuite) TearDownSuite() {
	testhelpers.TeardownTestDB(s.ctx, s.testDB)
}

// SetupTest runs before each test
func (s *DatabaseTestSuite) SetupTest() {
	// Reset database to snapshot for isolation
	testhelpers.ResetTestDB(s.ctx, s.testDB)
}

// TearDownTest runs after each test
func (s *DatabaseTestSuite) TearDownTest() {
	// Cleanup if needed
}

func (s *DatabaseTestSuite) TestCreatePlayer() {
	player := testhelpers.NewPlayerBuilder().
		WithLevel(5).
		WithStats(15, 12, 10, 6).
		Build()

	err := s.repo.CreatePlayer(s.ctx, player)
	s.NoError(err)
	s.NotEmpty(player.ID)
}

func TestDatabaseTestSuite(t *testing.T) {
	suite.Run(t, new(DatabaseTestSuite))
}
```

### Anti-Patterns to Avoid
- **Shared test data:** Tests should create their own fixtures, not share mutable state
- **Brittle mocks:** Mocks should verify behavior, not implementation details (avoid over-specifying expectations)
- **No cleanup:** Always defer cleanup in setup functions
- **Hard-coded database strings:** Use testcontainers connection strings dynamically
- **Testing private methods:** Test public interfaces; refactor private methods to public if critical

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PostgreSQL test instances | Custom Docker scripts | testcontainers-go PostgreSQL module | Handles lifecycle, connection pooling, snapshot/restore, port conflicts |
| Mock objects | Hand-written mock structs | uber-go/mock generated mocks | Type-safe, less boilerplate, IDE support, keeps mocks in sync with interfaces |
| Fixture factories | Ad-hoc test data creation | Builder pattern fixtures | Consistent defaults, readable, reusable, reduces test duplication |
| Database reset logic | TRUNCATE/DELETE queries | testcontainers snapshot/restore | 10-100x faster, ensures clean state, handles foreign keys automatically |

**Key insight:** Test isolation infrastructure is complex to build correctly. testcontainers-go solves Docker orchestration, connection management, and cleanup. uber-go/mock ensures mocks stay synchronized with interfaces. Building these manually leads to flaky tests, port conflicts, and mock drift.

## Common Pitfalls

### Pitfall 1: Test Pollution via Shared State
**What goes wrong:** Tests pass individually but fail when run together due to shared database state
**Why it happens:** Tests don't clean up data or reset database between tests
**How to avoid:**
- Use testcontainers snapshot/restore for fast database reset
- Always reset database in `SetupTest()` (before each test)
- Never share fixture instances between tests
**Warning signs:** Tests pass in isolation but fail in CI; adding `t.Parallel()` breaks tests

### Pitfall 2: Mock Drift from Real Implementation
**What goes wrong:** Mocks return different values than real implementation, tests pass but production fails
**Why it happens:** Hand-written mocks or outdated generated mocks
**How to avoid:**
- Use uber-go/mock for generated mocks (auto-sync with interfaces)
- Regenerate mocks when interfaces change: `make generate-mocks`
- Add mock validation test to compare mock vs real behavior
- Use contract tests to validate mocks match real implementation
**Warning signs:** Tests consistently pass but integration tests fail; mock logic diverges from implementation

### Pitfall 3: Slow Test Execution
**What goes wrong:** Test suite takes 10+ minutes due to PostgreSQL container recreation
**Why it happens:** Not using testcontainers snapshot/restore feature
**How to avoid:**
- Create snapshot after schema migrations in `SetupSuite()`
- Restore snapshot in `SetupTest()` (100ms vs 5s for new container)
- Use `ResetTestDB()` helper for consistent reset pattern
**Warning signs:** Tests take >5 minutes; developers skip running tests locally

### Pitfall 4: Interface Bloat
**What goes wrong:** Database interface has 50 methods; mocks are unmanageable
**Why it happens:** Extracting interface from entire concrete implementation
**How to avoid:**
- Extract minimal interfaces per use case (Interface Segregation Principle)
- Create multiple small interfaces (Queryer, Executor, Transacter)
- Compose interfaces as needed: `type Database interface { Queryer; Executor }`
**Warning signs:** Mock setup is longer than test logic; many EXPECT() calls per test

### Pitfall 5: Fixture Brittleness
**What goes wrong:** Tests break when game rules change (e.g., level caps, stat scaling)
**Why it happens:** Hard-coded test values instead of using builder defaults
**How to avoid:**
- Use builder pattern with sensible defaults
- Calculate derived values (e.g., stats from level) in fixtures
- Avoid hard-coding values that depend on game rules
**Warning signs:** Test files need mass updates when game logic changes

## Code Examples

Verified patterns from official sources:

### testcontainers-go PostgreSQL Setup
```go
// Source: https://golang.testcontainers.org/modules/postgres/
package testhelpers

import (
	"context"
	"testing"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func SetupPostgres(ctx context.Context, t *testing.T) *postgres.PostgresContainer {
	container, err := postgres.Run(ctx,
		"docker.io/postgres:16-alpine",
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("user"),
		postgres.WithPassword("password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		t.Fatalf("failed to start container: %v", err)
	}
	return container
}
```

### uber-go/mock Generation and Usage
```go
// Source: https://github.com/uber-go/mock
// Generation command:
// mockgen -source=interface.go -destination=mock_interface.go

// Usage in test:
func TestExample(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockObj := mocks.NewMockMyInterface(ctrl)
	mockObj.EXPECT().SomeMethod(gomock.Any()).Return(42)

	// Test code...
}
```

### Builder Pattern for Fixtures
```go
// Enhanced existing fixtures.go
player := testhelpers.NewPlayerBuilder().
	WithLevel(10).
	WithStats(25, 20, 15, 8).
	WithGear(*testhelpers.NewTestGearWithType("bow", "epic")).
	WithID("test_player_123").
	Build()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Docker scripts | testcontainers-go | 2023+ | Simplified test setup, better isolation, snapshot support |
| Hand-written mocks | uber-go/mock | 2021+ | Type-safe mocks, less boilerplate, auto-generation |
| Hard-coded fixtures | Builder pattern | Industry standard | Flexible test data, consistent defaults, less duplication |
| TRUNCATE for cleanup | Snapshot/restore | 2024+ | 10-100x faster test reset, cleaner isolation |

**Deprecated/outdated:**
- dockertest: Superseded by testcontainers-go (better API, more modules)
- testify/mock: Use uber-go/mock for interface mocking (testify/mock is for concrete types)
- Global test fixtures: Causes test pollution; use suite lifecycle with reset

## Open Questions

1. **Nakama Runtime Interface Completeness**
   - What we know: nakama-common/runtime provides interfaces (Logger, NakamaModule, etc.)
   - What's unclear: Full extent of interfaces needed for RPC handler mocking
   - Recommendation: Start with Logger and NakamaModule mocks, expand as needed during RPC handler tests

2. **Migration Script Compatibility with testcontainers**
   - What we know: testcontainers-go supports WithInitScripts() for SQL files
   - What's unclear: Whether Nakama migration format is compatible
   - Recommendation: Test with existing `backend/data/migrations/` SQL files; fall back to running migrations in test setup if needed

3. **Godot ↔ Go Fixture Sharing Format**
   - What we know: Both sides can serialize/deserialize JSON
   - What's unclear: Optimal JSON schema for cross-platform fixtures
   - Recommendation: Start with existing Go structs serialized to JSON; Godot can parse same format in Phase 3

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing + testify v1.11.1 |
| Config file | None (standard Go layout) |
| Quick run command | `go test ./backend/tests/testhelpers/... -run TestFixtures -v` |
| Full suite command | `go test ./backend/... -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISO-01 | Database isolation via testcontainers | integration | `go test ./backend/tests/testhelpers/... -run TestSetupTestDB -v` | ❌ Wave 0 |
| ISO-02 | Factory fixtures for test data | unit | `go test ./backend/tests/testhelpers/... -run TestNewTestPlayer -v` | ✅ exists (needs enhancement) |
| ISO-03 | Automatic test data cleanup | integration | `go test ./backend/tests/testhelpers/... -run TestResetTestDB -v` | ❌ Wave 0 |
| ISO-05 | Setup/teardown lifecycle | integration | `go test ./backend/tests/integration/... -run TestDatabaseTestSuite -v` | ❌ Wave 0 |
| FIX-01 | Player factory fixtures | unit | `go test ./backend/tests/testhelpers/... -run TestPlayerBuilder -v` | ❌ Wave 0 |
| FIX-02 | Gear factory fixtures | unit | `go test ./backend/tests/testhelpers/... -run TestGearBuilder -v` | ❌ Wave 0 |
| FIX-03 | Match factory fixtures | unit | `go test ./backend/tests/testhelpers/... -run TestMatchBuilder -v` | ❌ Wave 0 |
| FIX-04 | Builder pattern for fixtures | unit | `go test ./backend/tests/testhelpers/... -run TestBuilderPattern -v` | ❌ Wave 0 |
| FIX-05 | Cross-platform fixtures (JSON) | integration | `go test ./backend/tests/testhelpers/... -run TestJSONFixtures -v` | ❌ Wave 0 |
| MOCK-01 | Nakama runtime mocking | unit | `go test ./backend/internal/rpc/... -run TestNakamaMock -v` | ❌ Wave 0 |
| MOCK-02 | Database layer mocking | unit | `go test ./backend/internal/database/... -run TestDatabaseMock -v` | ❌ Wave 0 |
| MOCK-04 | uber/mock generation | build | `mockgen -source=internal/database/database.go -destination=tests/testhelpers/mocks/database_mock.go` | ❌ Wave 0 |
| MOCK-05 | Mock validation | integration | `go test ./backend/tests/integration/... -run TestMockValidation -v` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `go test ./backend/tests/testhelpers/... -run TestFixtures -v`
- **Per wave merge:** `go test ./backend/... -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/testhelpers/db_testcontainers.go` — testcontainers setup/teardown (covers ISO-01, ISO-03, ISO-05)
- [ ] `backend/tests/testhelpers/fixtures_builder.go` — builder pattern enhancements (covers FIX-01 through FIX-05)
- [ ] `backend/internal/database/database.go` — extract Database interface (covers MOCK-02)
- [ ] `backend/tests/testhelpers/mocks/*.go` — generated mocks (covers MOCK-01, MOCK-02, MOCK-04)
- [ ] `backend/tests/integration/db_suite_test.go` — test suite lifecycle (covers ISO-05)
- [ ] `backend/tests/integration/fixtures_test.go` — fixture tests (covers FIX-01 through FIX-05)
- [ ] `backend/tests/integration/mocks_validation_test.go` — mock validation (covers MOCK-05)
- [ ] Makefile target `generate-mocks` — regenerate mocks from interfaces
- [ ] Framework install: testcontainers-go and uber-go/mock (dependencies need installation)

## Sources

### Primary (HIGH confidence)
- testcontainers-go PostgreSQL module - https://golang.testcontainers.org/modules/postgres/ (snapshot/restore, WithInitScripts, lifecycle management)
- uber-go/mock - https://github.com/uber-go/mock (full README retrieved: mockgen usage, controller pattern, expectations)
- testify v1.11.1 - Already installed in project (verified in go.mod)
- Existing fixtures.go - /home/alex/armored-archer/backend/tests/testhelpers/fixtures.go (current factory implementation)

### Secondary (MEDIUM confidence)
- Go testing patterns - https://go.dev/doc/tutorial/add-a-test (table-driven tests, t.Helper())
- testify/suite - https://github.com/stretchr/testify/tree/master/suite (setup/teardown lifecycle)
- Interface extraction best practices - https://go.dev/blog/interfaces-behaviors (interface segregation)

### Tertiary (LOW confidence)
- None (all findings verified with official documentation or existing codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - testcontainers-go and uber-go/mock verified via official docs
- Architecture: HIGH - patterns from official documentation, existing codebase examined
- Pitfalls: HIGH - based on documented best practices and existing fixture limitations

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - stable ecosystem)
