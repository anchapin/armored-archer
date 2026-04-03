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

func test_vfxmanager_shake_methods() -> void:
	"""Test that VFXManager has screen shake methods."""
	var vfx_manager_script = load("res://autoloads/VFXManager.gd")

	if vfx_manager_script.has_method("trigger_light_shake"):
		_pass("test_vfxmanager_shake_methods - trigger_light_shake")
	else:
		_fail("test_vfxmanager_shake_methods - trigger_light_shake", "Method not found")

	if vfx_manager_script.has_method("trigger_medium_shake"):
		_pass("test_vfxmanager_shake_methods - trigger_medium_shake")
	else:
		_fail("test_vfxmanager_shake_methods - trigger_medium_shake", "Method not found")

	if vfx_manager_script.has_method("trigger_heavy_shake"):
		_pass("test_vfxmanager_shake_methods - trigger_heavy_shake")
	else:
		_fail("test_vfxmanager_shake_methods - trigger_heavy_shake", "Method not found")

func test_baseenemy_die_calls_vfx() -> void:
	"""Test that BaseEnemy.die() triggers VFXManager."""
	var base_enemy_script = load("res://scenes/enemies/base_enemy.gd")

	# Check that die() method exists
	if base_enemy_script.has_method("die"):
		_pass("test_baseenemy_die_calls_vfx - die method exists")
	else:
		_fail("test_baseenemy_die_calls_vfx - die method exists", "Method not found")

	# Read the source to check for VFXManager call
	var source_code = FileAccess.open("res://scenes/enemies/base_enemy.gd", FileAccess.READ)
	if source_code:
		var content = source_code.get_as_text()
		source_code.close()

		if "VFXManager" in content and "play_death_effect" in content:
			_pass("test_baseenemy_die_calls_vfx - VFXManager integration")
		else:
			_fail("test_baseenemy_die_calls_vfx - VFXManager integration", "VFXManager.play_death_effect call not found")
	else:
		_fail("test_baseenemy_die_calls_vfx - VFXManager integration", "Could not read source file")

func test_gamemanager_damage_shake() -> void:
	"""Test that GameManager.take_player_damage triggers screen shake."""
	var game_manager_script = load("res://autoloads/GameManager.gd")

	# Check that take_player_damage method exists
	if game_manager_script.has_method("take_player_damage"):
		_pass("test_gamemanager_damage_shake - take_player_damage method exists")
	else:
		_fail("test_gamemanager_damage_shake - take_player_damage method exists", "Method not found")

	# Read the source to check for VFXManager call
	var source_code = FileAccess.open("res://autoloads/GameManager.gd", FileAccess.READ)
	if source_code:
		var content = source_code.get_as_text()
		source_code.close()

		if "VFXManager" in content and "trigger_" in content:
			_pass("test_gamemanager_damage_shake - VFXManager integration")
		else:
			_fail("test_gamemanager_damage_shake - VFXManager integration", "VFXManager.trigger_* call not found")
	else:
		_fail("test_gamemanager_damage_shake - VFXManager integration", "Could not read source file")

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)
