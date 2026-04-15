// Package feedback provides feedback collection and management functionality for the Armored Archer backend.
package feedback

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// FeedbackCategory represents the category of feedback.
type FeedbackCategory string

const (
	CategoryBug         FeedbackCategory = "bug"
	CategorySuggestion  FeedbackCategory = "suggestion"
	CategoryBalance     FeedbackCategory = "balance"
	CategoryPerformance FeedbackCategory = "performance"
	CategoryUIUX        FeedbackCategory = "ui_ux"
	CategoryAudio       FeedbackCategory = "audio"
	CategoryOther       FeedbackCategory = "other"
)

// ValidFeedbackCategories returns all valid feedback categories.
func ValidFeedbackCategories() []FeedbackCategory {
	return []FeedbackCategory{
		CategoryBug,
		CategorySuggestion,
		CategoryBalance,
		CategoryPerformance,
		CategoryUIUX,
		CategoryAudio,
		CategoryOther,
	}
}

// IsValidCategory checks if a category is valid.
func IsValidCategory(category string) bool {
	for _, c := range ValidFeedbackCategories() {
		if string(c) == category {
			return true
		}
	}
	return false
}

// FeedbackPriority represents the priority level of feedback.
type FeedbackPriority string

const (
	PriorityLow      FeedbackPriority = "low"
	PriorityMedium   FeedbackPriority = "medium"
	PriorityHigh     FeedbackPriority = "high"
	PriorityCritical FeedbackPriority = "critical"
)

// ValidFeedbackPriorities returns all valid priority levels.
func ValidFeedbackPriorities() []FeedbackPriority {
	return []FeedbackPriority{PriorityLow, PriorityMedium, PriorityHigh, PriorityCritical}
}

// IsValidPriority checks if a priority is valid.
func IsValidPriority(priority string) bool {
	for _, p := range ValidFeedbackPriorities() {
		if string(p) == priority {
			return true
		}
	}
	return false
}

// FeedbackStatus represents the status of feedback.
type FeedbackStatus string

const (
	StatusSubmitted    FeedbackStatus = "submitted"
	StatusAcknowledged FeedbackStatus = "acknowledged"
	StatusInReview     FeedbackStatus = "in_review"
	StatusPlanned      FeedbackStatus = "planned"
	StatusInProgress   FeedbackStatus = "in_progress"
	StatusResolved     FeedbackStatus = "resolved"
	StatusClosed       FeedbackStatus = "closed"
	StatusRejected     FeedbackStatus = "rejected"
)

// ValidFeedbackStatuses returns all valid status values.
func ValidFeedbackStatuses() []FeedbackStatus {
	return []FeedbackStatus{
		StatusSubmitted,
		StatusAcknowledged,
		StatusInReview,
		StatusPlanned,
		StatusInProgress,
		StatusResolved,
		StatusClosed,
		StatusRejected,
	}
}

// IsValidStatus checks if a status is valid.
func IsValidStatus(status string) bool {
	for _, s := range ValidFeedbackStatuses() {
		if string(s) == status {
			return true
		}
	}
	return false
}

// NotificationType represents types of feedback notifications.
type NotificationType string

const (
	NotifyStatusChange     NotificationType = "status_change"
	NotifyDeveloperResponse NotificationType = "developer_response"
	NotifyResolved         NotificationType = "resolved"
	NotifyAssigned         NotificationType = "assigned"
	NotifyMention          NotificationType = "mention"
)

// FeedbackSubmission represents a user feedback submission.
type FeedbackSubmission struct {
	FeedbackID    string                 `json:"feedback_id"`
	UserID        string                 `json:"user_id"`
	Category      FeedbackCategory       `json:"category"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	Priority      FeedbackPriority       `json:"priority"`
	Status        FeedbackStatus         `json:"status"`
	GameVersion   string                 `json:"game_version"`
	Platform      string                 `json:"platform"`
	DeviceInfo    string                 `json:"device_info,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	ScreenshotURL string                 `json:"screenshot_url,omitempty"`
	ReplayData    map[string]interface{} `json:"replay_data,omitempty"`
	AssignedTo    string                 `json:"assigned_to,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	SubmittedAt   int64                  `json:"submitted_at"`
	ReviewedAt    *int64                 `json:"reviewed_at,omitempty"`
	ResolvedAt    *int64                 `json:"resolved_at,omitempty"`
}

// FeedbackResponse represents a developer response to feedback.
type FeedbackResponse struct {
	ResponseID   string `json:"response_id"`
	FeedbackID   string `json:"feedback_id"`
	UserID       string `json:"user_id"`
	ResponseText string `json:"response_text"`
	IsInternal   bool   `json:"is_internal"`
	CreatedAt    int64  `json:"created_at"`
}

// FeedbackVote represents a vote on feedback.
type FeedbackVote struct {
	VoteID    string `json:"vote_id"`
	FeedbackID string `json:"feedback_id"`
	UserID    string `json:"user_id"`
	VoteType  int    `json:"vote_type"` // 1 for upvote, -1 for downvote
	CreatedAt int64  `json:"created_at"`
}

// FeedbackNotification represents a notification about feedback.
type FeedbackNotification struct {
	NotificationID   string           `json:"notification_id"`
	FeedbackID       string           `json:"feedback_id"`
	UserID           string           `json:"user_id"`
	NotificationType NotificationType `json:"notification_type"`
	OldValue         string           `json:"old_value,omitempty"`
	NewValue         string           `json:"new_value,omitempty"`
	Message          string           `json:"message"`
	IsRead           bool             `json:"is_read"`
	SentAt           int64            `json:"sent_at"`
	ReadAt           *int64           `json:"read_at,omitempty"`
}

// FeedbackWithStats represents feedback with vote and response counts.
type FeedbackWithStats struct {
	FeedbackSubmission
	VoteCount       int `json:"vote_count"`
	ResponseCount   int `json:"response_count"`
	UnreadCount     int `json:"unread_count"`
}

// SubmitFeedbackRequest represents a request to submit feedback.
type SubmitFeedbackRequest struct {
	Category      string                 `json:"category"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	GameVersion   string                 `json:"game_version,omitempty"`
	Platform      string                 `json:"platform,omitempty"`
	DeviceInfo    string                 `json:"device_info,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	ScreenshotURL string                 `json:"screenshot_url,omitempty"`
	ReplayData    map[string]interface{} `json:"replay_data,omitempty"`
}

// Validate validates a submit feedback request.
func (r *SubmitFeedbackRequest) Validate() error {
	if r.Category == "" {
		return errors.New("category is required")
	}

	if !IsValidCategory(r.Category) {
		return fmt.Errorf("invalid category: %s", r.Category)
	}

	if r.Title == "" {
		return errors.New("title is required")
	}

	if len(r.Title) < 5 {
		return errors.New("title must be at least 5 characters")
	}

	if len(r.Title) > 200 {
		return errors.New("title must be less than 200 characters")
	}

	if r.Description == "" {
		return errors.New("description is required")
	}

	if len(r.Description) < 20 {
		return errors.New("description must be at least 20 characters")
	}

	if len(r.Description) > 5000 {
		return errors.New("description must be less than 5000 characters")
	}

	return nil
}

// UpdateFeedbackStatusRequest represents a request to update feedback status.
type UpdateFeedbackStatusRequest struct {
	FeedbackID  string `json:"feedback_id"`
	NewStatus   string `json:"new_status"`
	AssignedTo  string `json:"assigned_to,omitempty"`
	InternalNotes string `json:"internal_notes,omitempty"`
}

// Validate validates an update status request.
func (r *UpdateFeedbackStatusRequest) Validate() error {
	if r.FeedbackID == "" {
		return errors.New("feedback_id is required")
	}

	if r.NewStatus == "" {
		return errors.New("new_status is required")
	}

	if !IsValidStatus(r.NewStatus) {
		return fmt.Errorf("invalid status: %s", r.NewStatus)
	}

	return nil
}

// AddFeedbackResponseRequest represents a request to add a response.
type AddFeedbackResponseRequest struct {
	FeedbackID   string `json:"feedback_id"`
	ResponseText string `json:"response_text"`
	IsInternal   bool   `json:"is_internal"`
}

// Validate validates an add response request.
func (r *AddFeedbackResponseRequest) Validate() error {
	if r.FeedbackID == "" {
		return errors.New("feedback_id is required")
	}

	if r.ResponseText == "" {
		return errors.New("response_text is required")
	}

	if len(r.ResponseText) < 10 {
		return errors.New("response_text must be at least 10 characters")
	}

	if len(r.ResponseText) > 2000 {
		return errors.New("response_text must be less than 2000 characters")
	}

	return nil
}

// VoteFeedbackRequest represents a request to vote on feedback.
type VoteFeedbackRequest struct {
	FeedbackID string `json:"feedback_id"`
	VoteType   int    `json:"vote_type"` // 1 or -1
}

// Validate validates a vote request.
func (r *VoteFeedbackRequest) Validate() error {
	if r.FeedbackID == "" {
		return errors.New("feedback_id is required")
	}

	if r.VoteType != 1 && r.VoteType != -1 {
		return errors.New("vote_type must be 1 (upvote) or -1 (downvote)")
	}

	return nil
}

// GetFeedbackOptions represents options for querying feedback.
type GetFeedbackOptions struct {
	Limit      int              `json:"limit"`
	Offset     int              `json:"offset"`
	Category   *FeedbackCategory `json:"category,omitempty"`
	Status     *FeedbackStatus   `json:"status,omitempty"`
	Priority   *FeedbackPriority `json:"priority,omitempty"`
	AssignedTo *string           `json:"assigned_to,omitempty"`
	UserID     *string           `json:"user_id,omitempty"`
	SortBy     string            `json:"sort_by"` // "submitted_at", "vote_count", "priority"
	OrderBy    string            `json:"order_by"` // "asc", "desc"
}

// FeedbackStatistics represents statistics about feedback.
type FeedbackStatistics struct {
	TotalSubmissions      int64                  `json:"total_submissions"`
	TotalResolved         int64                  `json:"total_resolved"`
	TotalPending          int64                  `json:"total_pending"`
	AvgResolutionTimeHours float64               `json:"avg_resolution_time_hours"`
	SubmissionsByCategory map[string]int64      `json:"submissions_by_category"`
	SubmissionsByStatus   map[string]int64      `json:"submissions_by_status"`
	SubmissionsByPriority map[string]int64      `json:"submissions_by_priority"`
}

// FeedbackResult represents the result of a feedback operation.
type FeedbackResult struct {
	Success    bool                `json:"success"`
	FeedbackID string              `json:"feedback_id,omitempty"`
	Feedback   *FeedbackSubmission `json:"feedback,omitempty"`
	Error      string              `json:"error,omitempty"`
}

// FeedbackListResult represents a list of feedback.
type FeedbackListResult struct {
	Success     bool                 `json:"success"`
	Feedback    []*FeedbackWithStats `json:"feedback"`
	Total       int64                `json:"total"`
	Limit       int                  `json:"limit"`
	Offset      int                  `json:"offset"`
	Error       string               `json:"error,omitempty"`
}

// ResponseResult represents the result of a response operation.
type ResponseResult struct {
	Success    bool              `json:"success"`
	ResponseID string            `json:"response_id,omitempty"`
	Response   *FeedbackResponse `json:"response,omitempty"`
	Error      string            `json:"error,omitempty"`
}

// StatisticsResult represents the result of getting statistics.
type StatisticsResult struct {
	Success    bool                `json:"success"`
	Statistics *FeedbackStatistics `json:"statistics"`
	Error      string              `json:"error,omitempty"`
}

// NewFeedbackSubmission creates a new feedback submission from a request.
func NewFeedbackSubmission(userID string, request *SubmitFeedbackRequest) (*FeedbackSubmission, error) {
	if err := request.Validate(); err != nil {
		return nil, err
	}

	// Set defaults
	gameVersion := request.GameVersion
	if gameVersion == "" {
		gameVersion = "unknown"
	}

	platform := request.Platform
	if platform == "" {
		platform = "unknown"
	}

	// Determine initial priority based on category
	priority := PriorityMedium
	if FeedbackCategory(request.Category) == CategoryBug {
		priority = PriorityHigh
	}

	return &FeedbackSubmission{
		FeedbackID:  generateFeedbackID(),
		UserID:      userID,
		Category:    FeedbackCategory(request.Category),
		Title:       request.Title,
		Description: request.Description,
		Priority:    priority,
		Status:      StatusSubmitted,
		GameVersion: gameVersion,
		Platform:    platform,
		DeviceInfo:  request.DeviceInfo,
		SessionID:   request.SessionID,
		ScreenshotURL: request.ScreenshotURL,
		ReplayData:  request.ReplayData,
		SubmittedAt: time.Now().UnixMilli(),
	}, nil
}

// ToMap converts a feedback submission to a map for database operations.
func (f *FeedbackSubmission) ToMap() map[string]interface{} {
	replayDataJSON := "{}"
	if f.ReplayData != nil {
		jsonBytes, _ := json.Marshal(f.ReplayData)
		replayDataJSON = string(jsonBytes)
	}

	return map[string]interface{}{
		"feedback_id":    f.FeedbackID,
		"user_id":        f.UserID,
		"category":       string(f.Category),
		"title":          f.Title,
		"description":    f.Description,
		"priority":       string(f.Priority),
		"status":         string(f.Status),
		"game_version":   f.GameVersion,
		"platform":       f.Platform,
		"device_info":    f.DeviceInfo,
		"session_id":     f.SessionID,
		"screenshot_url": f.ScreenshotURL,
		"replay_data":    replayDataJSON,
		"submitted_at":   time.UnixMilli(f.SubmittedAt).UTC(),
	}
}

// ToJSON converts a feedback submission to JSON string.
func (f *FeedbackSubmission) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(f)
	if err != nil {
		return "", fmt.Errorf("failed to marshal feedback: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a feedback submission from JSON.
func FromJSON(jsonStr string) (*FeedbackSubmission, error) {
	var feedback FeedbackSubmission
	if err := json.Unmarshal([]byte(jsonStr), &feedback); err != nil {
		return nil, fmt.Errorf("failed to parse feedback JSON: %w", err)
	}
	return &feedback, nil
}

// UpdateStatus updates the feedback status.
func (f *FeedbackSubmission) UpdateStatus(status FeedbackStatus, assignedTo string) {
	f.Status = status
	
	now := time.Now().UnixMilli()
	nowPtr := &now

	if status == StatusInReview || status == StatusInProgress {
		if f.ReviewedAt == nil {
			f.ReviewedAt = nowPtr
		}
	}

	if status == StatusResolved {
		if f.ResolvedAt == nil {
			f.ResolvedAt = nowPtr
		}
	}

	if assignedTo != "" {
		f.AssignedTo = assignedTo
	}
}

// IsPending returns true if the feedback is pending review.
func (f *FeedbackSubmission) IsPending() bool {
	return f.Status == StatusSubmitted || f.Status == StatusAcknowledged
}

// IsResolved returns true if the feedback is resolved.
func (f *FeedbackSubmission) IsResolved() bool {
	return f.Status == StatusResolved || f.Status == StatusClosed
}

// GetResolutionTimeHours returns the time to resolution in hours.
func (f *FeedbackSubmission) GetResolutionTimeHours() float64 {
	if f.ResolvedAt == nil {
		return 0
	}
	
	resolvedTime := time.UnixMilli(*f.ResolvedAt)
	submittedTime := time.UnixMilli(f.SubmittedAt)
	
	duration := resolvedTime.Sub(submittedTime)
	return duration.Hours()
}

// NewFeedbackResponse creates a new feedback response.
func NewFeedbackResponse(feedbackID, userID, responseText string, isInternal bool) (*FeedbackResponse, error) {
	if feedbackID == "" {
		return nil, errors.New("feedback_id is required")
	}

	if userID == "" {
		return nil, errors.New("user_id is required")
	}

	if responseText == "" {
		return nil, errors.New("response_text is required")
	}

	if len(responseText) < 10 {
		return nil, errors.New("response_text must be at least 10 characters")
	}

	if len(responseText) > 2000 {
		return nil, errors.New("response_text must be less than 2000 characters")
	}

	return &FeedbackResponse{
		ResponseID:   generateResponseID(),
		FeedbackID:   feedbackID,
		UserID:       userID,
		ResponseText: responseText,
		IsInternal:   isInternal,
		CreatedAt:    time.Now().UnixMilli(),
	}, nil
}

// ToMap converts a feedback response to a map for database operations.
func (r *FeedbackResponse) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"response_id":   r.ResponseID,
		"feedback_id":   r.FeedbackID,
		"user_id":       r.UserID,
		"response_text": r.ResponseText,
		"is_internal":   r.IsInternal,
		"created_at":    time.UnixMilli(r.CreatedAt).UTC(),
	}
}

// ToJSON converts a feedback response to JSON string.
func (r *FeedbackResponse) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("failed to marshal response: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a feedback response from JSON.
func ResponseFromJSON(jsonStr string) (*FeedbackResponse, error) {
	var response FeedbackResponse
	if err := json.Unmarshal([]byte(jsonStr), &response); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %w", err)
	}
	return &response, nil
}

// NewFeedbackNotification creates a new feedback notification.
func NewFeedbackNotification(
	feedbackID, userID string,
	notificationType NotificationType,
	oldValue, newValue, message string,
) *FeedbackNotification {
	return &FeedbackNotification{
		NotificationID:   generateNotificationID(),
		FeedbackID:       feedbackID,
		UserID:           userID,
		NotificationType: notificationType,
		OldValue:         oldValue,
		NewValue:         newValue,
		Message:          message,
		IsRead:           false,
		SentAt:           time.Now().UnixMilli(),
	}
}

// MarkAsRead marks a notification as read.
func (n *FeedbackNotification) MarkAsRead() {
	n.IsRead = true
	now := time.Now().UnixMilli()
	n.ReadAt = &now
}

// ToMap converts a feedback notification to a map for database operations.
func (n *FeedbackNotification) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"notification_id":   n.NotificationID,
		"feedback_id":       n.FeedbackID,
		"user_id":           n.UserID,
		"notification_type": string(n.NotificationType),
		"old_value":         n.OldValue,
		"new_value":         n.NewValue,
		"message":           n.Message,
		"is_read":           n.IsRead,
		"sent_at":           time.UnixMilli(n.SentAt).UTC(),
	}
}

// ID generation functions
func generateFeedbackID() string {
	return fmt.Sprintf("fb_%d", time.Now().UnixNano())
}

func generateResponseID() string {
	return fmt.Sprintf("resp_%d", time.Now().UnixNano())
}

func generateNotificationID() string {
	return fmt.Sprintf("notif_%d", time.Now().UnixNano())
}

// Helper functions

// FeedbackSubmissionsToJSON converts a slice of feedback submissions to JSON.
func FeedbackSubmissionsToJSON(feedback []*FeedbackSubmission) (string, error) {
	jsonBytes, err := json.Marshal(feedback)
	if err != nil {
		return "", fmt.Errorf("failed to marshal feedback: %w", err)
	}
	return string(jsonBytes), nil
}

// FeedbackWithStatsToJSON converts a slice of feedback with stats to JSON.
func FeedbackWithStatsToJSON(feedback []*FeedbackWithStats) (string, error) {
	jsonBytes, err := json.Marshal(feedback)
	if err != nil {
		return "", fmt.Errorf("failed to marshal feedback: %w", err)
	}
	return string(jsonBytes), nil
}

// ResponsesToJSON converts a slice of responses to JSON.
func ResponsesToJSON(responses []*FeedbackResponse) (string, error) {
	jsonBytes, err := json.Marshal(responses)
	if err != nil {
		return "", fmt.Errorf("failed to marshal responses: %w", err)
	}
	return string(jsonBytes), nil
}

// FilterFeedbackByCategory filters feedback by category.
func FilterFeedbackByCategory(feedback []*FeedbackSubmission, category FeedbackCategory) []*FeedbackSubmission {
	filtered := make([]*FeedbackSubmission, 0)
	for _, f := range feedback {
		if f.Category == category {
			filtered = append(filtered, f)
		}
	}
	return filtered
}

// FilterFeedbackByStatus filters feedback by status.
func FilterFeedbackByStatus(feedback []*FeedbackSubmission, status FeedbackStatus) []*FeedbackSubmission {
	filtered := make([]*FeedbackSubmission, 0)
	for _, f := range feedback {
		if f.Status == status {
			filtered = append(filtered, f)
		}
	}
	return filtered
}

// GetFeedbackCountByStatus returns the count of feedback with a specific status.
func GetFeedbackCountByStatus(feedback []*FeedbackSubmission, status FeedbackStatus) int {
	count := 0
	for _, f := range feedback {
		if f.Status == status {
			count++
		}
	}
	return count
}

// GetFeedbackCountByCategory returns the count of feedback with a specific category.
func GetFeedbackCountByCategory(feedback []*FeedbackSubmission, category FeedbackCategory) int {
	count := 0
	for _, f := range feedback {
		if f.Category == category {
			count++
		}
	}
	return count
}

// CalculateAverageResolutionTime calculates the average resolution time in hours.
func CalculateAverageResolutionTime(feedback []*FeedbackSubmission) float64 {
	total := 0.0
	count := 0

	for _, f := range feedback {
		if f.IsResolved() {
			hours := f.GetResolutionTimeHours()
			if hours > 0 {
				total += hours
				count++
			}
		}
	}

	if count == 0 {
		return 0
	}

	return total / float64(count)
}
