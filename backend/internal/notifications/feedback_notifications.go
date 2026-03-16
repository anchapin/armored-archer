// Package notifications provides push notification and scheduling functionality for the Armored Archer backend.
// This file contains feedback-specific notification helpers.

package notifications

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// FeedbackNotificationType represents types of feedback notifications.
type FeedbackNotificationType string

const (
	FeedbackNotifyStatusChange     FeedbackNotificationType = "status_change"
	FeedbackNotifyDeveloperResponse FeedbackNotificationType = "developer_response"
	FeedbackNotifyResolved         FeedbackNotificationType = "resolved"
	FeedbackNotifyAssigned         FeedbackNotificationType = "assigned"
)

// SendFeedbackNotification sends a notification about feedback update to a user.
func SendFeedbackNotification(
	ctx context.Context,
	logger runtime.Logger,
	nk runtime.NakamaModule,
	db *sql.DB,
	userID string,
	feedbackID string,
	notificationType FeedbackNotificationType,
	oldValue string,
	newValue string,
	message string,
) error {
	logger.Debug("Sending feedback notification to user %s: %s", userID, notificationType)

	// Insert notification into database
	query := `
		INSERT INTO feedback_notifications (
			feedback_id, user_id, notification_type,
			old_value, new_value, message, sent_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING notification_id
	`

	var notificationID string
	err := db.QueryRowContext(ctx, query,
		feedbackID,
		userID,
		string(notificationType),
		oldValue,
		newValue,
		message,
	).Scan(&notificationID)

	if err != nil {
		logger.Error("Failed to insert feedback notification: %v", err)
		return fmt.Errorf("failed to insert feedback notification: %w", err)
	}

	// Check user notification preferences
	prefs, err := GetUserNotificationPreferences(ctx, logger, db, userID)
	if err != nil {
		logger.Warn("Failed to get user notification preferences: %v", err)
		// Continue anyway - better to notify than not
	}

	// Skip if notifications are disabled
	if prefs != nil && !prefs.NotificationsEnabled {
		logger.Debug("User %s has notifications disabled", userID)
		return nil
	}

	// Skip if quiet hours are enabled and we're in quiet hours
	if prefs != nil && prefs.QuietHoursEnabled {
		if isQuietHours(prefs) {
			logger.Debug("User %s is in quiet hours, scheduling notification", userID)
			// Schedule for later
			return scheduleNotificationForAfterQuietHours(ctx, logger, db, nk, userID, notificationID, prefs)
		}
	}

	// Send push notification
	title := "Feedback Update"
	body := message

	switch notificationType {
	case FeedbackNotifyStatusChange:
		title = "Feedback Status Update"
		body = fmt.Sprintf("Your feedback has been updated: %s → %s", oldValue, newValue)
	case FeedbackNotifyDeveloperResponse:
		title = "Developer Response"
		body = "A developer has responded to your feedback"
	case FeedbackNotifyResolved:
		title = "Feedback Resolved"
		body = "Great news! Your feedback has been resolved"
	case FeedbackNotifyAssigned:
		title = "Feedback Assigned"
		body = fmt.Sprintf("You've been assigned to review feedback %s", feedbackID)
	}

	// Get user's device tokens
	devices, err := GetUserDeviceTokens(ctx, logger, db, userID)
	if err != nil {
		logger.Error("Failed to get user device tokens: %v", err)
		return fmt.Errorf("failed to get device tokens: %w", err)
	}

	if len(devices) == 0 {
		logger.Debug("User %s has no registered devices", userID)
		return nil
	}

	// Send to each device
	for _, device := range devices {
		if device.FCMToken == "" {
			continue
		}

		// Prepare notification payload
		data := map[string]interface{}{
			"type":         "feedback",
			"feedback_id":  feedbackID,
			"notification": string(notificationType),
		}

		if oldValue != "" {
			data["old_value"] = oldValue
		}
		if newValue != "" {
			data["new_value"] = newValue
		}

		// Send via Nakama
		err := nk.SendNotification(ctx, userID, title, body, map[string]string{
			"feedback_id":  feedbackID,
			"type":         "feedback",
			"notification": string(notificationType),
		}, "feedback", 0)

		if err != nil {
			logger.Error("Failed to send notification to user %s: %v", userID, err)
			// Continue with other devices
		} else {
			logger.Info("Sent feedback notification to user %s on %s", userID, device.Platform)
		}
	}

	return nil
}

// SendFeedbackStatusChangeNotification sends a notification when feedback status changes.
func SendFeedbackStatusChangeNotification(
	ctx context.Context,
	logger runtime.Logger,
	nk runtime.NakamaModule,
	db *sql.DB,
	userID string,
	feedbackID string,
	oldStatus string,
	newStatus string,
) error {
	message := fmt.Sprintf("Your feedback status has changed from %s to %s", oldStatus, newStatus)
	
	return SendFeedbackNotification(
		ctx, logger, nk, db,
		userID, feedbackID,
		FeedbackNotifyStatusChange,
		oldStatus, newStatus,
		message,
	)
}

// SendFeedbackResponseNotification sends a notification when a developer responds.
func SendFeedbackResponseNotification(
	ctx context.Context,
	logger runtime.Logger,
	nk runtime.NakamaModule,
	db *sql.DB,
	userID string,
	feedbackID string,
) error {
	return SendFeedbackNotification(
		ctx, logger, nk, db,
		userID, feedbackID,
		FeedbackNotifyDeveloperResponse,
		"", "",
		"A developer has responded to your feedback",
	)
}

// SendFeedbackResolvedNotification sends a notification when feedback is resolved.
func SendFeedbackResolvedNotification(
	ctx context.Context,
	logger runtime.Logger,
	nk runtime.NakamaModule,
	db *sql.DB,
	userID string,
	feedbackID string,
) error {
	return SendFeedbackNotification(
		ctx, logger, nk, db,
		userID, feedbackID,
		FeedbackNotifyResolved,
		"", "resolved",
		"Great news! Your feedback has been resolved",
	)
}

// SendFeedbackAssignedNotification sends a notification when feedback is assigned to a developer.
func SendFeedbackAssignedNotification(
	ctx context.Context,
	logger runtime.Logger,
	nk runtime.NakamaModule,
	db *sql.DB,
	developerID string,
	feedbackID string,
) error {
	return SendFeedbackNotification(
		ctx, logger, nk, db,
		developerID, feedbackID,
		FeedbackNotifyAssigned,
		"", "assigned",
		fmt.Sprintf("You've been assigned to review feedback %s", feedbackID),
	)
}

// GetUserNotificationPreferences gets a user's notification preferences.
func GetUserNotificationPreferences(ctx context.Context, logger runtime.Logger, db *sql.DB, userID string) (*NotificationPreferences, error) {
	query := `
		SELECT user_id, daily_rewards_enabled, events_enabled, pvp_challenges_enabled,
		       promotions_enabled, notifications_enabled, quiet_hours_enabled,
		       quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at
		FROM notification_preferences
		WHERE user_id = $1
	`

	var prefs NotificationPreferences
	var createdAt, updatedAt time.Time
	var qhStart, qhEnd string

	err := db.QueryRowContext(ctx, query, userID).Scan(
		&prefs.UserID,
		&prefs.DailyRewardsEnabled,
		&prefs.EventsEnabled,
		&prefs.PvPChallengesEnabled,
		&prefs.PromotionsEnabled,
		&prefs.NotificationsEnabled,
		&prefs.QuietHoursEnabled,
		&qhStart,
		&qhEnd,
		&prefs.Timezone,
		&createdAt,
		&updatedAt,
	)

	if err == sql.ErrNoRows {
		// Return default preferences
		return NewNotificationPreferences(userID), nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get notification preferences: %w", err)
	}

	prefs.QuietHoursStart = qhStart
	prefs.QuietHoursEnd = qhEnd

	return &prefs, nil
}

// GetUserDeviceTokens gets all device tokens for a user.
func GetUserDeviceTokens(ctx context.Context, logger runtime.Logger, db *sql.DB, userID string) ([]*DeviceToken, error) {
	query := `
		SELECT user_id, device_token, platform, app_version, fcm_token,
		       created_at, updated_at, last_used_at
		FROM device_tokens
		WHERE user_id = $1
		ORDER BY last_used_at DESC
	`

	rows, err := db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query device tokens: %w", err)
	}
	defer rows.Close()

	devices := make([]*DeviceToken, 0)
	for rows.Next() {
		var device DeviceToken
		var createdAt, updatedAt, lastUsedAt time.Time

		err := rows.Scan(
			&device.UserID,
			&device.DeviceToken,
			&device.Platform,
			&device.AppVersion,
			&device.FCMToken,
			&createdAt,
			&updatedAt,
			&lastUsedAt,
		)

		if err != nil {
			logger.Warn("Failed to scan device token: %v", err)
			continue
		}

		device.RegisteredAt = createdAt.UnixMilli()
		device.LastUsed = lastUsedAt.UnixMilli()

		devices = append(devices, &device)
	}

	return devices, nil
}

// isQuietHours checks if current time is within user's quiet hours.
func isQuietHours(prefs *NotificationPreferences) bool {
	if !prefs.QuietHoursEnabled {
		return false
	}

	now := time.Now()
	userTZ, err := time.LoadLocation(prefs.Timezone)
	if err != nil {
		userTZ = time.UTC
	}

	localTime := now.In(userTZ)
	currentTime := localTime.Hour()*60 + localTime.Minute()

	// Parse quiet hours
	qhStart := parseTime(prefs.QuietHoursStart)
	qhEnd := parseTime(prefs.QuietHoursEnd)

	// Handle overnight quiet hours (e.g., 22:00 - 08:00)
	if qhStart > qhEnd {
		return currentTime >= qhStart || currentTime < qhEnd
	}

	return currentTime >= qhStart && currentTime < qhEnd
}

// parseTime parses a time string in HH:MM format to minutes since midnight.
func parseTime(timeStr string) int {
	var hours, minutes int
	fmt.Sscanf(timeStr, "%d:%d", &hours, &minutes)
	return hours*60 + minutes
}

// scheduleNotificationForAfterQuietHours schedules a notification to be sent after quiet hours end.
func scheduleNotificationForAfterQuietHours(
	ctx context.Context,
	logger runtime.Logger,
	db *sql.DB,
	nk runtime.NakamaModule,
	userID string,
	notificationID string,
	prefs *NotificationPreferences,
) error {
	// Calculate when quiet hours end
	userTZ, err := time.LoadLocation(prefs.Timezone)
	if err != nil {
		userTZ = time.UTC
	}

	now := time.Now().In(userTZ)
	qhEndMinutes := parseTime(prefs.QuietHoursEnd)
	qhEndHours := qhEndMinutes / 60
	qhEndMins := qhEndMinutes % 60

	scheduledTime := time.Date(now.Year(), now.Month(), now.Day(), qhEndHours, qhEndMins, 0, 0, userTZ)

	// If quiet hours end today has passed, schedule for tomorrow
	if scheduledTime.Before(now) {
		scheduledTime = scheduledTime.Add(24 * time.Hour)
	}

	// Insert into scheduled_notifications
	query := `
		INSERT INTO scheduled_notifications (
			user_id, notification_type, title, body, data,
			scheduled_for, status, created_at
		)
		VALUES ($1, 'feedback', 'Feedback Notification', 'You have a pending notification', $2, $3, 'pending', NOW())
	`

	data := map[string]interface{}{
		"notification_id": notificationID,
		"type":            "feedback",
	}

	dataJSON := `{"type":"feedback"}`

	_, err = db.ExecContext(ctx, query, userID, dataJSON, scheduledTime.UTC())
	if err != nil {
		logger.Error("Failed to schedule notification: %v", err)
		return fmt.Errorf("failed to schedule notification: %w", err)
	}

	logger.Info("Scheduled feedback notification for user %s at %s", userID, scheduledTime.Format(time.RFC3339))

	return nil
}

// GetUnreadFeedbackNotificationCount gets the count of unread feedback notifications for a user.
func GetUnreadFeedbackNotificationCount(ctx context.Context, logger runtime.Logger, db *sql.DB, userID string) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM feedback_notifications
		WHERE user_id = $1 AND is_read = false
	`

	var count int64
	err := db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count unread notifications: %w", err)
	}

	return count, nil
}

// MarkFeedbackNotificationAsRead marks a feedback notification as read.
func MarkFeedbackNotificationAsRead(ctx context.Context, logger runtime.Logger, db *sql.DB, notificationID string) error {
	query := `
		UPDATE feedback_notifications
		SET is_read = true, read_at = NOW()
		WHERE notification_id = $1
	`

	_, err := db.ExecContext(ctx, query, notificationID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	return nil
}

// MarkAllFeedbackNotificationsAsRead marks all feedback notifications as read for a user.
func MarkAllFeedbackNotificationsAsRead(ctx context.Context, logger runtime.Logger, db *sql.DB, userID string) error {
	query := `
		UPDATE feedback_notifications
		SET is_read = true, read_at = NOW()
		WHERE user_id = $1 AND is_read = false
	`

	_, err := db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notifications as read: %w", err)
	}

	return nil
}

// GetRecentFeedbackNotifications gets recent feedback notifications for a user.
func GetRecentFeedbackNotifications(
	ctx context.Context,
	logger runtime.Logger,
	db *sql.DB,
	userID string,
	limit int,
	offset int,
) ([]*FeedbackNotification, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT notification_id, feedback_id, user_id, notification_type,
		       old_value, new_value, message, is_read, sent_at, read_at, created_at
		FROM feedback_notifications
		WHERE user_id = $1
		ORDER BY sent_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query notifications: %w", err)
	}
	defer rows.Close()

	notifications := make([]*FeedbackNotification, 0)
	for rows.Next() {
		var notif FeedbackNotification
		var sentAt, readAt sql.NullTime
		var createdAt time.Time
		var oldVal, newVal sql.NullString

		err := rows.Scan(
			&notif.NotificationID,
			&notif.FeedbackID,
			&notif.UserID,
			&notif.NotificationType,
			&oldVal,
			&newVal,
			&notif.Message,
			&notif.IsRead,
			&sentAt,
			&readAt,
			&createdAt,
		)

		if err != nil {
			logger.Warn("Failed to scan notification: %v", err)
			continue
		}

		if sentAt.Valid {
			notif.SentAt = sentAt.Time.UnixMilli()
		}
		if readAt.Valid {
			ts := readAt.Time.UnixMilli()
			notif.ReadAt = &ts
		}
		if oldVal.Valid {
			notif.OldValue = oldVal.String
		}
		if newVal.Valid {
			notif.NewValue = newVal.String
		}

		notifications = append(notifications, &notif)
	}

	return notifications, nil
}
