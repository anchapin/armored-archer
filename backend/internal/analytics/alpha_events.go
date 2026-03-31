// Package analytics provides alpha-specific analytics event tracking for the Armored Archer backend.
// This file extends the base analytics system with alpha-focused events for user behavior validation.
package analytics

import (
	"context"
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// AlphaEventType represents alpha-specific analytics event types.
type AlphaEventType string

const (
	// === Alpha User Lifecycle Events ===

	// EventAlphaRegistration - User registered for alpha testing
	EventAlphaRegistration AlphaEventType = "alpha_registration"
	// EventAlphaAccessGranted - Alpha access key redeemed
	EventAlphaAccessGranted AlphaEventType = "alpha_access_granted"
	// EventAlphaOnboardingStarted - User started alpha onboarding
	EventAlphaOnboardingStarted AlphaEventType = "alpha_onboarding_started"
	// EventAlphaOnboardingCompleted - User completed alpha onboarding
	EventAlphaOnboardingCompleted AlphaEventType = "alpha_onboarding_completed"

	// === Session & Engagement Events ===

	// EventAlphaSessionStart - Alpha user session started
	EventAlphaSessionStart AlphaEventType = "alpha_session_start"
	// EventAlphaSessionEnd - Alpha user session ended
	EventAlphaSessionEnd AlphaEventType = "alpha_session_end"
	// EventAlphaSessionCrash - Session ended unexpectedly
	EventAlphaSessionCrash AlphaEventType = "alpha_session_crash"

	// Retention tracking
	EventAlphaDay1Return AlphaEventType = "alpha_day1_return"
	EventAlphaDay7Return AlphaEventType = "alpha_day7_return"
	EventAlphaDay30Return AlphaEventType = "alpha_day30_return"

	// === Feature Usage Events ===

	// Combat feature usage
	EventAlphaCombatTutorialStarted AlphaEventType = "alpha_combat_tutorial_started"
	EventAlphaCombatTutorialCompleted AlphaEventType = "alpha_combat_tutorial_completed"
	EventAlphaCombatActionPerformed AlphaEventType = "alpha_combat_action_performed"
	EventAlphaCombatMatchStarted AlphaEventType = "alpha_combat_match_started"
	EventAlphaCombatMatchCompleted AlphaEventType = "alpha_combat_match_completed"
	EventAlphaCombatMatchAbandoned AlphaEventType = "alpha_combat_match_abandoned"
	EventAlphaCombatDamageDealt AlphaEventType = "alpha_combat_damage_dealt"
	EventAlphaCombatDamageTaken AlphaEventType = "alpha_combat_damage_taken"
	EventAlphaCombatAbilityUsed AlphaEventType = "alpha_combat_ability_used"
	EventAlphaCombatItemUsed AlphaEventType = "alpha_combat_item_used"

	// Gear system usage
	EventAlphaGearMenuOpened AlphaEventType = "alpha_gear_menu_opened"
	EventAlphaGearEquipped AlphaEventType = "alpha_gear_equipped"
	EventAlphaGearUnequipped AlphaEventType = "alpha_gear_unequipped"
	EventAlphaGearUpgraded AlphaEventType = "alpha_gear_upgraded"
	EventAlphaGearObtained AlphaEventType = "alpha_gear_obtained"
	EventAlphaGearDismantled AlphaEventType = "alpha_gear_dismantled"
	EventAlphaTransmogApplied AlphaEventType = "alpha_transmog_applied"
	EventAlphaTransmogPreviewed AlphaEventType = "alpha_transmog_previewed"

	// Matchmaking usage
	EventAlphaMatchmakingQueueJoined AlphaEventType = "alpha_matchmaking_queue_joined"
	EventAlphaMatchmakingMatchFound AlphaEventType = "alpha_matchmaking_match_found"
	EventAlphaMatchmakingMatchAccepted AlphaEventType = "alpha_matchmaking_match_accepted"
	EventAlphaMatchmakingMatchDeclined AlphaEventType = "alpha_matchmaking_match_declined"
	EventAlphaMatchmakingQueueTimeout AlphaEventType = "alpha_matchmaking_queue_timeout"
	EventAlphaMatchmakingQueueCancelled AlphaEventType = "alpha_matchmaking_queue_cancelled"

	// Store usage
	EventAlphaStoreOpened AlphaEventType = "alpha_store_opened"
	EventAlphaStoreTabViewed AlphaEventType = "alpha_store_tab_viewed"
	EventAlphaStoreItemViewed AlphaEventType = "alpha_store_item_viewed"
	EventAlphaStoreItemPurchased AlphaEventType = "alpha_store_item_purchased"
	EventAlphaStorePurchaseFailed AlphaEventType = "alpha_store_purchase_failed"
	EventAlphaStoreCurrencySpent AlphaEventType = "alpha_store_currency_spent"
	EventAlphaStoreCurrencyEarned AlphaEventType = "alpha_store_currency_earned"
	EventAlphaStoreSubscriptionViewed AlphaEventType = "alpha_store_subscription_viewed"
	EventAlphaStoreSubscriptionPurchased AlphaEventType = "alpha_store_subscription_purchased"

	// Progression usage
	EventAlphaPlayerLevelUp AlphaEventType = "alpha_player_level_up"
	EventAlphaPlayerXPGranted AlphaEventType = "alpha_player_xp_granted"
	EventAlphaPlayerStatAllocated AlphaEventType = "alpha_player_stat_allocated"
	EventAlphaPlayerAbilityUnlocked AlphaEventType = "alpha_player_ability_unlocked"
	EventAlphaPlayerAchievementUnlocked AlphaEventType = "alpha_player_achievement_unlocked"
	EventAlphaPlayerQuestStarted AlphaEventType = "alpha_player_quest_started"
	EventAlphaPlayerQuestCompleted AlphaEventType = "alpha_player_quest_completed"
	EventAlphaPlayerQuestAbandoned AlphaEventType = "alpha_player_quest_abandoned"

	// Social features
	EventAlphaFriendInviteSent AlphaEventType = "alpha_friend_invite_sent"
	EventAlphaFriendInviteAccepted AlphaEventType = "alpha_friend_invite_accepted"
	EventAlphaFriendInviteDeclined AlphaEventType = "alpha_friend_invite_declined"
	EventAlphaGuildCreated AlphaEventType = "alpha_guild_created"
	EventAlphaGuildJoined AlphaEventType = "alpha_guild_joined"
	EventAlphaGuildLeft AlphaEventType = "alpha_guild_left"
	EventAlphaChatMessageSent AlphaEventType = "alpha_chat_message_sent"
	EventAlphaEmoteUsed AlphaEventType = "alpha_emote_used"

	// === Error & Performance Events ===

	// Client-side errors
	EventAlphaClientError AlphaEventType = "alpha_client_error"
	EventAlphaClientCrash AlphaEventType = "alpha_client_crash"
	EventAlphaClientFreeze AlphaEventType = "alpha_client_freeze"

	// Server-side errors (tracked per user)
	EventAlphaRPCError AlphaEventType = "alpha_rpc_error"
	EventAlphaRPCRetry AlphaEventType = "alpha_rpc_retry"
	EventAlphaRPCRateLimited AlphaEventType = "alpha_rpc_rate_limited"
	EventAlphaAuthenticationError AlphaEventType = "alpha_authentication_error"
	EventAlphaConnectionLost AlphaEventType = "alpha_connection_lost"
	EventAlphaConnectionRestored AlphaEventType = "alpha_connection_restored"

	// Performance metrics
	EventAlphaFrameRateDrop AlphaEventType = "alpha_frame_rate_drop"
	EventAlphaLoadingTimeExceeded AlphaEventType = "alpha_loading_time_exceeded"
	EventAlphaMemoryWarning AlphaEventType = "alpha_memory_warning"
	EventAlphaStutterDetected AlphaEventType = "alpha_stutter_detected"

	// === Conversion Funnel Events ===

	// Tutorial funnel
	EventAlphaTutorialStepStarted AlphaEventType = "alpha_tutorial_step_started"
	EventAlphaTutorialStepCompleted AlphaEventType = "alpha_tutorial_step_completed"
	EventAlphaTutorialStepFailed AlphaEventType = "alpha_tutorial_step_failed"
	EventAlphaTutorialAbandoned AlphaEventType = "alpha_tutorial_abandoned"

	// First-time user experience (FTUE) funnel
	EventAlphaFTUEStarted AlphaEventType = "alpha_ftue_started"
	EventAlphaFTUECharacterCreated AlphaEventType = "alpha_ftue_character_created"
	EventAlphaFTUEFirstCombat AlphaEventType = "alpha_ftue_first_combat"
	EventAlphaFTUEFirstGearEquip AlphaEventType = "alpha_ftue_first_gear_equip"
	EventAlphaFTUEFirstMatch AlphaEventType = "alpha_ftue_first_match"
	EventAlphaFTUECompleted AlphaEventType = "alpha_ftue_completed"

	// Store conversion funnel
	EventAlphaStoreFirstView AlphaEventType = "alpha_store_first_view"
	EventAlphaStoreFirstPurchaseAttempt AlphaEventType = "alpha_store_first_purchase_attempt"
	EventAlphaStoreFirstPurchase AlphaEventType = "alpha_store_first_purchase"
	EventAlphaStoreRepeatPurchase AlphaEventType = "alpha_store_repeat_purchase"

	// Engagement funnel
	EventAlphaFirstSessionComplete AlphaEventType = "alpha_first_session_complete"
	EventAlphaSecondSessionStarted AlphaEventType = "alpha_second_session_started"
	EventAlphaWeekOneComplete AlphaEventType = "alpha_week_one_complete"
	EventAlphaMonthOneComplete AlphaEventType = "alpha_month_one_complete"

	// === Feedback & Survey Events ===

	EventAlphaFeedbackSubmitted AlphaEventType = "alpha_feedback_submitted"
	EventAlphaSurveyStarted AlphaEventType = "alpha_survey_started"
	EventAlphaSurveyCompleted AlphaEventType = "alpha_survey_completed"
	EventAlphaSurveyAbandoned AlphaEventType = "alpha_survey_abandoned"
	EventAlphaBugReportSubmitted AlphaEventType = "alpha_bug_report_submitted"
	EventAlphaFeatureRequestSubmitted AlphaEventType = "alpha_feature_request_submitted"
	EventAlphaNPSResponse AlphaEventType = "alpha_nps_response"
	EventAlphaSatisfactionRating AlphaEventType = "alpha_satisfaction_rating"

	// === A/B Test Events ===

	EventAlphaABTestGroupAssigned AlphaEventType = "alpha_ab_test_group_assigned"
	EventAlphaABTestVariantViewed AlphaEventType = "alpha_ab_test_variant_viewed"
	EventAlphaABTestConversion AlphaEventType = "alpha_ab_test_conversion"
)

// AlphaEventProperties represents properties specific to alpha events.
type AlphaEventProperties struct {
	// User metadata
	AlphaAccessKey    string `json:"alpha_access_key,omitempty"`
	UserSegment       string `json:"user_segment,omitempty"` // e.g., "core", "casual", "new"
	PlaytimeMinutes   int64  `json:"playtime_minutes,omitempty"`
	TotalSessions     int64  `json:"total_sessions,omitempty"`
	LastSessionDate   string `json:"last_session_date,omitempty"` // ISO 8601

	// Device/Platform info
	DeviceModel      string `json:"device_model,omitempty"`
	OSVersion        string `json:"os_version,omitempty"`
	GameVersion      string `json:"game_version,omitempty"`
	BuildNumber      string `json:"build_number,omitempty"`
	Platform         string `json:"platform,omitempty"` // "ios", "android", "pc"
	PlatformVersion  string `json:"platform_version,omitempty"`

	// Session context
	SessionID        string `json:"session_id,omitempty"`
	SessionStartTime int64  `json:"session_start_time,omitempty"` // Unix ms
	IsFirstSession   bool   `json:"is_first_session,omitempty"`
	IsReturningUser  bool   `json:"is_returning_user,omitempty"`

	// Feature-specific context
	FeatureName      string `json:"feature_name,omitempty"`
	FeatureVariant   string `json:"feature_variant,omitempty"` // For A/B tests
	PreviousState    string `json:"previous_state,omitempty"`
	NewState         string `json:"new_state,omitempty"`

	// Combat context
	MatchID          string `json:"match_id,omitempty"`
	MatchType        string `json:"match_type,omitempty"` // "pve", "pvp", "tutorial"
	DamageAmount     int64  `json:"damage_amount,omitempty"`
	AbilityID        string `json:"ability_id,omitempty"`
	ItemID           string `json:"item_id,omitempty"`
	CombatDurationMs int64  `json:"combat_duration_ms,omitempty"`
	MatchResult      string `json:"match_result,omitempty"` // "win", "loss", "draw", "abandoned"

	// Gear context
	GearID             string `json:"gear_id,omitempty"`
	GearType           string `json:"gear_type,omitempty"` // "helm", "armor", "bow", "arrow", "amulet"
	GearRarity         string `json:"gear_rarity,omitempty"` // "common", "rare", "epic", "legendary"
	GearSlot           string `json:"gear_slot,omitempty"`
	TransmogID         string `json:"transmog_id,omitempty"`
	UpgradeLevel       int64  `json:"upgrade_level,omitempty"`

	// Matchmaking context
	QueueID            string `json:"queue_id,omitempty"`
	QueueDurationMs    int64  `json:"queue_duration_ms,omitempty"`
	MMR                int64  `json:"mmr,omitempty"`
	MatchmakingMode    string `json:"matchmaking_mode,omitempty"` // "ranked", "casual", "custom"

	// Store context
	ProductID          string `json:"product_id,omitempty"`
	ProductType        string `json:"product_type,omitempty"` // "consumable", "cosmetic", "subscription"
	Currency           string `json:"currency,omitempty"` // "USD", "gems", "gold"
	Amount             int64  `json:"amount,omitempty"`
	OriginalPrice      int64  `json:"original_price,omitempty"`
	DiscountPercent    int64  `json:"discount_percent,omitempty"`
	PurchaseID         string `json:"purchase_id,omitempty"`
	StoreTab           string `json:"store_tab,omitempty"` // "featured", "gems", "cosmetics", "subscriptions"

	// Progression context
	PlayerLevel        int64  `json:"player_level,omitempty"`
	PreviousLevel      int64  `json:"previous_level,omitempty"`
	XPGained           int64  `json:"xp_gained,omitempty"`
	XPTotal            int64  `json:"xp_total,omitempty"`
	StatType           string `json:"stat_type,omitempty"` // "strength", "agility", "intelligence"
	StatPointsSpent    int64  `json:"stat_points_spent,omitempty"`
	AbilitySlot        string `json:"ability_slot,omitempty"`
	QuestID            string `json:"quest_id,omitempty"`
	QuestType          string `json:"quest_type,omitempty"`
	AchievementID      string `json:"achievement_id,omitempty"`

	// Social context
	FriendID           string `json:"friend_id,omitempty"`
	GuildID            string `json:"guild_id,omitempty"`
	GuildName          string `json:"guild_name,omitempty"`
	ChatChannel        string `json:"chat_channel,omitempty"`
	MessageLength      int64  `json:"message_length,omitempty"`
	EmoteID            string `json:"emote_id,omitempty"`

	// Error context
	ErrorCode          string `json:"error_code,omitempty"`
	ErrorMessage       string `json:"error_message,omitempty"`
	RPCName            string `json:"rpc_name,omitempty"`
	StackTrace         string `json:"stack_trace,omitempty"`
	IsRetryable        bool   `json:"is_retryable,omitempty"`
	RetryCount         int64  `json:"retry_count,omitempty"`

	// Performance context
	FrameRate          float64 `json:"frame_rate,omitempty"`
	MemoryUsageMB      float64 `json:"memory_usage_mb,omitempty"`
	LoadingTimeMs      int64  `json:"loading_time_ms,omitempty"`
	StutterDurationMs  int64  `json:"stutter_duration_ms,omitempty"`
	NetworkLatencyMs   int64  `json:"network_latency_ms,omitempty"`

	// Tutorial/FTUE context
	TutorialStepID     string `json:"tutorial_step_id,omitempty"`
	TutorialStepNumber int64  `json:"tutorial_step_number,omitempty"`
	FTUEStep           string `json:"ftue_step,omitempty"`
	TimeToCompleteMs   int64  `json:"time_to_complete_ms,omitempty"`

	// Feedback context
	FeedbackCategory   string `json:"feedback_category,omitempty"` // "bug", "balance", "ux", "feature"
	FeedbackRating     int64  `json:"feedback_rating,omitempty"` // 1-5 scale
	SurveyID           string `json:"survey_id,omitempty"`
	SurveyQuestionID   string `json:"survey_question_id,omitempty"`
	NPSScore           int64  `json:"nps_score,omitempty"` // 0-10
	IsAnonymous        bool   `json:"is_anonymous,omitempty"`

	// A/B test context
	ABTestID           string `json:"ab_test_id,omitempty"`
	ABTestGroup        string `json:"ab_test_group,omitempty"` // "control", "variant_a", "variant_b"
	ABTestVariant      string `json:"ab_test_variant,omitempty"`
	ConversionValue    float64 `json:"conversion_value,omitempty"`

	// Retention context
	DaysSinceRegister    int64  `json:"days_since_register,omitempty"`
	DaysSinceLastSession int64  `json:"days_since_last_session,omitempty"`
	IsRetentionDay       bool   `json:"is_retention_day,omitempty"`

	// Custom properties (for extensibility)
	CustomProperties   map[string]interface{} `json:"custom_properties,omitempty"`
}

// AlphaAnalyticsEvent represents an alpha analytics event with extended properties.
type AlphaAnalyticsEvent struct {
	ID           string               `json:"id"`
	UserID       string               `json:"user_id"`
	EventName    AlphaEventType       `json:"event_name"`
	Timestamp    int64                `json:"timestamp"`
	Properties   AlphaEventProperties `json:"properties"`
	Platform     string               `json:"platform"`
	SessionID    string               `json:"session_id"`
	SequenceNum  int64                `json:"sequence_num"` // Event sequence in session
}

// AlphaAnalyticsManager extends AnalyticsManager with alpha-specific tracking.
type AlphaAnalyticsManager struct {
	logger        runtime.Logger
	baseManager   *AnalyticsManager
	sequenceCache map[string]int64 // userID -> sequence number
}

// NewAlphaAnalyticsManager creates a new alpha analytics manager.
func NewAlphaAnalyticsManager(logger runtime.Logger) *AlphaAnalyticsManager {
	return &AlphaAnalyticsManager{
		logger:        logger,
		baseManager:   NewAnalyticsManager(logger),
		sequenceCache: make(map[string]int64),
	}
}

// getSequenceNum gets and increments the sequence number for a user's session.
func (m *AlphaAnalyticsManager) getSequenceNum(userID, sessionID string) int64 {
	key := fmt.Sprintf("%s:%s", userID, sessionID)
	seq := m.sequenceCache[key]
	seq++
	m.sequenceCache[key] = seq
	return seq
}

// LogAlphaEvent logs an alpha-specific analytics event.
func (m *AlphaAnalyticsManager) LogAlphaEvent(event *AlphaAnalyticsEvent) {
	if event.ID == "" {
		event.ID = generateAlphaEventID()
	}
	if event.Timestamp == 0 {
		event.Timestamp = time.Now().UnixMilli()
	}
	if event.SequenceNum == 0 {
		event.SequenceNum = m.getSequenceNum(event.UserID, event.SessionID)
	}

	m.logger.Debug("Alpha analytics event",
		"event_id", event.ID,
		"event_name", event.EventName,
		"user_id", event.UserID,
		"session_id", event.SessionID,
		"sequence_num", event.SequenceNum)

	// Also log to base manager for unified processing
	baseEvent := &AnalyticsEvent{
		ID:        event.ID,
		UserID:    event.UserID,
		EventName: EventType(event.EventName),
		Timestamp: event.Timestamp,
		Platform:  event.Platform,
		SessionID: event.SessionID,
	}

	// Convert AlphaEventProperties to map[string]interface{}
	baseEvent.Properties = m.propertiesToMap(event.Properties)

	m.baseManager.LogEvent(baseEvent)
}

// propertiesToMap converts AlphaEventProperties to a map for base analytics.
func (m *AlphaAnalyticsManager) propertiesToMap(props AlphaEventProperties) map[string]interface{} {
	result := make(map[string]interface{})

	// Use reflection-like manual conversion for known fields
	if props.AlphaAccessKey != "" {
		result["alpha_access_key"] = props.AlphaAccessKey
	}
	if props.UserSegment != "" {
		result["user_segment"] = props.UserSegment
	}
	if props.PlaytimeMinutes > 0 {
		result["playtime_minutes"] = props.PlaytimeMinutes
	}
	if props.TotalSessions > 0 {
		result["total_sessions"] = props.TotalSessions
	}
	if props.DeviceModel != "" {
		result["device_model"] = props.DeviceModel
	}
	if props.OSVersion != "" {
		result["os_version"] = props.OSVersion
	}
	if props.GameVersion != "" {
		result["game_version"] = props.GameVersion
	}
	if props.BuildNumber != "" {
		result["build_number"] = props.BuildNumber
	}
	if props.Platform != "" {
		result["platform"] = props.Platform
	}
	if props.SessionID != "" {
		result["session_id"] = props.SessionID
	}
	if props.SessionStartTime > 0 {
		result["session_start_time"] = props.SessionStartTime
	}
	result["is_first_session"] = props.IsFirstSession
	result["is_returning_user"] = props.IsReturningUser

	if props.FeatureName != "" {
		result["feature_name"] = props.FeatureName
	}
	if props.FeatureVariant != "" {
		result["feature_variant"] = props.FeatureVariant
	}

	// Combat
	if props.MatchID != "" {
		result["match_id"] = props.MatchID
	}
	if props.MatchType != "" {
		result["match_type"] = props.MatchType
	}
	if props.DamageAmount > 0 {
		result["damage_amount"] = props.DamageAmount
	}
	if props.MatchResult != "" {
		result["match_result"] = props.MatchResult
	}

	// Gear
	if props.GearID != "" {
		result["gear_id"] = props.GearID
	}
	if props.GearType != "" {
		result["gear_type"] = props.GearType
	}
	if props.GearRarity != "" {
		result["gear_rarity"] = props.GearRarity
	}

	// Store
	if props.ProductID != "" {
		result["product_id"] = props.ProductID
	}
	if props.Currency != "" {
		result["currency"] = props.Currency
	}
	if props.Amount > 0 {
		result["amount"] = props.Amount
	}

	// Progression
	if props.PlayerLevel > 0 {
		result["player_level"] = props.PlayerLevel
	}
	if props.XPGained > 0 {
		result["xp_gained"] = props.XPGained
	}

	// Error
	if props.ErrorCode != "" {
		result["error_code"] = props.ErrorCode
	}
	if props.ErrorMessage != "" {
		result["error_message"] = props.ErrorMessage
	}
	if props.RPCName != "" {
		result["rpc_name"] = props.RPCName
	}

	// Performance
	if props.FrameRate > 0 {
		result["frame_rate"] = props.FrameRate
	}
	if props.MemoryUsageMB > 0 {
		result["memory_usage_mb"] = props.MemoryUsageMB
	}
	if props.NetworkLatencyMs > 0 {
		result["network_latency_ms"] = props.NetworkLatencyMs
	}

	// A/B Test
	if props.ABTestID != "" {
		result["ab_test_id"] = props.ABTestID
	}
	if props.ABTestGroup != "" {
		result["ab_test_group"] = props.ABTestGroup
	}

	// Custom properties
	if props.CustomProperties != nil {
		for k, v := range props.CustomProperties {
			result[k] = v
		}
	}

	return result
}

// === Alpha User Lifecycle Methods ===

// LogAlphaRegistration logs when a user registers for alpha testing.
func (m *AlphaAnalyticsManager) LogAlphaRegistration(userID, alphaAccessKey, platform, deviceModel string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaRegistration,
		Platform:  platform,
		Properties: AlphaEventProperties{
			AlphaAccessKey: alphaAccessKey,
			DeviceModel:    deviceModel,
			Platform:       platform,
			IsFirstSession: true,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaAccessGranted logs when alpha access is granted.
func (m *AlphaAnalyticsManager) LogAlphaAccessGranted(userID, alphaAccessKey string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaAccessGranted,
		Properties: AlphaEventProperties{
			AlphaAccessKey: alphaAccessKey,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaOnboardingStarted logs when user starts alpha onboarding.
func (m *AlphaAnalyticsManager) LogAlphaOnboardingStarted(userID, sessionID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaOnboardingStarted,
		SessionID: sessionID,
	}
	m.LogAlphaEvent(event)
}

// LogAlphaOnboardingCompleted logs when user completes alpha onboarding.
func (m *AlphaAnalyticsManager) LogAlphaOnboardingCompleted(userID, sessionID string, durationSec int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaOnboardingCompleted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			TimeToCompleteMs: durationSec * 1000,
		},
	}
	m.LogAlphaEvent(event)
}

// === Alpha Session Methods ===

// LogAlphaSessionStart logs an alpha session start with extended metadata.
func (m *AlphaAnalyticsManager) LogAlphaSessionStart(userID, sessionID, platform, gameVersion string, isReturning bool) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSessionStart,
		Platform:  platform,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			GameVersion:     gameVersion,
			Platform:        platform,
			IsReturningUser: isReturning,
			IsFirstSession:  !isReturning,
			SessionStartTime: time.Now().UnixMilli(),
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaSessionEnd logs an alpha session end with duration.
func (m *AlphaAnalyticsManager) LogAlphaSessionEnd(userID, sessionID string, durationSec int64, playtimeMinutes int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSessionEnd,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			PlaytimeMinutes: playtimeMinutes,
			SessionStartTime: time.Now().UnixMilli() - (durationSec * 1000),
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaSessionCrash logs an unexpected session termination.
func (m *AlphaAnalyticsManager) LogAlphaSessionCrash(userID, sessionID, crashReason, stackTrace string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSessionCrash,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ErrorMessage: crashReason,
			StackTrace:   stackTrace,
		},
	}
	m.LogAlphaEvent(event)
}

// === Retention Tracking Methods ===

// LogRetentionReturn logs a retention milestone (D1, D7, D30).
func (m *AlphaAnalyticsManager) LogRetentionReturn(userID, sessionID string, daysSinceRegister int64) {
	var eventName AlphaEventType
	if daysSinceRegister == 1 {
		eventName = EventAlphaDay1Return
	} else if daysSinceRegister == 7 {
		eventName = EventAlphaDay7Return
	} else if daysSinceRegister == 30 {
		eventName = EventAlphaDay30Return
	} else {
		return // Only track specific retention days
	}

	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: eventName,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			DaysSinceRegister:    daysSinceRegister,
			IsRetentionDay:       true,
		},
	}
	m.LogAlphaEvent(event)
}

// === Combat Feature Methods ===

// LogAlphaCombatAction logs a combat action.
func (m *AlphaAnalyticsManager) LogAlphaCombatAction(userID, sessionID, matchID, matchType, actionType string, damageAmount int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaCombatActionPerformed,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			MatchID:      matchID,
			MatchType:    matchType,
			FeatureName:  "combat",
			CustomProperties: map[string]interface{}{
				"action_type":    actionType,
				"damage_amount":  damageAmount,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaCombatMatchStarted logs when a combat match starts.
func (m *AlphaAnalyticsManager) LogAlphaCombatMatchStarted(userID, sessionID, matchID, matchType string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaCombatMatchStarted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			MatchID:   matchID,
			MatchType: matchType,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaCombatMatchCompleted logs when a combat match completes.
func (m *AlphaAnalyticsManager) LogAlphaCombatMatchCompleted(userID, sessionID, matchID, matchType, result string, durationMs int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaCombatMatchCompleted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			MatchID:        matchID,
			MatchType:      matchType,
			MatchResult:    result,
			CombatDurationMs: durationMs,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaCombatMatchAbandoned logs when a player abandons a match.
func (m *AlphaAnalyticsManager) LogAlphaCombatMatchAbandoned(userID, sessionID, matchID, matchType string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaCombatMatchAbandoned,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			MatchID:     matchID,
			MatchType:   matchType,
			MatchResult: "abandoned",
		},
	}
	m.LogAlphaEvent(event)
}

// === Gear Feature Methods ===

// LogAlphaGearEquipped logs when gear is equipped.
func (m *AlphaAnalyticsManager) LogAlphaGearEquipped(userID, sessionID, gearID, gearType, gearRarity, gearSlot string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaGearEquipped,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			GearID:     gearID,
			GearType:   gearType,
			GearRarity: gearRarity,
			GearSlot:   gearSlot,
			FeatureName: "gear",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaGearObtained logs when gear is obtained.
func (m *AlphaAnalyticsManager) LogAlphaGearObtained(userID, sessionID, gearID, gearType, gearRarity, source string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaGearObtained,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			GearID:     gearID,
			GearType:   gearType,
			GearRarity: gearRarity,
			FeatureName: "gear",
			CustomProperties: map[string]interface{}{
				"source": source,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaTransmogApplied logs when a transmog skin is applied.
func (m *AlphaAnalyticsManager) LogAlphaTransmogApplied(userID, sessionID, gearID, transmogID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaTransmogApplied,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			GearID:     gearID,
			TransmogID: transmogID,
			FeatureName: "transmog",
		},
	}
	m.LogAlphaEvent(event)
}

// === Matchmaking Feature Methods ===

// LogAlphaMatchmakingQueueJoined logs when player joins matchmaking queue.
func (m *AlphaAnalyticsManager) LogAlphaMatchmakingQueueJoined(userID, sessionID, queueID, mode string, mmr int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaMatchmakingQueueJoined,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			QueueID:         queueID,
			MatchmakingMode: mode,
			MMR:             mmr,
			FeatureName:     "matchmaking",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaMatchmakingMatchFound logs when a match is found.
func (m *AlphaAnalyticsManager) LogAlphaMatchmakingMatchFound(userID, sessionID, queueID, matchID string, queueDurationMs int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaMatchmakingMatchFound,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			QueueID:         queueID,
			MatchID:         matchID,
			QueueDurationMs: queueDurationMs,
			FeatureName:     "matchmaking",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaMatchmakingMatchAccepted logs when player accepts a match.
func (m *AlphaAnalyticsManager) LogAlphaMatchmakingMatchAccepted(userID, sessionID, queueID, matchID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaMatchmakingMatchAccepted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			QueueID:     queueID,
			MatchID:     matchID,
			FeatureName: "matchmaking",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaMatchmakingMatchDeclined logs when player declines a match.
func (m *AlphaAnalyticsManager) LogAlphaMatchmakingMatchDeclined(userID, sessionID, queueID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaMatchmakingMatchDeclined,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			QueueID:     queueID,
			FeatureName: "matchmaking",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaMatchmakingQueueTimeout logs when queue times out.
func (m *AlphaAnalyticsManager) LogAlphaMatchmakingQueueTimeout(userID, sessionID, queueID string, queueDurationMs int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaMatchmakingQueueTimeout,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			QueueID:         queueID,
			QueueDurationMs: queueDurationMs,
			FeatureName:     "matchmaking",
		},
	}
	m.LogAlphaEvent(event)
}

// === Store Feature Methods ===

// LogAlphaStoreOpened logs when the store is opened.
func (m *AlphaAnalyticsManager) LogAlphaStoreOpened(userID, sessionID, storeTab string, isFirstView bool) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaStoreOpened,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			StoreTab:    storeTab,
			FeatureName: "store",
			CustomProperties: map[string]interface{}{
				"is_first_view": isFirstView,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaStoreItemPurchased logs a successful store purchase.
func (m *AlphaAnalyticsManager) LogAlphaStoreItemPurchased(userID, sessionID, productID, productType, currency string, amount, originalPrice int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaStoreItemPurchased,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ProductID:     productID,
			ProductType:   productType,
			Currency:      currency,
			Amount:        amount,
			OriginalPrice: originalPrice,
			FeatureName:   "store",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaStorePurchaseFailed logs a failed purchase attempt.
func (m *AlphaAnalyticsManager) LogAlphaStorePurchaseFailed(userID, sessionID, productID, errorCode, errorMessage string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaStorePurchaseFailed,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ProductID:  productID,
			ErrorCode:  errorCode,
			ErrorMessage: errorMessage,
			FeatureName: "store",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaStoreCurrencySpent logs currency spending.
func (m *AlphaAnalyticsManager) LogAlphaStoreCurrencySpent(userID, sessionID, currency string, amount int64, productType string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaStoreCurrencySpent,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			Currency:    currency,
			Amount:      amount,
			FeatureName: "store",
			CustomProperties: map[string]interface{}{
				"product_type": productType,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// === Progression Methods ===

// LogAlphaPlayerLevelUp logs a player level up.
func (m *AlphaAnalyticsManager) LogAlphaPlayerLevelUp(userID, sessionID string, previousLevel, newLevel, xpTotal int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaPlayerLevelUp,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			PlayerLevel:   newLevel,
			PreviousLevel: previousLevel,
			XPTotal:       xpTotal,
			FeatureName:   "progression",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaPlayerXPGranted logs XP granted to player.
func (m *AlphaAnalyticsManager) LogAlphaPlayerXPGranted(userID, sessionID string, xpGained, xpTotal int64, source string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaPlayerXPGranted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			XPGained: xpGained,
			XPTotal:  xpTotal,
			FeatureName: "progression",
			CustomProperties: map[string]interface{}{
				"source": source,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaPlayerStatAllocated logs stat point allocation.
func (m *AlphaAnalyticsManager) LogAlphaPlayerStatAllocated(userID, sessionID, statType string, statPointsSpent int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaPlayerStatAllocated,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			StatType:       statType,
			StatPointsSpent: statPointsSpent,
			FeatureName:    "progression",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaPlayerAbilityUnlocked logs ability unlock.
func (m *AlphaAnalyticsManager) LogAlphaPlayerAbilityUnlocked(userID, sessionID, abilityID, abilitySlot string, playerLevel int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaPlayerAbilityUnlocked,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			CustomProperties: map[string]interface{}{
				"ability_id":    abilityID,
				"ability_slot":  abilitySlot,
				"player_level":  playerLevel,
			},
			FeatureName: "progression",
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaPlayerAchievementUnlocked logs achievement unlock.
func (m *AlphaAnalyticsManager) LogAlphaPlayerAchievementUnlocked(userID, sessionID, achievementID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaPlayerAchievementUnlocked,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			CustomProperties: map[string]interface{}{
				"achievement_id": achievementID,
			},
			FeatureName: "progression",
		},
	}
	m.LogAlphaEvent(event)
}

// === Error & Performance Methods ===

// LogAlphaClientError logs a client-side error.
func (m *AlphaAnalyticsManager) LogAlphaClientError(userID, sessionID, errorCode, errorMessage, stackTrace string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaClientError,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ErrorCode:    errorCode,
			ErrorMessage: errorMessage,
			StackTrace:   stackTrace,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaRPCError logs an RPC error with retry info.
func (m *AlphaAnalyticsManager) LogAlphaRPCError(userID, sessionID, rpcName, errorCode, errorMessage string, isRetryable bool, retryCount int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaRPCError,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			RPCName:      rpcName,
			ErrorCode:    errorCode,
			ErrorMessage: errorMessage,
			IsRetryable:  isRetryable,
			RetryCount:   retryCount,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaConnectionLost logs connection loss.
func (m *AlphaAnalyticsManager) LogAlphaConnectionLost(userID, sessionID, reason string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaConnectionLost,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ErrorMessage: reason,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaConnectionRestored logs connection restoration.
func (m *AlphaAnalyticsManager) LogAlphaConnectionRestored(userID, sessionID string, downtimeMs int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaConnectionRestored,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			CustomProperties: map[string]interface{}{
				"downtime_ms": downtimeMs,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaFrameRateDrop logs a frame rate drop event.
func (m *AlphaAnalyticsManager) LogAlphaFrameRateDrop(userID, sessionID string, frameRate float64, durationMs int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaFrameRateDrop,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			FrameRate:         frameRate,
			CustomProperties: map[string]interface{}{
				"duration_ms": durationMs,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaMemoryWarning logs a memory warning.
func (m *AlphaAnalyticsManager) LogAlphaMemoryWarning(userID, sessionID string, memoryUsageMB float64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaMemoryWarning,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			MemoryUsageMB: memoryUsageMB,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaNetworkLatency logs network latency.
func (m *AlphaAnalyticsManager) LogAlphaNetworkLatency(userID, sessionID string, latencyMs int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaRPCError,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			NetworkLatencyMs: latencyMs,
			CustomProperties: map[string]interface{}{
				"latency_ms": latencyMs,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// === Conversion Funnel Methods ===

// LogAlphaFTUEStep logs an FTUE step.
func (m *AlphaAnalyticsManager) LogAlphaFTUEStep(userID, sessionID, ftueStep string, isCompleted bool, timeToCompleteMs int64) {
	eventName := EventAlphaFTUEStarted
	if isCompleted {
		if ftueStep == "completed" {
			eventName = EventAlphaFTUECompleted
		} else {
			eventName = EventAlphaTutorialStepCompleted
		}
	}

	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: eventName,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			FTUEStep:         ftueStep,
			TimeToCompleteMs: timeToCompleteMs,
			CustomProperties: map[string]interface{}{
				"is_completed": isCompleted,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaFirstSessionComplete logs completion of first session.
func (m *AlphaAnalyticsManager) LogAlphaFirstSessionComplete(userID, sessionID string, durationSec int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaFirstSessionComplete,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			SessionStartTime: time.Now().UnixMilli() - (durationSec * 1000),
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaSecondSessionStarted logs start of second session (D1 retention signal).
func (m *AlphaAnalyticsManager) LogAlphaSecondSessionStarted(userID, sessionID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSecondSessionStarted,
		SessionID: sessionID,
	}
	m.LogAlphaEvent(event)
}

// === Feedback & Survey Methods ===

// LogAlphaFeedbackSubmitted logs feedback submission.
func (m *AlphaAnalyticsManager) LogAlphaFeedbackSubmitted(userID, sessionID, category string, rating int64, isAnonymous bool) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaFeedbackSubmitted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			FeedbackCategory: category,
			FeedbackRating:   rating,
			IsAnonymous:      isAnonymous,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaBugReportSubmitted logs bug report submission.
func (m *AlphaAnalyticsManager) LogAlphaBugReportSubmitted(userID, sessionID, bugID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaBugReportSubmitted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			CustomProperties: map[string]interface{}{
				"bug_id": bugID,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaSurveyStarted logs survey start.
func (m *AlphaAnalyticsManager) LogAlphaSurveyStarted(userID, sessionID, surveyID string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSurveyStarted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			SurveyID: surveyID,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaSurveyCompleted logs survey completion.
func (m *AlphaAnalyticsManager) LogAlphaSurveyCompleted(userID, sessionID, surveyID string, questionsAnswered int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSurveyCompleted,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			SurveyID: surveyID,
			CustomProperties: map[string]interface{}{
				"questions_answered": questionsAnswered,
			},
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaNPSResponse logs NPS score submission.
func (m *AlphaAnalyticsManager) LogAlphaNPSResponse(userID, sessionID string, npsScore int64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaNPSResponse,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			NPSScore: npsScore,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaSatisfactionRating logs satisfaction rating.
func (m *AlphaAnalyticsManager) LogAlphaSatisfactionRating(userID, sessionID string, rating int64, feature string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaSatisfactionRating,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			FeedbackRating: rating,
			FeatureName:    feature,
		},
	}
	m.LogAlphaEvent(event)
}

// === A/B Test Methods ===

// LogAlphaABTestGroupAssigned logs A/B test group assignment.
func (m *AlphaAnalyticsManager) LogAlphaABTestGroupAssigned(userID, sessionID, abTestID, abTestGroup string) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaABTestGroupAssigned,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ABTestID:    abTestID,
			ABTestGroup: abTestGroup,
		},
	}
	m.LogAlphaEvent(event)
}

// LogAlphaABTestConversion logs A/B test conversion.
func (m *AlphaAnalyticsManager) LogAlphaABTestConversion(userID, sessionID, abTestID, abTestGroup string, conversionValue float64) {
	event := &AlphaAnalyticsEvent{
		UserID:    userID,
		EventName: EventAlphaABTestConversion,
		SessionID: sessionID,
		Properties: AlphaEventProperties{
			ABTestID:        abTestID,
			ABTestGroup:     abTestGroup,
			ConversionValue: conversionValue,
		},
	}
	m.LogAlphaEvent(event)
}

// generateAlphaEventID generates a unique alpha event ID.
func generateAlphaEventID() string {
	return fmt.Sprintf("alpha_evt_%d", time.Now().UnixNano())
}

// RecordAlphaEvent is a convenience function for recording alpha events with a context.
func RecordAlphaEvent(ctx context.Context, m *AlphaAnalyticsManager, event *AlphaAnalyticsEvent) {
	m.LogAlphaEvent(event)
}
