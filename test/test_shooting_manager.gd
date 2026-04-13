extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ShootingManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_shooting_mode_enum()
	await test_can_shoot_initial()
	await test_can_shoot_no_ammo()
	await test_can_shoot_reloading()
	await test_can_shoot_on_cooldown()
	await test_can_shoot_ready()
	await test_get_ammo()
	await test_get_max_ammo()
	await test_add_ammo()
	await test_set_shooting_mode()
	await test_toggle_shooting_mode()
	await test_get_shooting_mode()
	await test_reload_when_full()
	await test_reload_when_empty()
	await test_reload_progress()
	await test_cooldown_progress()
	await test_handle_auto_shoot_cooldown_tick()
	await test_handle_auto_shoot_reload_tick()

	print("\n=== ShootingManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_shooting_manager() -> Node:
	var sm = load("res://autoloads/ShootingManager.gd").new()
	add_child(sm)
	# Wait for _ready() to complete
	await get_tree().process_frame
	return sm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var sm = _create_shooting_manager()

	if sm.get_shooting_mode() == sm.ShootingMode.MANUAL and sm.get_ammo() == 50 and sm.get_max_ammo() == 50 and not sm.is_reloading():
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be MANUAL mode with max ammo")

	sm.queue_free()

func test_shooting_mode_enum() -> void:
	var sm = _create_shooting_manager()

	if sm.ShootingMode.MANUAL == 0 and sm.ShootingMode.AUTO == 1:
		_pass("test_shooting_mode_enum")
	else:
		_fail("test_shooting_mode_enum", "ShootingMode enum values should be correct")

	sm.queue_free()

func test_can_shoot_initial() -> void:
	var sm = _create_shooting_manager()

	if sm.can_shoot():
		_pass("test_can_shoot_initial")
	else:
		_fail("test_can_shoot_initial", "Should be able to shoot initially")

	sm.queue_free()

func test_can_shoot_no_ammo() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 0

	if not sm.can_shoot():
		_pass("test_can_shoot_no_ammo")
	else:
		_fail("test_can_shoot_no_ammo", "Should not be able to shoot with no ammo")

	sm.queue_free()

func test_can_shoot_reloading() -> void:
	var sm = _create_shooting_manager()
	sm._is_reloading = true
	sm._current_ammo = 50

	if not sm.can_shoot():
		_pass("test_can_shoot_reloading")
	else:
		_fail("test_can_shoot_reloading", "Should not be able to shoot while reloading")

	sm.queue_free()

func test_can_shoot_on_cooldown() -> void:
	var sm = _create_shooting_manager()
	sm._cooldown_timer = 0.5

	if not sm.can_shoot():
		_pass("test_can_shoot_on_cooldown")
	else:
		_fail("test_can_shoot_on_cooldown", "Should not be able to shoot on cooldown")

	sm.queue_free()

func test_can_shoot_ready() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 10
	sm._cooldown_timer = 0.0
	sm._is_reloading = false

	if sm.can_shoot():
		_pass("test_can_shoot_ready")
	else:
		_fail("test_can_shoot_ready", "Should be able to shoot when ready")

	sm.queue_free()

func test_get_ammo() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 25

	if sm.get_ammo() == 25:
		_pass("test_get_ammo")
	else:
		_fail("test_get_ammo", "Should return correct ammo count")

	sm.queue_free()

func test_get_max_ammo() -> void:
	var sm = _create_shooting_manager()

	if sm.get_max_ammo() == 50:
		_pass("test_get_max_ammo")
	else:
		_fail("test_get_max_ammo", "Should return max ammo (50)")

	sm.queue_free()

func test_add_ammo() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 30
	sm.add_ammo(15)

	if sm.get_ammo() == 45:
		_pass("test_add_ammo")
	else:
		_fail("test_add_ammo", "Should add ammo up to max")

	sm.queue_free()

func test_add_ammo_exceeds_max() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 45
	sm.add_ammo(20)

	if sm.get_ammo() == 50:
		_pass("test_add_ammo_exceeds_max")
	else:
		_fail("test_add_ammo_exceeds_max", "Should cap ammo at max")

	sm.queue_free()

func test_set_shooting_mode() -> void:
	var sm = _create_shooting_manager()
	sm.set_shooting_mode(sm.ShootingMode.AUTO)

	if sm.get_shooting_mode() == sm.ShootingMode.AUTO:
		_pass("test_set_shooting_mode")
	else:
		_fail("test_set_shooting_mode", "Should set shooting mode to AUTO")

	sm.queue_free()

func test_toggle_shooting_mode() -> void:
	var sm = _create_shooting_manager()
	sm._shooting_mode = sm.ShootingMode.MANUAL
	sm.toggle_shooting_mode()

	if sm.get_shooting_mode() == sm.ShootingMode.AUTO:
		_pass("test_toggle_shooting_mode")
	else:
		_fail("test_toggle_shooting_mode", "Should toggle from MANUAL to AUTO")

	sm.queue_free()

func test_get_shooting_mode() -> void:
	var sm = _create_shooting_manager()
	sm._shooting_mode = sm.ShootingMode.AUTO

	if sm.get_shooting_mode() == sm.ShootingMode.AUTO:
		_pass("test_get_shooting_mode")
	else:
		_fail("test_get_shooting_mode", "Should return current shooting mode")

	sm.queue_free()

func test_reload_when_full() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 50
	sm.reload()

	if sm.get_ammo() == 50 and not sm.is_reloading():
		_pass("test_reload_when_full")
	else:
		_fail("test_reload_when_full", "Should not reload when ammo is full")

	sm.queue_free()

func test_reload_when_empty() -> void:
	var sm = _create_shooting_manager()
	sm._current_ammo = 0
	sm.reload()

	if sm.is_reloading() and sm._reload_timer > 0:
		_pass("test_reload_when_empty")
	else:
		_fail("test_reload_when_empty", "Should start reload when ammo is empty")

	sm.queue_free()

func test_reload_progress() -> void:
	var sm = _create_shooting_manager()
	sm._is_reloading = true
	sm._reload_timer = 1.0

	var progress = sm.get_reload_progress()

	if progress > 0.0 and progress < 1.0:
		_pass("test_reload_progress")
	else:
		_fail("test_reload_progress", "Should return reload progress between 0 and 1")

	sm.queue_free()

func test_reload_progress_not_reloading() -> void:
	var sm = _create_shooting_manager()
	sm._is_reloading = false

	if sm.get_reload_progress() == 0.0:
		_pass("test_reload_progress_not_reloading")
	else:
		_fail("test_reload_progress_not_reloading", "Should return 0 when not reloading")

	sm.queue_free()

func test_cooldown_progress() -> void:
	var sm = _create_shooting_manager()
	sm._cooldown_timer = 0.25

	var progress = sm.get_cooldown_progress()

	if progress > 0.0 and progress < 1.0:
		_pass("test_cooldown_progress")
	else:
		_fail("test_cooldown_progress", "Should return cooldown progress between 0 and 1")

	sm.queue_free()

func test_cooldown_progress_ready() -> void:
	var sm = _create_shooting_manager()
	sm._cooldown_timer = 0.0

	if sm.get_cooldown_progress() == 1.0:
		_pass("test_cooldown_progress_ready")
	else:
		_fail("test_cooldown_progress_ready", "Should return 1.0 when cooldown is ready")

	sm.queue_free()

func test_handle_auto_shoot_cooldown_tick() -> void:
	var sm = _create_shooting_manager()
	sm._cooldown_timer = 0.3

	sm.handle_auto_shoot(0.1)

	if sm._cooldown_timer < 0.3:
		_pass("test_handle_auto_shoot_cooldown_tick")
	else:
		_fail("test_handle_auto_shoot_cooldown_tick", "Cooldown should decrease")

	sm.queue_free()

func test_handle_auto_shoot_reload_tick() -> void:
	var sm = _create_shooting_manager()
	sm._is_reloading = true
	sm._reload_timer = 0.5

	sm.handle_auto_shoot(0.3)

	if sm._reload_timer < 0.5:
		_pass("test_handle_auto_shoot_reload_tick")
	else:
		_fail("test_handle_auto_shoot_reload_tick", "Reload timer should decrease")

	sm.queue_free()

func test_handle_auto_shoot_finish_reload() -> void:
	var sm = _create_shooting_manager()
	sm._is_reloading = true
	sm._reload_timer = 0.1
	sm._current_ammo = 0

	sm.handle_auto_shoot(0.2)

	if not sm._is_reloading and sm._current_ammo == 50:
		_pass("test_handle_auto_shoot_finish_reload")
	else:
		_fail("test_handle_auto_shoot_finish_reload", "Reload should finish and ammo restored")

	sm.queue_free()
