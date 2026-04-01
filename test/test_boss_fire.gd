extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running BossFire Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_boss_name()
	await test_phase_1_defaults()
	await test_phase_2_transition()
	await test_phase_3_transition()
	await test_enraged_state()
	await test_enraged_takes_more_damage()
	await test_health_changed_signal()
	await test_boss_defeated_signal()
	await test_take_damage_death()
	await test_in_boss_group()
	await test_phase_2_speed_increase()
	await test_phase_3_speed_increase()

	print("\n=== BossFire Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_fire_boss() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/bosses/boss_fire.gd"))
	var sprite = Sprite2D.new()
	sprite.name = "Sprite2D"
	enemy.add_child(sprite)
	var collision = CollisionShape2D.new()
	collision.name = "CollisionShape2D"
	enemy.add_child(collision)
	var hurt_area = Area2D.new()
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
	var boss = _create_fire_boss()
	boss._ready()
	var passed = boss.max_health == 800 and boss.damage == 25
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected health=800, damage=25 got (%d, %d)" % [boss.max_health, boss.damage])
	boss.queue_free()

func test_boss_name() -> void:
	var boss = _create_fire_boss()
	if boss.boss_name == "Inferno":
		_pass("test_boss_name")
	else:
		_fail("test_boss_name", "Expected 'Inferno' got '%s'" % boss.boss_name)
	boss.queue_free()

func test_phase_1_defaults() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	var passed = boss.phase == 1 and boss.move_speed == boss.base_move_speed and not boss.is_enraged
	if passed:
		_pass("test_phase_1_defaults")
	else:
		_fail("test_phase_1_defaults", "Should start in phase 1, not enraged")
	boss.queue_free()

func test_phase_2_transition() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	# Deal 400 damage (50% of 800)
	boss.take_damage(400)
	if boss.phase == 2:
		_pass("test_phase_2_transition")
	else:
		_fail("test_phase_2_transition", "Should enter phase 2 at 50%% health (got phase %d)" % boss.phase)
	boss.queue_free()

func test_phase_3_transition() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	# Deal 600 damage (75% of 800) to trigger phase 2 then phase 3
	boss.take_damage(600)
	if boss.phase == 3:
		_pass("test_phase_3_transition")
	else:
		_fail("test_phase_3_transition", "Should enter phase 3 at 25%% health (got phase %d)" % boss.phase)
	boss.queue_free()

func test_enraged_state() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	boss.take_damage(600)
	if boss.is_enraged:
		_pass("test_enraged_state")
	else:
		_fail("test_enraged_state", "Should be enraged in phase 3")
	boss.queue_free()

func test_enraged_takes_more_damage() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	boss.take_damage(600)  # Enter phase 3 (enraged)
	var health_after_phase3 = boss.current_health
	# When enraged, takes 20% more damage
	boss.take_damage(100)
	# Actual damage = int(100 * 1.2) = 120
	var expected = health_after_phase3 - 120
	if boss.current_health == expected:
		_pass("test_enraged_takes_more_damage")
	else:
		_fail("test_enraged_takes_more_damage", "Expected %d got %d (enraged should take 120%% damage)" % [expected, boss.current_health])
	boss.queue_free()

func test_health_changed_signal() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	var received = false
	boss.health_changed.connect(func(_c, _m): received = true)
	boss.take_damage(10)
	if received:
		_pass("test_health_changed_signal")
	else:
		_fail("test_health_changed_signal", "health_changed should emit on damage")
	boss.queue_free()

func test_boss_defeated_signal() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	var received_name = ""
	boss.boss_defeated.connect(func(name): received_name = name)
	boss.take_damage(800)
	if received_name == "Inferno":
		_pass("test_boss_defeated_signal")
	else:
		_fail("test_boss_defeated_signal", "boss_defeated should emit 'Inferno' (got '%s')" % received_name)
	boss.queue_free()

func test_take_damage_death() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	var defeated = false
	boss.boss_defeated.connect(func(_name): defeated = true)
	boss.take_damage(800)
	if defeated:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should be defeated at 0 health")
	boss.queue_free()

func test_in_boss_group() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	if boss.is_in_group("Boss"):
		_pass("test_in_boss_group")
	else:
		_fail("test_in_boss_group", "Should be in 'Boss' group")
	boss.queue_free()

func test_phase_2_speed_increase() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	boss.take_damage(400)  # Enter phase 2
	if boss.move_speed == boss.phase2_speed:
		_pass("test_phase_2_speed_increase")
	else:
		_fail("test_phase_2_speed_increase", "Phase 2 should set speed to phase2_speed")
	boss.queue_free()

func test_phase_3_speed_increase() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	boss.take_damage(600)  # Enter phase 3
	if boss.move_speed == boss.phase3_speed:
		_pass("test_phase_3_speed_increase")
	else:
		_fail("test_phase_3_speed_increase", "Phase 3 should set speed to phase3_speed")
	boss.queue_free()
