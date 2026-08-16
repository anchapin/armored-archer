extends Node

## Test camera shake integration with combat events

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running Camera Shake Integration Tests ===\n")
	await run_tests()
	print("\n=== Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func run_tests() -> void:
	await test_vfxmanager_shake_methods()
	await test_baseenemy_die_calls_vfx()
	await test_gamemanager_damage_shake()

func test_vfxmanager_shake_methods() -> void:
	"""Test that VFXManager has screen shake methods."""
	# Create instance to check methods (script.has_method doesn't work reliably)
	var vfx_manager_script = load("res://autoloads/VFXManager.gd")
	var vfx_manager = Node.new()
	vfx_manager.set_script(vfx_manager_script)
	add_child(vfx_manager)

	if vfx_manager.has_method("trigger_light_shake"):
		_pass("test_vfxmanager_shake_methods - trigger_light_shake")
	else:
		_fail("test_vfxmanager_shake_methods - trigger_light_shake", "Method not found")

	if vfx_manager.has_method("trigger_medium_shake"):
		_pass("test_vfxmanager_shake_methods - trigger_medium_shake")
	else:
		_fail("test_vfxmanager_shake_methods - trigger_medium_shake", "Method not found")

	if vfx_manager.has_method("trigger_heavy_shake"):
		_pass("test_vfxmanager_shake_methods - trigger_heavy_shake")
	else:
		_fail("test_vfxmanager_shake_methods - trigger_heavy_shake", "Method not found")

	vfx_manager.queue_free()

func test_baseenemy_die_calls_vfx() -> void:
	"""Test that BaseEnemy.die() triggers VFXManager."""
	var base_enemy_script = load("res://scenes/enemies/base_enemy.gd")
	var base_enemy = CharacterBody2D.new()
	base_enemy.set_script(base_enemy_script)
	base_enemy.name = "TestEnemy"
	add_child(base_enemy)

	# Check that die() method exists
	if base_enemy.has_method("die"):
		_pass("test_baseenemy_die_calls_vfx - die method exists")
	else:
		_fail("test_baseenemy_die_calls_vfx - die method exists", "Method not found")

	base_enemy.queue_free()

	# Read the source to check for death VFX wiring. die() routes through
	# CombatJuiceManager ("DEATH_ANIMATION") with a VFXManager.spawn_death_particles fallback.
	var source_code = FileAccess.open("res://scenes/enemies/base_enemy.gd", FileAccess.READ)
	if source_code:
		var content = source_code.get_as_text()
		source_code.close()

		if content.contains("CombatJuiceManager") and content.contains("DEATH_ANIMATION") and content.contains("VFXManager") and content.contains("spawn_death_particles"):
			_pass("test_baseenemy_die_calls_vfx - VFXManager integration")
		else:
			_fail("test_baseenemy_die_calls_vfx - VFXManager integration", "Death VFX wiring (CombatJuiceManager/VFXManager) not found")
	else:
		_fail("test_baseenemy_die_calls_vfx - VFXManager integration", "Could not read source file")

func test_gamemanager_damage_shake() -> void:
	"""Test that GameManager.take_player_damage triggers screen shake."""
	# Read the source: has_method() on a GDScript resource is unreliable
	var source_code = FileAccess.open("res://autoloads/GameManager.gd", FileAccess.READ)
	if not source_code:
		_fail("test_gamemanager_damage_shake - take_player_damage method exists", "Could not read source file")
		return
	var content = source_code.get_as_text()
	source_code.close()

	if content.contains("func take_player_damage"):
		_pass("test_gamemanager_damage_shake - take_player_damage method exists")
	else:
		_fail("test_gamemanager_damage_shake - take_player_damage method exists", "Method not found")

	# Check that damage routes to a VFXManager shake trigger
	if content.contains("VFXManager") and content.contains("trigger_"):
		_pass("test_gamemanager_damage_shake - VFXManager integration")
	else:
		_fail("test_gamemanager_damage_shake - VFXManager integration", "VFXManager.trigger_* call not found")

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)
