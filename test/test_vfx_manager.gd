extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

# Preload VFXManager class to avoid duplicate loads
const VFXManagerClass = preload("res://autoloads/VFXManager.gd")

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running VFXManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_initial_state()
	await test_scene_preloading()
	await test_singleton_instance()
	await test_hit_effect_path()
	await test_crit_effect_path()
	await test_miss_effect_path()
	await test_fire_effect_path()
	await test_ice_effect_path()
	await test_lightning_effect_path()
	await test_charge_effect_path()
	await test_damage_popup_scene_path()
	await test_screen_shake_scene_path()

	print("\n=== VFXManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_vfx_manager() -> Node:
	var vfx = VFXManagerClass.new()
	add_child(vfx)
	await get_tree().process_frame
	return vfx

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.HIT_EFFECT_PATH == "res://assets/particles/hit_effect.tscn":
		_pass("test_hit_effect_path_constant")
	else:
		_fail("test_hit_effect_path_constant", "HIT_EFFECT_PATH incorrect")

	if vfx.CRIT_EFFECT_PATH == "res://assets/particles/crit_effect.tscn":
		_pass("test_crit_effect_path_constant")
	else:
		_fail("test_crit_effect_path_constant", "CRIT_EFFECT_PATH incorrect")

	if vfx.MISS_EFFECT_PATH == "res://assets/particles/miss_effect.tscn":
		_pass("test_miss_effect_path_constant")
	else:
		_fail("test_miss_effect_path_constant", "MISS_EFFECT_PATH incorrect")

	vfx.queue_free()

func test_initial_state() -> void:
	var vfx = await _create_vfx_manager()

	if vfx._hit_effect == null:
		_pass("test_initial_hit_effect_null")
	else:
		_fail("test_initial_hit_effect_null", "Should be null before _ready")

	if vfx._screen_shake == null:
		_pass("test_initial_screen_shake_null")
	else:
		_fail("test_initial_screen_shake_null", "Should be null initially")

	vfx.queue_free()

func test_scene_preloading() -> void:
	var vfx = await _create_vfx_manager()

	if vfx._hit_effect != null:
		_pass("test_hit_effect_preloaded")
	else:
		_fail("test_hit_effect_preloaded", "Hit effect should be preloaded")

	if vfx._crit_effect != null:
		_pass("test_crit_effect_preloaded")
	else:
		_fail("test_crit_effect_preloaded", "Crit effect should be preloaded")

	if vfx._miss_effect != null:
		_pass("test_miss_effect_preloaded")
	else:
		_fail("test_miss_effect_preloaded", "Miss effect should be preloaded")

	if vfx._fire_effect != null:
		_pass("test_fire_effect_preloaded")
	else:
		_fail("test_fire_effect_preloaded", "Fire effect should be preloaded")

	if vfx._ice_effect != null:
		_pass("test_ice_effect_preloaded")
	else:
		_fail("test_ice_effect_preloaded", "Ice effect should be preloaded")

	if vfx._lightning_effect != null:
		_pass("test_lightning_effect_preloaded")
	else:
		_fail("test_lightning_effect_preloaded", "Lightning effect should be preloaded")

	if vfx._charge_effect != null:
		_pass("test_charge_effect_preloaded")
	else:
		_fail("test_charge_effect_preloaded", "Charge effect should be preloaded")

	if vfx._damage_popup_scene != null:
		_pass("test_damage_popup_preloaded")
	else:
		_fail("test_damage_popup_preloaded", "Damage popup should be preloaded")

	vfx.queue_free()

func test_singleton_instance() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.instance == vfx:
		_pass("test_singleton_sets_self")
	else:
		_fail("test_singleton_sets_self", "Singleton should be set to self")

	vfx.queue_free()

	# Access static instance through the loaded class
	if VFXManagerClass.instance == null:
		_pass("test_singleton_clears_on_exit")
	else:
		_fail("test_singleton_clears_on_exit", "Singleton should be null after cleanup")

func test_hit_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.HIT_EFFECT_PATH.begins_with("res://"):
		_pass("test_hit_effect_path_valid")
	else:
		_fail("test_hit_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_crit_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.CRIT_EFFECT_PATH.begins_with("res://"):
		_pass("test_crit_effect_path_valid")
	else:
		_fail("test_crit_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_miss_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.MISS_EFFECT_PATH.begins_with("res://"):
		_pass("test_miss_effect_path_valid")
	else:
		_fail("test_miss_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_fire_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.FIRE_EFFECT_PATH.begins_with("res://"):
		_pass("test_fire_effect_path_valid")
	else:
		_fail("test_fire_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_ice_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.ICE_EFFECT_PATH.begins_with("res://"):
		_pass("test_ice_effect_path_valid")
	else:
		_fail("test_ice_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_lightning_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.LIGHTNING_EFFECT_PATH.begins_with("res://"):
		_pass("test_lightning_effect_path_valid")
	else:
		_fail("test_lightning_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_charge_effect_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.CHARGE_EFFECT_PATH.begins_with("res://"):
		_pass("test_charge_effect_path_valid")
	else:
		_fail("test_charge_effect_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_damage_popup_scene_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.DAMAGE_POPUP_SCENE.begins_with("res://"):
		_pass("test_damage_popup_scene_path_valid")
	else:
		_fail("test_damage_popup_scene_path_valid", "Path should be res:// format")

	vfx.queue_free()

func test_screen_shake_scene_path() -> void:
	var vfx = await _create_vfx_manager()

	if vfx.SCREEN_SHAKE_SCENE.begins_with("res://"):
		_pass("test_screen_shake_scene_path_valid")
	else:
		_fail("test_screen_shake_scene_path_valid", "Path should be res:// format")

	vfx.queue_free()