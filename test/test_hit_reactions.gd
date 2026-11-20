extends GutTest

## Unit tests for hit reactions (issue #1823).
##
## The real player is scenes/player.tscn, which runs
## scripts/character_body_2d.gd and joins the "Player" group in _ready().
## CombatJuiceManager routes HIT_REACTION juice to that node; the old
## "/root/PlayerCharacter" lookup pointed at a node that never existed, so
## every hit reaction was silently dropped.
##
## trigger_combat_juice() returns void, so the contract asserted here is
## the observable one: the juice signals are emitted and the player
## reaction actually runs.

const PLAYER_SCENE: PackedScene = preload("res://scenes/player.tscn")
const PLAYER_SCRIPT = preload("res://scripts/character_body_2d.gd")

var player
var manager
var other_players: Array[Node] = []


func before_each() -> void:
	manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager autoload required")

	player = PLAYER_SCENE.instantiate()
	add_child_autofree(player)
	await get_tree().process_frame

	player.set_physics_process(false)
	other_players.clear()
	# Other suites drop fixtures into the "Player" group; make sure the
	# routing target is the player this test owns.
	for node in get_tree().get_nodes_in_group("Player"):
		if node != player and is_instance_valid(node):
			other_players.append(node)
			node.remove_from_group("Player")


func after_each() -> void:
	for node in other_players:
		if is_instance_valid(node):
			node.add_to_group("Player")
	other_players.clear()
	player = null
	manager = null


## Waits until the reaction is over (or the timeout expires) and reports
## whether the reaction finished.
func _await_reaction_end(is_active: Callable, timeout_ms: int = 2000) -> bool:
	var start: int = Time.get_ticks_msec()
	while is_active.call() and (Time.get_ticks_msec() - start) < timeout_ms:
		await get_tree().process_frame
	return not is_active.call()


## Test trigger_flinch method exists on the player
func test_trigger_flinch_method_exists():
	assert_true(player.has_method("trigger_flinch"),
		"trigger_flinch must exist on the player script")

## Test trigger_stutter method exists on the player
func test_trigger_stutter_method_exists():
	assert_true(player.has_method("trigger_stutter"),
		"trigger_stutter must exist on the player script")

## Test on_damage_taken method routes to the correct reaction
func test_on_damage_taken_routing():
	assert_true(player.has_method("on_damage_taken"),
		"on_damage_taken must exist on the player script")

	var result: Dictionary = player.on_damage_taken(25, "melee")

	assert_true(result.get("success", false), "on_damage_taken must succeed")
	assert_eq(result.get("reaction", ""), "flinch",
		"A light hit must route to the flinch reaction")
	assert_true(result.get("flinch", false), "The flinch must have been triggered")
	assert_true(player.is_flinching(), "The player must be flinching afterwards")

## Test CombatJuiceManager HIT_REACTION routing
func test_combat_juice_hit_reaction_routing():
	watch_signals(manager)
	watch_signals(player)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.HIT_REACTION,
		{"damage": 25, "source": "melee"}
	)

	assert_signal_emitted_with_parameters(manager, "juice_effect_started",
		["hit_reaction", {"damage": 25, "source": "melee"}])
	assert_signal_emitted(manager, "juice_effect_completed")
	assert_signal_emitted(player, "flinch_started")
	assert_true(player.is_flinching(), "The routed hit reaction must reach the player")

## Test flinch effect timing (should be ~200ms)
func test_flinch_timing():
	assert_almost_eq(PLAYER_SCRIPT.FLINCH_DURATION, 0.2, 0.001,
		"The flinch reaction is documented as ~200 ms")

	watch_signals(player)
	var start_time: int = Time.get_ticks_msec()
	player.trigger_flinch()
	var duration: int = Time.get_ticks_msec() - start_time

	# Triggering the reaction must not block the caller.
	assert_true(duration < 500, "Flinch trigger should be fast (<500ms)")
	assert_true(player.is_flinching(), "The flinch must be running after the trigger")

	var finished: bool = await _await_reaction_end(player.is_flinching)
	assert_true(finished, "The flinch must end on its own")
	assert_signal_emitted(player, "flinch_ended")

## Test stutter effect timing (should be ~50ms)
func test_stutter_timing():
	assert_almost_eq(PLAYER_SCRIPT.STUTTER_DURATION, 0.05, 0.001,
		"The stutter reaction is documented as ~50 ms")

	watch_signals(player)
	var start_time: int = Time.get_ticks_msec()
	player.trigger_stutter()
	var duration: int = Time.get_ticks_msec() - start_time

	# Triggering the reaction must not block the caller.
	assert_true(duration < 200, "Stutter trigger should be very fast (<200ms)")
	assert_true(player.is_stuttering(), "The stutter must be running after the trigger")

	var finished: bool = await _await_reaction_end(player.is_stuttering)
	assert_true(finished, "The stutter must end on its own")
	assert_signal_emitted(player, "stutter_ended")

## Test hit reaction with different damage sources
func test_hit_reaction_sources():
	var sources: Array = ["melee", "ranged", "magic"]

	for source in sources:
		watch_signals(player)
		manager.trigger_combat_juice(
			CombatJuiceManager.EffectType.HIT_REACTION,
			{"damage": 25, "source": source}
		)
		assert_signal_emitted(player, "flinch_started")
		assert_true(player.is_flinching(),
			"A hit reaction must run for source: %s" % source)

## Test juice_effect_completed signal for hit reactions
func test_hit_reaction_completion_signal():
	watch_signals(manager)
	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.HIT_REACTION,
		{"damage": 25, "source": "melee"}
	)
	assert_signal_emitted(manager, "juice_effect_completed")
	var args = get_signal_parameters(manager, "juice_effect_completed")
	assert_eq(args[0], "hit_reaction")
	assert_eq(args[1].get("reaction"), "flinch")
	assert_true(args[1].get("success", false))


func _prepare_manual_reaction() -> void:
	player.set_process(false)
	player.body_sprite.modulate = Color(0.4, 0.6, 0.8, 0.7)
	player.body_sprite.scale = Vector2(1.2, 0.8)
	watch_signals(player)


func test_repeated_flinch_restores_original_nonwhite_tint() -> void:
	_prepare_manual_reaction()
	var original: Color = player.body_sprite.modulate
	player.trigger_flinch()
	player._process(0.1)
	player.trigger_flinch()
	assert_eq(player._flinch_time_left, PLAYER_SCRIPT.FLINCH_DURATION)
	player._process(0.21)
	assert_eq(player.body_sprite.modulate, original)
	assert_false(player.is_flinching())
	assert_eq(player.get_hit_reaction(), "")
	assert_signal_emit_count(player, "flinch_started", 2)
	assert_signal_emit_count(player, "flinch_ended", 1)
	player._process(1.0)
	assert_signal_emit_count(player, "flinch_ended", 1)


func test_repeated_stutter_does_not_compound_squash() -> void:
	_prepare_manual_reaction()
	var original: Vector2 = player.body_sprite.scale
	player.trigger_stutter()
	player._process(0.02)
	player.trigger_stutter()
	assert_eq(player.body_sprite.scale, original * PLAYER_SCRIPT.STUTTER_SQUASH_SCALE)
	assert_eq(player._stutter_time_left, PLAYER_SCRIPT.STUTTER_DURATION)
	player._process(0.06)
	assert_eq(player.body_sprite.scale, original)
	assert_false(player.is_stuttering())
	assert_eq(player.get_hit_reaction(), "")
	assert_signal_emit_count(player, "stutter_started", 2)
	assert_signal_emit_count(player, "stutter_ended", 1)


func test_overlap_keeps_remaining_flinch_then_restores_both_properties() -> void:
	_prepare_manual_reaction()
	var original_color: Color = player.body_sprite.modulate
	var original_scale: Vector2 = player.body_sprite.scale
	player.trigger_flinch()
	player.trigger_stutter()
	player.trigger_flinch()
	assert_eq(player.get_hit_reaction(), "stutter")
	player._process(0.06)
	assert_eq(player.get_hit_reaction(), "flinch")
	assert_eq(player.body_sprite.scale, original_scale)
	assert_ne(player.body_sprite.modulate, original_color)
	player._process(0.2)
	assert_eq(player.body_sprite.modulate, original_color)
	assert_eq(player.get_hit_reaction(), "")
	assert_signal_emit_count(player, "flinch_ended", 1)
	assert_signal_emit_count(player, "stutter_ended", 1)


func test_completed_reaction_captures_new_baseline_for_next_cycle() -> void:
	_prepare_manual_reaction()
	player.trigger_flinch()
	player.trigger_stutter()
	player._process(1.0)
	var new_color := Color(0.7, 0.8, 0.9, 0.6)
	var new_scale := Vector2(0.7, 1.1)
	player.body_sprite.modulate = new_color
	player.body_sprite.scale = new_scale
	player.trigger_stutter()
	player.trigger_flinch()
	player.trigger_stutter()
	player._process(1.0)
	assert_eq(player.body_sprite.modulate, new_color)
	assert_eq(player.body_sprite.scale, new_scale)
	assert_eq(player.get_hit_reaction(), "")
