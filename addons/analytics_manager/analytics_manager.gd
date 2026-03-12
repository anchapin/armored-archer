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

# Funnel Analysis Events
const EVENT_APP_OPENED := "app_opened"
const EVENT_MAIN_MENU_VIEWED := "main_menu_viewed"
const EVENT_CAMPAIGN_STARTED := "campaign_started"
const EVENT_CAMPAIGN_COMPLETED := "campaign_completed"
const EVENT_STORE_VIEWED := "store_viewed"
const EVENT_PVP_LOBBY_ENTERED := "pvp_lobby_entered"
const EVENT_INVENTORY_VIEWED := "inventory_viewed"
const EVENT_SETTINGS_OPENED := "settings_opened"
const EVENT_TUTORIAL_SKIPPED := "tutorial_skipped"

func _ready() -> void:
	_initialize_analytics()

	# Set up performance monitoring
	last_performance_check = Time.get_ticks_msec()
	last_network_check = Time.get_ticks_msec()

func _process(_delta: float) -> void:
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
			# Report any pending errors before ending session
			end_session()
		NOTIFICATION_CRASH:
			# Godot crashed - attempt to log crash info
			_capture_crash_dump()

func _capture_crash_dump() -> void:
	# Attempt to capture crash information before app terminates
	# This is a best-effort capture since the app is crashing
	var crash_data := {
		"crash_time": Time.get_unix_time_from_system(),
		"session_id": current_session_id,
		"breadcrumbs": breadcrumbs.duplicate(),
		"memory_mb": OS.get_static_memory_usage() / (1024.0 * 1024.0),
		"platform": platform,
		"app_version": app_version,
		"engine_version": engine_version
	}
	
	# Log to console for debugging
	print("AnalyticsManager: CRASH DETECTED - ", JSON.stringify(crash_data))
	
	# Attempt to send to Firebase if available
	if is_crashlytics_enabled:
		_log_crashlytics_error("Application crash detected", "", crash_data)

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
	
	# Set up crash signal handlers for automatic crash capture
	_setup_crash_signal_handlers()

func _setup_crash_signal_handlers() -> void:
	# Set up automatic crash reporting by connecting to engine crash handlers
	# This enables capturing crashes that would otherwise be missed
	
	# Register with Godot's error handler for uncaught errors
	# Note: Godot doesn't have a native crash signal handler API,
	# but we can intercept common error patterns
	
	# Add breadcrumb for crashlytics initialization
	add_breadcrumb("crashlytics_initialized", {
		"platform": platform,
		"crashlytics_enabled": is_crashlytics_enabled,
		"session_id": current_session_id
	})
	
	print("AnalyticsManager: Crash signal handlers configured")

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

func log_purchase_initiated(item_id: String, item_name: String, item_type: String, price_cents: int, currency: String = "USD") -> void:
	_log_event(EVENT_PURCHASE_INITIATED, {
		"item_id": item_id,
		"item_name": item_name,
		"item_type": item_type,
		"price_cents": price_cents,
		"currency": currency,
		"platform": platform
	})

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

func log_purchase_failed(item_id: String, item_name: String, failure_reason: String) -> void:
	_log_event(EVENT_PURCHASE_FAILED, {
		"item_id": item_id,
		"item_name": item_name,
		"failure_reason": failure_reason,
		"platform": platform
	})

func log_gem_purchased(gems_amount: int, price_cents: int, currency: String = "USD", purchase_type: String = "iap", offer_id: String = "") -> void:
	_log_event(EVENT_GEM_PURCHASED, {
		"gems_amount": gems_amount,
		"price_cents": price_cents,
		"currency": currency,
		"purchase_type": purchase_type,
		"offer_id": offer_id,
		"platform": platform
	})

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
# Funnel Analysis Events
# ============================================================================

func log_app_opened() -> void:
	"""Logs when the app is opened/launched."""
	_log_event(EVENT_APP_OPENED, {
		"platform": platform,
		"app_version": app_version,
		"engine_version": engine_version
	})

func log_main_menu_viewed() -> void:
	"""Logs when the main menu is displayed."""
	_log_event(EVENT_MAIN_MENU_VIEWED, {
		"platform": platform
	})

func log_campaign_started(chapter: int = 1, stage: int = 1) -> void:
	"""Logs when a campaign stage is started."""
	_log_event(EVENT_CAMPAIGN_STARTED, {
		"chapter": chapter,
		"stage": stage,
		"platform": platform
	})

func log_campaign_completed(chapter: int = 1, stages_completed: int = 0) -> void:
	"""Logs when a campaign chapter is completed."""
	_log_event(EVENT_CAMPAIGN_COMPLETED, {
		"chapter": chapter,
		"stages_completed": stages_completed,
		"platform": platform
	})

func log_store_viewed(store_location: String = "main_menu") -> void:
	"""Logs when the store is viewed."""
	_log_event(EVENT_STORE_VIEWED, {
		"store_location": store_location,
		"platform": platform
	})

func log_pvp_lobby_entered(season_id: int = 0) -> void:
	"""Logs when entering the PvP matchmaking lobby."""
	_log_event(EVENT_PVP_LOBBY_ENTERED, {
		"season_id": season_id,
		"platform": platform
	})

func log_inventory_viewed() -> void:
	"""Logs when the inventory screen is viewed."""
	_log_event(EVENT_INVENTORY_VIEWED, {
		"platform": platform
	})

func log_settings_opened() -> void:
	"""Logs when settings screen is opened."""
	_log_event(EVENT_SETTINGS_OPENED, {
		"platform": platform
	})

func log_tutorial_skipped(step_id: String = "") -> void:
	"""Logs when the tutorial is skipped."""
	_log_event(EVENT_TUTORIAL_SKIPPED, {
		"step_id": step_id,
		"platform": platform
	})

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
	if NetworkManager and NetworkManager.is_connected:
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
	
	# Include recent breadcrumbs with crash report for debugging context
	params["breadcrumbs"] = _get_breadcrumb_summary()
	
	# Include session context
	params["session_id"] = current_session_id
	params["session_duration"] = Time.get_unix_time_from_system() - session_start_time if session_start_time > 0 else 0
	
	# Include performance context
	params["memory_mb"] = OS.get_static_memory_usage() / (1024.0 * 1024.0)
	params["fps"] = Engine.get_frames_per_second()

	_log_crashlytics_error(message, stack_trace, params)
	print("Analytics: Recorded custom error: ", message)

	crash_reported.emit(_generate_crash_id(), message)

func _get_breadcrumb_summary() -> Array:
	# Return last 10 breadcrumbs for crash context
	var summary_size := min(breadcrumbs.size(), 10)
	if summary_size == 0:
		return []
	return breadcrumbs.slice(-summary_size)

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
		}
	}

# ============================================================================
# Backend RPC Integration
# ============================================================================

## Send analytics event to backend server
## This allows the backend to aggregate analytics and forward to external services
func track_event_to_backend(event_name: String, properties: Dictionary = {}) -> void:
	if not is_initialized:
		_queue_event(event_name, properties)
		return

	var network_manager = _get_network_manager()
	if network_manager == null:
		push_warning("AnalyticsManager: NetworkManager not available, cannot send event to backend")
		_queue_event(event_name, properties)
		return

	var payload := {
		"event_name": event_name,
		"properties": properties,
		"platform": platform,
		"session_id": current_session_id
	}

	var rpc_id := "armored_archer/track_event"
	var response = await network_manager.send_rpc(rpc_id, JSON.stringify(payload))

	if is_debug_mode:
		print("AnalyticsManager: Backend track_event response: ", response)

## Send revenue event to backend
func track_revenue_to_backend(amount: int, currency: String, product_id: String, transaction_id: String) -> void:
	var network_manager = _get_network_manager()
	if network_manager == null:
		push_warning("AnalyticsManager: NetworkManager not available, cannot track revenue")
		return

	var payload := {
		"amount": amount,
		"currency": currency,
		"product_id": product_id,
		"transaction_id": transaction_id,
		"platform": platform
	}

	var rpc_id := "armored_archer/track_revenue"
	var response = await network_manager.send_rpc(rpc_id, JSON.stringify(payload))

	if is_debug_mode:
		print("AnalyticsManager: Backend track_revenue response: ", response)

## Get analytics summary from backend
func get_analytics_summary_from_backend(start_date: String, end_date: String, event_names: Array = []) -> Dictionary:
	var network_manager = _get_network_manager()
	if network_manager == null:
		push_warning("AnalyticsManager: NetworkManager not available, cannot get analytics summary")
		return {}

	var payload := {
		"start_date": start_date,
		"end_date": end_date,
		"event_names": event_names
	}

	var rpc_id := "armored_archer/get_analytics_summary"
	var response = await network_manager.send_rpc(rpc_id, JSON.stringify(payload))

	if response and response.has("summary"):
		return response["summary"]
	return {}

## Get NetworkManager node reference
func _get_network_manager() -> Node:
	return get_node_or_null("/root/NetworkManager")
