extends GutTest

## Unit tests for the screen shake / flash API consolidated into CombatJuiceManager (issue #1660; formerly ImpactManager)
## Tests screen shake with different intensities and shake state tracking

const JuiceScript := preload("res://autoloads/CombatJuiceManager.gd")

var juice: Node

## Records shake_started emissions (lambdas capture locals by value, so a
## flag-flipping lambda never updates the outer variables).
class ShakeRecorder extends RefCounted:
	var started_count: int = 0

	func on_started() -> void:
		started_count += 1

func before_each():
	# Fresh instance per test: the shared autoload singleton leaks shake
	# state (and deferred shake coroutines) between tests.
	juice = JuiceScript.new()
	add_child_autofree(juice)

## Test the consolidated manager singleton exists
func test_impact_manager_exists():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager should be loaded as autoload")

## Test shake_screen with light intensity
func test_shake_screen_light():
	var manager = juice

	var result = manager.shake_screen("light", 0.2, true)
	assert_not_null(result, "Result should be returned for light shake")

## Test shake_screen with medium intensity
func test_shake_screen_medium():
	var manager = juice

	var result = manager.shake_screen("medium", 0.4, true)
	assert_not_null(result, "Result should be returned for medium shake")

## Test shake_screen with heavy intensity
func test_shake_screen_heavy():
	var manager = juice

	var result = manager.shake_screen("heavy", 0.6, true)
	assert_not_null(result, "Result should be returned for heavy shake")

## Test shake_screen with invalid intensity
func test_shake_screen_invalid_intensity():
	var manager = juice

	var result = manager.shake_screen("invalid", 0.2, true)
	assert_eq(result.get("success", true), false, "Invalid intensity should return failure")

## Test shake_screen with decay enabled
func test_shake_screen_with_decay():
	var manager = juice

	var result = manager.shake_screen("medium", 0.4, true)
	assert_not_null(result, "Result should be returned with decay enabled")

## Test shake_screen with decay disabled
func test_shake_screen_without_decay():
	var manager = juice

	var result = manager.shake_screen("medium", 0.4, false)
	assert_not_null(result, "Result should be returned with decay disabled")

## Test shake_config presets
func test_shake_config_presets():
	var manager = juice

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
	var manager = juice

	var state = manager.get_shake_state()
	assert_not_null(state, "Shake state should be returned")
	assert_has(state, "is_shaking", "Shake state should have is_shaking field")
	assert_has(state, "active_shake_duration", "Shake state should have active_shake_duration field")

## Test is_shake_active method
func test_is_shake_active():
	var manager = juice

	# The manager is a shared autoload and the tests above start shakes that
	# stay active for their requested duration, so wait for the manager to go
	# idle before asserting the inactive state (issue #1878).
	await _wait_until_shake_idle(manager)

	# Should be inactive when no shake is running
	assert_false(manager.is_shake_active(), "Shake should not be active initially")

## Wait (bounded) until the manager reports no active shake.
func _wait_until_shake_idle(manager: Node) -> void:
	var waited := 0.0
	while manager.is_shake_active() and waited < 3.0:
		await get_tree().create_timer(0.05).timeout
		waited += 0.05

## Test shake_started signal
func test_shake_started_signal():
	var manager = juice

	var recorder = ShakeRecorder.new()
	manager.shake_started.connect(recorder.on_started)

	manager.shake_screen("light", 0.2, true)

	# Wait for signal processing
	await get_tree().process_frame

	assert_eq(recorder.started_count, 1, "shake_started signal should be emitted")

## Test shake_completed signal
func test_shake_completed_signal():
	var manager = juice

	# Array-based tracking: GDScript lambdas capture locals by value, so a
	# plain bool assigned inside the lambda would not be observable here.
	# The shake_completed signal carries no payload (issue #1878), so the
	# handler takes no arguments.
	var signal_emitted := [false]

	manager.shake_completed.connect(func():
		signal_emitted[0] = true
	)

	manager.shake_screen("light", 0.2, true)

	# Wait for shake to complete (duration + buffer)
	await get_tree().create_timer(0.5).timeout

	assert_true(signal_emitted[0], "shake_completed signal should be emitted")

## Test shake_completed is emitted exactly once per shake
func test_shake_completed_emitted_once():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Make sure no shake from an earlier test is still in flight, otherwise
	# its completion would be counted here as well.
	await _wait_until_shake_idle(manager)

	# Array-based tracking: GDScript lambdas capture locals by value.
	var emit_count := [0]

	manager.shake_completed.connect(func():
		emit_count[0] += 1
	)

	manager.shake_screen("light", 0.2, true)

	# Wait for the shake (duration + decay steps) to complete
	await get_tree().create_timer(0.6).timeout

	assert_eq(emit_count[0], 1, "shake_completed should be emitted exactly once per shake")

## Test rapid shake triggering (stress test)
func test_rapid_shake_triggering():
	var manager = juice

	# Trigger multiple shakes rapidly
	for i in range(5):
		manager.shake_screen("light", 0.1, true)

	pass_test("Rapid shake triggering should not crash")

## Test shake with zero duration
func test_shake_zero_duration():
	var manager = juice

	var result = manager.shake_screen("light", 0.0, true)
	assert_not_null(result, "Zero duration shake should return result")

## Test shake with long duration
func test_shake_long_duration():
	var manager = juice

	var result = manager.shake_screen("medium", 2.0, true)
	assert_not_null(result, "Long duration shake should return result")

## Test CombatJuiceManager SCREEN_SHAKE routing
func test_combat_juice_screen_shake_routing():
	var manager = juice

	# trigger_combat_juice returns void; a routed shake starts synchronously.
	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)

	assert_true(manager.is_shake_active(), "SCREEN_SHAKE routing should start a shake")
