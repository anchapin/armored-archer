package rpc

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/cache"
	"github.com/anchapin/armored-archer/backend/internal/feedback"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

// BenchmarkSubmitFeedback measures performance of feedback submission.
func BenchmarkSubmitFeedback(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
	if err != nil {
		b.Fatalf("Failed to setup benchmark DB: %v", err)
	}
	defer testhelpers.TeardownTestDB(ctx, tdb)

	// Create feedback_submissions table
	_, err = tdb.DB.Exec(`
		CREATE TABLE IF NOT EXISTS feedback_submissions (
			feedback_id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			category TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			priority TEXT NOT NULL,
			status TEXT NOT NULL,
			game_version TEXT,
			platform TEXT,
			device_info TEXT,
			session_id TEXT,
			screenshot_url TEXT,
			replay_data JSONB,
			assigned_to TEXT,
			tags TEXT[],
			submitted_at TIMESTAMP NOT NULL,
			reviewed_at TIMESTAMP,
			resolved_at TIMESTAMP
		)
	`)
	if err != nil {
		b.Fatalf("Failed to create feedback_submissions table: %v", err)
	}

	// Initialize global cache for cache invalidation testing
	globalCache := cache.GetGlobalCache()
	if globalCache == nil {
		b.Skip("Cache not initialized - skipping cache invalidation test")
	}

	// Prepare payload
	req := feedback.SubmitFeedbackRequest{
		Category:    string(feedback.CategoryBug),
		Title:       "Test feedback",
		Description: "Load test feedback submission with enough characters",
	}
	payloadBytes, _ := json.Marshal(req)
	payload := string(payloadBytes)

	// Create mock logger and NakamaModule
	logger := &mockLogger{}
	nk := new(mockNakamaModule)

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_, err := SubmitFeedback(ctx, logger, tdb.DB, nk, payload)
		if err != nil {
			b.Fatalf("SubmitFeedback failed: %v", err)
		}
	}
}

// BenchmarkGetFeedbackStatistics measures performance of statistics query.
func BenchmarkGetFeedbackStatistics(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
	if err != nil {
		b.Fatalf("Failed to setup benchmark DB: %v", err)
	}
	defer testhelpers.TeardownTestDB(ctx, tdb)

	// Create feedback_submissions table
	_, err = tdb.DB.Exec(`
		CREATE TABLE IF NOT EXISTS feedback_submissions (
			feedback_id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			category TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			priority TEXT NOT NULL,
			status TEXT NOT NULL,
			game_version TEXT,
			platform TEXT,
			device_info TEXT,
			session_id TEXT,
			screenshot_url TEXT,
			replay_data JSONB,
			assigned_to TEXT,
			tags TEXT[],
			submitted_at TIMESTAMP NOT NULL,
			reviewed_at TIMESTAMP,
			resolved_at TIMESTAMP
		)
	`)
	if err != nil {
		b.Fatalf("Failed to create feedback_submissions table: %v", err)
	}

	// Insert 50 feedback submissions with various categories/statuses
	categories := []feedback.FeedbackCategory{
		feedback.CategoryBug,
		feedback.CategorySuggestion,
		feedback.CategoryBalance,
		feedback.CategoryPerformance,
		feedback.CategoryUIUX,
	}
	statuses := []feedback.FeedbackStatus{
		feedback.StatusSubmitted,
		feedback.StatusAcknowledged,
		feedback.StatusInReview,
		feedback.StatusResolved,
	}

	for i := 1; i <= 50; i++ {
		category := categories[i%len(categories)]
		status := statuses[i%len(statuses)]

		submittedAt := time.Now().Add(-time.Duration(i) * time.Hour).UTC()

		_, err = tdb.DB.Exec(`
			INSERT INTO feedback_submissions (
				feedback_id, user_id, category, title, description,
				priority, status, submitted_at, resolved_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`,
			fmt.Sprintf("feedback-%d", i),
			fmt.Sprintf("user-%d", i),
			string(category),
			fmt.Sprintf("Feedback %d", i),
			fmt.Sprintf("Description for feedback %d", i),
			string(feedback.PriorityMedium),
			string(status),
			submittedAt,
			nil,
		)
		if err != nil {
			b.Fatalf("Failed to insert feedback submission: %v", err)
		}
	}

	// Create mock logger and NakamaModule with admin privileges
	logger := &mockLogger{}
	nk := new(mockNakamaModule)

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		payload := `{"days": 30}`
		_, err := GetFeedbackStatistics(ctx, logger, tdb.DB, nk, payload)
		if err != nil {
			b.Fatalf("GetFeedbackStatistics failed: %v", err)
		}
	}
}

// BenchmarkGetFeedbackStatisticsCached measures cache hit performance.
func BenchmarkGetFeedbackStatisticsCached(b *testing.B) {
	ctx := context.Background()

	// Setup testcontainers PostgreSQL instance
	tdb, err := SetupBenchmarkDB(ctx)
	if err != nil {
		b.Fatalf("Failed to setup benchmark DB: %v", err)
	}
	defer testhelpers.TeardownTestDB(ctx, tdb)

	// Create feedback_submissions table
	_, err = tdb.DB.Exec(`
		CREATE TABLE IF NOT EXISTS feedback_submissions (
			feedback_id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			category TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			priority TEXT NOT NULL,
			status TEXT NOT NULL,
			game_version TEXT,
			platform TEXT,
			device_info TEXT,
			session_id TEXT,
			screenshot_url TEXT,
			replay_data JSONB,
			assigned_to TEXT,
			tags TEXT[],
			submitted_at TIMESTAMP NOT NULL,
			reviewed_at TIMESTAMP,
			resolved_at TIMESTAMP
		)
	`)
	if err != nil {
		b.Fatalf("Failed to create feedback_submissions table: %v", err)
	}

	// Insert 50 feedback submissions
	categories := []feedback.FeedbackCategory{
		feedback.CategoryBug,
		feedback.CategorySuggestion,
		feedback.CategoryBalance,
		feedback.CategoryPerformance,
		feedback.CategoryUIUX,
	}
	statuses := []feedback.FeedbackStatus{
		feedback.StatusSubmitted,
		feedback.StatusAcknowledged,
		feedback.StatusInReview,
		feedback.StatusResolved,
	}

	for i := 1; i <= 50; i++ {
		category := categories[i%len(categories)]
		status := statuses[i%len(statuses)]

		submittedAt := time.Now().Add(-time.Duration(i) * time.Hour).UTC()

		_, err = tdb.DB.Exec(`
			INSERT INTO feedback_submissions (
				feedback_id, user_id, category, title, description,
				priority, status, submitted_at, resolved_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`,
			fmt.Sprintf("feedback-%d", i),
			fmt.Sprintf("user-%d", i),
			string(category),
			fmt.Sprintf("Feedback %d", i),
			fmt.Sprintf("Description for feedback %d", i),
			string(feedback.PriorityMedium),
			string(status),
			submittedAt,
			nil,
		)
		if err != nil {
			b.Fatalf("Failed to insert feedback submission: %v", err)
		}
	}

	// Create mock logger and NakamaModule with admin privileges
	logger := &mockLogger{}
	nk := new(mockNakamaModule)

	// Initialize cache and populate it with first call
	globalCache := cache.GetGlobalCache()
	if globalCache == nil {
		b.Skip("Cache not initialized - skipping cached benchmark")
	}

	payload := `{"days": 30}`
	_, err = GetFeedbackStatistics(ctx, logger, tdb.DB, nk, payload)
	if err != nil {
		b.Fatalf("Failed to populate cache: %v", err)
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark - should hit cache
	for i := 0; i < b.N; i++ {
		_, err := GetFeedbackStatistics(ctx, logger, tdb.DB, nk, payload)
		if err != nil {
			b.Fatalf("GetFeedbackStatistics failed: %v", err)
		}
	}
}
