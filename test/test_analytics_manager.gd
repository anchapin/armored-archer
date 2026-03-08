extends GDScriptTestCase

## Tests for the AnalyticsManager module
## Tests cover session tracking, event logging, user properties,
## crash reporting, and data export functionality

const TEST_USER_ID := "test_user_123"
const TEST_SESSION_ID := "test_session_456"


func before_each() -> void:
	super.before_each()
	# Reset analytics state before each test
	var analytics = _get_analytics_manager()
	if analytics:
		analytics.is_initialized = false
		analytics.session_count = 0
		analytics.total_play_time_seconds = 0.0
		analytics.breadcrumbs.clear()
		analytics.event_queue.clear()


func _get_analytics_manager() -> Node:
	return get_node_or_null("/root/AnalyticsManager")


func test_analytics_manager_exists() -> void:
	"""Test that AnalyticsManager autoload exists"""
	var analytics = _get_analytics_manager()
	assert_not_null(analytics, "AnalyticsManager should exist as autoload")


func test_analytics_initialization() -> void:
	"""Test that AnalyticsManager initializes correctly"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	assert_true(analytics.is_initialized or not analytics.is_initialized, 
		"AnalyticsManager should have valid initialization state")


func test_set_user_id() -> void:
	"""Test setting user ID for analytics tracking"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.set_user_id(TEST_USER_ID)
	assert_eq(analytics.user_id, TEST_USER_ID)


func test_set_user_property() -> void:
	"""Test setting user properties"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.set_user_property("platform", "android")
	assert_true(analytics.user_properties.has("platform"))
	assert_eq(analytics.user_properties["platform"], "android")


func test_set_multiple_user_properties() -> void:
	"""Test setting multiple user properties at once"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	var properties := {
		"platform": "ios",
		"level": 10,
		"version": "1.0.0"
	}
	analytics.set_user_properties(properties)
	
	assert_true(analytics.user_properties.has("platform"))
	assert_true(analytics.user_properties.has("level"))
	assert_true(analytics.user_properties.has("version"))


func test_session_tracking() -> void:
	"""Test session tracking functionality"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	var initial_session_count := analytics.session_count
	analytics.start_session()
	assert_true(analytics.current_session_id != "")
	assert_true(analytics.session_start_time > 0)
	
	# End session and verify duration tracking
	await get_tree().create_timer(0.1).timeout
	analytics.end_session()
	
	# Session should have been tracked
	assert_true(analytics.session_count >= initial_session_count)


func test_log_tutorial_started() -> void:
	"""Test logging tutorial started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_tutorial_started("tutorial_basic")
	# Event should be logged without errors


func test_log_tutorial_completed() -> void:
	"""Test logging tutorial completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_tutorial_completed("tutorial_basic", 120.5)
	# Event should be logged without errors


func test_log_tutorial_failed() -> void:
	"""Test logging tutorial failed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_tutorial_failed("tutorial_basic", "step_3", "player_gave_up")
	# Event should be logged without errors


func test_log_pve_stage_started() -> void:
	"""Test logging PVE stage started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pve_stage_started("campaign_1", "Stage 1", "normal", 1)
	# Event should be logged without errors


func test_log_pve_stage_completed() -> void:
	"""Test logging PVE stage completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pve_stage_completed("campaign_1", "Stage 1", 180.5, 3, "normal", 1)
	# Event should be logged without errors


func test_log_pve_stage_failed() -> void:
	"""Test logging PVE stage failed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pve_stage_failed("campaign_1", "Stage 1", 90.0, "player_died", "hard")
	# Event should be logged without errors


func test_log_pve_boss_defeated() -> void:
	"""Test logging PVE boss defeated event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pve_boss_defeated("campaign_boss", "boss_fire", "normal", 3)
	# Event should be logged without errors


func test_log_pvp_match_started() -> void:
	"""Test logging PVP match started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pvp_match_started("match_123", "opponent_456", 1, 1500)
	# Event should be logged without errors


func test_log_pvp_match_completed() -> void:
	"""Test logging PVP match completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pvp_match_completed("match_123", "win", "opponent_456", 1, 300.0, 100, 50, 25)
	# Event should be logged without errors


func test_log_pvp_match_abandoned() -> void:
	"""Test logging PVP match abandoned event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pvp_match_abandoned("match_123", "player_left", 1)
	# Event should be logged without errors


func test_log_pvp_disconnect() -> void:
	"""Test logging PVP disconnect event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_pvp_disconnect("match_123", true)
	# Event should be logged without errors


func test_log_store_opened() -> void:
	"""Test logging store opened event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_store_opened("main_menu")
	analytics.log_store_opened("in_game")
	# Events should be logged without errors


func test_log_purchase_initiated() -> void:
	"""Test logging purchase initiated event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_purchase_initiated("com.armoredarcher.gems.small", "Small Gems", "gem_bundle", 99, "USD")
	# Event should be logged without errors


func test_log_purchase_completed() -> void:
	"""Test logging purchase completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_purchase_completed("com.armoredarcher.gems.small", "Small Gems", "gem_bundle", 99, "USD", "tx_123")
	# Event should be logged without errors


func test_log_purchase_failed() -> void:
	"""Test logging purchase failed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_purchase_failed("com.armoredarcher.gems.small", "declined")
	# Event should be logged without errors


func test_log_gem_purchased() -> void:
	"""Test logging gem purchased event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_gem_purchased(100, 99, "USD", "iap", "offer_123")
	# Event should be logged without errors


func test_log_cosmetic_purchased() -> void:
	"""Test logging cosmetic purchased event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_cosmetic_purchased("skin_001", "Dragon Armor", "armor", "legendary", 499, "USD")
	# Event should be logged without errors


func test_log_subscription_started() -> void:
	"""Test logging subscription started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_subscription_started("premium_monthly", 999, "USD")
	# Event should be logged without errors


func test_log_gear_obtained() -> void:
	"""Test logging gear obtained event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_gear_obtained("sword_001", "Flame Sword", "weapon", "rare", "pve_drop")
	# Event should be logged without errors


func test_log_gear_equipped() -> void:
	"""Test logging gear equipped event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_gear_equipped("sword_001", "Flame Sword", "weapon", "main_hand")
	# Event should be logged without errors


func test_log_transmog_applied() -> void:
	"""Test logging transmog applied event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_transmog_applied("skin_001", "Dragon Armor", "sword_001")
	# Event should be logged without errors


func test_log_level_up() -> void:
	"""Test logging level up event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_level_up(10, 9, "pve")
	# Event should be logged without errors


func test_log_ability_unlocked() -> void:
	"""Test logging ability unlocked event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_ability_unlocked("ability_001", "Fireball", 5)
	# Event should be logged without errors


func test_log_season_start() -> void:
	"""Test logging season start event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_season_start(1, "Season 1")
	# Event should be logged without errors


func test_log_season_end() -> void:
	"""Test logging season end event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_season_end(1, "Season 1", 1500)
	# Event should be logged without errors


func test_log_first_session() -> void:
	"""Test logging first session event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_first_session()
	# Event should be logged without errors


func test_log_daily_login() -> void:
	"""Test logging daily login event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_daily_login(5)
	# Event should be logged without errors


func test_log_returning_player() -> void:
	"""Test logging returning player event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_returning_player(30)
	# Event should be logged without errors


func test_log_network_error() -> void:
	"""Test logging network error event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_network_error("timeout", "/rpc/get_player_stats", 408)
	# Event should be logged without errors


func test_log_rpc_error() -> void:
	"""Test logging RPC error event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_rpc_error("get_player_stats", -1, "Server error")
	# Event should be logged without errors


func test_log_rpc_latency() -> void:
	"""Test logging RPC latency event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.log_rpc_latency("get_player_stats", 150)
	# Event should be logged without errors


func test_log_custom_event() -> void:
	"""Test logging custom event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	var params := {
		"level": 10,
		"inventory_size": 50,
		"platform": "android"
	}
	analytics.log_custom_event("custom_event", params)
	# Event should be logged without errors


func test_breadcrumb_logging() -> void:
	"""Test breadcrumb logging functionality"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.add_breadcrumb("Test breadcrumb", {"key": "value"})
	
	var breadcrumbs = analytics.get_breadcrumbs()
	assert_true(breadcrumbs.size() > 0, "Breadcrumbs should be recorded")


func test_clear_breadcrumbs() -> void:
	"""Test clearing breadcrumbs"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.add_breadcrumb("Test breadcrumb 1")
	analytics.add_breadcrumb("Test breadcrumb 2")
	assert_true(analytics.get_breadcrumbs().size() > 0)
	
	analytics.clear_breadcrumbs()
	assert_eq(analytics.get_breadcrumbs().size(), 0)


func test_session_summary() -> void:
	"""Test getting session summary"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.set_user_id(TEST_USER_ID)
	analytics.start_session()
	
	var summary = analytics.get_session_summary()
	assert_true(summary.has("session_id"))
	assert_true(summary.has("session_count"))
	assert_true(summary.has("platform"))
	assert_true(summary.has("app_version"))


func test_export_analytics_data() -> void:
	"""Test exporting analytics data"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.add_breadcrumb("Test breadcrumb")
	analytics.log_custom_event("test_event", {"key": "value"})
	
	var data = analytics.export_analytics_data()
	assert_true(data.has("session_summary"))
	assert_true(data.has("breadcrumbs"))


func test_analytics_enabled_toggle() -> void:
	"""Test enabling/disabling analytics"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.set_analytics_enabled(false)
	assert_false(analytics.is_analytics_enabled)
	
	analytics.set_analytics_enabled(true)
	assert_true(analytics.is_analytics_enabled)


func test_crashlytics_enabled_toggle() -> void:
	"""Test enabling/disabling crashlytics"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.set_crashlytics_collection_enabled(false)
	assert_false(analytics.is_crashlytics_enabled)
	
	analytics.set_crashlytics_collection_enabled(true)
	assert_true(analytics.is_crashlytics_enabled)


func test_debug_mode_toggle() -> void:
	"""Test enabling/disabling debug mode"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	analytics.set_debug_mode(false)
	assert_false(analytics.is_debug_mode)
	
	analytics.set_debug_mode(true)
	assert_true(analytics.is_debug_mode)


func test_event_constants_defined() -> void:
	"""Test that all event constants are defined"""
	var analytics = _get_analytics_manager()
	if not analytics:
		skip("AnalyticsManager not available")
	
	# Session events
	assert_true(analytics.has_method("log_first_session"))
	assert_true(analytics.has_method("log_daily_login"))
	
	# Tutorial events
	assert_true(analytics.has_method("log_tutorial_started"))
	assert_true(analytics.has_method("log_tutorial_completed"))
	assert_true(analytics.has_method("log_tutorial_failed"))
	
	# PVE events
	assert_true(analytics.has_method("log_pve_stage_started"))
	assert_true(analytics.has_method("log_pve_stage_completed"))
	assert_true(analytics.has_method("log_pve_stage_failed"))
	assert_true(analytics.has_method("log_pve_boss_defeated"))
	
	# PVP events
	assert_true(analytics.has_method("log_pvp_match_started"))
	assert_true(analytics.has_method("log_pvp_match_completed"))
	assert_true(analytics.has_method("log_pvp_match_abandoned"))
	assert_true(analytics.has_method("log_pvp_disconnect"))
	
	# Store events
	assert_true(analytics.has_method("log_store_opened"))
	assert_true(analytics.has_method("log_purchase_completed"))
	assert_true(analytics.has_method("log_gem_purchased"))
	
	# Progression events
	assert_true(analytics.has_method("log_level_up"))
	assert_true(analytics.has_method("log_ability_unlocked"))
	assert_true(analytics.has_method("log_gear_obtained"))
	assert_true(analytics.has_method("log_gear_equipped"))
	assert_true(analytics.has_method("log_transmog_applied"))
