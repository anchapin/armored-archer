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


func before_each() -> void:
	manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager autoload required")

	player = PLAYER_SCENE.instantiate()
	add_child_autofree(player)
	await get_tree().process_frame

	# Other suites drop fixtures into the "Player" group; make sure the
	# routing target is the player this test owns.
	for node in get_tree().get_nodes_in_group("Player"):
		if node != player and is_instance_valid(node):
			node.remove_from_group("Player")


func after_each() -> void:
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

	assert_signal_emitted_with_parameters(manager, "juice_effect_started", ["hit_reaction"])
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
	_completed_types.clear()
	manager.juice_effect_completed.connect(_on_juice_effect_completed)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.HIT_REACTION,
		{"damage": 25, "source": "melee"}
	)

	# Wait a frame for signal processing
	await get_tree().process_frame

	assert_true(_completed_types.has("hit_reaction"),
		"juice_effect_completed should be emitted for hit reactions")


## Collects the effect types reported by the juice manager.
func _on_juice_effect_completed(effect_type: String, _data: Dictionary) -> void:
	_completed_types.append(effect_type)
