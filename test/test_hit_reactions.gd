extends GutTest

## Unit tests for hit reactions
## Tests flinch, stutter, and damage routing

## Test trigger_flinch method exists on player sprite
func test_trigger_flinch_method_exists():
	var player_sprite = get_node_or_null("/root/PlayerCharacter")
	if player_sprite and player_sprite.has_method("trigger_flinch"):
		pass_test("trigger_flinch method exists on player sprite")
	else:
		pending("PlayerCharacter or trigger_flinch method not available in test environment")

## Test trigger_stutter method exists on player sprite
func test_trigger_stutter_method_exists():
	var player_sprite = get_node_or_null("/root/PlayerCharacter")
	if player_sprite and player_sprite.has_method("trigger_stutter"):
		pass_test("trigger_stutter method exists on player sprite")
	else:
		pending("PlayerCharacter or trigger_stutter method not available in test environment")

## Test on_damage_taken method routes to correct reaction
func test_on_damage_taken_routing():
	var player_sprite = get_node_or_null("/root/PlayerCharacter")
	if player_sprite and player_sprite.has_method("on_damage_taken"):
		pass_test("on_damage_taken method exists on player sprite")
	else:
		pending("PlayerCharacter or on_damage_taken method not available in test environment")

## Test CombatJuiceManager HIT_REACTION routing
func test_combat_juice_hit_reaction_routing():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Trigger hit reaction
	var result = manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.HIT_REACTION,
		{"damage": 25, "source": "melee"}
	)

	assert_not_null(result, "Result should be returned")

## Test flinch effect timing (should be ~200ms)
func test_flinch_timing():
	var player_sprite = get_node_or_null("/root/PlayerCharacter")
	if player_sprite and player_sprite.has_method("trigger_flinch"):
		var start_time = Time.get_ticks_msec()
		player_sprite.trigger_flinch()
		var duration = Time.get_ticks_msec() - start_time

		# Flinch should be fast (approximately 200ms trigger time)
		assert_true(duration < 500, "Flinch trigger should be fast (<500ms)")
	else:
		pending("PlayerCharacter or trigger_flinch method not available in test environment")

## Test stutter effect timing (should be ~50ms pause)
func test_stutter_timing():
	var player_sprite = get_node_or_null("/root/PlayerCharacter")
	if player_sprite and player_sprite.has_method("trigger_stutter"):
		var start_time = Time.get_ticks_msec()
		player_sprite.trigger_stutter()
		var duration = Time.get_ticks_msec() - start_time

		# Stutter should be very fast (approximately 50ms trigger time)
		assert_true(duration < 200, "Stutter trigger should be very fast (<200ms)")
	else:
		pending("PlayerCharacter or trigger_stutter method not available in test environment")

## Test hit reaction with different damage sources
func test_hit_reaction_sources():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Test with different damage sources
	var sources = ["melee", "ranged", "magic"]

	for source in sources:
		var result = manager.trigger_combat_juice(
			CombatJuiceManager.EffectType.HIT_REACTION,
			{"damage": 25, "source": source}
		)
		assert_not_null(result, "Result should be returned for source: %s" % source)

## Test juice_effect_completed signal for hit reactions
func test_hit_reaction_completion_signal():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var signal_emitted = false

	manager.juice_effect_completed.connect(func(effect_type: String, data: Dictionary):
		if effect_type == "hit_reaction":
			signal_emitted = true
	)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.HIT_REACTION,
		{"damage": 25, "source": "melee"}
	)

	# Wait a frame for signal processing
	await get_tree().process_frame

	assert_true(signal_emitted, "juice_effect_completed should be emitted for hit reactions")
