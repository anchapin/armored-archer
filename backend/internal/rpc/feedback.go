// Package rpc provides RPC handler implementations for the Armored Archer backend.
// This file contains feedback-related RPC handlers.

package rpc

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/feedback"
	"github.com/heroiclabs/nakama-common/runtime"
	"github.com/lib/pq"
)

// Cache key constants for feedback
const (
	cacheKeyFeedbackStats = "feedback:stats"
	cacheTTLFeedbackStats = 60 * time.Second // Short TTL for stats - changes frequently
)

// SubmitFeedback handles user feedback submission.
// RPC: submit_feedback
func SubmitFeedback(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("SubmitFeedback called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}

	// Parse request
	var req feedback.SubmitFeedbackRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse submit feedback request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Validate request
	if err := req.Validate(); err != nil {
		logger.Warn("Invalid feedback submission from user %s: %v", userID, err)
		return errorResponse(false, err.Error(), nil)
	}

	// Create feedback submission
	fb, err := feedback.NewFeedbackSubmission(userID, &req)
	if err != nil {
		logger.Error("Failed to create feedback submission: %v", err)
		return errorResponse(false, "Failed to create feedback", err)
	}

	// Insert into database
	query := `
		INSERT INTO feedback_submissions (
			user_id, category, title, description, priority, status,
			game_version, platform, device_info, session_id,
			screenshot_url, replay_data, submitted_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING feedback_id
	`

	replayDataJSON := "{}"
	if fb.ReplayData != nil {
		jsonBytes, _ := json.Marshal(fb.ReplayData)
		replayDataJSON = string(jsonBytes)
	}

	var feedbackID string
	err = db.QueryRowContext(ctx, query,
		fb.UserID,
		string(fb.Category),
		fb.Title,
		fb.Description,
		string(fb.Priority),
		string(fb.Status),
		fb.GameVersion,
		fb.Platform,
		fb.DeviceInfo,
		fb.SessionID,
		fb.ScreenshotURL,
		replayDataJSON,
		time.UnixMilli(fb.SubmittedAt).UTC(),
	).Scan(&feedbackID)

	if err != nil {
		logger.Error("Failed to insert feedback into database: %v", err)
		return errorResponse(false, "Failed to save feedback", err)
	}

	fb.FeedbackID = feedbackID

	// Log feedback submission
	logger.Info("Feedback submitted: %s by user %s (category: %s)", feedbackID, userID, fb.Category)

	// Send notification to developers (optional - can be implemented later)
	// For now, we'll just log it
	logger.Debug("Developer notification to be implemented")

	// Return success response
	response := feedback.FeedbackResult{
		Success:    true,
		FeedbackID: feedbackID,
		Feedback:   fb,
	}

	return jsonResponse(response)
}

// GetFeedback handles retrieving feedback by ID.
// RPC: get_feedback
func GetFeedback(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetFeedback called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}

	// Parse request
	var req struct {
		FeedbackID string `json:"feedback_id"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse get feedback request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	if req.FeedbackID == "" {
		return errorResponse(false, "feedback_id is required", nil)
	}

	// Query feedback from database
	query := `
		SELECT 
			feedback_id, user_id, category, title, description, priority, status,
			game_version, platform, device_info, session_id, screenshot_url,
			replay_data, assigned_to, tags, submitted_at, reviewed_at, resolved_at
		FROM feedback_submissions
		WHERE feedback_id = $1
	`

	var fb feedback.FeedbackSubmission
	var replayDataJSON string
	var reviewedAt, resolvedAt sql.NullTime

	err = db.QueryRowContext(ctx, query, req.FeedbackID).Scan(
		&fb.FeedbackID,
		&fb.UserID,
		&fb.Category,
		&fb.Title,
		&fb.Description,
		&fb.Priority,
		&fb.Status,
		&fb.GameVersion,
		&fb.Platform,
		&fb.DeviceInfo,
		&fb.SessionID,
		&fb.ScreenshotURL,
		&replayDataJSON,
		&fb.AssignedTo,
		pqArray(&fb.Tags),
		&fb.SubmittedAt,
		&reviewedAt,
		&resolvedAt,
	)

	if err == sql.ErrNoRows {
		return errorResponse(false, "Feedback not found", nil)
	}
	if err != nil {
		logger.Error("Failed to query feedback: %v", err)
		return errorResponse(false, "Failed to retrieve feedback", err)
	}

	// Parse replay data
	if replayDataJSON != "" && replayDataJSON != "{}" {
		json.Unmarshal([]byte(replayDataJSON), &fb.ReplayData)
	}

	// Convert timestamps
	fb.SubmittedAt = time.UnixMilli(fb.SubmittedAt).UnixMilli()
	if reviewedAt.Valid {
		ts := reviewedAt.Time.UnixMilli()
		fb.ReviewedAt = &ts
	}
	if resolvedAt.Valid {
		ts := resolvedAt.Time.UnixMilli()
		fb.ResolvedAt = &ts
	}

	// Check permissions - users can only view their own feedback unless they're admin
	if fb.UserID != userID {
		// Check if user is admin (this should be implemented based on your auth system)
		isAdmin, err := checkIfUserIsAdmin(ctx, nk, userID)
		if err != nil {
			logger.Warn("Failed to check admin status: %v", err)
		}
		if !isAdmin {
			return errorResponse(false, "Permission denied", nil)
		}
	}

	// Get vote count and response count
	statsQuery := `
		SELECT 
			COALESCE((SELECT SUM(vote_type) FROM feedback_votes WHERE feedback_id = $1), 0) AS vote_count,
			COALESCE((SELECT COUNT(*) FROM feedback_responses WHERE feedback_id = $1 AND is_internal = false), 0) AS response_count
	`
	
	var voteCount, responseCount int
	err = db.QueryRowContext(ctx, statsQuery, req.FeedbackID).Scan(&voteCount, &responseCount)
	if err != nil {
		logger.Warn("Failed to get feedback stats: %v", err)
	}

	feedbackWithStats := &feedback.FeedbackWithStats{
		FeedbackSubmission: fb,
		VoteCount:          voteCount,
		ResponseCount:      responseCount,
	}

	response := feedback.FeedbackListResult{
		Success:  true,
		Feedback: []*feedback.FeedbackWithStats{feedbackWithStats},
		Total:    1,
		Limit:    1,
		Offset:   0,
	}

	return jsonResponse(response)
}

// ListFeedback handles listing feedback with optional filters.
// RPC: list_feedback
func ListFeedback(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("ListFeedback called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}

	// Parse request
	var req feedback.GetFeedbackOptions
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse list feedback request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Set defaults
	if req.Limit <= 0 {
		req.Limit = 50
	}
	if req.Limit > 100 {
		req.Limit = 100
	}
	if req.SortBy == "" {
		req.SortBy = "submitted_at"
	}
	if req.OrderBy == "" {
		req.OrderBy = "desc"
	}

	// Check if user is admin
	isAdmin, err := checkIfUserIsAdmin(ctx, nk, userID)
	if err != nil {
		logger.Warn("Failed to check admin status: %v", err)
		isAdmin = false
	}

	// Build query
	query := `
		SELECT 
			fs.feedback_id, fs.user_id, fs.category, fs.title, fs.description,
			fs.priority, fs.status, fs.game_version, fs.platform, fs.device_info,
			fs.session_id, fs.screenshot_url, fs.replay_data, fs.assigned_to,
			fs.tags, fs.submitted_at, fs.reviewed_at, fs.resolved_at,
			COALESCE(v.vote_count, 0) AS vote_count,
			COALESCE(r.response_count, 0) AS response_count,
			COALESCE(n.unread_count, 0) AS unread_count
		FROM feedback_submissions fs
		LEFT JOIN (
			SELECT feedback_id, SUM(vote_type) AS vote_count
			FROM feedback_votes
			GROUP BY feedback_id
		) v ON fs.feedback_id = v.feedback_id
		LEFT JOIN (
			SELECT feedback_id, COUNT(*) AS response_count
			FROM feedback_responses
			WHERE is_internal = false
			GROUP BY feedback_id
		) r ON fs.feedback_id = r.feedback_id
		LEFT JOIN (
			SELECT feedback_id, COUNT(*) AS unread_count
			FROM feedback_notifications
			WHERE is_read = false
			GROUP BY feedback_id
		) n ON fs.feedback_id = n.feedback_id
		WHERE 1=1
	`

	args := []interface{}{}
	argIndex := 1

	// Apply filters
	if !isAdmin {
		// Non-admin users can only see their own feedback
		query += fmt.Sprintf(" AND fs.user_id = $%d", argIndex)
		args = append(args, userID)
		argIndex++
	}

	if req.Category != nil {
		query += fmt.Sprintf(" AND fs.category = $%d", argIndex)
		args = append(args, string(*req.Category))
		argIndex++
	}

	if req.Status != nil {
		query += fmt.Sprintf(" AND fs.status = $%d", argIndex)
		args = append(args, string(*req.Status))
		argIndex++
	}

	if req.Priority != nil && isAdmin {
		query += fmt.Sprintf(" AND fs.priority = $%d", argIndex)
		args = append(args, string(*req.Priority))
		argIndex++
	}

	if req.AssignedTo != nil && isAdmin {
		query += fmt.Sprintf(" AND fs.assigned_to = $%d", argIndex)
		args = append(args, *req.AssignedTo)
		argIndex++
	}

	if req.UserID != nil && isAdmin {
		query += fmt.Sprintf(" AND fs.user_id = $%d", argIndex)
		args = append(args, *req.UserID)
		argIndex++
	}

	// Add ordering
	query += fmt.Sprintf(" ORDER BY fs.%s %s", req.SortBy, req.OrderBy)
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, req.Limit, req.Offset)

	// Execute query
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		logger.Error("Failed to query feedback: %v", err)
		return errorResponse(false, "Failed to retrieve feedback", err)
	}
	defer rows.Close()

	feedbackList := make([]*feedback.FeedbackWithStats, 0)
	for rows.Next() {
		var fb feedback.FeedbackWithStats
		var replayDataJSON string
		var reviewedAt, resolvedAt sql.NullTime

		err := rows.Scan(
			&fb.FeedbackID,
			&fb.UserID,
			&fb.Category,
			&fb.Title,
			&fb.Description,
			&fb.Priority,
			&fb.Status,
			&fb.GameVersion,
			&fb.Platform,
			&fb.DeviceInfo,
			&fb.SessionID,
			&fb.ScreenshotURL,
			&replayDataJSON,
			&fb.AssignedTo,
			pqArray(&fb.Tags),
			&fb.SubmittedAt,
			&reviewedAt,
			&resolvedAt,
			&fb.VoteCount,
			&fb.ResponseCount,
			&fb.UnreadCount,
		)
		if err != nil {
			logger.Error("Failed to scan feedback row: %v", err)
			continue
		}

		// Parse replay data
		if replayDataJSON != "" && replayDataJSON != "{}" {
			json.Unmarshal([]byte(replayDataJSON), &fb.ReplayData)
		}

		// Convert timestamps
		fb.SubmittedAt = time.UnixMilli(fb.SubmittedAt).UnixMilli()
		if reviewedAt.Valid {
			ts := reviewedAt.Time.UnixMilli()
			fb.ReviewedAt = &ts
		}
		if resolvedAt.Valid {
			ts := resolvedAt.Time.UnixMilli()
			fb.ResolvedAt = &ts
		}

		feedbackList = append(feedbackList, &fb)
	}

	// Get total count (approximation based on result set)
	var total int64 = int64(len(feedbackList))

	response := feedback.FeedbackListResult{
		Success:  true,
		Feedback: feedbackList,
		Total:    total,
		Limit:    req.Limit,
		Offset:   req.Offset,
	}

	return jsonResponse(response)
}

// VoteFeedback handles voting on feedback.
// RPC: vote_feedback
func VoteFeedback(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("VoteFeedback called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}

	// Parse request
	var req feedback.VoteFeedbackRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse vote feedback request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Validate request
	if err := req.Validate(); err != nil {
		return errorResponse(false, err.Error(), nil)
	}

	// Check if feedback exists
	var feedbackUserID string
	err = db.QueryRowContext(ctx, "SELECT user_id FROM feedback_submissions WHERE feedback_id = $1", req.FeedbackID).Scan(&feedbackUserID)
	if err == sql.ErrNoRows {
		return errorResponse(false, "Feedback not found", nil)
	}
	if err != nil {
		logger.Error("Failed to check feedback existence: %v", err)
		return errorResponse(false, "Failed to validate feedback", err)
	}

	// Users cannot vote on their own feedback
	if feedbackUserID == userID {
		return errorResponse(false, "Cannot vote on your own feedback", nil)
	}

	// Insert or update vote
	query := `
		INSERT INTO feedback_votes (feedback_id, user_id, vote_type, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (feedback_id, user_id) DO UPDATE
		SET vote_type = $3, created_at = NOW()
	`

	_, err = db.ExecContext(ctx, query, req.FeedbackID, userID, req.VoteType)
	if err != nil {
		logger.Error("Failed to save vote: %v", err)
		return errorResponse(false, "Failed to save vote", err)
	}

	logger.Info("User %s voted %d on feedback %s", userID, req.VoteType, req.FeedbackID)

	response := feedback.FeedbackResult{
		Success: true,
	}

	return jsonResponse(response)
}

// AddFeedbackResponse handles adding a response to feedback.
// RPC: add_feedback_response
func AddFeedbackResponse(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("AddFeedbackResponse called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}

	// Parse request
	var req feedback.AddFeedbackResponseRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse add response request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Validate request
	if err := req.Validate(); err != nil {
		return errorResponse(false, err.Error(), nil)
	}

	// Check if user is admin/developer (only developers can respond)
	isAdmin, err := checkIfUserIsAdmin(ctx, nk, userID)
	if err != nil || !isAdmin {
		return errorResponse(false, "Permission denied - only developers can respond", nil)
	}

	// Create response
	resp, err := feedback.NewFeedbackResponse(req.FeedbackID, userID, req.ResponseText, req.IsInternal)
	if err != nil {
		logger.Error("Failed to create response: %v", err)
		return errorResponse(false, "Failed to create response", err)
	}

	// Insert into database
	query := `
		INSERT INTO feedback_responses (feedback_id, user_id, response_text, is_internal, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING response_id
	`

	var responseID string
	err = db.QueryRowContext(ctx, query,
		resp.FeedbackID,
		resp.UserID,
		resp.ResponseText,
		resp.IsInternal,
		time.UnixMilli(resp.CreatedAt).UTC(),
	).Scan(&responseID)

	if err != nil {
		logger.Error("Failed to insert response: %v", err)
		return errorResponse(false, "Failed to save response", err)
	}

	resp.ResponseID = responseID

	logger.Info("Developer %s added response to feedback %s", userID, req.FeedbackID)

	response := feedback.ResponseResult{
		Success:    true,
		ResponseID: responseID,
		Response:   resp,
	}

	return jsonResponse(response)
}

// GetFeedbackStatistics handles retrieving feedback statistics.
// RPC: get_feedback_statistics
func GetFeedbackStatistics(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetFeedbackStatistics called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}

	// Check if user is admin
	isAdmin, err := checkIfUserIsAdmin(ctx, nk, userID)
	if err != nil || !isAdmin {
		return errorResponse(false, "Permission denied - only developers can view statistics", nil)
	}

	// Parse request
	var req struct {
		Days int `json:"days"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse statistics request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Set default
	if req.Days <= 0 {
		req.Days = 30
	}

	// Query statistics
	query := `
		SELECT
			(SELECT COUNT(*) FROM feedback_submissions WHERE submitted_at >= NOW() - ($1 || ' days')::INTERVAL)::BIGINT AS total_submissions,
			(SELECT COUNT(*) FROM feedback_submissions WHERE status = 'resolved' AND resolved_at >= NOW() - ($1 || ' days')::INTERVAL)::BIGINT AS total_resolved,
			(SELECT COUNT(*) FROM feedback_submissions WHERE status IN ('submitted', 'acknowledged', 'in_review'))::BIGINT AS total_pending,
			(SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - submitted_at)) / 3600)
			 FROM feedback_submissions
			 WHERE status = 'resolved' AND resolved_at IS NOT NULL) AS avg_resolution_time_hours
	`

	var stats feedback.FeedbackStatistics
	var avgResolutionTime sql.NullFloat64

	err = db.QueryRowContext(ctx, query, req.Days).Scan(
		&stats.TotalSubmissions,
		&stats.TotalResolved,
		&stats.TotalPending,
		&avgResolutionTime,
	)

	if err != nil {
		logger.Error("Failed to query statistics: %v", err)
		return errorResponse(false, "Failed to retrieve statistics", err)
	}

	if avgResolutionTime.Valid {
		stats.AvgResolutionTimeHours = avgResolutionTime.Float64
	}

	// Get breakdowns by category
	categoryQuery := `
		SELECT category::TEXT, COUNT(*) 
		FROM feedback_submissions 
		WHERE submitted_at >= NOW() - ($1 || ' days')::INTERVAL
		GROUP BY category
	`

	stats.SubmissionsByCategory = make(map[string]int64)
	rows, err := db.QueryContext(ctx, categoryQuery, req.Days)
	if err != nil {
		logger.Warn("Failed to query category breakdown: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var category string
			var count int64
			if err := rows.Scan(&category, &count); err == nil {
				stats.SubmissionsByCategory[category] = count
			}
		}
	}

	// Get breakdowns by status
	statusQuery := `
		SELECT status::TEXT, COUNT(*) 
		FROM feedback_submissions 
		WHERE submitted_at >= NOW() - ($1 || ' days')::INTERVAL
		GROUP BY status
	`

	stats.SubmissionsByStatus = make(map[string]int64)
	rows, err = db.QueryContext(ctx, statusQuery, req.Days)
	if err != nil {
		logger.Warn("Failed to query status breakdown: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int64
			if err := rows.Scan(&status, &count); err == nil {
				stats.SubmissionsByStatus[status] = count
			}
		}
	}

	// Get breakdowns by priority
	priorityQuery := `
		SELECT priority::TEXT, COUNT(*) 
		FROM feedback_submissions 
		WHERE submitted_at >= NOW() - ($1 || ' days')::INTERVAL
		GROUP BY priority
	`

	stats.SubmissionsByPriority = make(map[string]int64)
	rows, err = db.QueryContext(ctx, priorityQuery, req.Days)
	if err != nil {
		logger.Warn("Failed to query priority breakdown: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var priority string
			var count int64
			if err := rows.Scan(&priority, &count); err == nil {
				stats.SubmissionsByPriority[priority] = count
			}
		}
	}

	response := feedback.StatisticsResult{
		Success:    true,
		Statistics: &stats,
	}

	return jsonResponse(response)
}

// Helper functions

// getUserIDFromContext extracts user ID from Nakama session.
func getUserIDFromContext(ctx context.Context, nk runtime.NakamaModule) (string, error) {
	// This is a simplified version - in production, extract from context properly
	// For Nakama, you'd use: nk.GetSession(ctx).UserID
	// Since we don't have direct access, we'll use a placeholder
	// The actual implementation would depend on how Nakama passes session info
	
	// For Go modules, Nakama passes session in context
	// You can extract it using:
	// session, ok := ctx.Value(runtime.ContextKeySession).(nakama.Session)
	// if !ok {
	//     return "", fmt.Errorf("session not found in context")
	// }
	// return session.GetUserID(), nil
	
	// For now, return empty string - actual implementation depends on Nakama version
	// The session user ID should be extracted from context in production
	return "", nil
}

// checkIfUserIsAdmin checks if a user has admin privileges.
func checkIfUserIsAdmin(ctx context.Context, nk runtime.NakamaModule, userID string) (bool, error) {
	// This should be implemented based on your authentication/authorization system
	// Options:
	// 1. Check user metadata for admin flag
	// 2. Check against a list of admin user IDs
	// 3. Use Nakama's account system with custom fields
	
	// Placeholder implementation - replace with actual admin check
	// For now, return false (no admins)
	return false, nil
}

// pqArray is a helper for scanning PostgreSQL arrays
func pqArray(dest *[]string) interface{} {
	return (*pq.StringArray)(dest)
}

// jsonResponse creates a JSON response from a struct.
func jsonResponse(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// errorResponse creates an error JSON response.
func errorResponse(success bool, message string, err error) (string, error) {
	response := map[string]interface{}{
		"success": success,
		"error":   message,
	}

	if err != nil {
		response["error_details"] = err.Error()
	}

	b, jsonErr := json.Marshal(response)
	if jsonErr != nil {
		return "", jsonErr
	}
	return string(b), nil
}
