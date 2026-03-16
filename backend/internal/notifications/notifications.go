// Package notifications provides push notification and scheduling functionality for the Armored Archer backend.
package notifications

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Notification types
const (
	NotificationTypeDailyReward   = "daily_reward"
	NotificationTypeEvent         = "event"
	NotificationTypePvPChallenge  = "pvp_challenge"
	NotificationTypePromotion     = "promotion"
	NotificationTypeCustom        = "custom"
)

// Valid notification types
var ValidNotificationTypes = []string{
	NotificationTypeDailyReward,
	NotificationTypeEvent,
	NotificationTypePvPChallenge,
	NotificationTypePromotion,
	NotificationTypeCustom,
}

// Platform constants
const (
	PlatformAndroid = "android"
	PlatformIOS     = "ios"
)

// Valid platforms
var ValidPlatforms = []string{PlatformAndroid, PlatformIOS}

// DeviceToken represents a registered device for push notifications.
type DeviceToken struct {
	UserID     string `json:"user_id"`
	DeviceToken string `json:"device_token"`
	Platform   string `json:"platform"`
	AppVersion string `json:"app_version,omitempty"`
	FCMToken   string `json:"fcm_token,omitempty"`
	RegisteredAt int64 `json:"registered_at"`
	LastUsed   int64  `json:"last_used"`
}

// NotificationPreferences represents a user's notification preferences.
type NotificationPreferences struct {
	UserID              string `json:"user_id"`
	DailyRewardsEnabled bool   `json:"daily_rewards_enabled"`
	EventsEnabled       bool   `json:"events_enabled"`
	PvPChallengesEnabled bool  `json:"pvp_challenges_enabled"`
	PromotionsEnabled   bool   `json:"promotions_enabled"`
	NotificationsEnabled bool  `json:"notifications_enabled"`
	QuietHoursEnabled   bool   `json:"quiet_hours_enabled"`
	QuietHoursStart     string `json:"quiet_hours_start"` // HH:MM format
	QuietHoursEnd       string `json:"quiet_hours_end"`   // HH:MM format
	Timezone            string `json:"timezone"`
	UpdatedAt           int64  `json:"updated_at"`
}

// ScheduledNotification represents a scheduled notification.
type ScheduledNotification struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	Type         string                 `json:"type"`
	Title        string                 `json:"title"`
	Body         string                 `json:"body"`
	ScheduledFor int64                  `json:"scheduled_for"`
	Data         map[string]interface{} `json:"data,omitempty"`
	Status       string                 `json:"status"` // "pending", "sent", "cancelled"
	CreatedAt    int64                  `json:"created_at"`
}

// NotificationTemplate represents a notification template.
type NotificationTemplate struct {
	Type  string `json:"type"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

// RegisterDeviceTokenRequest represents a request to register a device token.
type RegisterDeviceTokenRequest struct {
	DeviceToken string `json:"device_token"`
	Platform    string `json:"platform"`
	AppVersion  string `json:"app_version,omitempty"`
	FCMToken    string `json:"fcm_token,omitempty"`
}

// RemoveDeviceTokenRequest represents a request to remove a device token.
type RemoveDeviceTokenRequest struct {
	DeviceToken string `json:"device_token"`
}

// ScheduleNotificationRequest represents a request to schedule a notification.
type ScheduleNotificationRequest struct {
	Type         string                 `json:"type"`
	Title        string                 `json:"title,omitempty"`
	Body         string                 `json:"body,omitempty"`
	ScheduledFor string                 `json:"scheduled_for"`
	Data         map[string]interface{} `json:"data,omitempty"`
}

// CancelScheduledNotificationRequest represents a request to cancel a scheduled notification.
type CancelScheduledNotificationRequest struct {
	NotificationID string `json:"notification_id"`
}

// DeviceTokenResult represents the result of a device token operation.
type DeviceTokenResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// NotificationPreferencesResult represents the result of getting notification preferences.
type NotificationPreferencesResult struct {
	Success     bool                   `json:"success"`
	Preferences *NotificationPreferences `json:"preferences,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

// ScheduleNotificationResult represents the result of scheduling a notification.
type ScheduleNotificationResult struct {
	Success        bool                `json:"success"`
	NotificationID string              `json:"notification_id,omitempty"`
	Error          string              `json:"error,omitempty"`
}

// Predefined notification templates
var NotificationTemplates = map[string]NotificationTemplate{
	NotificationTypeDailyReward: {
		Type:  NotificationTypeDailyReward,
		Title: "Daily Reward Ready!",
		Body:  "Claim your daily reward now!",
	},
	NotificationTypeEvent: {
		Type:  NotificationTypeEvent,
		Title: "New Event Available",
		Body:  "A new event has started. Join now!",
	},
	NotificationTypePvPChallenge: {
		Type:  NotificationTypePvPChallenge,
		Title: "PvP Challenge",
		Body:  "You've been challenged to a PvP match!",
	},
	NotificationTypePromotion: {
		Type:  NotificationTypePromotion,
		Title: "Special Offer",
		Body:  "Check out our latest promotion!",
	},
	// Feedback notification templates
	"feedback_status_change": {
		Type:  "feedback_status_change",
		Title: "Feedback Status Update",
		Body:  "Your feedback has been updated: {{status}}",
	},
	"feedback_developer_response": {
		Type:  "feedback_developer_response",
		Title: "Developer Response",
		Body:  "A developer has responded to your feedback",
	},
	"feedback_resolved": {
		Type:  "feedback_resolved",
		Title: "Feedback Resolved",
		Body:  "Great news! Your feedback has been resolved",
	},
	"feedback_assigned": {
		Type:  "feedback_assigned",
		Title: "Feedback Assigned",
		Body:  "You have been assigned to review feedback",
	},
}

// NewNotificationPreferences creates a new notification preferences with defaults.
func NewNotificationPreferences(userID string) *NotificationPreferences {
	return &NotificationPreferences{
		UserID:              userID,
		DailyRewardsEnabled: true,
		EventsEnabled:       true,
		PvPChallengesEnabled: true,
		PromotionsEnabled:   true,
		NotificationsEnabled: true,
		QuietHoursEnabled:   false,
		QuietHoursStart:     "22:00",
		QuietHoursEnd:       "08:00",
		Timezone:            "UTC",
		UpdatedAt:           time.Now().UnixMilli(),
	}
}

// NewDeviceToken creates a new device token.
func NewDeviceToken(userID, deviceToken, platform, appVersion, fcmToken string) *DeviceToken {
	now := time.Now().UnixMilli()
	return &DeviceToken{
		UserID:       userID,
		DeviceToken:  deviceToken,
		Platform:     platform,
		AppVersion:   appVersion,
		FCMToken:     fcmToken,
		RegisteredAt: now,
		LastUsed:     now,
	}
}

// NewScheduledNotification creates a new scheduled notification.
func NewScheduledNotification(userID, notificationType, title, body string, scheduledFor time.Time, data map[string]interface{}) *ScheduledNotification {
	return &ScheduledNotification{
		ID:           generateNotificationID(),
		UserID:       userID,
		Type:         notificationType,
		Title:        title,
		Body:         body,
		ScheduledFor: scheduledFor.UnixMilli(),
		Data:         data,
		Status:       "pending",
		CreatedAt:    time.Now().UnixMilli(),
	}
}

// Validate validates a register device token request.
func (r *RegisterDeviceTokenRequest) Validate() error {
	if r.DeviceToken == "" {
		return errors.New("device_token is required")
	}
	if r.Platform == "" {
		return errors.New("platform is required")
	}
	
	valid := false
	for _, p := range ValidPlatforms {
		if p == r.Platform {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid platform: %s (must be one of: %v)", r.Platform, ValidPlatforms)
	}
	
	return nil
}

// Validate validates a schedule notification request.
func (r *ScheduleNotificationRequest) Validate() error {
	if r.Type == "" {
		return errors.New("type is required")
	}
	
	valid := false
	for _, t := range ValidNotificationTypes {
		if t == r.Type {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid type: %s (must be one of: %v)", r.Type, ValidNotificationTypes)
	}
	
	if r.ScheduledFor == "" {
		return errors.New("scheduled_for is required")
	}
	
	// Parse the scheduled time
	_, err := time.Parse(time.RFC3339, r.ScheduledFor)
	if err != nil {
		return fmt.Errorf("invalid scheduled_for format: must be RFC3339 (ISO 8601)")
	}
	
	return nil
}

// GetNotificationTemplate returns the template for a notification type.
func GetNotificationTemplate(notificationType string) *NotificationTemplate {
	if template, ok := NotificationTemplates[notificationType]; ok {
		return &template
	}
	return &NotificationTemplate{
		Type:  notificationType,
		Title: "Notification",
		Body:  "You have a new notification",
	}
}

// IsQuietHours checks if a given time is within quiet hours.
func (p *NotificationPreferences) IsQuietHours(t time.Time) bool {
	if !p.QuietHoursEnabled {
		return false
	}
	
	// Parse quiet hours
	startHour, startMin := parseTime(p.QuietHoursStart)
	endHour, endMin := parseTime(p.QuietHoursEnd)
	
	currentMin := t.Hour()*60 + t.Minute()
	startMinTotal := startHour*60 + startMin
	endMinTotal := endHour*60 + endMin
	
	// Handle quiet hours that span midnight
	if startMinTotal > endMinTotal {
		// Quiet hours span midnight (e.g., 22:00 - 08:00)
		return currentMin >= startMinTotal || currentMin < endMinTotal
	}
	
	return currentMin >= startMinTotal && currentMin < endMinTotal
}

// CanSendNotification checks if a notification can be sent based on preferences.
func (p *NotificationPreferences) CanSendNotification(notificationType string, t time.Time) bool {
	if !p.NotificationsEnabled {
		return false
	}
	
	// Check quiet hours
	if p.IsQuietHours(t) {
		return false
	}
	
	// Check type-specific preferences
	switch notificationType {
	case NotificationTypeDailyReward:
		return p.DailyRewardsEnabled
	case NotificationTypeEvent:
		return p.EventsEnabled
	case NotificationTypePvPChallenge:
		return p.PvPChallengesEnabled
	case NotificationTypePromotion:
		return p.PromotionsEnabled
	default:
		return true
	}
}

// ToJSON converts notification preferences to JSON string.
func (p *NotificationPreferences) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(p)
	if err != nil {
		return "", fmt.Errorf("failed to marshal notification preferences: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates notification preferences from JSON.
func NotificationPreferencesFromJSON(jsonStr string) (*NotificationPreferences, error) {
	var prefs NotificationPreferences
	if err := json.Unmarshal([]byte(jsonStr), &prefs); err != nil {
		return nil, fmt.Errorf("failed to parse notification preferences JSON: %w", err)
	}
	return &prefs, nil
}

// ToJSON converts a scheduled notification to JSON string.
func (n *ScheduledNotification) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(n)
	if err != nil {
		return "", fmt.Errorf("failed to marshal scheduled notification: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a scheduled notification from JSON.
func ScheduledNotificationFromJSON(jsonStr string) (*ScheduledNotification, error) {
	var notification ScheduledNotification
	if err := json.Unmarshal([]byte(jsonStr), &notification); err != nil {
		return nil, fmt.Errorf("failed to parse scheduled notification JSON: %w", err)
	}
	return &notification, nil
}

// DeviceTokenResultToJSON converts a device token result to JSON.
func DeviceTokenResultToJSON(result *DeviceTokenResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal device token result: %w", err)
	}
	return string(jsonBytes), nil
}

// NotificationPreferencesResultToJSON converts a preferences result to JSON.
func NotificationPreferencesResultToJSON(result *NotificationPreferencesResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal notification preferences result: %w", err)
	}
	return string(jsonBytes), nil
}

// ScheduleNotificationResultToJSON converts a schedule result to JSON.
func ScheduleNotificationResultToJSON(result *ScheduleNotificationResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal schedule notification result: %w", err)
	}
	return string(jsonBytes), nil
}

// ScheduledNotificationsToJSON converts a slice of scheduled notifications to JSON.
func ScheduledNotificationsToJSON(notifications []*ScheduledNotification) (string, error) {
	jsonBytes, err := json.Marshal(notifications)
	if err != nil {
		return "", fmt.Errorf("failed to marshal scheduled notifications: %w", err)
	}
	return string(jsonBytes), nil
}

// Helper functions

func generateNotificationID() string {
	return fmt.Sprintf("notif_%d", time.Now().UnixNano())
}

func parseTime(timeStr string) (hour, minute int) {
	var h, m int
	fmt.Sscanf(timeStr, "%d:%d", &h, &m)
	return h, m
}

// GetPendingNotifications returns pending notifications for a user.
func GetPendingNotifications(notifications []*ScheduledNotification, userID string) []*ScheduledNotification {
	pending := make([]*ScheduledNotification, 0)
	now := time.Now().UnixMilli()
	
	for _, n := range notifications {
		if n.UserID == userID && n.Status == "pending" && n.ScheduledFor <= now {
			pending = append(pending, n)
		}
	}
	
	return pending
}

// CancelNotification cancels a scheduled notification.
func (n *ScheduledNotification) Cancel() {
	n.Status = "cancelled"
}

// MarkAsSent marks a notification as sent.
func (n *ScheduledNotification) MarkAsSent() {
	n.Status = "sent"
}

// IsDue checks if a notification is due to be sent.
func (n *ScheduledNotification) IsDue() bool {
	return n.Status == "pending" && time.Now().UnixMilli() >= n.ScheduledFor
}

// GetNotificationTypes returns all valid notification types.
func GetNotificationTypes() []string {
	return ValidNotificationTypes
}

// GetPlatforms returns all valid platforms.
func GetPlatforms() []string {
	return ValidPlatforms
}
