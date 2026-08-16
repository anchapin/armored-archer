extends GDScriptTestCase

## Tests for the AnalyticsManager module
## Tests cover session tracking, event logging, user properties,
## crash reporting, and data export functionality

const TEST_USER_ID := "test_user_123"
const TEST_SESSION_ID := "test_session_456"

func _ready() -> void:
	print("=== Running AnalyticsManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_analytics_manager_exists()
	await test_analytics_initialization()
	await test_set_user_id()
	await test_set_user_property()
	await test_set_multiple_user_properties()
	await test_session_tracking()
	await test_log_tutorial_started()
	await test_log_tutorial_completed()
	await test_log_tutorial_failed()
	await test_log_pve_stage_started()
	await test_log_pve_stage_completed()
	await test_log_pve_stage_failed()
	await test_log_pve_boss_defeated()
	await test_log_pvp_match_started()
	await test_log_pvp_match_completed()
	await test_log_pvp_match_abandoned()
	await test_log_pvp_disconnect()
	await test_log_store_opened()
	await test_log_purchase_initiated()
	await test_log_purchase_completed()
	await test_log_purchase_failed()
	await test_log_gem_purchased()
	await test_log_cosmetic_purchased()
	await test_log_subscription_started()
	await test_log_gear_obtained()
	await test_log_gear_equipped()
	await test_log_gear_unequipped()
	await test_log_loadout_viewed()
	await test_log_transmog_applied()
	await test_log_level_up()
	await test_log_ability_unlocked()
	await test_log_season_start()
	await test_log_season_end()
	await test_log_first_session()
	await test_log_daily_login()
	await test_log_returning_player()
	await test_log_network_error()
	await test_log_rpc_error()
	await test_log_rpc_latency()
	await test_log_custom_event()
	await test_breadcrumb_logging()
	await test_clear_breadcrumbs()
	await test_session_summary()
	await test_export_analytics_data()
	await test_analytics_enabled_toggle()
	await test_crashlytics_enabled_toggle()
	await test_debug_mode_toggle()
	await test_event_constants_defined()

	print("\n=== AnalyticsManager Test Results ===")
	print("Passed: %d" % assertions_passed)
	print("Failed: %d" % assertions_failed)
	queue_free()

func _get_analytics_manager() -> Node:
	return get_node_or_null("/root/AnalyticsManager")

func _pass(test_name: String) -> void:
	test_name = test_name
	assertions_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	test_name = test_name
	assertions_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_analytics_manager_exists() -> void:
	var test_name = "test_analytics_manager_exists"
	"""Test that AnalyticsManager autoload exists"""
	var analytics = _get_analytics_manager()
	if analytics != null:
		_pass(test_name)
	else:
		_fail(test_name, "AnalyticsManager should exist as autoload")

func test_analytics_initialization() -> void:
	var test_name = "test_analytics_initialization"
	"""Test that AnalyticsManager initializes correctly"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	_pass(test_name)

func test_set_user_id() -> void:
	var test_name = "test_set_user_id"
	"""Test setting user ID for analytics tracking"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.set_user_id(TEST_USER_ID)
	if analytics.user_id == TEST_USER_ID:
		_pass(test_name)
	else:
		_fail(test_name, "User ID should be set correctly")

func test_set_user_property() -> void:
	var test_name = "test_set_user_property"
	"""Test setting user properties"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.set_user_property("platform", "android")
	if analytics.user_properties.has("platform") and analytics.user_properties["platform"] == "android":
		_pass(test_name)
	else:
		_fail(test_name, "User property should be set correctly")

func test_set_multiple_user_properties() -> void:
	var test_name = "test_set_multiple_user_properties"
	"""Test setting multiple user properties at once"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	# set_user_property() is typed String -> String; values must be strings
	var properties := {
		"platform": "ios",
		"level": "10",
		"version": "1.0.0"
	}
	analytics.set_user_properties(properties)

	if analytics.user_properties.has("platform") and analytics.user_properties.has("level") and analytics.user_properties.has("version"):
		_pass(test_name)
	else:
		_fail(test_name, "Multiple properties should be set correctly")

func test_session_tracking() -> void:
	var test_name = "test_session_tracking"
	"""Test session tracking functionality"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	var initial_session_count: int = analytics.session_count
	analytics.start_session()

	if analytics.current_session_id != "" and analytics.session_start_time > 0:
		# End session and verify duration tracking
		await get_tree().create_timer(0.1).timeout
		analytics.end_session()
		_pass(test_name)
	else:
		_fail(test_name, "Session should start correctly")

func test_log_tutorial_started() -> void:
	var test_name = "test_log_tutorial_started"
	"""Test logging tutorial started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_tutorial_started("tutorial_basic")
	_pass(test_name)

func test_log_tutorial_completed() -> void:
	var test_name = "test_log_tutorial_completed"
	"""Test logging tutorial completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_tutorial_completed("tutorial_basic", 120.5)
	_pass(test_name)

func test_log_tutorial_failed() -> void:
	var test_name = "test_log_tutorial_failed"
	"""Test logging tutorial failed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_tutorial_failed("tutorial_basic", "step_3", "player_gave_up")
	_pass(test_name)

func test_log_pve_stage_started() -> void:
	var test_name = "test_log_pve_stage_started"
	"""Test logging PVE stage started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pve_stage_started("campaign_1", "Stage 1", "normal", 1)
	_pass(test_name)

func test_log_pve_stage_completed() -> void:
	var test_name = "test_log_pve_stage_completed"
	"""Test logging PVE stage completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pve_stage_completed("campaign_1", "Stage 1", 180.5, 3, "normal", 1)
	_pass(test_name)

func test_log_pve_stage_failed() -> void:
	var test_name = "test_log_pve_stage_failed"
	"""Test logging PVE stage failed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pve_stage_failed("campaign_1", "Stage 1", 90.0, "player_died", "hard")
	_pass(test_name)

func test_log_pve_boss_defeated() -> void:
	var test_name = "test_log_pve_boss_defeated"
	"""Test logging PVE boss defeated event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pve_boss_defeated("campaign_boss", "boss_fire", "normal", 3)
	_pass(test_name)

func test_log_pvp_match_started() -> void:
	var test_name = "test_log_pvp_match_started"
	"""Test logging PVP match started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pvp_match_started("match_123", "opponent_456", 1, 1500)
	_pass(test_name)

func test_log_pvp_match_completed() -> void:
	var test_name = "test_log_pvp_match_completed"
	"""Test logging PVP match completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pvp_match_completed("match_123", "win", "opponent_456", 1, 300.0, 100, 50, 25)
	_pass(test_name)

func test_log_pvp_match_abandoned() -> void:
	var test_name = "test_log_pvp_match_abandoned"
	"""Test logging PVP match abandoned event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pvp_match_abandoned("match_123", "player_left", 1)
	_pass(test_name)

func test_log_pvp_disconnect() -> void:
	var test_name = "test_log_pvp_disconnect"
	"""Test logging PVP disconnect event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_pvp_disconnect("match_123", true)
	_pass(test_name)

func test_log_store_opened() -> void:
	var test_name = "test_log_store_opened"
	"""Test logging store opened event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_store_opened("main_menu")
	analytics.log_store_opened("in_game")
	_pass(test_name)

func test_log_purchase_initiated() -> void:
	var test_name = "test_log_purchase_initiated"
	"""Test logging purchase initiated event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_purchase_initiated("com.armoredarcher.gems.small", "Small Gems", "gem_bundle", 99, "USD")
	_pass(test_name)

func test_log_purchase_completed() -> void:
	var test_name = "test_log_purchase_completed"
	"""Test logging purchase completed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_purchase_completed("com.armoredarcher.gems.small", "Small Gems", "gem_bundle", 99, "USD", "tx_123")
	_pass(test_name)

func test_log_purchase_failed() -> void:
	var test_name = "test_log_purchase_failed"
	"""Test logging purchase failed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_purchase_failed("com.armoredarcher.gems.small", "declined")
	_pass(test_name)

func test_log_gem_purchased() -> void:
	var test_name = "test_log_gem_purchased"
	"""Test logging gem purchased event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_gem_purchased(100, 99, "USD", "iap", "offer_123")
	_pass(test_name)

func test_log_cosmetic_purchased() -> void:
	var test_name = "test_log_cosmetic_purchased"
	"""Test logging cosmetic purchased event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_cosmetic_purchased("skin_001", "Dragon Armor", "armor", "legendary", 499, "USD")
	_pass(test_name)

func test_log_subscription_started() -> void:
	var test_name = "test_log_subscription_started"
	"""Test logging subscription started event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_subscription_started("premium_monthly", 999, "USD")
	_pass(test_name)

func test_log_gear_obtained() -> void:
	var test_name = "test_log_gear_obtained"
	"""Test logging gear obtained event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_gear_obtained("sword_001", "Flame Sword", "weapon", "rare", "pve_drop")
	_pass(test_name)

func test_log_gear_equipped() -> void:
	var test_name = "test_log_gear_equipped"
	"""Test logging gear equipped event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_gear_equipped("sword_001", "Flame Sword", "weapon", "main_hand")
	_pass(test_name)

func test_log_gear_unequipped() -> void:
	var test_name = "test_log_gear_unequipped"
	"""Test logging gear unequipped event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_gear_unequipped("sword_001", "Flame Sword", "weapon", "main_hand")
	_pass(test_name)

func test_log_loadout_viewed() -> void:
	var test_name = "test_log_loadout_viewed"
	"""Test logging loadout viewed event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_loadout_viewed()
	_pass(test_name)

func test_log_transmog_applied() -> void:
	var test_name = "test_log_transmog_applied"
	"""Test logging transmog applied event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_transmog_applied("skin_001", "Dragon Armor", "sword_001")
	_pass(test_name)

func test_log_level_up() -> void:
	var test_name = "test_log_level_up"
	"""Test logging level up event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_level_up(10, 9, "pve")
	_pass(test_name)

func test_log_ability_unlocked() -> void:
	var test_name = "test_log_ability_unlocked"
	"""Test logging ability unlocked event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_ability_unlocked("ability_001", "Fireball", 5)
	_pass(test_name)

func test_log_season_start() -> void:
	var test_name = "test_log_season_start"
	"""Test logging season start event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_season_start(1, "Season 1")
	_pass(test_name)

func test_log_season_end() -> void:
	var test_name = "test_log_season_end"
	"""Test logging season end event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_season_end(1, "Season 1", 1500)
	_pass(test_name)

func test_log_first_session() -> void:
	var test_name = "test_log_first_session"
	"""Test logging first session event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_first_session()
	_pass(test_name)

func test_log_daily_login() -> void:
	var test_name = "test_log_daily_login"
	"""Test logging daily login event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_daily_login(5)
	_pass(test_name)

func test_log_returning_player() -> void:
	var test_name = "test_log_returning_player"
	"""Test logging returning player event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_returning_player(30)
	_pass(test_name)

func test_log_network_error() -> void:
	var test_name = "test_log_network_error"
	"""Test logging network error event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_network_error("timeout", "/rpc/get_player_stats", 408)
	_pass(test_name)

func test_log_rpc_error() -> void:
	var test_name = "test_log_rpc_error"
	"""Test logging RPC error event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_rpc_error("get_player_stats", -1, "Server error")
	_pass(test_name)

func test_log_rpc_latency() -> void:
	var test_name = "test_log_rpc_latency"
	"""Test logging RPC latency event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.log_rpc_latency("get_player_stats", 150)
	_pass(test_name)

func test_log_custom_event() -> void:
	var test_name = "test_log_custom_event"
	"""Test logging custom event"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	var params := {
		"level": 10,
		"inventory_size": 50,
		"platform": "android"
	}
	analytics.log_custom_event("custom_event", params)
	_pass(test_name)

func test_breadcrumb_logging() -> void:
	var test_name = "test_breadcrumb_logging"
	"""Test breadcrumb logging functionality"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.add_breadcrumb("Test breadcrumb", {"key": "value"})

	var breadcrumbs = analytics.get_breadcrumbs()
	if breadcrumbs.size() > 0:
		_pass(test_name)
	else:
		_fail(test_name, "Breadcrumbs should be recorded")

func test_clear_breadcrumbs() -> void:
	var test_name = "test_clear_breadcrumbs"
	"""Test clearing breadcrumbs"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.add_breadcrumb("Test breadcrumb 1")
	analytics.add_breadcrumb("Test breadcrumb 2")

	if analytics.get_breadcrumbs().size() > 0:
		analytics.clear_breadcrumbs()
		if analytics.get_breadcrumbs().size() == 0:
			_pass(test_name)
		else:
			_fail(test_name, "Breadcrumbs should be cleared")
	else:
		_fail(test_name, "Breadcrumbs should be added first")

func test_session_summary() -> void:
	var test_name = "test_session_summary"
	"""Test getting session summary"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.set_user_id(TEST_USER_ID)
	analytics.start_session()

	var summary = analytics.get_session_summary()
	if summary.has("session_id") and summary.has("session_count") and summary.has("platform") and summary.has("app_version"):
		_pass(test_name)
	else:
		_fail(test_name, "Session summary should contain required fields")

func test_export_analytics_data() -> void:
	var test_name = "test_export_analytics_data"
	"""Test exporting analytics data"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.add_breadcrumb("Test breadcrumb")
	analytics.log_custom_event("test_event", {"key": "value"})

	var data = analytics.export_analytics_data()
	if data.has("session_summary") and data.has("breadcrumbs"):
		_pass(test_name)
	else:
		_fail(test_name, "Exported data should contain required fields")

func test_analytics_enabled_toggle() -> void:
	var test_name = "test_analytics_enabled_toggle"
	"""Test enabling/disabling analytics"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.set_analytics_enabled(false)
	if not analytics.is_analytics_enabled:
		analytics.set_analytics_enabled(true)
		if analytics.is_analytics_enabled:
			_pass(test_name)
		else:
			_fail(test_name, "Analytics should be enabled")
	else:
		_fail(test_name, "Analytics should be disabled")

func test_crashlytics_enabled_toggle() -> void:
	var test_name = "test_crashlytics_enabled_toggle"
	"""Test enabling/disabling crashlytics"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.set_crashlytics_collection_enabled(false)
	if not analytics.is_crashlytics_enabled:
		analytics.set_crashlytics_collection_enabled(true)
		if analytics.is_crashlytics_enabled:
			_pass(test_name)
		else:
			_fail(test_name, "Crashlytics should be enabled")
	else:
		_fail(test_name, "Crashlytics should be disabled")

func test_debug_mode_toggle() -> void:
	var test_name = "test_debug_mode_toggle"
	"""Test enabling/disabling debug mode"""
	var analytics = _get_analytics_manager()
	if not analytics:
		_fail(test_name, "AnalyticsManager not available")
		return

	analytics.set_debug_mode(false)
	if not analytics.is_debug_mode:
		analytics.set_debug_mode(true)
		if analytics.is_debug_mode:
			_pass(test_name)
		else:
			_fail(test_name, "Debug mode should be enabled")
	else:
		_fail(test_name, "Debug mode should be disabled")

func test_event_constants_defined() -> void:
	## Test that all event constants are defined
	var test_name = "test_event_constants_defined"
	var analytics = _get_analytics_manager()
	var error_msg = ""

	if not analytics:
		error_msg = "AnalyticsManager not available"
	elif not analytics.has_method("log_first_session"):
		error_msg = "Missing log_first_session"
	elif not analytics.has_method("log_daily_login"):
		error_msg = "Missing log_daily_login"
	elif not (analytics.has_method("log_tutorial_started") and analytics.has_method("log_tutorial_completed") and analytics.has_method("log_tutorial_failed")):
		error_msg = "Missing tutorial methods"
	elif not (analytics.has_method("log_pve_stage_started") and analytics.has_method("log_pve_stage_completed") and analytics.has_method("log_pve_stage_failed") and analytics.has_method("log_pve_boss_defeated")):
		error_msg = "Missing PVE methods"
	elif not (analytics.has_method("log_pvp_match_started") and analytics.has_method("log_pvp_match_completed") and analytics.has_method("log_pvp_match_abandoned") and analytics.has_method("log_pvp_disconnect")):
		error_msg = "Missing PVP methods"
	elif not (analytics.has_method("log_store_opened") and analytics.has_method("log_purchase_completed") and analytics.has_method("log_gem_purchased")):
		error_msg = "Missing store methods"
	elif not (analytics.has_method("log_level_up") and analytics.has_method("log_ability_unlocked") and analytics.has_method("log_gear_obtained") and analytics.has_method("log_gear_equipped") and analytics.has_method("log_transmog_applied")):
		error_msg = "Missing progression methods"

	if error_msg:
		_fail(test_name, error_msg)
	else:
		_pass(test_name)
