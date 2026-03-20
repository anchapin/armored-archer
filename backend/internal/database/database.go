// Package database provides database connection helpers and utilities for the Armored Archer backend.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/config"
	"github.com/heroiclabs/nakama-common/runtime"
	_ "github.com/lib/pq"
)

// Database defines the interface for database operations.
// This interface enables mocking for unit tests.
type Database interface {
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
	Close() error
}

// DBWrapper provides a wrapped database connection with tracing and metrics.
type DBWrapper struct {
	db     *sql.DB
	config *config.DatabaseConfig
	logger runtime.Logger
}

// Ensure DBWrapper implements Database interface
var _ Database = (*DBWrapper)(nil)

// NewDBWrapper creates a new database wrapper with the provided connection.
func NewDBWrapper(db *sql.DB, cfg *config.DatabaseConfig, logger runtime.Logger) *DBWrapper {
	return &DBWrapper{
		db:     db,
		config: cfg,
		logger: logger,
	}
}

// GetDB returns the underlying database connection.
func (w *DBWrapper) GetDB() *sql.DB {
	return w.db
}

// QueryContext executes a query that returns rows.
func (w *DBWrapper) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return w.db.QueryContext(ctx, query, args...)
}

// QueryRowContext executes a query that returns a single row.
func (w *DBWrapper) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return w.db.QueryRowContext(ctx, query, args...)
}

// ExecContext executes a query that doesn't return rows.
func (w *DBWrapper) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return w.db.ExecContext(ctx, query, args...)
}

// BeginTx begins a transaction.
func (w *DBWrapper) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return w.db.BeginTx(ctx, opts)
}

// ConnectDatabase establishes a connection to the PostgreSQL database.
func ConnectDatabase(ctx context.Context, cfg *config.Config, logger runtime.Logger) (*sql.DB, error) {
	logger.Info("Connecting to database: host=%s, port=%d, database=%s",
		cfg.Database.Host, cfg.Database.Port, cfg.Database.Database)

	// Parse database address if provided
	dsn := cfg.Database.Address
	if dsn == "" {
		// Build DSN from components
		dsn = fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=prefer",
			cfg.Database.Host,
			cfg.Database.Port,
			cfg.Database.User,
			cfg.Database.Password,
			cfg.Database.Database,
		)
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		logger.Error("Failed to open database connection: %v", err)
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool with optimized settings
	db.SetConnMaxLifetime(time.Duration(cfg.Database.ConnMaxLifetime) * time.Second)
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		logger.Error("Failed to ping database: %v", err)
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Info("Database connection established successfully (max_open: %d, max_idle: %d, conn_lifetime: %ds)",
		cfg.Database.MaxOpenConns, cfg.Database.MaxIdleConns, cfg.Database.ConnMaxLifetime)
	return db, nil
}

// QueryWithTimeout executes a query with a custom timeout.
// This helps prevent long-running queries from blocking the system.
func (w *DBWrapper) QueryWithTimeout(ctx context.Context, timeout time.Duration, query string, args ...interface{}) (*sql.Rows, error) {
	// Create a context with timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return w.db.QueryContext(ctx, query, args...)
}

// QueryRowWithTimeout executes a single-row query with a custom timeout.
func (w *DBWrapper) QueryRowWithTimeout(ctx context.Context, timeout time.Duration, query string, args ...interface{}) *sql.Row {
	// Create a context with timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return w.db.QueryRowContext(ctx, query, args...)
}

// ExecWithTimeout executes a statement with a custom timeout.
func (w *DBWrapper) ExecWithTimeout(ctx context.Context, timeout time.Duration, query string, args ...interface{}) (sql.Result, error) {
	// Create a context with timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return w.db.ExecContext(ctx, query, args...)
}

// QueryWithRetry executes a query with retry logic.
func (w *DBWrapper) QueryWithRetry(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	const maxRetries = 3
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		rows, err := w.db.QueryContext(ctx, query, args...)
		if err == nil {
			return rows, nil
		}

		lastErr = err
		w.logger.Debug("Query attempt %d failed: %v", attempt+1, err)

		// Don't retry on context errors
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		// Wait before retry (exponential backoff)
		time.Sleep(time.Duration(attempt*100) * time.Millisecond)
	}

	return nil, fmt.Errorf("query failed after %d attempts: %w", maxRetries, lastErr)
}

// ExecWithRetry executes a statement with retry logic.
func (w *DBWrapper) ExecWithRetry(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	const maxRetries = 3
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		result, err := w.db.ExecContext(ctx, query, args...)
		if err == nil {
			return result, nil
		}

		lastErr = err
		w.logger.Debug("Exec attempt %d failed: %v", attempt+1, err)

		// Don't retry on context errors
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		// Wait before retry (exponential backoff)
		time.Sleep(time.Duration(attempt*100) * time.Millisecond)
	}

	return nil, fmt.Errorf("exec failed after %d attempts: %w", maxRetries, lastErr)
}

// QueryRowWithRetry executes a query that returns a single row with retry logic.
func (w *DBWrapper) QueryRowWithRetry(ctx context.Context, query string, args ...interface{}) *sql.Row {
	// For QueryRow, we don't retry automatically since it's typically used for single lookups
	// Callers should handle errors appropriately
	return w.db.QueryRowContext(ctx, query, args...)
}

// Close closes the database connection.
func (w *DBWrapper) Close() error {
	if w.db != nil {
		return w.db.Close()
	}
	return nil
}
