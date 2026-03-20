package rpc

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	nakamaruntime "github.com/heroiclabs/nakama-common/runtime"
)

// mockLogger is a minimal logger implementation for benchmarks.
type mockLogger struct{}

func (m *mockLogger) Info(format string, args ...interface{}) {}
func (m *mockLogger) Debug(format string, args ...interface{}) {}
func (m *mockLogger) Warn(format string, args ...interface{}) {}
func (m *mockLogger) Error(format string, args ...interface{}) {}
func (m *mockLogger) Fields() map[string]interface{} {
	return make(map[string]interface{})
}
func (m *mockLogger) WithField(name string, value interface{}) nakamaruntime.Logger {
	return m
}
func (m *mockLogger) WithFields(fields map[string]interface{}) nakamaruntime.Logger {
	return m
}

// mockNakamaModule is a minimal NakamaModule implementation for benchmarks.
// We embed the actual interface and only implement what we need.
// The RPC handlers only use GetUserId, so we implement that.
type mockNakamaModule struct {
	nakamaruntime.NakamaModule
}

func (m *mockNakamaModule) GetUserId(ctx context.Context) (string, error) {
	return "test-user-id", nil
}

// SetupBenchmarkDB creates a PostgreSQL container for benchmarks.
// This is a benchmark-friendly version that doesn't require *testing.T.
func SetupBenchmarkDB(ctx context.Context) (*testhelpers.TestDB, error) {
	// Create PostgreSQL container
	pgContainer, err := postgres.Run(ctx,
		"docker.io/postgres:16-alpine",
		postgres.WithDatabase("test_db"),
		postgres.WithUsername("test_user"),
		postgres.WithPassword("test_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*60*time.Second)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to start postgres container: %w", err)
	}

	// Get connection string
	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		pgContainer.Terminate(ctx)
		return nil, fmt.Errorf("failed to get connection string: %w", err)
	}

	// Create initial snapshot for fast reset
	snapshotName := "initial_snapshot"
	if err := pgContainer.Snapshot(ctx, postgres.WithSnapshotName(snapshotName)); err != nil {
		pgContainer.Terminate(ctx)
		return nil, fmt.Errorf("failed to create snapshot: %w", err)
	}

	// Connect to database after snapshot is created
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		pgContainer.Terminate(ctx)
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Verify connection
	if err := db.PingContext(ctx); err != nil {
		pgContainer.Terminate(ctx)
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &testhelpers.TestDB{
		Container: pgContainer,
		DB:        db,
		ConnStr:   connStr,
		Snapshot:  snapshotName,
	}, nil
}

// BenchmarkGetPlayerStats measures performance of GetPlayerStats RPC handler.
func BenchmarkGetPlayerStats(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
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

	// Insert test player stats using factory function
	player := testhelpers.NewPlayerBuilder().
		WithID("test-user-id").
		WithLevel(10).
		WithXP(5000).
		Build()

	// Convert player stats to JSON for database storage
	statsJSON, err := json.Marshal(player)
	if err != nil {
		b.Fatalf("Failed to marshal player stats: %v", err)
	}
	_, err = tdb.DB.Exec(`
		INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
		VALUES ($1, $2, $3, $4, $5)
	`, player.UserID, player.Level, player.XP, 5, statsJSON)
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

// BenchmarkGetLeaderboard measures performance of GetLeaderboard RPC handler.
func BenchmarkGetLeaderboard(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
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

	// Insert 100 test players with varying XP
	for i := 1; i <= 100; i++ {
		userID := fmt.Sprintf("user-%d", i)
		username := fmt.Sprintf("Player%d", i)

		_, err = tdb.DB.Exec(`
			INSERT INTO users (id, username) VALUES ($1, $2)
		`, userID, username)
		if err != nil {
			b.Fatalf("Failed to insert user: %v", err)
		}

		_, err = tdb.DB.Exec(`
			INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
			VALUES ($1, $2, $3, $4, $5)
		`, userID, i, int64(i*1000), i*5, `{}`)
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

// BenchmarkGetInventory measures performance of GetInventory RPC handler.
func BenchmarkGetInventory(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
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

	// Insert test catalog entries
	for i := 1; i <= 20; i++ {
		baseStats := map[string]int{
			"attack":  i * 5,
			"defense": i * 3,
			"speed":   i * 2,
		}
		statsJSON, _ := json.Marshal(baseStats)

		gearID := fmt.Sprintf("gear-%d", i)
		name := fmt.Sprintf("Bow%d", i)

		_, err = tdb.DB.Exec(`
			INSERT INTO catalog (gear_id, gear_type, name, rarity, base_stats, modifiers)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, gearID, "bow", name, "rare", statsJSON, `[]`)
		if err != nil {
			b.Fatalf("Failed to insert catalog entry: %v", err)
		}
	}

	// Insert test inventory items
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

// BenchmarkGetPlayerStatsParallel measures concurrent performance.
func BenchmarkGetPlayerStatsParallel(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
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

	// Insert test player stats using factory function
	player := testhelpers.NewPlayerBuilder().
		WithID("test-user-id").
		WithLevel(10).
		WithXP(5000).
		Build()

	// Convert player stats to JSON for database storage
	statsJSON, err := json.Marshal(player)
	if err != nil {
		b.Fatalf("Failed to marshal player stats: %v", err)
	}
	_, err = tdb.DB.Exec(`
		INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
		VALUES ($1, $2, $3, $4, $5)
	`, player.UserID, player.Level, player.XP, 5, statsJSON)
	if err != nil {
		b.Fatalf("Failed to insert test player stats: %v", err)
	}

	// Create mock logger and NakamaModule
	logger := &mockLogger{}
	nk := new(mockNakamaModule)

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark in parallel
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := GetPlayerStats(ctx, logger, tdb.DB, nk, "{}")
			if err != nil {
				b.Fatalf("GetPlayerStats failed: %v", err)
			}
		}
	})
}
