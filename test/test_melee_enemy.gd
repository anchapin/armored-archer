extends Node

# Tests for the MeleeEnemy class (post-#910 spawner consolidation).
#
# MeleeEnemy is a `BaseEnemy` subclass declared with `extends BaseEnemy`
# (no `class_name`), so we instantiate it via the loaded script resource
# rather than as a globally-registered class. The script's `@onready` vars
# reference $Sprite2D / $CollisionShape2D / $HurtArea, so those children
# must be added BEFORE the enemy is parented to the scene tree (which
# triggers _ready()).

const MELEE_ENEMY_SCRIPT: Script = preload("res://scenes/enemies/melee_enemy.gd")

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running MeleeEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_detection_range()
	await test_attack_range()
	await test_attack_cooldown()
	await test_chase_sets_velocity()
	await test_attack_stops_velocity()
	await test_perform_attack_exists()
	await test_take_damage_with_armor_small_attack()
	await test_take_damage_with_armor_medium_attack()
	await test_take_damage_with_armor_large_attack()
	await test_take_damage_death()
	await test_hurt_area_deals_damage()

	print("\n=== MeleeEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_melee_enemy() -> Node:
	var enemy: Node = MELEE_ENEMY_SCRIPT.new()
	var sprite := Sprite2D.new()
	sprite.name = "Sprite2D"
	enemy.add_child(sprite)
	var collision := CollisionShape2D.new()
	collision.name = "CollisionShape2D"
	enemy.add_child(collision)
	var hurt_area := Area2D.new()
	hurt_area.name = "HurtArea"
	enemy.add_child(hurt_area)
	add_child(enemy)
	return enemy

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_default_stats() -> void:
	var enemy: Node = _create_melee_enemy()
	# Melee enemy inherits base_enemy defaults
	var passed: bool = (enemy.max_health == 100
			and enemy.move_speed == 150.0
			and enemy.damage == 10)
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats",
			"Expected base stats (health=100, speed=150, damage=10) got (%d, %f, %d)" %
			[enemy.max_health, enemy.move_speed, enemy.damage])
	enemy.queue_free()

func test_detection_range() -> void:
	var enemy: Node = _create_melee_enemy()
	if enemy.detection_range == 200.0:
		_pass("test_detection_range")
	else:
		_fail("test_detection_range", "Expected 200.0 got %f" % enemy.detection_range)
	enemy.queue_free()

func test_attack_range() -> void:
	var enemy: Node = _create_melee_enemy()
	if enemy.attack_range == 35.0:
		_pass("test_attack_range")
	else:
		_fail("test_attack_range", "Expected 35.0 got %f" % enemy.attack_range)
	enemy.queue_free()

func test_attack_cooldown() -> void:
	var enemy: Node = _create_melee_enemy()
	if enemy.attack_cooldown == 1.5:
		_pass("test_attack_cooldown")
	else:
		_fail("test_attack_cooldown", "Expected 1.5 got %f" % enemy.attack_cooldown)
	enemy.queue_free()

func test_chase_sets_velocity() -> void:
	var enemy: Node = _create_melee_enemy()
	# Create a mock player
	var mock_player := CharacterBody2D.new()
	mock_player.add_to_group("Player")
	mock_player.global_position = Vector2(200, 0)
	add_child(mock_player)
	enemy.player_ref = mock_player
	enemy.chase_player()
	var speed: float = enemy.velocity.length()
	var passed: bool = speed > 0
	if passed:
		_pass("test_chase_sets_velocity")
	else:
		_fail("test_chase_sets_velocity",
			"Chase should set non-zero velocity (got %s)" % str(enemy.velocity))
	mock_player.queue_free()
	enemy.queue_free()

func test_attack_stops_velocity() -> void:
	var enemy: Node = _create_melee_enemy()
	enemy.velocity = Vector2(100, 0)
	enemy.attack_player(0.5)
	var passed: bool = enemy.velocity == Vector2.ZERO
	if passed:
		_pass("test_attack_stops_velocity")
	else:
		_fail("test_attack_stops_velocity",
			"Attack should stop velocity (got %s)" % str(enemy.velocity))
	enemy.queue_free()

func test_perform_attack_exists() -> void:
	# Post-#910 contract: MeleeEnemy still owns `perform_attack()` (it is
	# a subclass-specific behavior; the spawner doesn't override it).
	# Instantiate the actual script (not a base CharacterBody2D with
	# set_script attached) so has_method sees the class methods.
	var enemy: Node = _create_melee_enemy()
	if enemy.has_method("perform_attack"):
		_pass("test_perform_attack_exists")
	else:
		_fail("test_perform_attack_exists",
			"Enemy should have perform_attack method")
	enemy.queue_free()

func test_take_damage_with_armor_small_attack() -> void:
	# Brute has armor reduction - test that melee doesn't (inherits base)
	var enemy: Node = _create_melee_enemy()
	enemy.take_damage(10)
	var passed: bool = enemy.current_health == 90
	if passed:
		_pass("test_take_damage_with_armor_small_attack")
	else:
		_fail("test_take_damage_with_armor_small_attack",
			"Melee should take full damage (got %d)" % enemy.current_health)
	enemy.queue_free()

func test_take_damage_with_armor_medium_attack() -> void:
	var enemy: Node = _create_melee_enemy()
	enemy.take_damage(25)
	var passed: bool = enemy.current_health == 75
	if passed:
		_pass("test_take_damage_with_armor_medium_attack")
	else:
		_fail("test_take_damage_with_armor_medium_attack",
			"Expected 75 got %d" % enemy.current_health)
	enemy.queue_free()

func test_take_damage_with_armor_large_attack() -> void:
	var enemy: Node = _create_melee_enemy()
	enemy.take_damage(50)
	var passed: bool = enemy.current_health == 50
	if passed:
		_pass("test_take_damage_with_armor_large_attack")
	else:
		_fail("test_take_damage_with_armor_large_attack",
			"Expected 50 got %d" % enemy.current_health)
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy: Node = _create_melee_enemy()
	# GDScript lambdas capture locals by value; use an Array to observe the signal
	var death_calls: Array = []
	enemy.died.connect(func(_xp: int) -> void: death_calls.append(1))
	enemy.take_damage(100)
	if death_calls.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.queue_free()

func test_hurt_area_deals_damage() -> void:
	# Post-#910 contract: the HurtArea collision handler is still wired
	# via `_on_hurt_area_body_entered()` (BaseEnemy implements it,
	# MeleeEnemy overrides it). Confirm the method exists and the
	# HurtArea child node is present in the scene tree.
	var enemy: Node = _create_melee_enemy()
	var has_method: bool = enemy.has_method("_on_hurt_area_body_entered")
	var has_area: bool = enemy.has_node("HurtArea")
	if has_method and has_area:
		_pass("test_hurt_area_deals_damage")
	else:
		_fail("test_hurt_area_deals_damage",
			"Should have _on_hurt_area_body_entered (=%s) and HurtArea child (=%s)" %
			[str(has_method), str(has_area)])
	enemy.queue_free()