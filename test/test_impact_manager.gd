extends GutTest

## Unit tests for ImpactManager
## Tests screen shake with different intensities and shake state tracking

## Test ImpactManager singleton exists
func test_impact_manager_exists():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager should be loaded as autoload")

## Test shake_screen with light intensity
func test_shake_screen_light():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("light", 0.2, true)
	assert_not_null(result, "Result should be returned for light shake")

## Test shake_screen with medium intensity
func test_shake_screen_medium():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("medium", 0.4, true)
	assert_not_null(result, "Result should be returned for medium shake")

## Test shake_screen with heavy intensity
func test_shake_screen_heavy():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("heavy", 0.6, true)
	assert_not_null(result, "Result should be returned for heavy shake")

## Test shake_screen with invalid intensity
func test_shake_screen_invalid_intensity():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("invalid", 0.2, true)
	assert_eq(result.get("success", true), false, "Invalid intensity should return failure")

## Test shake_screen with decay enabled
func test_shake_screen_with_decay():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("medium", 0.4, true)
	assert_not_null(result, "Result should be returned with decay enabled")

## Test shake_screen with decay disabled
func test_shake_screen_without_decay():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("medium", 0.4, false)
	assert_not_null(result, "Result should be returned with decay disabled")

## Test shake_config presets
func test_shake_config_presets():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	# Light shake should have intensity 2, duration 0.2
	var light_config = manager.shake_config.get("light", {})
	assert_eq(light_config.get("intensity"), 2, "Light shake intensity should be 2")
	assert_eq(light_config.get("duration"), 0.2, "Light shake duration should be 0.2")

	# Medium shake should have intensity 5, duration 0.4
	var medium_config = manager.shake_config.get("medium", {})
	assert_eq(medium_config.get("intensity"), 5, "Medium shake intensity should be 5")
	assert_eq(medium_config.get("duration"), 0.4, "Medium shake duration should be 0.4")

	# Heavy shake should have intensity 10, duration 0.6
	var heavy_config = manager.shake_config.get("heavy", {})
	assert_eq(heavy_config.get("intensity"), 10, "Heavy shake intensity should be 10")
	assert_eq(heavy_config.get("duration"), 0.6, "Heavy shake duration should be 0.6")

## Test get_shake_state method
func test_get_shake_state():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var state = manager.get_shake_state()
	assert_not_null(state, "Shake state should be returned")
	assert_has(state, "is_shaking", "Shake state should have is_shaking field")
	assert_has(state, "active_shake_duration", "Shake state should have active_shake_duration field")

## Test is_shake_active method
func test_is_shake_active():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	# Should be inactive initially
	var is_active = manager.is_shake_active()
	assert_false(is_active, "Shake should not be active initially")

## Test shake_started signal
func test_shake_started_signal():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var signal_emitted = false

	manager.shake_started.connect(func():
		signal_emitted = true
	)

	manager.shake_screen("light", 0.2, true)

	# Wait for signal processing
	await get_tree().process_frame

	assert_true(signal_emitted, "shake_started signal should be emitted")

## Test shake_completed signal
func test_shake_completed_signal():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var signal_emitted = false

	manager.shake_completed.connect(func(data: Dictionary):
		signal_emitted = true
	)

	manager.shake_screen("light", 0.2, true)

	# Wait for shake to complete (duration + buffer)
	await get_tree().create_timer(0.5).timeout

	assert_true(signal_emitted, "shake_completed signal should be emitted")

## Test rapid shake triggering (stress test)
func test_rapid_shake_triggering():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	# Trigger multiple shakes rapidly
	for i in range(5):
		manager.shake_screen("light", 0.1, true)

	pass_test("Rapid shake triggering should not crash")

## Test shake with zero duration
func test_shake_zero_duration():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("light", 0.0, true)
	assert_not_null(result, "Zero duration shake should return result")

## Test shake with long duration
func test_shake_long_duration():
	var manager = get_node_or_null("/root/ImpactManager")
	assert_not_null(manager, "ImpactManager required")

	var result = manager.shake_screen("medium", 2.0, true)
	assert_not_null(result, "Long duration shake should return result")

## Test CombatJuiceManager SCREEN_SHAKE routing
func test_combat_juice_screen_shake_routing():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var result = manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)

	assert_not_null(result, "Result should be returned")
