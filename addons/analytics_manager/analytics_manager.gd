extends Node

## Game Analytics & Monitoring System
## 
## This module provides comprehensive analytics and monitoring for the Godot client.
## It integrates with Firebase Analytics and Crashlytics for mobile platforms.
##
## Features:
## - Firebase Analytics for event tracking
## - Firebase Crashlytics for crash reporting
## - Game-specific analytics (tutorial, PvE, PvP, store)
## - Session tracking and breadcrumb logging
## - Structured logging for debugging
## - Performance monitoring
## - Network quality monitoring

signal analytics_initialized
signal analytics_error(message: String)
signal session_started(session_id: String)
signal session_ended(session_id: String, duration_seconds: float)
signal crash_reported(crash_id: String, message: String)
signal event_logged(event_name: String, parameters: Dictionary)

# Configuration
var is_initialized: bool = false
var is_crashlytics_enabled: bool = true
var is_analytics_enabled: bool = true
var is_debug_mode: bool = false
var firebase_project_id: String = ""
var measurement_id: String = ""
var app_id: String = ""

# User tracking
var user_id: String = ""
var user_properties: Dictionary = {}
var user_properties_to_set: Dictionary = {}

# Session tracking
var current_session_id: String = ""
var session_start_time: int = 0
var session_count: int = 0
var total_play_time_seconds: float = 0.0
var breadcrumbs: Array = []

# Performance monitoring
var frame_times: Array = []
var memory_usage_mb: float = 0.0
var last_performance_check: int = 0
var performance_check_interval: int = 30000  # 30 seconds

# Network monitoring
var network_quality: String = "unknown"  # "excellent", "good", "fair", "poor", "unknown"
var last_network_check: int = 0

# Revenue & Monetization Tracking
var total_revenue_cents: int = 0
var total_purchases: int = 0
var total_gems_purchased: int = 0
var purchase_history: Array = []  # Track purchase timestamps for revenue analytics
var conversion_tracking: Dictionary = {
	"total_sessions": 0,
	"total_users": 0,
	"paying_users": 0,
	"free_users": 0,
	"store_visits": 0,
	"purchase_attempts": 0,
	"successful_purchases": 0,
	"failed_purchases": 0
}
var first_purchase_time: int = 0
var last_purchase_time: int = 0

# Lifetime Value (LTV) Tracking
var user_lifetime_value: float = 0.0
var session_values: Array = []  # Track revenue per session for LTV calculations

# Event queue for offline/batched events
var event_queue: Array = []
var max_queue_size: int = 100

# Platform info
var platform: String = ""
var app_version: String = ""
var engine_version: String = ""

# Analytics event names (constants for consistency)
const EVENT_TUTORIAL_STARTED := "tutorial_started"
const EVENT_TUTORIAL_COMPLETED := "tutorial_completed"
const EVENT_TUTORIAL_FAILED := "tutorial_failed"
const EVENT_TUTORIAL_STEP := "tutorial_step"

const EVENT_PVE_STAGE_STARTED := "pve_stage_started"
const EVENT_PVE_STAGE_COMPLETED := "pve_stage_completed"
const EVENT_PVE_STAGE_FAILED := "pve_stage_failed"
const EVENT_PVE_BOSS_DEFEATED := "pve_boss_defeated"

const EVENT_PVP_MATCH_STARTED := "pvp_match_started"
const EVENT_PVP_MATCH_COMPLETED := "pvp_match_completed"
const EVENT_PVP_MATCH_ABANDONED := "pvp_match_abandoned"
const EVENT_PVP_DISCONNECT := "pvp_disconnect"

const EVENT_STORE_OPENED := "store_opened"
const EVENT_PURCHASE_INITIATED := "purchase_initiated"
const EVENT_PURCHASE_COMPLETED := "purchase_completed"
const EVENT_PURCHASE_FAILED := "purchase_failed"
const EVENT_GEM_PURCHASED := "gem_purchased"
const EVENT_COSMETIC_PURCHASED := "cosmetic_purchased"
const EVENT_SUBSCRIPTION_STARTED := "subscription_started"

const EVENT_GEAR_OBTAINED := "gear_obtained"
const EVENT_GEAR_EQUIPPED := "gear_equipped"
const EVENT_TRANSMOG_APPLIED := "transmog_applied"

const EVENT_LEVEL_UP := "level_up"
const EVENT_ABILITY_UNLOCKED := "ability_unlocked"
const EVENT_SEASON_START := "season_start"
const EVENT_SEASON_END := "season_end"

const EVENT_FIRST_SESSION := "first_session"
const EVENT_DAILY_LOGIN := "daily_login"
const EVENT_RETURNING_PLAYER := "returning_player"

const EVENT_NETWORK_ERROR := "network_error"
const EVENT_RPC_ERROR := "rpc_error"
const EVENT_RPC_LATENCY := "rpc_latency"

# Monetization & Revenue Events
const EVENT_REVENUE_TRACKED := "revenue_tracked"
const EVENT_ARPU_CALCULATED := "arpu_calculated"
const EVENT_CONVERSION := "conversion_tracked"
const EVENT_LTV_UPDATED := "ltv_updated"
const EVENT_STORE_VISIT := "store_visit"
const EVENT_SUBSCRIPTION_RENEWED := "subscription_renewed"
const EVENT_SUBSCRIPTION_CANCELLED := "subscription_cancelled"
const EVENT_PROMO_CODE_USED := "promo_code_used"
const EVENT_OFFER_VIEWED := "offer_viewed"
const EVENT_OFFER_ACCEPTED := "offer_accepted"

# Crashlytics Events
const EVENT_CRASH_RECORDED := "crash_recorded"
const EVENT_ERROR_RECORDED := "error_recorded"

func _ready() -> void:
	_initialize_analytics()
	
	# Set up performance monitoring
	last_performance_check = Time.get_ticks_msec()
	last_network_check = Time.get_ticks_msec()

func _process(delta: float) -> void:
	# Periodic performance checks
	var current_time := Time.get_ticks_msec()
	if current_time - last_performance_check > performance_check_interval:
		_perform_performance_check()
		last_performance_check = current_time
	
	# Periodic network quality check
	if current_time - last_network_check > 60000:  # Every minute
		_check_network_quality()
		last_network_check = current_time

func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_CLOSE_REQUEST, NOTIFICATION_EXIT_TREE:
			end_session()

func _initialize_analytics() -> void:
	# Determine platform
	if OS.has_feature("android"):
		platform = "android"
	elif OS.has_feature("ios"):
		platform = "ios"
	elif OS.has_feature("web"):
		platform = "web"
	else:
		platform = "desktop"
	
	# Get app and engine versions
	app_version = _get_app_version()
	engine_version = Engine.get_version_info()["string"]
	
	# Initialize Firebase on mobile platforms
	if platform in ["android", "ios"]:
		_initialize_firebase()
	else:
		# For non-mobile platforms, just initialize with warning
		push_warning("AnalyticsManager: Running on " + platform + " - limited analytics support")
		# Still allow analytics for testing purposes
		_initialize_local_analytics()
	
	# Start first session
	start_session()

func _get_app_version() -> String:
	# Try to get version from project settings
	if ProjectSettings.has_setting("application/config/version"):
		return ProjectSettings.get_setting("application/config/version")
	return "1.0.0"

func _initialize_firebase() -> void:
	var config_path: String = ""
	if OS.has_feature("android"):
		config_path = "res://firebase_config/google-services.json"
	elif OS.has_feature("ios"):
		config_path = "res://firebase_config/GoogleService-Info.plist"
	
	if not FileAccess.file_exists(config_path):
		push_error("AnalyticsManager: Firebase config file not found at " + config_path)
		analytics_error.emit("Firebase config file not found")
		# Fall back to local analytics
		_initialize_local_analytics()
		return
	
	_load_firebase_config(config_path)
	_setup_crashlytics()
	_setup_firebase_analytics()
	_collect_initialization_params()
	is_initialized = true
	analytics_initialized.emit()

func _initialize_local_analytics() -> void:
	# Initialize without Firebase (for testing/non-mobile platforms)
	is_initialized = true
	analytics_initialized.emit()
	print("AnalyticsManager: Initialized in local mode")

func _load_firebase_config(config_path: String) -> void:
	var config_file: FileAccess = FileAccess.open(config_path, FileAccess.READ)
	if config_file:
		var config_content: String = config_file.get_as_text()
		config_file.close()
		
		if OS.has_feature("android"):
			_parse_android_config(config_content)
		elif OS.has_feature("ios"):
			_parse_ios_config(config_content)

func _parse_android_config(config_content: String) -> void:
	var json: JSON = JSON.new()
	var error: Error = json.parse(config_content)
	if error == OK:
		var config_data: Dictionary = json.data
		firebase_project_id = config_data.get("project_info", {}).get("project_number", "")
		measurement_id = config_data.get("project_info", {}).get("firebase_url", "")
		app_id = config_data.get("client", [{}])[0].get("client_info", {}).get("mobilesdk_app_id", "")
	else:
		push_error("AnalyticsManager: Failed to parse Firebase Android config")

func _parse_ios_config(config_content: String) -> void:
	var config_data: Dictionary = _parse_plist(config_content)
	firebase_project_id = config_data.get("PROJECT_ID", "")
	measurement_id = config_data.get("GCM_SENDER_ID", "")
	app_id = config_data.get("GOOGLE_APP_ID", "")

func _parse_plist(plist_content: String) -> Dictionary:
	var result: Dictionary = {}
	var lines: PackedStringArray = plist_content.split("\n")
	
	for line: String in lines:
		var key_regex: RegEx = RegEx.new()
		key_regex.compile("<key>(.*?)</key>")
		var string_regex: RegEx = RegEx.new()
		string_regex.compile("<string>(.*?)</string>")
		
		var key_match: RegExMatch = key_regex.search(line)
		var string_match: RegExMatch = string_regex.search(line)
		
		if key_match and string_match:
			result[key_match.get_string(1)] = string_match.get_string(1)
	
	return result

func _setup_crashlytics() -> void:
	if not is_crashlytics_enabled:
		return
	
	if OS.has_feature("android"):
		_setup_android_crashlytics()
	elif OS.has_feature("ios"):
		_setup_ios_crashlytics()

func _setup_android_crashlytics() -> void:
	# Attempt to integrate with Firebase Crashlytics on Android
	# This requires the Firebase SDK to be properly configured
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase and firebase.has_method("initializeCrashlytics"):
			firebase.initializeCrashlytics()
			print("AnalyticsManager: Firebase Crashlytics initialized on Android")
	else:
		print("AnalyticsManager: Firebase SDK not available - crashlytics disabled")

func _setup_ios_crashlytics() -> void:
	# Attempt to integrate with Firebase Crashlytics on iOS
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase and firebase.has_method("initializeCrashlytics"):
			firebase.initializeCrashlytics()
			print("AnalyticsManager: Firebase Crashlytics initialized on iOS")
	else:
		print("AnalyticsManager: Firebase SDK not available - crashlytics disabled")

func _setup_firebase_analytics() -> void:
	# Set up Firebase Analytics
	if OS.has_feature("android") or OS.has_feature("ios"):
		if Engine.has_singleton("GodotFirebase"):
			var firebase: Object = Engine.get_singleton("GodotFirebase")
			if firebase and firebase.has_method("initializeAnalytics"):
				firebase.initializeAnalytics()
				print("AnalyticsManager: Firebase Analytics initialized")

func _collect_initialization_params() -> void:
	# Log initialization event with app info
	_log_event("app_initialized", {
		"platform": platform,
		"app_version": app_version,
		"engine_version": engine_version,
		"firebase_project_id": firebase_project_id,
		"session_count": session_count
	})

# ============================================================================
# Session Management
# ============================================================================

func start_session() -> void:
	if current_session_id != "":
		# End previous session before starting new one
		end_session()
	
	current_session_id = _generate_session_id()
	session_start_time = Time.get_unix_time_from_system()
	session_count += 1
	breadcrumbs.clear()
	
	# Log session start
	_log_event("session_start", {
		"session_id": current_session_id,
		"session_count": session_count,
		"platform": platform,
		"app_version": app_version
	})
	
	add_breadcrumb("session_start", {"session_id": current_session_id})
	session_started.emit(current_session_id)
	print("AnalyticsManager: Session started - ", current_session_id)

func end_session() -> void:
	if current_session_id == "":
		return
	
	var duration := Time.get_unix_time_from_system() - session_start_time
	total_play_time_seconds += duration
	
	# Log session end
	_log_event("session_end", {
		"session_id": current_session_id,
		"duration_seconds": duration,
		"total_play_time_seconds": total_play_time_seconds,
		"session_count": session_count,
		"breadcrumb_count": breadcrumbs.size()
	})
	
	add_breadcrumb("session_end", {
		"session_id": current_session_id,
		"duration": duration
	})
	
	session_ended.emit(current_session_id, duration)
	print("AnalyticsManager: Session ended - ", current_session_id, ", duration: ", duration)
	
	current_session_id = ""
	session_start_time = 0

func _generate_session_id() -> String:
	var timestamp := Time.get_unix_time_from_system()
	var random := randi()
	return str(timestamp) + "_" + str(random)

# ============================================================================
# User Management
# ============================================================================

func set_user_id(user_identifier: String) -> void:
	user_id = user_identifier
	
	if is_initialized and platform in ["android", "ios"]:
		_set_firebase_user_id(user_identifier)
	
	_log_event("user_id_set", {
		"user_id": user_identifier,
		"previous_user_id": user_id if user_id != user_identifier else ""
	})

func _set_firebase_user_id(user_id: String) -> void:
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase and firebase.has_method("setUserId"):
			firebase.setUserId(user_id)

func set_user_property(property_name: String, property_value: String) -> void:
	user_properties[property_name] = property_value
	user_properties_to_set[property_name] = property_value
	
	if is_initialized and platform in ["android", "ios"]:
		_set_firebase_user_property(property_name, property_value)
	
	_log_event("user_property_set", {
		"property_name": property_name,
		"property_value": property_value
	})

func _set_firebase_user_property(name: String, value: String) -> void:
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase and firebase.has_method("setUserProperty"):
			firebase.setUserProperty(name, value)

func set_user_properties(properties: Dictionary) -> void:
	for key: String in properties:
		set_user_property(key, properties[key])

# ============================================================================
# Tutorial Analytics
# ============================================================================

func log_tutorial_started(tutorial_id: String) -> void:
	_log_event(EVENT_TUTORIAL_STARTED, {
		"tutorial_id": tutorial_id,
		"platform": platform
	})
	add_breadcrumb("tutorial_started", {"tutorial_id": tutorial_id})

func log_tutorial_completed(tutorial_id: String, time_taken_seconds: float) -> void:
	_log_event(EVENT_TUTORIAL_COMPLETED, {
		"tutorial_id": tutorial_id,
		"time_taken_seconds": time_taken_seconds,
		"platform": platform
	})
	add_breadcrumb("tutorial_completed", {
		"tutorial_id": tutorial_id,
		"time_taken": time_taken_seconds
	})

func log_tutorial_failed(tutorial_id: String, step_id: String, failure_reason: String) -> void:
	_log_event(EVENT_TUTORIAL_FAILED, {
		"tutorial_id": tutorial_id,
		"step_id": step_id,
		"failure_reason": failure_reason,
		"platform": platform
	})
	add_breadcrumb("tutorial_failed", {
		"tutorial_id": tutorial_id,
		"step_id": step_id,
		"reason": failure_reason
	})

func log_tutorial_step(tutorial_id: String, step_id: String, step_name: String) -> void:
	_log_event(EVENT_TUTORIAL_STEP, {
		"tutorial_id": tutorial_id,
		"step_id": step_id,
		"step_name": step_name,
		"platform": platform
	})

# ============================================================================
# PvE Analytics
# ============================================================================

func log_pve_stage_started(stage_id: String, stage_name: String, difficulty: String = "normal", chapter: int = 1) -> void:
	_log_event(EVENT_PVE_STAGE_STARTED, {
		"stage_id": stage_id,
		"stage_name": stage_name,
		"difficulty": difficulty,
		"chapter": chapter,
		"platform": platform
	})
	add_breadcrumb("pve_stage_started", {
		"stage_id": stage_id,
		"difficulty": difficulty
	})

func log_pve_stage_completed(stage_id: String, stage_name: String, time_taken_seconds: float, stars_earned: int, difficulty: String = "normal", chapter: int = 1) -> void:
	_log_event(EVENT_PVE_STAGE_COMPLETED, {
		"stage_id": stage_id,
		"stage_name": stage_name,
		"time_taken_seconds": time_taken_seconds,
		"stars_earned": stars_earned,
		"difficulty": difficulty,
		"chapter": chapter,
		"platform": platform
	})
	add_breadcrumb("pve_stage_completed", {
		"stage_id": stage_id,
		"stars": stars_earned,
		"time": time_taken_seconds
	})

func log_pve_stage_failed(stage_id: String, stage_name: String, time_taken_seconds: float, failure_reason: String, difficulty: String = "normal") -> void:
	_log_event(EVENT_PVE_STAGE_FAILED, {
		"stage_id": stage_id,
		"stage_name": stage_name,
		"time_taken_seconds": time_taken_seconds,
		"failure_reason": failure_reason,
		"difficulty": difficulty,
		"platform": platform
	})
	add_breadcrumb("pve_stage_failed", {
		"stage_id": stage_id,
		"reason": failure_reason
	})

func log_pve_boss_defeated(stage_id: String, boss_name: String, difficulty: String, attempts: int) -> void:
	_log_event(EVENT_PVE_BOSS_DEFEATED, {
		"stage_id": stage_id,
		"boss_name": boss_name,
		"difficulty": difficulty,
		"attempts": attempts,
		"platform": platform
	})

# Alias for backward compatibility
func log_stage_completed(stage_id: String, stage_name: String, time_taken_seconds: float, stars_earned: int, difficulty: String = "normal") -> void:
	log_pve_stage_completed(stage_id, stage_name, time_taken_seconds, stars_earned, difficulty)

func log_stage_failed(stage_id: String, stage_name: String, time_taken_seconds: float, failure_reason: String, difficulty: String = "normal") -> void:
	log_pve_stage_failed(stage_id, stage_name, time_taken_seconds, failure_reason, difficulty)

# ============================================================================
# PvP Analytics
# ============================================================================

func log_pvp_match_started(match_id: String, opponent_id: String, season_id: int, rank: int = 0) -> void:
	_log_event(EVENT_PVP_MATCH_STARTED, {
		"match_id": match_id,
		"opponent_id": opponent_id,
		"season_id": season_id,
		"rank": rank,
		"platform": platform
	})
	add_breadcrumb("pvp_match_started", {
		"match_id": match_id,
		"opponent_id": opponent_id
	})

func log_pvp_match_completed(match_id: String, result: String, opponent_id: String, season_id: int, match_duration_seconds: float, score: int, opponent_score: int, rank_change: int = 0) -> void:
	_log_event(EVENT_PVP_MATCH_COMPLETED, {
		"match_id": match_id,
		"result": result,
		"opponent_id": opponent_id,
		"season_id": season_id,
		"match_duration_seconds": match_duration_seconds,
		"score": score,
		"opponent_score": opponent_score,
		"rank_change": rank_change,
		"platform": platform
	})
	add_breadcrumb("pvp_match_completed", {
		"match_id": match_id,
		"result": result,
		"score": score,
		"opponent_score": opponent_score
	})

func log_pvp_match_abandoned(match_id: String, reason: String, season_id: int) -> void:
	_log_event(EVENT_PVP_MATCH_ABANDONED, {
		"match_id": match_id,
		"reason": reason,
		"season_id": season_id,
		"platform": platform
	})
	add_breadcrumb("pvp_match_abandoned", {
		"match_id": match_id,
		"reason": reason
	})

func log_pvp_disconnect(match_id: String, reconnecting: bool) -> void:
	_log_event(EVENT_PVP_DISCONNECT, {
		"match_id": match_id,
		"reconnecting": reconnecting,
		"platform": platform
	})

# Alias for backward compatibility
func log_pvp_match_completed_extended(match_id: String, result: String, opponent_id: String, season_id: int, match_duration_seconds: float, score: int, opponent_score: int) -> void:
	log_pvp_match_completed(match_id, result, opponent_id, season_id, match_duration_seconds, score, opponent_score)

# ============================================================================
# Store & Monetization Analytics
# ============================================================================

func log_store_opened(store_location: String = "main_menu") -> void:
	_log_event(EVENT_STORE_OPENED, {
		"store_location": store_location,
		"platform": platform
	})
	add_breadcrumb("store_opened", {"location": store_location})
	# Track store visit for conversion
	conversion_tracking["store_visits"] += 1

func log_purchase_initiated(item_id: String, item_name: String, item_type: String, price_cents: int, currency: String = "USD") -> void:
	_log_event(EVENT_PURCHASE_INITIATED, {
		"item_id": item_id,
		"item_name": item_name,
		"item_type": item_type,
		"price_cents": price_cents,
		"currency": currency,
		"platform": platform
	})
	# Track purchase attempt for conversion rate
	conversion_tracking["purchase_attempts"] += 1

func log_purchase_completed(item_id: String, item_name: String, item_type: String, price_cents: int, currency: String = "USD", transaction_id: String = "") -> void:
	_log_event(EVENT_PURCHASE_COMPLETED, {
		"item_id": item_id,
		"item_name": item_name,
		"item_type": item_type,
		"price_cents": price_cents,
		"currency": currency,
		"transaction_id": transaction_id,
		"platform": platform
	})
	add_breadcrumb("purchase_completed", {
		"item_id": item_id,
		"price": price_cents
	})
	
	# Update revenue tracking
	_track_revenue(price_cents, item_type)
	
	# Update conversion tracking
	conversion_tracking["successful_purchases"] += 1
	conversion_tracking["purchase_attempts"] = max(0, conversion_tracking["purchase_attempts"] - 1)
	
	# Track purchase for ARPU/LTV calculations
	_track_purchase_for_metrics(price_cents)

func log_purchase_failed(item_id: String, item_name: String, failure_reason: String) -> void:
	_log_event(EVENT_PURCHASE_FAILED, {
		"item_id": item_id,
		"item_name": item_name,
		"failure_reason": failure_reason,
		"platform": platform
	})
	# Track failed purchase for conversion analysis
	conversion_tracking["failed_purchases"] += 1

func log_gem_purchased(gems_amount: int, price_cents: int, currency: String = "USD", purchase_type: String = "iap", offer_id: String = "") -> void:
	_log_event(EVENT_GEM_PURCHASED, {
		"gems_amount": gems_amount,
		"price_cents": price_cents,
		"currency": currency,
		"purchase_type": purchase_type,
		"offer_id": offer_id,
		"platform": platform
	})
	
	# Update revenue tracking
	_track_revenue(price_cents, "gems")
	total_gems_purchased += gems_amount

func log_cosmetic_purchased(cosmetic_id: String, cosmetic_name: String, cosmetic_type: String, rarity: String, price_cents: int, currency: String = "USD") -> void:
	_log_event(EVENT_COSMETIC_PURCHASED, {
		"cosmetic_id": cosmetic_id,
		"cosmetic_name": cosmetic_name,
		"cosmetic_type": cosmetic_type,
		"rarity": rarity,
		"price_cents": price_cents,
		"currency": currency,
		"platform": platform
	})

func log_subscription_started(subscription_type: String, price_cents: int, currency: String = "USD") -> void:
	_log_event(EVENT_SUBSCRIPTION_STARTED, {
		"subscription_type": subscription_type,
		"price_cents": price_cents,
		"currency": currency,
		"platform": platform
	})
	add_breadcrumb("subscription_started", {"type": subscription_type})

# Aliases for backward compatibility
func log_purchase(item_id: String, item_name: String, item_type: String, price_cents: int, currency: String = "USD") -> void:
	log_purchase_completed(item_id, item_name, item_type, price_cents, currency)

# ============================================================================
# Gear & Progression Analytics
# ============================================================================

func log_gear_obtained(gear_id: String, gear_name: String, gear_type: String, rarity: String, source: String) -> void:
	_log_event(EVENT_GEAR_OBTAINED, {
		"gear_id": gear_id,
		"gear_name": gear_name,
		"gear_type": gear_type,
		"rarity": rarity,
		"source": source,
		"platform": OS.get_name()
	})

func log_gear_equipped(gear_id: String, gear_name: String, gear_type: String, slot: String) -> void:
	_log_event(EVENT_GEAR_EQUIPPED, {
		"gear_id": gear_id,
		"gear_name": gear_name,
		"gear_type": gear_type,
		"slot": slot,
		"platform": platform
	})

func log_transmog_applied(cosmetic_id: String, cosmetic_name: String, gear_id: String) -> void:
	_log_event(EVENT_TRANSMOG_APPLIED, {
		"cosmetic_id": cosmetic_id,
		"cosmetic_name": cosmetic_name,
		"gear_id": gear_id,
		"platform": platform
	})

func log_level_up(new_level: int, previous_level: int, source: String = "pve") -> void:
	_log_event(EVENT_LEVEL_UP, {
		"new_level": new_level,
		"previous_level": previous_level,
		"level_gain": new_level - previous_level,
		"source": source,
		"platform": platform
	})
	add_breadcrumb("level_up", {
		"new_level": new_level,
		"source": source
	})

func log_ability_unlocked(ability_id: String, ability_name: String, level_unlocked: int) -> void:
	_log_event(EVENT_ABILITY_UNLOCKED, {
		"ability_id": ability_id,
		"ability_name": ability_name,
		"level_unlocked": level_unlocked,
		"platform": platform
	})

# ============================================================================
# Season & Events Analytics
# ============================================================================

func log_season_start(season_id: int, season_name: String) -> void:
	_log_event(EVENT_SEASON_START, {
		"season_id": season_id,
		"season_name": season_name,
		"platform": platform
	})
	add_breadcrumb("season_start", {
		"season_id": season_id,
		"season_name": season_name
	})

func log_season_end(season_id: int, season_name: String, final_rank: int) -> void:
	_log_event(EVENT_SEASON_END, {
		"season_id": season_id,
		"season_name": season_name,
		"final_rank": final_rank,
		"platform": platform
	})

# ============================================================================
# Engagement Analytics
# ============================================================================

func log_first_session() -> void:
	_log_event(EVENT_FIRST_SESSION, {
		"platform": platform,
		"session_count": session_count
	})

func log_daily_login(streak_days: int) -> void:
	_log_event(EVENT_DAILY_LOGIN, {
		"streak_days": streak_days,
		"platform": platform
	})
	add_breadcrumb("daily_login", {"streak": streak_days})

func log_returning_player(days_since_last_login: int) -> void:
	_log_event(EVENT_RETURNING_PLAYER, {
		"days_since_last_login": days_since_last_login,
		"platform": platform
	})

# ============================================================================
# Network Analytics
# ============================================================================

func log_network_error(error_type: String, endpoint: String, status_code: int = 0) -> void:
	_log_event(EVENT_NETWORK_ERROR, {
		"error_type": error_type,
		"endpoint": endpoint,
		"status_code": status_code,
		"platform": platform
	})
	add_breadcrumb("network_error", {
		"error_type": error_type,
		"endpoint": endpoint
	})

func log_rpc_error(rpc_name: String, error_code: int, error_message: String) -> void:
	_log_event(EVENT_RPC_ERROR, {
		"rpc_name": rpc_name,
		"error_code": error_code,
		"error_message": error_message,
		"platform": platform
	})

func log_rpc_latency(rpc_name: String, latency_ms: int) -> void:
	_log_event(EVENT_RPC_LATENCY, {
		"rpc_name": rpc_name,
		"latency_ms": latency_ms,
		"network_quality": network_quality,
		"platform": platform
	})

# ============================================================================
# Custom Events
# ============================================================================

func log_custom_event(event_name: String, parameters: Dictionary) -> void:
	if not is_initialized:
		return
	
	var event_params := parameters.duplicate()
	event_params["platform"] = platform
	event_params["session_id"] = current_session_id
	event_params["timestamp"] = Time.get_unix_time_from_system()
	
	_log_event(event_name, event_params)

# ============================================================================
# Breadcrumb Logging
# ============================================================================

func add_breadcrumb(label: String, metadata: Dictionary = {}) -> void:
	var breadcrumb := {
		"label": label,
		"timestamp": Time.get_unix_time_from_system(),
		"session_id": current_session_id,
		"metadata": metadata
	}
	
	breadcrumbs.append(breadcrumb)
	
	# Keep breadcrumbs limited to prevent memory issues
	if breadcrumbs.size() > 100:
		breadcrumbs = breadcrumbs.slice(-100)
	
	# Log breadcrumb as event for Firebase
	_log_event("breadcrumb_" + label, metadata)

func get_breadcrumbs() -> Array:
	return breadcrumbs.duplicate()

func clear_breadcrumbs() -> void:
	breadcrumbs.clear()

# ============================================================================
# Performance Monitoring
# ============================================================================

func _perform_performance_check() -> void:
	# Collect performance metrics
	var fps := Engine.get_frames_per_second()
	var memory := OS.get_static_memory_usage() / (1024.0 * 1024.0)  # Convert to MB
	
	# Log performance metrics
	_log_event("performance_check", {
		"fps": fps,
		"memory_mb": memory,
		"frame_time_ms": 1000.0 / fps if fps > 0 else 0,
		"session_duration": Time.get_unix_time_from_system() - session_start_time,
		"breadcrumb_count": breadcrumbs.size()
	})
	
	# Store for potential crash reporting
	memory_usage_mb = memory
	
	# Check for performance issues
	if fps < 30:
		add_breadcrumb("low_fps", {"fps": fps})
	
	if memory > 500:  # Warning threshold
		add_breadcrumb("high_memory", {"memory_mb": memory})

func log_performance_issue(issue_type: String, details: Dictionary) -> void:
	var params := details.duplicate()
	params["issue_type"] = issue_type
	params["fps"] = Engine.get_frames_per_second()
	params["memory_mb"] = OS.get_static_memory_usage() / (1024.0 * 1024.0)
	
	_log_event("performance_issue", params)

# ============================================================================
# Network Quality Monitoring
# ============================================================================

func _check_network_quality() -> void:
	# Simple network quality check based on last RPC latency
	# In a real implementation, this would use actual network tests
	var new_quality := "unknown"
	
	# This is a placeholder - in production, you'd implement actual network testing
	if NetworkManager and NetworkManager.is_connected():
		new_quality = "good"  # Assume good if connected
	
	network_quality = new_quality

func set_network_quality(quality: String) -> void:
	if quality != network_quality:
		var old_quality := network_quality
		network_quality = quality
		_log_event("network_quality_changed", {
			"old_quality": old_quality,
			"new_quality": quality,
			"session_id": current_session_id
		})

# ============================================================================
# Core Logging Functions
# ============================================================================

func _log_event(event_name: String, parameters: Dictionary) -> void:
	if not is_analytics_enabled:
		return
	
	# Add common parameters
	var event_params := parameters.duplicate()
	event_params["_timestamp"] = Time.get_unix_time_from_system()
	
	if current_session_id != "":
		event_params["session_id"] = current_session_id
	
	if platform != "":
		event_params["platform"] = platform
	
	# Queue event if not initialized
	if not is_initialized:
		_queue_event(event_name, event_params)
		return
	
	# Log to appropriate backend
	if platform in ["android", "ios"]:
		_log_to_firebase(event_name, event_params)
	else:
		_log_locally(event_name, event_params)
	
	# Emit event signal
	event_logged.emit(event_name, event_params)
	
	# Print in debug mode
	if is_debug_mode:
		print("Analytics: ", event_name, " - ", JSON.stringify(event_params))

func _queue_event(event_name: String, parameters: Dictionary) -> void:
	var event := {
		"event_name": event_name,
		"parameters": parameters,
		"timestamp": Time.get_unix_time_from_system()
	}
	
	event_queue.append(event)
	
	# Remove oldest events if queue too large
	while event_queue.size() > max_queue_size:
		event_queue.pop_front()

func _flush_event_queue() -> void:
	if not is_initialized:
		return
	
	for event: Dictionary in event_queue:
		if platform in ["android", "ios"]:
			_log_to_firebase(event["event_name"], event["parameters"])
		else:
			_log_locally(event["event_name"], event["parameters"])
	
	event_queue.clear()

func _log_to_firebase(event_name: String, parameters: Dictionary) -> void:
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase and firebase.has_method("logEvent"):
			firebase.logEvent(event_name, parameters)

func _log_locally(event_name: String, parameters: Dictionary) -> void:
	# Local logging for non-mobile platforms or when Firebase unavailable
	print("Analytics: ", event_name, " - ", JSON.stringify(parameters))

# ============================================================================
# Crashlytics / Error Reporting
# ============================================================================

func record_custom_error(message: String, stack_trace: String = "", metadata: Dictionary = {}) -> void:
	if not is_initialized or not is_crashlytics_enabled:
		return
	
	var params := metadata.duplicate()
	params["message"] = message
	if stack_trace != "":
		params["stack_trace"] = stack_trace
	
	_log_crashlytics_error(message, stack_trace, params)
	print("Analytics: Recorded custom error: ", message)
	
	crash_reported.emit(_generate_crash_id(), message)

func record_exception(error: Error, context: String = "") -> void:
	if not is_initialized or not is_crashlytics_enabled:
		return
	
	var message := "Error " + str(error) + ": " + context
	record_custom_error(message, "", {
		"error_code": error,
		"context": context
	})

func _log_crashlytics_error(message: String, stack_trace: String, metadata: Dictionary) -> void:
	if OS.has_feature("android"):
		_log_android_crashlytics_error(message, stack_trace, metadata)
	elif OS.has_feature("ios"):
		_log_ios_crashlytics_error(message, stack_trace, metadata)

func _log_android_crashlytics_error(message: String, stack_trace: String, metadata: Dictionary) -> void:
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase and firebase.has_method("logError"):
			var error_params := metadata.duplicate()
			error_params["message"] = message
			if stack_trace != "":
				error_params["stack_trace"] = stack_trace
			firebase.logError(error_params)

func _log_ios_crashlytics_error(message: String, stack_trace: String, metadata: Dictionary) -> void:
	_log_android_crashlytics_error(message, stack_trace, metadata)

func _generate_crash_id() -> String:
	return "crash_" + str(Time.get_unix_time_from_system()) + "_" + str(randi())

func test_crash() -> void:
	# For testing crash reporting
	push_error("AnalyticsManager: Test crash triggered!")
	
	# Also record via our error tracking
	record_custom_error("Test crash from AnalyticsManager", "test_crash() function", {
		"function": "test_crash",
		"session_id": current_session_id
	})

# ============================================================================
# Configuration
# ============================================================================

func set_crashlytics_collection_enabled(enabled: bool) -> void:
	is_crashlytics_enabled = enabled
	print("AnalyticsManager: Crashlytics collection ", "enabled" if enabled else "disabled")

func set_analytics_enabled(enabled: bool) -> void:
	is_analytics_enabled = enabled
	print("AnalyticsManager: Analytics ", "enabled" if enabled else "disabled")

func set_debug_mode(enabled: bool) -> void:
	is_debug_mode = enabled
	print("AnalyticsManager: Debug mode ", "enabled" if enabled else "disabled")

# ============================================================================
# Data Export
# ============================================================================

func get_session_summary() -> Dictionary:
	return {
		"session_id": current_session_id,
		"session_count": session_count,
		"total_play_time_seconds": total_play_time_seconds,
		"session_start_time": session_start_time,
		"breadcrumb_count": breadcrumbs.size(),
		"platform": platform,
		"app_version": app_version,
		"network_quality": network_quality
	}

func export_analytics_data() -> Dictionary:
	return {
		"session_summary": get_session_summary(),
		"breadcrumbs": breadcrumbs,
		"event_queue": event_queue,
		"user_properties": user_properties,
		"performance": {
			"memory_usage_mb": memory_usage_mb,
			"network_quality": network_quality
		},
		"revenue": get_revenue_summary(),
		"conversion": get_conversion_summary(),
		"ltv": get_ltv_summary()
	}

# ============================================================================
# Revenue & Monetization Analytics
# ============================================================================

func _track_revenue(price_cents: int, item_type: String) -> void:
	"""Internal method to track revenue from purchases."""
	total_revenue_cents += price_cents
	total_purchases += 1
	
	# Track purchase timestamp
	var timestamp := Time.get_unix_time_from_system()
	purchase_history.append({
		"timestamp": timestamp,
		"amount_cents": price_cents,
		"item_type": item_type
	})
	
	# Update first/last purchase times
	if first_purchase_time == 0:
		first_purchase_time = timestamp
	last_purchase_time = timestamp
	
	# Mark user as paying
	if conversion_tracking["paying_users"] == 0:
		conversion_tracking["paying_users"] = 1
	
	# Log revenue event
	_log_event(EVENT_REVENUE_TRACKED, {
		"amount_cents": price_cents,
		"total_revenue_cents": total_revenue_cents,
		"item_type": item_type,
		"platform": platform
	})

func _track_purchase_for_metrics(price_cents: float) -> void:
	"""Track purchase for ARPU and LTV calculations."""
	# Update session value for this purchase
	if current_session_id != "":
		var session_value := session_values.back() if session_values.size() > 0 else 0.0
		session_values[-1] = session_value + (price_cents / 100.0)
	
	# Recalculate LTV
	_calculate_ltv()
	
	# Log ARPU event (typically calculated per session)
	_log_event(EVENT_ARPU_CALCULATED, {
		"arpu": get_arpu(),
		"total_revenue": total_revenue_cents / 100.0,
		"user_count": max(1, conversion_tracking["total_users"]),
		"paying_user_count": max(1, conversion_tracking["paying_users"])
	})

func _calculate_ltv() -> void:
	"""Calculate Lifetime Value based on purchase history."""
	if conversion_tracking["total_users"] <= 0:
		return
	
	# LTV = Total Revenue / Total Users (simplified)
	# In production, you'd calculate based on actual paying users
	var paying_users := max(1, conversion_tracking["paying_users"])
	user_lifetime_value = float(total_revenue_cents) / 100.0 / float(paying_users)
	
	_log_event(EVENT_LTV_UPDATED, {
		"ltv": user_lifetime_value,
		"total_revenue": total_revenue_cents / 100.0,
		"paying_users": paying_users
	})

func get_arpu() -> float:
	"""Calculate Average Revenue Per User.
	
	Returns:
		float: ARPU in dollars
	"""
	var user_count := max(1, conversion_tracking["total_users"])
	return float(total_revenue_cents) / 100.0 / float(user_count)

func get_arpu_paying() -> float:
	"""Calculate Average Revenue Per Paying User.
	
	Returns:
		float: ARPPU in dollars
	"""
	var paying_count := max(1, conversion_tracking["paying_users"])
	return float(total_revenue_cents) / 100.0 / float(paying_count)

func get_conversion_rate() -> float:
	"""Calculate purchase conversion rate.
	
	Returns:
		float: Conversion rate as percentage (0-100)
	"""
	var users := max(1, conversion_tracking["total_users"])
	var paying := conversion_tracking["paying_users"]
	return (float(paying) / float(users)) * 100.0

func get_store_conversion_rate() -> float:
	"""Calculate store visit to purchase conversion rate.
	
	Returns:
		float: Store conversion rate as percentage (0-100)
	"""
	var store_visits := max(1, conversion_tracking["store_visits"])
	var purchases := conversion_tracking["successful_purchases"]
	return (float(purchases) / float(store_visits)) * 100.0

func get_revenue_summary() -> Dictionary:
	"""Get revenue summary for analytics export.
	
	Returns:
		Dictionary containing revenue metrics
	"""
	return {
		"total_revenue_cents": total_revenue_cents,
		"total_revenue_dollars": total_revenue_cents / 100.0,
		"total_purchases": total_purchases,
		"total_gems_purchased": total_gems_purchased,
		"arpu": get_arpu(),
		"arpu_paying": get_arpu_paying(),
		"ltv": user_lifetime_value,
		"first_purchase_time": first_purchase_time,
		"last_purchase_time": last_purchase_time
	}

func get_conversion_summary() -> Dictionary:
	"""Get conversion tracking summary.
	
	Returns:
		Dictionary containing conversion metrics
	"""
	return {
		"total_users": conversion_tracking["total_users"],
		"paying_users": conversion_tracking["paying_users"],
		"free_users": conversion_tracking["free_users"],
		"conversion_rate": get_conversion_rate(),
		"store_visits": conversion_tracking["store_visits"],
		"store_conversion_rate": get_store_conversion_rate(),
		"purchase_attempts": conversion_tracking["purchase_attempts"],
		"successful_purchases": conversion_tracking["successful_purchases"],
		"failed_purchases": conversion_tracking["failed_purchases"]
	}

func get_ltv_summary() -> Dictionary:
	"""Get LTV tracking summary.
	
	Returns:
		Dictionary containing LTV metrics
	"""
	return {
		"user_lifetime_value": user_lifetime_value,
		"total_revenue": total_revenue_cents / 100.0,
		"paying_users": conversion_tracking["paying_users"],
		"session_values": session_values
	}

# ============================================================================
# User & Session Analytics
# ============================================================================

func register_user(is_paying: bool = false) -> void:
	"""Register a new user for analytics tracking.
	
	Parameters:
		is_paying: Whether the user has made a purchase
	"""
	conversion_tracking["total_users"] += 1
	if is_paying:
		conversion_tracking["paying_users"] += 1
	else:
		conversion_tracking["free_users"] += 1
	
	# Set user property for Firebase
	set_user_property("is_paying", str(is_paying).to_lower())
	set_user_property("registration_time", str(Time.get_unix_time_from_system()))

func increment_session_count() -> void:
	"""Increment session count for the user."""
	conversion_tracking["total_sessions"] += 1
	
	# Start tracking session value
	session_values.append(0.0)

func log_user_activity(activity_type: String, details: Dictionary = {}) -> void:
	"""Log general user activity.
	
	Parameters:
		activity_type: Type of activity (e.g., "gameplay", "social", "store")
		details: Additional details about the activity
	"""
	var params := details.duplicate()
	params["activity_type"] = activity_type
	params["session_id"] = current_session_id
	params["timestamp"] = Time.get_unix_time_from_system()
	
	_log_event("user_activity", params)

# ============================================================================
# Offer & Promo Analytics
# ============================================================================

func log_offer_viewed(offer_id: String, offer_type: String, bonus_percentage: int = 0) -> void:
	"""Log when a player views a special offer.
	
	Parameters:
		offer_id: Unique offer identifier
		offer_type: Type of offer (e.g., "first_purchase", "daily_deal", "limited")
		bonus_percentage: Bonus percentage if applicable
	"""
	_log_event(EVENT_OFFER_VIEWED, {
		"offer_id": offer_id,
		"offer_type": offer_type,
		"bonus_percentage": bonus_percentage,
		"platform": platform
	})

func log_offer_accepted(offer_id: String, offer_type: String, original_price_cents: int, discounted_price_cents: int) -> void:
	"""Log when a player accepts a special offer.
	
	Parameters:
		offer_id: Unique offer identifier
		offer_type: Type of offer
		original_price_cents: Original price before discount
		discounted_price_cents: Discounted price
	"""
	_log_event(EVENT_OFFER_ACCEPTED, {
		"offer_id": offer_id,
		"offer_type": offer_type,
		"original_price_cents": original_price_cents,
		"discounted_price_cents": discounted_price_cents,
		"savings_cents": original_price_cents - discounted_price_cents,
		"platform": platform
	})

func log_promo_code_used(promo_code: String, discount_percentage: int, discount_cents: int) -> void:
	"""Log when a player uses a promotional code.
	
	Parameters:
		promo_code: The promo code entered
		discount_percentage: Percentage discount applied
		discount_cents: Amount of discount in cents
	"""
	_log_event(EVENT_PROMO_CODE_USED, {
		"promo_code": promo_code,
		"discount_percentage": discount_percentage,
		"discount_cents": discount_cents,
		"platform": platform
	})

func log_subscription_renewed(subscription_type: String, renewal_price_cents: int) -> void:
	"""Log subscription renewal.
	
	Parameters:
		subscription_type: Type of subscription
		renewal_price_cents: Price of renewal
	"""
	_log_event(EVENT_SUBSCRIPTION_RENEWED, {
		"subscription_type": subscription_type,
		"renewal_price_cents": renewal_price_cents,
		"platform": platform
	})
	
	# Track revenue from subscription
	_track_revenue(renewal_price_cents, "subscription")

func log_subscription_cancelled(subscription_type: String, cancellation_reason: String = "") -> void:
	"""Log subscription cancellation.
	
	Parameters:
		subscription_type: Type of subscription
		cancellation_reason: Optional reason for cancellation
	"""
	_log_event(EVENT_SUBSCRIPTION_CANCELLED, {
		"subscription_type": subscription_type,
		"cancellation_reason": cancellation_reason,
		"platform": platform
	})

# ============================================================================
# Enhanced Crashlytics Integration
# ============================================================================

func log_crash_with_context(crash_type: String, stack_trace: String, context: Dictionary) -> void:
	"""Log a crash with additional context for better debugging.
	
	Parameters:
		crash_type: Type of crash (e.g., "null_pointer", "runtime_error")
		stack_trace: Stack trace of the crash
		context: Additional context (session info, game state, etc.)
	"""
	var params := context.duplicate()
	params["crash_type"] = crash_type
	params["session_id"] = current_session_id
	params["session_count"] = session_count
	params["total_play_time_seconds"] = total_play_time_seconds
	params["platform"] = platform
	params["app_version"] = app_version
	
	# Add performance context
	params["fps"] = Engine.get_frames_per_second()
	params["memory_mb"] = OS.get_static_memory_usage() / (1024.0 * 1024.0)
	
	# Add last breadcrumbs for context
	if breadcrumbs.size() > 0:
		params["recent_breadcrumbs"] = breadcrumbs.slice(-5)
	
	_log_crashlytics_error(crash_type, stack_trace, params)
	_log_event(EVENT_CRASH_RECORDED, params)
	
	crash_reported.emit(_generate_crash_id(), crash_type)
	print("AnalyticsManager: Crash recorded - ", crash_type)

func log_error_with_breadcrumbs(error_message: String, severity: String = "error") -> void:
	"""Log an error with recent breadcrumbs for context.
	
	Parameters:
		error_message: Description of the error
		severity: Severity level ("error", "warning", "info")
	"""
	var metadata := {
		"severity": severity,
		"session_id": current_session_id,
		"session_count": session_count,
		"total_play_time_seconds": total_play_time_seconds,
		"recent_breadcrumbs": breadcrumbs.slice(-10) if breadcrumbs.size() > 0 else []
	}
	
	record_custom_error(error_message, "", metadata)
	_log_event(EVENT_ERROR_RECORDED, metadata)
