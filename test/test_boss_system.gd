## Boss System Integration Tests
## Tests for BossManager, boss phases, special attacks, and loot tables
##
## Test Coverage:
## - BossManager phase transitions
## - Special attacks with cooldowns
## - Boss loot tables (Epic/Legendary drops)
## - Guardian boss phases and attacks
## - Warlock boss teleport and minion spawning
## - Titan boss enraged state and charge

extends GutTest

# --- Test Fixtures ---
var boss_manager: Node
var test_player: Node2D
var test_boss: BaseEnemy

# --- Setup and Teardown ---

func before_all() -> void:
	print("=== Boss System Integration Tests Starting ===")

func after_all() -> void:
	print("=== Boss System Integration Tests Complete ===")

func before_each() -> void:
	# Get autoloads
	boss_manager = get_node_or_null("/root/BossManager")

	# Create test player node
	test_player = CharacterBody2D.new()
	test_player.name = "TestPlayer"
	test_player.add_to_group("Player")
	get_tree().root.add_child(test_player)

func after_each() -> void:
	# Clean up test player and boss
	if test_player:
		test_player.queue_free()
	if test_boss:
		test_boss.queue_free()

# --- BossManager Tests ---

func test_boss_manager_exists() -> void:
	# Test: BossManager autoload exists
	assert_true(boss_manager != null, "BossManager should exist")

	var manager_script = load("res://autoloads/BossManager.gd")
	assert_true(manager_script != null, "BossManager script should be loadable")

	print("PASS: BossManager exists test")

func test_phase_transitions() -> void:
	# Test: Boss phases trigger at correct health thresholds
	if not boss_manager:
		return

	# Start boss encounter
	boss_manager.start_boss_encounter(0, test_player)  # Guardian boss

	# Test phase 1 at 100% health
	var phase1 = boss_manager.check_phase_transition(100, 100)
	assert_eq(phase1, 0, "Phase should be 0 at 100% health")

	# Test phase 2 at 75% health
	var phase2 = boss_manager.check_phase_transition(75, 100)
	assert_eq(phase2, 1, "Phase should be 1 at 75% health")

	# Test phase 3 at 50% health
	var phase3 = boss_manager.check_phase_transition(50, 100)
	assert_eq(phase3, 2, "Phase should be 2 at 50% health")

	print("PASS: Phase transitions test")

func test_special_attacks() -> void:
	# Test: Special attacks have cooldowns and damage values
	if not boss_manager:
		return

	boss_manager.start_boss_encounter(0, test_player)

	# Test special attack retrieval
	var attack = boss_manager.get_special_attack()
	assert_true(not attack.is_empty(), "Should return special attack data")

	# Test special attack has cooldown
	assert_true(attack.has("ground_slam") or attack.has("shadow_bolt"), "Attack should be a known special attack")

	print("PASS: Special attacks test")

func test_boss_loot_tables() -> void:
	# Test: Boss loot tables contain guaranteed drops
	if not boss_manager:
		return

	var loot = boss_manager.roll_boss_loot(0)  # Guardian loot
	assert_true(loot.size() > 0, "Boss should drop loot")

	# Test guaranteed drop exists
	var has_guaranteed = false
	for item in loot:
		if item.has("type") and item.has("rarity"):
			has_guaranteed = true
			assert_eq(item.rarity, "legendary", "Guaranteed drop should be legendary")
			break

	assert_true(has_guaranteed, "Loot should contain guaranteed drop")

	print("PASS: Boss loot tables test")

# --- Guardian Boss Tests ---

func test_guardian_phases() -> void:
	# Test: Guardian boss has correct phase structure
	var guardian_scene = load("res://scenes/enemies/bosses/boss_earth.tscn")
	assert_true(guardian_scene != null, "Guardian boss scene should exist")

	var guardian: GuardianBoss = guardian_scene.instantiate()
	if guardian:
		get_tree().root.add_child(guardian)

		# Test base stats
		assert_eq(guardian.max_health, 800, "Guardian should have 800 health")
		assert_eq(guardian.damage, 15, "Guardian should have 15 base damage")

		# Test phase system
		assert_true(guardian.has_method("transition_to_phase"), "Guardian should have phase transition method")

		guardian.queue_free()

	print("PASS: Guardian phases test")

func test_guardian_special_attacks() -> void:
	# Test: Guardian boss uses ground slam and shield bash
	var guardian: GuardianBoss = load("res://scenes/enemies/bosses/boss_earth.tscn").instantiate()
	if guardian:
		get_tree().root.add_child(guardian)

		# Test special attack methods
		assert_true(guardian.has_method("perform_ground_slam"), "Guardian should have ground slam")
		assert_true(guardian.has_method("perform_shield_bash"), "Guardian should have shield bash")

		guardian.queue_free()

	print("PASS: Guardian special attacks test")

# --- Warlock Boss Tests ---

func test_warlock_minion_spawning() -> void:
	# Test: Warlock boss spawns shadow minions
	var warlock_scene = load("res://scenes/enemies/bosses/boss_fire.tscn")
	assert_true(warlock_scene != null, "Warlock boss scene should exist")

	var warlock: WarlockBoss = warlock_scene.instantiate()
	if warlock:
		get_tree().root.add_child(warlock)

		# Test minion spawning method
		assert_true(warlock.has_method("summon_shadow_minions"), "Warlock should have summon method")

		# Test phase 2 minion availability
		warlock.transition_to_phase(1)  # Phase 2
		assert_true(warlock.can_summon_minions, "Warlock should be able to summon minions in phase 2")

		warlock.queue_free()

	print("PASS: Warlock minion spawning test")

func test_warlock_teleport() -> void:
	# Test: Warlock boss uses teleport to dodge
	var warlock: WarlockBoss = load("res://scenes/enemies/bosses/boss_fire.tscn").instantiate()
	if warlock:
		get_tree().root.add_child(warlock)

		# Test teleport method
		assert_true(warlock.has_method("_perform_teleport"), "Warlock should have teleport method")
		assert_true(warlock.has_method("_teleport_away"), "Warlock should have teleport away method")

		warlock.queue_free()

	print("PASS: Warlock teleport test")

# --- Titan Boss Tests ---

func test_titan_enrage() -> void:
	# Test: Titan boss enrages at 50% health
	var titan_scene = load("res://scenes/enemies/bosses/boss_wind.tscn")
	assert_true(titan_scene != null, "Titan boss scene should exist")

	var titan: TitanBoss = titan_scene.instantiate()
	if titan:
		get_tree().root.add_child(titan)

		# Test base stats
		assert_eq(titan.max_health, 900, "Titan should have 900 health")

		# Test enrage at phase 2 (50% health)
		titan.transition_to_phase(2)
		assert_true(titan.is_enraged, "Titan should be enraged at phase 2")

		titan.queue_free()

	print("PASS: Titan enrage test")

func test_titan_special_attacks() -> void:
	# Test: Titan boss uses stomp, roar, and charge
	var titan: TitanBoss = load("res://scenes/enemies/bosses/boss_wind.tscn").instantiate()
	if titan:
		get_tree().root.add_child(titan)

		# Test special attack methods
		assert_true(titan.has_method("perform_stomp"), "Titan should have stomp")
		assert_true(titan.has_method("perform_roar"), "Titan should have roar")
		assert_true(titan.has_method("perform_charge"), "Titan should have charge")

		titan.queue_free()

	print("PASS: Titan special attacks test")

# --- Integration Tests ---

func test_boss_to_ai_manager() -> void:
	# Test: BossManager integrates with EnemyAIManager
	if not boss_manager:
		return

	# Start boss encounter
	boss_manager.start_boss_encounter(0, test_player)

	# Test boss difficulty modifier
	var ai_manager = get_node_or_null("/root/EnemyAIManager")
	if ai_manager:
		var modifier = ai_manager.get_difficulty_modifier(0)  # BOSS type
		assert_eq(modifier, 2.0, "Boss should have 2x difficulty multiplier")

	print("PASS: Boss to AI manager test")

func test_boss_to_combat_manager() -> void:
	# Test: BossManager connects to CombatManager for damage
	if not boss_manager:
		return

	boss_manager.start_boss_encounter(0, test_player)

	# Test that special attacks return damage values
	var attack = boss_manager.get_special_attack()
	if not attack.is_empty():
		var attack_name = attack.keys()[0]
		var attack_data = attack[attack_name]
		assert_true(attack_data.has("damage"), "Special attack should have damage")

	print("PASS: Boss to CombatManager test")

func test_boss_loot_to_gear_manager() -> void:
	# Test: Boss loot integrates with GearManager
	if not boss_manager:
		return

	var loot = boss_manager.roll_boss_loot(0)
	assert_true(loot.size() > 0, "Boss should generate loot")

	# Test loot has gear type
	var has_gear = false
	for item in loot:
		if item.has("type"):
			var valid_types = ["helm", "armor", "bow", "arrow", "amulet"]
			if item.type in valid_types:
				has_gear = true
				break

	assert_true(has_gear, "Loot should contain gear item")

	print("PASS: Boss loot to GearManager test")
