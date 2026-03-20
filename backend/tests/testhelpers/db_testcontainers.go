// Package testhelpers provides testcontainers PostgreSQL setup/teardown for integration tests.
// This file implements isolated PostgreSQL instances using testcontainers-go with
// snapshot/restore for fast database reset between tests.
package testhelpers

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	_ "github.com/lib/pq"
)

// TestDB wraps testcontainers PostgreSQL container with lifecycle management.
// It provides database isolation, connection management, and snapshot/restore
// for fast test execution.
type TestDB struct {
	Container *postgres.PostgresContainer
	DB        *sql.DB
	ConnStr   string
	Snapshot  string // Snapshot name for fast reset
}

// SetupTestDB creates a new PostgreSQL container for testing.
//
// The container is configured with:
// - PostgreSQL 16-alpine image
// - Database name: "test_db"
// - Username: "test_user"
// - Password: "test_password"
// - Migrations loaded from backend/data/migrations/
// - Snapshot created after schema setup for fast reset
//
// Example:
//
//	ctx := context.Background()
//	tdb := testhelpers.SetupTestDB(ctx, t)
//	defer testhelpers.TeardownTestDB(ctx, tdb)
func SetupTestDB(ctx context.Context, t *testing.T) *TestDB {
	t.Helper()

	// Create PostgreSQL container with migrations
	pgContainer, err := postgres.Run(ctx,
		"docker.io/postgres:16-alpine",
		postgres.WithDatabase("test_db"),
		postgres.WithUsername("test_user"),
		postgres.WithPassword("test_password"),
		postgres.WithInitScripts("../../data/migrations/"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*60*time.Second)),
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

	// Verify connection
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("failed to ping database: %v", err)
	}

	// Create initial snapshot for fast reset
	snapshotName := "initial_snapshot"
	if err := pgContainer.Snapshot(ctx, postgres.WithSnapshotName(snapshotName)); err != nil {
		t.Fatalf("failed to create snapshot: %v", err)
	}

	return &TestDB{
		Container: pgContainer,
		DB:        db,
		ConnStr:   connStr,
		Snapshot:  snapshotName,
	}
}

// TeardownTestDB stops the PostgreSQL container and closes the database connection.
//
// This should be called in a defer statement after SetupTestDB to ensure
// proper cleanup of test resources.
//
// Example:
//
//	defer testhelpers.TeardownTestDB(ctx, tdb)
func TeardownTestDB(ctx context.Context, tdb *TestDB) error {
	if tdb == nil {
		return nil
	}

	// Close database connection
	if tdb.DB != nil {
		if err := tdb.DB.Close(); err != nil {
			return fmt.Errorf("failed to close database: %w", err)
		}
	}

	// Terminate PostgreSQL container
	if tdb.Container != nil {
		if err := tdb.Container.Terminate(ctx); err != nil {
			return fmt.Errorf("failed to terminate container: %w", err)
		}
	}

	return nil
}

// ResetTestDB restores the database to the initial snapshot.
//
// This is much faster than recreating the container (typically 100ms vs 5s).
// Should be called in SetupTest() before each test to ensure test isolation.
//
// Example:
//
//	func (s *MyTestSuite) SetupTest() {
//		testhelpers.ResetTestDB(s.ctx, s.testDB)
//	}
func ResetTestDB(ctx context.Context, tdb *TestDB) error {
	if tdb == nil || tdb.Container == nil || tdb.Snapshot == "" {
		return fmt.Errorf("invalid TestDB state for reset")
	}

	if err := tdb.Container.Restore(ctx, postgres.WithSnapshotName(tdb.Snapshot)); err != nil {
		return fmt.Errorf("failed to restore snapshot: %w", err)
	}

	return nil
}
