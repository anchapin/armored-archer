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
	await test_enraged_damage_increase()
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

## boss_fire.gd ships the Shadow Warlock (WarlockBoss): ranged spells boss
## whose phases are driven by BossManager.transition_to_phase().
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
	var passed = boss.max_health == 700 and boss.damage == 18
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected health=700, damage=18 got (%d, %d)" % [boss.max_health, boss.damage])
	boss.queue_free()

func test_boss_name() -> void:
	var boss = _create_fire_boss()
	if boss.boss_name == "Shadow Warlock":
		_pass("test_boss_name")
	else:
		_fail("test_boss_name", "Expected 'Shadow Warlock' got '%s'" % boss.boss_name)
	boss.queue_free()

func test_phase_1_defaults() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	var passed = boss.current_phase == 0 and boss.move_speed == boss.base_move_speed and not boss.is_enraged
	if passed:
		_pass("test_phase_1_defaults")
	else:
		_fail("test_phase_1_defaults", "Should start in phase 0 (phase 1), not enraged")
	boss.queue_free()

func test_phase_2_transition() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	await boss.transition_to_phase(1)
	var passed = boss.current_phase == 1 and boss.damage == 22 and boss.can_summon_minions
	if passed:
		_pass("test_phase_2_transition")
	else:
		_fail("test_phase_2_transition", "Phase 2 should unlock minions and set damage=22 (got phase %d, damage %d)" % [boss.current_phase, boss.damage])
	boss.queue_free()

func test_phase_3_transition() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	await boss.transition_to_phase(2)
	if boss.current_phase == 2:
		_pass("test_phase_3_transition")
	else:
		_fail("test_phase_3_transition", "Should enter phase 3 (got phase %d)" % boss.current_phase)
	boss.queue_free()

func test_enraged_state() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	await boss.transition_to_phase(2)
	if boss.is_enraged:
		_pass("test_enraged_state")
	else:
		_fail("test_enraged_state", "Should be enraged in phase 3")
	boss.queue_free()

func test_enraged_damage_increase() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	var base_damage: int = boss.damage
	await boss.transition_to_phase(2)
	if boss.damage > base_damage and boss.damage == 26:
		_pass("test_enraged_damage_increase")
	else:
		_fail("test_enraged_damage_increase", "Enraged should deal increased damage (base %d, got %d)" % [base_damage, boss.damage])
	boss.queue_free()

func test_health_changed_signal() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	# GDScript lambdas capture locals by value; use an Array to observe the signal
	var calls: Array = []
	boss.health_changed.connect(func(_c, _m): calls.append(1))
	boss.take_damage(10)
	if calls.size() > 0:
		_pass("test_health_changed_signal")
	else:
		_fail("test_health_changed_signal", "health_changed should emit on damage")
	boss.queue_free()

func test_boss_defeated_signal() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	# GDScript lambdas capture locals by value; use an Array to observe the signal
	var defeated_names: Array = []
	boss.boss_defeated.connect(func(boss_name): defeated_names.append(boss_name))
	boss.take_damage(700)
	if defeated_names.has("Shadow Warlock"):
		_pass("test_boss_defeated_signal")
	else:
		_fail("test_boss_defeated_signal", "boss_defeated should emit 'Shadow Warlock' (got '%s')" % str(defeated_names))
	boss.queue_free()

func test_take_damage_death() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	# GDScript lambdas capture locals by value; use an Array to observe the signal
	var defeat_calls: Array = []
	boss.boss_defeated.connect(func(_name): defeat_calls.append(1))
	boss.take_damage(700)
	if defeat_calls.size() > 0:
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
	await boss.transition_to_phase(1)
	if boss.move_speed == boss.base_move_speed:
		_pass("test_phase_2_speed_increase")
	else:
		_fail("test_phase_2_speed_increase", "Phase 2 should keep speed at base_move_speed")
	boss.queue_free()

func test_phase_3_speed_increase() -> void:
	var boss = _create_fire_boss()
	boss._ready()
	await boss.transition_to_phase(2)
	if is_equal_approx(boss.move_speed, boss.base_move_speed * 1.2):
		_pass("test_phase_3_speed_increase")
	else:
		_fail("test_phase_3_speed_increase", "Phase 3 should set speed to base_move_speed * 1.2")
	boss.queue_free()
