extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running PvE Difficulty Integration Tests ===\n")
	await run_tests()
	print("\n=== PvE Difficulty Integration Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func run_tests() -> void:
	await test_difficulty_modifier_bounds()
	await test_ai_behavior_selection_per_enemy_type()
	await test_aggressive_ai_attacks_low_health_player()
	await test_difficulty_modifier_clamped_on_transition()
	await test_track_match_outcome_adjusts_streaks()
	print("\nAll PvE difficulty integration tests complete.")

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func _create_dynamic_difficulty_manager() -> Node:
	var ddm = load("res://autoloads/DynamicDifficultyManager.gd").new()
	add_child(ddm)
	return ddm

func _create_enemy_ai_manager() -> Node:
	var ai = load("res://autoloads/EnemyAIManager.gd").new()
	add_child(ai)
	return ai

func test_difficulty_modifier_bounds() -> void:
	var ddm = _create_dynamic_difficulty_manager()

	ddm.set_difficulty_modifier(0.5)
	if ddm.current_modifier > 0.20:
		_fail("test_difficulty_modifier_bounds", "Modifier should be clamped to MAX_MODIFIER (0.20)")
		ddm.queue_free()
		return

	ddm.set_difficulty_modifier(-0.5)
	if ddm.current_modifier < -0.20:
		_fail("test_difficulty_modifier_bounds", "Modifier should be clamped to MIN_MODIFIER (-0.20)")
		ddm.queue_free()
		return

	ddm.set_difficulty_modifier(0.10)
	if absf(ddm.current_modifier - 0.10) > 0.001:
		_fail("test_difficulty_modifier_bounds", "Modifier within bounds should be set directly")
		ddm.queue_free()
		return

	_pass("test_difficulty_modifier_bounds")
	ddm.queue_free()

func test_ai_behavior_selection_per_enemy_type() -> void:
	var ai = _create_enemy_ai_manager()

	# Test enemy type -> behavior mapping
	# Scout(1), Speed(2), Swarmer(3) -> AGGRESSIVE
	# Tank(4), Guardian(5) -> DEFENSIVE
	# Brute(6) -> PACK_HUNT
	# Necromancer(7) -> AMBUSH

	var scout_behavior = ai.get_base_behavior(1)
	if scout_behavior != ai.AIBehavior.AGGRESSIVE:
		_fail("test_ai_behavior_scout", "Scout should use AGGRESSIVE behavior, got: %d" % scout_behavior)
		ai.queue_free()
		return

	var tank_behavior = ai.get_base_behavior(4)
	if tank_behavior != ai.AIBehavior.DEFENSIVE:
		_fail("test_ai_behavior_tank", "Tank should use DEFENSIVE behavior, got: %d" % tank_behavior)
		ai.queue_free()
		return

	var brute_behavior = ai.get_base_behavior(6)
	if brute_behavior != ai.AIBehavior.PACK_HUNT:
		_fail("test_ai_behavior_brute", "Brute should use PACK_HUNT behavior, got: %d" % brute_behavior)
		ai.queue_free()
		return

	var necro_behavior = ai.get_base_behavior(7)
	if necro_behavior != ai.AIBehavior.AMBUSH:
		_fail("test_ai_behavior_necro", "Necromancer should use AMBUSH behavior, got: %d" % necro_behavior)
		ai.queue_free()
		return

	_pass("test_ai_behavior_selection_per_enemy_type")
	ai.queue_free()

func test_aggressive_ai_attacks_low_health_player() -> void:
	var ai = _create_enemy_ai_manager()

	var enemy_data = {
		"health": 50,
		"damage": 10,
		"speed": 100,
		"type": "scout"
	}
	ai.setup_enemy(enemy_data, 1, ai.AIBehavior.AGGRESSIVE)

	# Test with low health player (below 30%)
	var action = ai.decide_action(20, 5)

	if not action.has("action"):
		_fail("test_aggressive_ai_attacks_low_health", "Action should have action key")
		ai.queue_free()
		return

	var action_type = action["action"]
	if action_type != "attack" and action_type != "power_attack":
		_fail("test_aggressive_ai_attacks_low_health", "AGGRESSIVE AI should attack low HP player, got: %s" % str(action_type))
		ai.queue_free()
		return

	_pass("test_aggressive_ai_attacks_low_health_player")
	ai.queue_free()

func test_difficulty_modifier_clamped_on_transition() -> void:
	var ddm = _create_dynamic_difficulty_manager()

	# Simulate rapid consecutive wins
	for i in range(10):
		ddm.track_match_outcome(true, "pve")

	# Modifier should still be within bounds
	if ddm.current_modifier > ddm.MAX_MODIFIER:
		_fail("test_difficulty_modifier_clamped", "Modifier exceeded MAX after many wins: %f" % ddm.current_modifier)
		ddm.queue_free()
		return

	# Simulate rapid consecutive losses
	ddm.reset_difficulty()
	for i in range(10):
		ddm.track_match_outcome(false, "pve")

	if ddm.current_modifier < ddm.MIN_MODIFIER:
		_fail("test_difficulty_modifier_clamped", "Modifier fell below MIN after many losses: %f" % ddm.current_modifier)
		ddm.queue_free()
		return

	_pass("test_difficulty_modifier_clamped_on_transition")
	ddm.queue_free()

func test_track_match_outcome_adjusts_streaks() -> void:
	var ddm = _create_dynamic_difficulty_manager()

	# Track 3 wins
	ddm.track_match_outcome(true, "pve")
	ddm.track_match_outcome(true, "pve")
	ddm.track_match_outcome(true, "pve")

	if ddm.win_streak != 3:
		_fail("test_track_match_outcome_streaks", "Win streak should be 3, got: %d" % ddm.win_streak)
		ddm.queue_free()
		return

	# Track a loss - win streak resets, lose streak starts
	ddm.track_match_outcome(false, "pve")

	if ddm.win_streak != 0:
		_fail("test_track_match_outcome_streaks_loss", "Win streak should reset to 0 after loss, got: %d" % ddm.win_streak)
		ddm.queue_free()
		return

	if ddm.lose_streak != 1:
		_fail("test_track_match_outcome_streaks_loss", "Lose streak should be 1, got: %d" % ddm.lose_streak)
		ddm.queue_free()
		return

	_pass("test_track_match_outcome_adjusts_streaks")
	ddm.queue_free()
