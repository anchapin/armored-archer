extends Node

const DamagePopup = preload("res://scripts/damage_popup.gd")

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running DamagePopup Script Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_colors_defined()
	await test_setup_damage_normal()
	await test_setup_damage_crit()
	await test_setup_miss()
	await test_setup_heal()
	await test_factory_method()

	print("\n=== DamagePopup Script Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_damage_popup() -> Label:
	var dp_script = DamagePopup
	var dp = Label.new()
	dp.set_script(dp_script)
	add_child(dp)
	return dp

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var dp = _create_damage_popup()

	if dp.float_speed == 80.0 and dp.lifetime == 1.0 and dp.fade_start == 0.6:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should have default values")

	dp.queue_free()

func test_colors_defined() -> void:
	var dp = _create_damage_popup()

	if dp.COLOR_NORMAL == Color(1.0, 1.0, 1.0, 1.0) and dp.COLOR_CRIT == Color(1.0, 0.3, 0.1, 1.0) and dp.COLOR_MISS == Color(0.6, 0.6, 0.6, 0.8) and dp.COLOR_HEAL == Color(0.3, 1.0, 0.4, 1.0):
		_pass("test_colors_defined")
	else:
		_fail("test_colors_defined", "All color constants should be defined")

	dp.queue_free()

func test_setup_damage_normal() -> void:
	var dp = _create_damage_popup()
	dp.setup_damage(150)

	if dp.text == "150" and dp.modulate == dp.COLOR_NORMAL:
		_pass("test_setup_damage_normal")
	else:
		_fail("test_setup_damage_normal", "Normal damage should show number")

	dp.queue_free()

func test_setup_damage_crit() -> void:
	var dp = _create_damage_popup()
	dp.setup_damage(150, true, false, false)

	if dp.text == "150!" and dp.modulate == dp.COLOR_CRIT:
		_pass("test_setup_damage_crit")
	else:
		_fail("test_setup_damage_crit", "Critical damage should show with exclamation")

	dp.queue_free()

func test_setup_miss() -> void:
	var dp = _create_damage_popup()
	dp.setup_damage(0, false, true, false)

	if dp.text == "MISS" and dp.modulate == dp.COLOR_MISS:
		_pass("test_setup_miss")
	else:
		_fail("test_setup_miss", "Miss should show 'MISS' text")

	dp.queue_free()

func test_setup_heal() -> void:
	var dp = _create_damage_popup()
	dp.setup_damage(50, false, false, true)

	if dp.text == "+50" and dp.modulate == dp.COLOR_HEAL:
		_pass("test_setup_heal")
	else:
		_fail("test_setup_heal", "Heal should show with + prefix")

	dp.queue_free()

func test_factory_method() -> void:
	var popup = DamagePopup.create_damage_popup(100, Vector2(200, 200), false, false, false)

	if popup != null and popup.text == "100" and popup.position == Vector2(200, 200):
		_pass("test_factory_method")
	else:
		_fail("test_factory_method", "Factory method should create popup")

	popup.queue_free()
