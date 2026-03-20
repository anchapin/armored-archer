// Package database provides database connection helpers and utilities for the Armored Archer backend.
package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
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

// QueryPerformanceResult holds EXPLAIN ANALYZE results.
type QueryPerformanceResult struct {
	ExecutionTime  float64               // milliseconds
	PlanningTime   float64               // milliseconds
	Plan           map[string]interface{} // EXPLAIN output
	UsesIndex      bool
	MissingIndexes []string
}

// ValidateQueryPerformance runs EXPLAIN ANALYZE and validates performance.
func (w *DBWrapper) ValidateQueryPerformance(ctx context.Context, query string, args ...interface{}) (*QueryPerformanceResult, error) {
	explainQuery := fmt.Sprintf("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s", query)

	var resultJSON []byte
	err := w.db.QueryRowContext(ctx, explainQuery, args...).Scan(&resultJSON)
	if err != nil {
		return nil, fmt.Errorf("EXPLAIN ANALYZE failed: %w", err)
	}

	var plan []map[string]interface{}
	if err := json.Unmarshal(resultJSON, &plan); err != nil {
		return nil, fmt.Errorf("failed to parse EXPLAIN output: %w", err)
	}

	result := &QueryPerformanceResult{
		Plan: plan[0],
	}

	// Extract execution time from plan
	if executionTime, ok := plan[0]["Execution Time"].(float64); ok {
		result.ExecutionTime = executionTime
	}

	if planningTime, ok := plan[0]["Planning Time"].(float64); ok {
		result.PlanningTime = planningTime
	}

	// Check if index is used
	result.UsesIndex = w.checkIndexUsage(plan)

	// Identify potential missing indexes
	result.MissingIndexes = w.identifyMissingIndexes(plan)

	return result, nil
}

// checkIndexUsage recursively checks if any node uses an index.
func (w *DBWrapper) checkIndexUsage(plan []map[string]interface{}) bool {
	for _, node := range plan {
		if scanType, ok := node["Node Type"].(string); ok {
			if strings.Contains(scanType, "Index") || strings.Contains(scanType, "Index Scan") || strings.Contains(scanType, "Index Only Scan") {
				return true
			}
		}
		if children, ok := node["Plans"].([]map[string]interface{}); ok {
			// Convert to slice of map[string]interface{} for recursion
			childPlans := make([]map[string]interface{}, len(children))
			for i, child := range children {
				childPlans[i] = child
			}
			if w.checkIndexUsage(childPlans) {
				return true
			}
		}
	}
	return false
}

// identifyMissingIndexes suggests indexes for Seq Scan nodes.
func (w *DBWrapper) identifyMissingIndexes(plan []map[string]interface{}) []string {
	var suggestions []string

	for _, node := range plan {
		if relationName, ok := node["Relation Name"].(string); ok {
			if scanType, ok := node["Node Type"].(string); ok && scanType == "Seq Scan" {
				// Check if this is a large table scan
				if actualRows, ok := node["Actual Rows"].(float64); ok && actualRows > 1000 {
					suggestions = append(suggestions, fmt.Sprintf("Consider adding index on %s", relationName))
				}
			}
		}

		if condition, ok := node["Filter"].(string); ok {
			// Extract column name from filter condition
			// This is simplified - real implementation would parse SQL
			if strings.Contains(condition, "WHERE") {
				suggestions = append(suggestions, fmt.Sprintf("Filter: %s", condition))
			}
		}

		// Recurse into child plans
		if children, ok := node["Plans"].([]map[string]interface{}); ok {
			childPlans := make([]map[string]interface{}, len(children))
			for i, child := range children {
				childPlans[i] = child
			}
			suggestions = append(suggestions, w.identifyMissingIndexes(childPlans)...)
		}
	}

	return suggestions
}

// LogQueryPerformance validates and logs query performance with warnings.
func (w *DBWrapper) LogQueryPerformance(ctx context.Context, query string, args ...interface{}) {
	result, err := w.ValidateQueryPerformance(ctx, query, args...)
	if err != nil {
		w.logger.Warn("Failed to validate query performance: %v", err)
		return
	}

	// Log performance metrics
	w.logger.Debug("Query performance: %.2fms execution, %.2fms planning",
		result.ExecutionTime, result.PlanningTime)

	// Warn if exceeds P95 target
	if result.ExecutionTime > 50 {
		w.logger.Warn("Query exceeds P95 target (%.2fms > 50ms)", result.ExecutionTime)
	}

	// Warn if not using index
	if !result.UsesIndex {
		w.logger.Warn("Query not using index - consider adding index for better performance")
	}

	// Log missing index suggestions
	for _, suggestion := range result.MissingIndexes {
		w.logger.Info("Index suggestion: %s", suggestion)
	}
}
