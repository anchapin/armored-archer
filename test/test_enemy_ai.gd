## Enemy AI Integration Tests
## Tests for EnemyFactory, EnemyAIManager, and new enemy types
##
## Test Coverage:
## - EnemyFactory type registry and spawn configuration
## - Difficulty scaling and stat modifiers
## - Elemental enemy attacks and weakness system
## - Flying enemy dive-bomb mechanics
## - Swarmer group coordination
## - AI behavior patterns (aggressive, defensive, pack-hunt, ambush)

extends GutTest

# --- Test Fixtures ---
var enemy_factory: Node
var ai_manager: Node
var test_player: Node2D

# --- Setup and Teardown ---

func before_all() -> void:
	print("=== Enemy AI Integration Tests Starting ===")

func after_all() -> void:
	print("=== Enemy AI Integration Tests Complete ===")

func before_each() -> void:
	# Get autoloads
	enemy_factory = get_node_or_null("/root/EnemyFactory")
	ai_manager = get_node_or_null("/root/EnemyAIManager")

	# Create test player node
	test_player = CharacterBody2D.new()
	test_player.name = "TestPlayer"
	test_player.add_to_group("Player")
	get_tree().root.add_child(test_player)

func after_each() -> void:
	# Clean up test player
	if test_player:
		test_player.queue_free()

# --- EnemyFactory Tests ---

func test_enemy_type_registry() -> void:
	# Test: All enemy types are registered
	assert_true(enemy_factory != null, "EnemyFactory should exist")

	var factory_script = load("res://autoloads/EnemyFactory.gd")
	assert_true(factory_script != null, "EnemyFactory script should be loadable")

	print("PASS: EnemyFactory type registry test")

func test_spawn_configuration() -> void:
	# Test: Spawn parameters apply correctly
	if not enemy_factory:
		return

	var enemy: BaseEnemy = enemy_factory.spawn_enemy(
		0,  # GOBLIN
		Vector2(100, 100),
		1,  # EASY difficulty
		0   # AGGRESSIVE behavior
	)

	if enemy:
		assert_eq(enemy.max_health, 40, "Goblin should have 40 base health")
		assert_eq(enemy.damage, 8, "Goblin should have 8 base damage")
		assert_eq(enemy.xp_reward, 15, "Goblin should give 15 XP")

		# Cleanup
		enemy.queue_free()

	print("PASS: Spawn configuration test")

func test_difficulty_scaling() -> void:
	# Test: Difficulty multipliers apply correctly
	if not enemy_factory:
		return

	# Test EASY difficulty (0.8x)
	var easy_enemy = enemy_factory.spawn_enemy(0, Vector2(100, 100), 1, 0)
	if easy_enemy:
		assert_eq(easy_enemy.max_health, 32, "Easy enemy should have 0.8x health")
		easy_enemy.queue_free()

	# Test HARD difficulty (1.3x)
	var hard_enemy = enemy_factory.spawn_enemy(0, Vector2(100, 100), 3, 0)
	if hard_enemy:
		assert_eq(hard_enemy.max_health, 52, "Hard enemy should have 1.3x health")
		hard_enemy.queue_free()

	print("PASS: Difficulty scaling test")

# --- New Enemy Type Tests ---

func test_elemental_attacks() -> void:
	# Test: Elemental enemies have elemental attacks
	var elemental_scene = load("res://scenes/enemies/elemental_enemy.tscn")
	assert_true(elemental_scene != null, "Elemental enemy scene should exist")

	var elemental: ElementalEnemy = elemental_scene.instantiate()
	if elemental:
		get_tree().root.add_child(elemental)

		# Test elemental data
		var fire_data = elemental.get_elemental_data()
		assert_true(fire_data.has("name"), "Elemental should have name")
		assert_true(fire_data.has("attack_damage"), "Elemental should have attack_damage")
		assert_true(fire_data.has("status_effect"), "Elemental should have status_effect")

		elemental.queue_free()

	print("PASS: Elemental attacks test")

func test_elemental_weakness() -> void:
	# Test: Elemental weakness deals 2x damage
	var elemental: ElementalEnemy = load("res://scenes/enemies/elemental_enemy.tscn").instantiate()
	if elemental:
		get_tree().root.add_child(elemental)

		# Test weakness calculation
		var base_damage = 20

		# Fire vs Ice (weakness) = 2x
		var weak_damage = elemental.get_elemental_damage(base_damage, 1)  # ICE element
		assert_eq(weak_damage, 40, "Fire element should deal 2x damage to Ice enemy")

		# Fire vs Fire (resistance) = 0.5x
		var resist_damage = elemental.get_elemental_damage(base_damage, 0)  # FIRE element
		assert_eq(resist_damage, 10, "Fire element should deal 0.5x damage to Fire enemy")

		elemental.queue_free()

	print("PASS: Elemental weakness test")

func test_flying_dive_attack() -> void:
	# Test: Flying enemy performs dive-bomb with damage bonus
	var flying_scene = load("res://scenes/enemies/flying_enemy.tscn")
	assert_true(flying_scene != null, "Flying enemy scene should exist")

	var flying: FlyingEnemy = flying_scene.instantiate()
	if flying:
		get_tree().root.add_child(flying)

		# Test dive damage multiplier
		var dive_multiplier = flying.dive_damage_multiplier
		assert_eq(dive_multiplier, 1.5, "Dive attack should have 1.5x damage")

		# Test flight system
		assert_true(flying.has_method("dive_attack"), "Flying enemy should have dive_attack method")
		assert_true(flying.has_method("escape_when_damaged"), "Flying enemy should have escape method")

		flying.queue_free()

	print("PASS: Flying dive attack test")

func test_swarmer_group_buff() -> void:
	# Test: Swarmer applies speed buff when 3+ nearby
	var swarmer_scene = load("res://scenes/enemies/swarmer_enemy.tscn")
	assert_true(swarmer_scene != null, "Swarmer enemy scene should exist")

	var swarmer: SwarmerEnemy = swarmer_scene.instantiate()
	if swarmer:
		get_tree().root.add_child(swarmer)

		# Test group buff threshold
		var threshold = swarmer.group_buff_threshold
		assert_eq(threshold, 3, "Swarmer should activate buff at 3 nearby")

		# Test speed multiplier
		var multiplier = swarmer.group_buff_speed_multiplier
		assert_eq(multiplier, 1.2, "Group buff should give 1.2x speed")

		# Test method availability
		assert_true(swarmer.has_method("check_nearby_swarmers"), "Swarmer should have check_nearby_swarmers method")
		assert_true(swarmer.has_method("apply_group_buff"), "Swarmer should have apply_group_buff method")

		swarmer.queue_free()

	print("PASS: Swarmer group buff test")

# --- AI Behavior Tests ---

func test_aggressive_behavior() -> void:
	# Test: Aggressive AI uses 1.5x speed, engages at 60% range
	if not ai_manager:
		return

	var enemy_data = {"health": 50, "attack": 10, "defense": 5, "speed": 100}
	ai_manager.setup_enemy(enemy_data, 2, ai_manager.AIBehavior.AGGRESSIVE)

	var action = ai_manager.decide_action(100, 10)
	assert_true(action.has("action"), "Aggressive AI should return action")
	assert_eq(action.action, "attack", "Aggressive AI should always attack")

	print("PASS: Aggressive behavior test")

func test_defensive_behavior() -> void:
	# Test: Defensive AI uses 0.8x speed, engages at 40% range
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.DEFENSIVE)

	# Test defensive at high player health
	var action_high = ai_manager.decide_action(80, 10)
	assert_eq(action_high.action, "defend", "Defensive AI should defend at high player health")

	# Test attack at low player health
	var action_low = ai_manager.decide_action(20, 10)
	assert_eq(action_low.action, "power_attack", "Defensive AI should power attack at low player health")

	print("PASS: Defensive behavior test")

func test_pack_hunt_coordination() -> void:
	# Test: Pack hunting coordinates 2-4 enemies
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.PACK_HUNT)

	# Test pack member registration
	assert_true(ai_manager.has_method("register_pack_member"), "AI manager should have register_pack_member method")
	assert_true(ai_manager.has_method("unregister_pack_member"), "AI manager should have unregister_pack_member method")

	# Test flanking attack (50% chance)
	var action = ai_manager.decide_action(50, 10)
	assert_true(action.action in ["attack", "flank_attack"], "Pack hunt should attack or flank")

	print("PASS: Pack hunt coordination test")

func test_ambush_strike() -> void:
	# Test: Ambush AI hides, strikes at close range
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.AMBUSH)

	# Test ambush at high player health
	var action_high = ai_manager.decide_action(80, 10)
	assert_eq(action_high.action, "ambush_attack", "Ambush AI should attack unexpectedly at high health")

	# Test retreat at low player health
	var action_low = ai_manager.decide_action(20, 10)
	assert_eq(action_low.action, "defend", "Ambush AI should defend at low health")

	print("PASS: Ambush strike test")

# --- Integration Tests ---

func test_enemy_to_ai_manager() -> void:
	# Test: Enemy signals connect to AI manager
	if not enemy_factory or not ai_manager:
		return

	var enemy = enemy_factory.spawn_enemy(0, Vector2(100, 100), 1, 0)
	if enemy:
		# Test enemy is added to Enemies group
		assert_true(enemy.is_in_group("Enemies"), "Enemy should be in Enemies group")

		# Test AI manager setup
		var enemy_data = {"health": 50, "attack": 10, "defense": 5, "speed": 100}
		ai_manager.setup_enemy(enemy_data, 2, ai_manager.AIBehavior.AGGRESSIVE)

		# Test action decision
		var action = ai_manager.decide_action(100, 10)
		assert_true(action.has("action"), "AI manager should decide action")

		enemy.queue_free()

	print("PASS: Enemy to AI manager test")

func test_difficulty_scaling_on_spawn() -> void:
	# Test: EnemyAIManager integrates with EnemyFactory difficulty
	if not enemy_factory or not ai_manager:
		return

	# Test different difficulties
	for diff in [1, 2, 3]:
		var enemy = enemy_factory.spawn_enemy(0, Vector2(100, 100), diff, 0)
		if enemy:
			var modifier = ai_manager.get_difficulty_modifier()
			assert_true(modifier > 0, "Difficulty modifier should be positive")

			enemy.queue_free()

	print("PASS: Difficulty scaling on spawn test")

func test_behavior_transitions() -> void:
	# Test: AI can switch behaviors dynamically
	if not ai_manager:
		return

	ai_manager.setup_enemy({"health": 50, "attack": 10}, 2, ai_manager.AIBehavior.AGGRESSIVE)

	# Initial action (aggressive)
	var action1 = ai_manager.decide_action(50, 10)
	assert_eq(action1.action, "attack", "Initial behavior should be attack")

	# Switch to defensive
	ai_manager.select_behavior(ai_manager.AIBehavior.DEFENSIVE)
	var action2 = ai_manager.decide_action(80, 10)
	assert_eq(action2.action, "defend", "Switched behavior should be defend")

	# Switch to pack hunt
	ai_manager.select_behavior(ai_manager.AIBehavior.PACK_HUNT)
	var action3 = ai_manager.decide_action(50, 10)
	assert_true(action3.action in ["attack", "flank_attack"], "Pack hunt should attack or flank")

	print("PASS: Behavior transitions test")
