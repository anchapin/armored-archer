// Package analytics provides product analytics event tracking for the Armored Archer backend.
package analytics

import (
	"context"
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// EventType represents analytics event types.
type EventType string

const (
	// Session events
	EventSessionStart    EventType = "session_start"
	EventSessionEnd      EventType = "session_end"
	
	// Tutorial events
	EventTutorialStarted   EventType = "tutorial_started"
	EventTutorialCompleted EventType = "tutorial_completed"
	EventTutorialFailed    EventType = "tutorial_failed"
	
	// PvE events
	EventPvEStageStarted   EventType = "pve_stage_started"
	EventPvEStageCompleted EventType = "pve_stage_completed"
	EventPvEStageFailed    EventType = "pve_stage_failed"
	EventPvEBossDefeated   EventType = "pve_boss_defeated"
	
	// PvP events
	EventPvPMachStarted    EventType = "pvp_match_started"
	EventPvPMachCompleted  EventType = "pvp_match_completed"
	EventPvPMachAbandoned  EventType = "pvp_match_abandoned"
	EventPvPDisconnect     EventType = "pvp_disconnect"
	
	// Store events
	EventStoreOpened       EventType = "store_opened"
	EventPurchaseInitiated EventType = "purchase_initiated"
	EventPurchaseCompleted EventType = "purchase_completed"
	EventPurchaseFailed    EventType = "purchase_failed"
	EventGemPurchased      EventType = "gem_purchased"
	EventCosmeticPurchased EventType = "cosmetic_purchased"
	EventSubscriptionStarted EventType = "subscription_started"
	
	// Progression events
	EventGearObtained      EventType = "gear_obtained"
	EventGearEquipped      EventType = "gear_equipped"
	EventTransmogApplied   EventType = "transmog_applied"
	EventLevelUp           EventType = "level_up"
	EventAbilityUnlocked   EventType = "ability_unlocked"
	EventSeasonStart       EventType = "season_start"
	EventSeasonEnd         EventType = "season_end"
	
	// Engagement events
	EventFirstSession      EventType = "first_session"
	EventDailyLogin        EventType = "daily_login"
	EventReturningPlayer   EventType = "returning_player"
	
	// Network events
	EventNetworkError      EventType = "network_error"
	EventRPCError          EventType = "rpc_error"
	EventRPCLatency        EventType = "rpc_latency"
	
	// Custom events
	EventCustom            EventType = "custom"
)

// AnalyticsEvent represents an analytics event.
type AnalyticsEvent struct {
	ID         string                 `json:"id"`
	UserID     string                 `json:"user_id"`
	EventName  EventType              `json:"event_name"`
	Timestamp  int64                  `json:"timestamp"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Platform   string                 `json:"platform"`
	SessionID  string                 `json:"session_id"`
}

// AnalyticsManager manages analytics event collection and logging.
type AnalyticsManager struct {
	logger runtime.Logger
}

// NewAnalyticsManager creates a new analytics manager.
func NewAnalyticsManager(logger runtime.Logger) *AnalyticsManager {
	return &AnalyticsManager{
		logger: logger,
	}
}

// LogEvent logs an analytics event (for immediate processing).
func (m *AnalyticsManager) LogEvent(event *AnalyticsEvent) {
	if event.ID == "" {
		event.ID = generateEventID()
	}
	if event.Timestamp == 0 {
		event.Timestamp = time.Now().UnixMilli()
	}
	
	m.logger.Debug("Analytics event",
		"event_id", event.ID,
		"event_name", event.EventName,
		"user_id", event.UserID,
		"session_id", event.SessionID)
}

// LogSessionStart logs a session start event.
func (m *AnalyticsManager) LogSessionStart(userID, sessionID, platform string) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventSessionStart,
		Platform:  platform,
		SessionID: sessionID,
		Properties: map[string]interface{}{
			"platform_version": platform,
		},
	}
	m.LogEvent(event)
}

// LogSessionEnd logs a session end event.
func (m *AnalyticsManager) LogSessionEnd(userID, sessionID string, sessionDurationSec int64) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventSessionEnd,
		SessionID: sessionID,
		Properties: map[string]interface{}{
			"session_duration_sec": sessionDurationSec,
		},
	}
	m.LogEvent(event)
}

// LogPurchase logs a purchase event.
func (m *AnalyticsManager) LogPurchase(userID, productID, currency string, amount int64, success bool) {
	eventName := EventPurchaseCompleted
	if !success {
		eventName = EventPurchaseFailed
	}
	
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: eventName,
		Properties: map[string]interface{}{
			"product_id": productID,
			"currency":   currency,
			"amount":     amount,
			"success":    success,
		},
	}
	m.LogEvent(event)
}

// LogLevelUp logs a level up event.
func (m *AnalyticsManager) LogLevelUp(userID string, oldLevel, newLevel int) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventLevelUp,
		Properties: map[string]interface{}{
			"old_level": oldLevel,
			"new_level": newLevel,
		},
	}
	m.LogEvent(event)
}

// LogGearObtained logs a gear obtained event.
func (m *AnalyticsManager) LogGearObtained(userID, gearID, gearType, rarity string) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventGearObtained,
		Properties: map[string]interface{}{
			"gear_id":   gearID,
			"gear_type": gearType,
			"rarity":    rarity,
		},
	}
	m.LogEvent(event)
}

// LogRPCError logs an RPC error event.
func (m *AnalyticsManager) LogRPCError(userID, rpcName, errorMessage string, durationMs int64) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventRPCError,
		Properties: map[string]interface{}{
			"rpc_name":      rpcName,
			"error_message": errorMessage,
			"duration_ms":   durationMs,
		},
	}
	m.LogEvent(event)
}

// LogRPCLatency logs RPC latency.
func (m *AnalyticsManager) LogRPCLatency(userID, rpcName string, latencyMs int64) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventRPCLatency,
		Properties: map[string]interface{}{
			"rpc_name":   rpcName,
			"latency_ms": latencyMs,
		},
	}
	m.LogEvent(event)
}

// LogCustomEvent logs a custom analytics event.
func (m *AnalyticsManager) LogCustomEvent(userID, eventName string, properties map[string]interface{}) {
	event := &AnalyticsEvent{
		UserID:     userID,
		EventName:  EventCustom,
		Properties: properties,
	}
	
	// Add event name to properties
	if properties == nil {
		properties = make(map[string]interface{})
	}
	properties["custom_event_name"] = eventName
	
	m.LogEvent(event)
}

// generateEventID generates a unique event ID.
func generateEventID() string {
	return fmt.Sprintf("evt_%d", time.Now().UnixNano())
}

// Helper functions for common analytics patterns

// LogFirstSession logs a first session event.
func (m *AnalyticsManager) LogFirstSession(userID, sessionID, platform string) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventFirstSession,
		Platform:  platform,
		SessionID: sessionID,
	}
	m.LogEvent(event)
}

// LogDailyLogin logs a daily login event.
func (m *AnalyticsManager) LogDailyLogin(userID, sessionID string) {
	event := &AnalyticsEvent{
		UserID:    userID,
		EventName: EventDailyLogin,
		SessionID: sessionID,
		Properties: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
	}
	m.LogEvent(event)
}

// RecordEvent is a convenience function for recording events with a context.
func RecordEvent(ctx context.Context, m *AnalyticsManager, event *AnalyticsEvent) {
	m.LogEvent(event)
}
