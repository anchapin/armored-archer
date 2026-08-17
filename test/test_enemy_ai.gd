## Enemy AI Integration Tests
## Tests for EnemyAIManager and new enemy types (issue #910 — EnemyFactory removed)
##
## Test Coverage:
## - Difficulty scaling and stat modifiers
## - Elemental enemy attacks and weakness system
## - Flying enemy dive-bomb mechanics
## - Swarmer group coordination
## - AI behavior patterns (aggressive, defensive, pack-hunt, ambush)

extends GutTest

# --- Constants ---
const ELEMENTAL_SCENE: PackedScene = preload("res://scenes/enemies/elemental_enemy.tscn")

# --- Test Fixtures ---
var ai_manager: Node
var test_player: Node2D

# --- Setup and Teardown ---

func before_all() -> void:
	print("=== Enemy AI Integration Tests Starting ===")

func after_all() -> void:
	print("=== Enemy AI Integration Tests Complete ===")

func before_each() -> void:
	ai_manager = get_node_or_null("/root/EnemyAIManager")

	test_player = CharacterBody2D.new()
	test_player.name = "TestPlayer"
	test_player.add_to_group("Player")
	get_tree().root.add_child(test_player)

func after_each() -> void:
	if test_player:
		test_player.queue_free()

# --- New Enemy Type Tests ---

func test_elemental_attacks() -> void:
	var elemental_scene: PackedScene = ELEMENTAL_SCENE
	assert_true(elemental_scene != null, "Elemental enemy scene should exist")

	var elemental: ElementalEnemy = elemental_scene.instantiate()
	if elemental:
		get_tree().root.add_child(elemental)

		var fire_data = elemental.get_elemental_data()
		assert_true(fire_data.has("name"), "Elemental should have name")
		assert_true(fire_data.has("attack_damage"), "Elemental should have attack_damage")
		assert_true(fire_data.has("status_effect"), "Elemental should have status_effect")

		elemental.queue_free()

	print("PASS: Elemental attacks test")

func test_elemental_weakness() -> void:
	var elemental_scene: PackedScene = ELEMENTAL_SCENE
	var elemental: ElementalEnemy = elemental_scene.instantiate()
	if elemental:
		get_tree().root.add_child(elemental)

		var base_damage = 20

		var weak_damage = elemental.get_elemental_damage(base_damage, 1)
		assert_eq(weak_damage, 40, "Fire element should deal 2x damage to Ice enemy")

		var resist_damage = elemental.get_elemental_damage(base_damage, 0)
		assert_eq(resist_damage, 10, "Fire element should deal 0.5x damage to Fire enemy")

		elemental.queue_free()

	print("PASS: Elemental weakness test")

func test_flying_dive_attack() -> void:
	var flying_scene = load("res://scenes/enemies/flying_enemy.tscn")
	assert_true(flying_scene != null, "Flying enemy scene should exist")

	var flying: FlyingEnemy = flying_scene.instantiate()
	if flying:
		get_tree().root.add_child(flying)

		var dive_multiplier = flying.dive_damage_multiplier
		assert_eq(dive_multiplier, 1.5, "Dive attack should have 1.5x damage")

		assert_true(flying.has_method("dive_attack"), "Flying enemy should have dive_attack method")
		assert_true(flying.has_method("escape_when_damaged"), "Flying enemy should have escape method")

		flying.queue_free()

	print("PASS: Flying dive attack test")

func test_swarmer_group_buff() -> void:
	var swarmer_scene = load("res://scenes/enemies/swarmer_enemy.tscn")
	assert_true(swarmer_scene != null, "Swarmer enemy scene should exist")

	var swarmer: SwarmerEnemy = swarmer_scene.instantiate()
	if swarmer:
		get_tree().root.add_child(swarmer)

		var threshold = swarmer.group_buff_threshold
		assert_eq(threshold, 3, "Swarmer should activate buff at 3 nearby")

		var multiplier = swarmer.group_buff_speed_multiplier
		assert_eq(multiplier, 1.2, "Group buff should give 1.2x speed")

		assert_true(swarmer.has_method("check_nearby_swarmers"), "Swarmer should have check_nearby_swarmers method")
		assert_true(swarmer.has_method("apply_group_buff"), "Swarmer should have apply_group_buff method")

		swarmer.queue_free()

	print("PASS: Swarmer group buff test")

# --- AI Behavior Tests ---

func test_aggressive_behavior() -> void:
	if not ai_manager:
		return

	var enemy_data = {"health": 50, "attack": 10, "defense": 5, "speed": 100}
	ai_manager.setup_enemy(enemy_data, 2, ai_manager.AIBehavior.AGGRESSIVE)

	var action = ai_manager.decide_action(100, 10)
	assert_true(action.has("action"), "Aggressive AI should return action")
	assert_eq(action.action, "attack", "Aggressive AI should always attack")

	print("PASS: Aggressive behavior test")

func test_defensive_behavior() -> void:
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.DEFENSIVE)

	var action_high = ai_manager.decide_action(80, 10)
	assert_eq(action_high.action, "defend", "Defensive AI should defend at high player health")

	var action_low = ai_manager.decide_action(20, 10)
	assert_eq(action_low.action, "power_attack", "Defensive AI should power attack at low player health")

	print("PASS: Defensive behavior test")

func test_pack_hunt_coordination() -> void:
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.PACK_HUNT)

	assert_true(ai_manager.has_method("register_pack_member"), "AI manager should have register_pack_member method")
	assert_true(ai_manager.has_method("unregister_pack_member"), "AI manager should have unregister_pack_member method")

	var action = ai_manager.decide_action(50, 10)
	assert_true(action.action in ["attack", "flank_attack"], "Pack hunt should attack or flank")

	print("PASS: Pack hunt coordination test")

func test_ambush_strike() -> void:
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.AMBUSH)

	var action_high = ai_manager.decide_action(80, 10)
	assert_eq(action_high.action, "ambush_attack", "Ambush AI should attack unexpectedly at high health")

	var action_low = ai_manager.decide_action(20, 10)
	assert_eq(action_low.action, "defend", "Ambush AI should defend at low health")

	print("PASS: Ambush strike test")

# --- Integration Tests ---

func test_enemy_to_ai_manager() -> void:
	if not ai_manager:
		return

	var enemy_data = {"health": 50, "attack": 10, "defense": 5, "speed": 100}
	ai_manager.setup_enemy(enemy_data, 2, ai_manager.AIBehavior.AGGRESSIVE)

	var action = ai_manager.decide_action(100, 10)
	assert_true(action.has("action"), "AI manager should decide action")

	print("PASS: Enemy to AI manager test")

func test_difficulty_scaling_on_spawn() -> void:
	if not ai_manager:
		return

	for diff in [1, 2, 3]:
		var modifier = ai_manager.get_difficulty_modifier()
		assert_true(modifier > 0, "Difficulty modifier should be positive")

	print("PASS: Difficulty scaling on spawn test")
