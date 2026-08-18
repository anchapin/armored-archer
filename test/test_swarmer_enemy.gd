extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0
var _death_signal_received: bool = false

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running SwarmerEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_swarmer_detection_range()
	await test_group_buff_config()
	await test_initial_attack_cooldown()
	await test_retreat_config()
	await test_rush_settings()
	await test_take_damage()
	await test_take_damage_death()
	await test_solo_swarmer_no_buff()

	print("\n=== SwarmerEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_swarmer_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/swarmer_enemy.gd"))
	var sprite = Sprite2D.new()
	sprite.name = "Sprite2D"
	enemy.add_child(sprite)
	var collision = CollisionShape2D.new()
	collision.name = "CollisionShape2D"
	enemy.add_child(collision)
	var hurt_area = Area2D.new()
	hurt_area.name = "HurtArea"
	enemy.add_child(hurt_area)
	var detection = Area2D.new()
	detection.name = "DetectionArea"
	enemy.add_child(detection)
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
	var enemy = _create_swarmer_enemy()
	var passed = enemy.max_health == 25 and enemy.move_speed == 180.0 and enemy.damage == 8 and enemy.xp_reward == 15
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (25, 180, 8, 15) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.free()

func test_swarmer_detection_range() -> void:
	var enemy = _create_swarmer_enemy()
	if enemy._swarmer_detection_range == 150.0:
		_pass("test_swarmer_detection_range")
	else:
		_fail("test_swarmer_detection_range", "Expected 150.0 got %f" % enemy._swarmer_detection_range)
	enemy.free()

func test_group_buff_config() -> void:
	var enemy = _create_swarmer_enemy()
	var passed = enemy.group_buff_threshold == 3 and enemy.group_buff_speed_multiplier == 1.2
	if passed:
		_pass("test_group_buff_config")
	else:
		_fail("test_group_buff_config", "Expected threshold=3, multiplier=1.2")
	enemy.free()

func test_initial_attack_cooldown() -> void:
	var enemy = _create_swarmer_enemy()
	if enemy._attack_cooldown == 0.0:
		_pass("test_initial_attack_cooldown")
	else:
		_fail("test_initial_attack_cooldown", "Expected 0.0 got %f" % enemy._attack_cooldown)
	enemy.free()

func test_retreat_config() -> void:
	var enemy = _create_swarmer_enemy()
	var passed = enemy._retreat_when_hurt_threshold == 0.25 and enemy._is_retreating == false
	if passed:
		_pass("test_retreat_config")
	else:
		_fail("test_retreat_config", "Expected threshold=0.25, retreating=false")
	enemy.free()

func test_rush_settings() -> void:
	var enemy = _create_swarmer_enemy()
	var passed = enemy._rush_speed == 200.0 and enemy._is_rushing == false
	if passed:
		_pass("test_rush_settings")
	else:
		_fail("test_rush_settings", "Expected _rush_speed=200.0, is_rushing=false")
	enemy.free()

func test_take_damage() -> void:
	var enemy = _create_swarmer_enemy()
	enemy.take_damage(5)
	var expected = 25 - 5
	if enemy.current_health == expected:
		_pass("test_take_damage")
	else:
		_fail("test_take_damage", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.free()

func test_take_damage_death() -> void:
	var enemy = _create_swarmer_enemy()
	_death_signal_received = false
	enemy.died.connect(func(_xp): _death_signal_received = true)
	enemy.take_damage(25)
	if _death_signal_received:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.free()

func test_solo_swarmer_no_buff() -> void:
	var enemy = _create_swarmer_enemy()
	var nearby = enemy.check_nearby_swarmers()
	# A lone swarmer should count zero allies and have no group buff
	var passed = nearby == 0 and enemy._group_buff_active == false
	if passed:
		_pass("test_solo_swarmer_no_buff")
	else:
		_fail("test_solo_swarmer_no_buff", "Expected 0 nearby, buff inactive (got %d, %s)" % [nearby, str(enemy._group_buff_active)])
	enemy.free()
