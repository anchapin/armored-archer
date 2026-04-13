extends GutTest

## Integration tests for CombatJuiceManager
## Tests coordination between all juice effect managers

## Test CombatJuiceManager singleton exists
func test_combat_juice_manager_exists():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager should be loaded as autoload")

## Test trigger_combat_juice routes SCREEN_SHAKE correctly
func test_trigger_screen_shake_routing():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Trigger screen shake effect
	var result = manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)

	# Should not throw error (result can be empty dict on success)
	assert_not_null(result, "Result should be returned")

## Test trigger_combat_juice routes DAMAGE_NUMBER correctly
func test_trigger_damage_number_routing():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Trigger damage number effect
	var result = manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.DAMAGE_NUMBER,
		{"position": Vector2(100, 100), "damage": 25, "is_critical": false}
	)

	assert_not_null(result, "Result should be returned")

## Test juice_effect_started signal emits
func test_juice_effect_started_signal():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var signal_emitted = false
	var received_type = ""

	manager.juice_effect_started.connect(func(effect_type: String):
		signal_emitted = true
		received_type = effect_type
	)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)

	# Wait a frame for signal processing
	await get_tree().process_frame

	assert_true(signal_emitted, "juice_effect_started should be emitted")

## Test is_effect_active method
func test_is_effect_active():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Should return false for inactive effects
	var is_active = manager.is_effect_active(CombatJuiceManager.EffectType.SCREEN_SHAKE)
	assert_false(is_active, "Effect should not be active initially")

## Test get_time_scale method
func test_get_time_scale():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var time_scale = manager.get_time_scale()
	assert_eq(time_scale, 1.0, "Default time scale should be 1.0")

## Test set_time_scale method
func test_set_time_scale():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

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
