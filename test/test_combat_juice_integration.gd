extends GutTest

## Integration tests for CombatJuiceManager
## Tests coordination between all juice effect managers

const JuiceScript := preload("res://autoloads/CombatJuiceManager.gd")

var juice: Node

## Records juice_effect_completed emissions (declared with the same
## (effect_type, data) shape the routing handlers emit).
class CompletedRecorder extends RefCounted:
	var calls: Array = []

	func record(effect_type: String, data: Dictionary) -> void:
		calls.append([effect_type, data])

func before_each():
	# Fresh instance per test: the shared autoload singleton leaks effect
	# and shake state between tests.
	juice = JuiceScript.new()
	add_child_autofree(juice)

## Test CombatJuiceManager singleton exists
func test_combat_juice_manager_exists():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager should be loaded as autoload")

## Test trigger_combat_juice routes SCREEN_SHAKE correctly
func test_trigger_screen_shake_routing():
	var manager = juice

	# trigger_combat_juice returns void; the routed handler reports back
	# through juice_effect_completed.
	var recorder = CompletedRecorder.new()
	manager.juice_effect_completed.connect(recorder.record)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)

	assert_eq(recorder.calls.size(), 1, "Screen shake handler should run to completion")
	assert_eq(recorder.calls[0][0], "screen_shake", "Effect should route to the screen shake handler")
	assert_true(recorder.calls[0][1].get("success", false), "Screen shake should succeed")

## Test trigger_combat_juice routes DAMAGE_NUMBER correctly
func test_trigger_damage_number_routing():
	var manager = juice

	# trigger_combat_juice returns void; the routed handler reports back
	# through juice_effect_completed.
	var recorder = CompletedRecorder.new()
	manager.juice_effect_completed.connect(recorder.record)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.DAMAGE_NUMBER,
		{"position": Vector2(100, 100), "damage": 25, "is_critical": false}
	)

	assert_eq(recorder.calls.size(), 1, "Damage number handler should run to completion")
	assert_eq(recorder.calls[0][0], "damage_number", "Effect should route to the damage number handler")
	assert_true(recorder.calls[0][1].get("success", false), "Damage number should succeed")

## Test juice_effect_started signal emits
func test_juice_effect_started_signal():
	var manager = juice

	# Array-based tracking: GDScript lambdas capture locals by value, so a
	# plain bool assigned inside the lambda would not be observable here.
	var signal_emitted := [false]
	var received_type := [""]

	manager.juice_effect_started.connect(func(effect_type: String, _data: Dictionary):
		signal_emitted[0] = true
		received_type[0] = effect_type
	)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)

	# Wait a frame for signal processing
	await get_tree().process_frame

	assert_true(signal_emitted[0], "juice_effect_started should be emitted")

## Test is_effect_active method
func test_is_effect_active():
	var manager = juice

	# Should return false for inactive effects
	var is_active = manager.is_effect_active(CombatJuiceManager.EffectType.SCREEN_SHAKE)
	assert_false(is_active, "Effect should not be active initially")

## Test get_time_scale method
func test_get_time_scale():
	var manager = juice

	var time_scale = manager.get_time_scale()
	assert_eq(time_scale, 1.0, "Default time scale should be 1.0")

## Test set_time_scale method
func test_set_time_scale():
	var manager = juice

	manager.set_time_scale(0.5)
	var time_scale = manager.get_time_scale()
	assert_eq(time_scale, 0.5, "Time scale should be set to 0.5")

	# Reset to default
	manager.set_time_scale(1.0)

## Test EffectType enum values
func test_effect_type_enum():
	assert_eq(CombatJuiceManager.EffectType.SCREEN_SHAKE, 0, "SCREEN_SHAKE should be 0")
	assert_eq(CombatJuiceManager.EffectType.IMPACT_VFX, 1, "IMPACT_VFX should be 1")
	assert_eq(CombatJuiceManager.EffectType.DAMAGE_NUMBER, 2, "DAMAGE_NUMBER should be 2")
	assert_eq(CombatJuiceManager.EffectType.HIT_REACTION, 3, "HIT_REACTION should be 3")
	assert_eq(CombatJuiceManager.EffectType.DEATH_ANIMATION, 4, "DEATH_ANIMATION should be 4")
