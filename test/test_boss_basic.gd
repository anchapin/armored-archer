extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running BossBasic Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_boss_name_export()
	await test_phase_1_defaults()
	await test_phase_2_stats()
	await test_health_changed_signal()
	await test_boss_defeated_signal()
	await test_phase_transition_at_50_percent()
	await test_no_phase_transition_above_50()
	await test_take_damage_reduces_health()
	await test_take_damage_death()
	await test_in_boss_group()

	print("\n=== BossBasic Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_boss() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/bosses/boss_basic.gd"))
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
	var boss = _create_boss()
	boss._ready()
	var passed = boss.max_health == 500
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected max_health=500 got %d" % boss.max_health)
	boss.queue_free()

func test_boss_name_export() -> void:
	var boss = _create_boss()
	if boss.boss_name == "Basic Boss":
		_pass("test_boss_name_export")
	else:
		_fail("test_boss_name_export", "Expected 'Basic Boss' got '%s'" % boss.boss_name)
	boss.queue_free()

func test_phase_1_defaults() -> void:
	var boss = _create_boss()
	boss._ready()
	var passed = boss.phase == 1 and boss.move_speed == boss.phase1_speed and boss.damage == boss.phase1_damage
	if passed:
		_pass("test_phase_1_defaults")
	else:
		_fail("test_phase_1_defaults", "Should start in phase 1 with phase1 stats")
	boss.queue_free()

func test_phase_2_stats() -> void:
	var boss = _create_boss()
	boss._ready()
	boss.enter_phase_2()
	var passed = boss.phase == 2 and boss.move_speed == boss.phase2_speed and boss.damage == boss.phase2_damage and boss.attack_cooldown == boss.phase2_attack_cooldown
	if passed:
		_pass("test_phase_2_stats")
	else:
		_fail("test_phase_2_stats", "Phase 2 should update speed/damage/cooldown")
	boss.queue_free()

func test_health_changed_signal() -> void:
	var boss = _create_boss()
	boss._ready()
	var signals_received: Array = []
	boss.health_changed.connect(func(_c, _m): signals_received.append("health_changed"))
	boss.take_damage(10)
	if signals_received.size() > 0:
		_pass("test_health_changed_signal")
	else:
		_fail("test_health_changed_signal", "health_changed signal should emit on take_damage")
	boss.queue_free()

func test_boss_defeated_signal() -> void:
	var boss = _create_boss()
	boss._ready()
	var signals_received: Array = []
	boss.boss_defeated.connect(func(boss_name): signals_received.append(boss_name))
	boss.take_damage(500)
	if signals_received.size() > 0 and signals_received[0] == "Basic Boss":
		_pass("test_boss_defeated_signal")
	else:
		_fail("test_boss_defeated_signal", "boss_defeated should emit boss name (got '%s')" % (signals_received[0] if signals_received.size() > 0 else ""))
	boss.queue_free()

func test_phase_transition_at_50_percent() -> void:
	var boss = _create_boss()
	boss._ready()
	# Deal 250 damage (50% of 500)
	boss.take_damage(250)
	if boss.phase == 2:
		_pass("test_phase_transition_at_50_percent")
	else:
		_fail("test_phase_transition_at_50_percent", "Should enter phase 2 at 50%% health (got phase %d, health %d)" % [boss.phase, boss.current_health])
	boss.queue_free()

func test_no_phase_transition_above_50() -> void:
	var boss = _create_boss()
	boss._ready()
	# Deal 200 damage (40% of 500)
	boss.take_damage(200)
	if boss.phase == 1:
		_pass("test_no_phase_transition_above_50")
	else:
		_fail("test_no_phase_transition_above_50", "Should stay in phase 1 above 50%% health")
	boss.queue_free()

func test_take_damage_reduces_health() -> void:
	var boss = _create_boss()
	boss._ready()
	boss.take_damage(100)
	if boss.current_health == 400:
		_pass("test_take_damage_reduces_health")
	else:
		_fail("test_take_damage_reduces_health", "Expected 400 got %d" % boss.current_health)
	boss.queue_free()

func test_take_damage_death() -> void:
	var boss = _create_boss()
	boss._ready()
	var signals_received: Array = []
	boss.boss_defeated.connect(func(_name): signals_received.append("boss_defeated"))
	boss.take_damage(500)
	if signals_received.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Boss should be defeated at 0 health")
	boss.queue_free()

func test_in_boss_group() -> void:
	var boss = _create_boss()
	boss._ready()
	if boss.is_in_group("Boss"):
		_pass("test_in_boss_group")
	else:
		_fail("test_in_boss_group", "Boss should be in 'Boss' group")
	boss.queue_free()
