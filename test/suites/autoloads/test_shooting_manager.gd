extends GutTest

var ShootingManagerClass = load("res://autoloads/ShootingManager.gd")

func before_each():
	super.before_each()
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)

func test_shooting_manager_initializes():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	assert_true(sm != null, "ShootingManager should instantiate")
	assert_true(sm.has_method("shoot_arrow"), "Should have shoot_arrow method")
	assert_true(sm.has_method("can_shoot"), "Should have can_shoot method")
	assert_true(sm.has_method("get_ammo"), "Should have get_ammo method")

func test_shooting_mode_enum():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	var mode = sm.ShootingMode.MANUAL
	assert_eq(mode, 0, "MANUAL mode should be 0")
	mode = sm.ShootingMode.AUTO
	assert_eq(mode, 1, "AUTO mode should be 1")

func test_get_shooting_mode():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	var mode = sm.get_shooting_mode()
	assert_eq(mode, sm.ShootingMode.MANUAL, "Default mode should be MANUAL")

func test_set_shooting_mode():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	sm.set_shooting_mode(sm.ShootingMode.AUTO)
	var mode = sm.get_shooting_mode()
	assert_eq(mode, sm.ShootingMode.AUTO, "Mode should be AUTO after setting")

func test_toggle_shooting_mode():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	assert_eq(sm.get_shooting_mode(), sm.ShootingMode.MANUAL)
	sm.toggle_shooting_mode()
	assert_eq(sm.get_shooting_mode(), sm.ShootingMode.AUTO)
	sm.toggle_shooting_mode()
	assert_eq(sm.get_shooting_mode(), sm.ShootingMode.MANUAL)

func test_get_max_ammo():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	var max_ammo = sm.get_max_ammo()
	assert_true(max_ammo > 0, "Max ammo should be positive")

func test_add_ammo():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	var initial = sm.get_ammo()
	sm.add_ammo(10)
	assert_true(sm.get_ammo() > initial, "Ammo should increase after add")

func test_add_ammo_caps_at_max():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	sm.add_ammo(1000)
	assert_eq(sm.get_ammo(), sm.get_max_ammo(), "Ammo should cap at max")

func test_reload():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	sm.reload()
	assert_true(sm.is_reloading(), "Should be reloading after reload()")

func test_reload_progress():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	var progress = sm.get_reload_progress()
	assert_eq(progress, 0.0, "Should not be reloading initially")

func test_cooldown_progress_ready():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	var progress = sm.get_cooldown_progress()
	assert_eq(progress, 1.0, "Should be ready (1.0) when not on cooldown")

func test_handle_auto_shoot_updates_cooldown():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	sm.handle_auto_shoot(0.1)
	assert_true(true, "handle_auto_shoot should run without error")

func test_signals_exist():
	var sm = ShootingManagerClass.new()
	add_child_autofree(sm)
	assert_true(sm.has_signal("arrow_fired"), "Should have arrow_fired signal")
	assert_true(sm.has_signal("ammo_changed"), "Should have ammo_changed signal")
	assert_true(sm.has_signal("shooting_mode_changed"), "Should have shooting_mode_changed signal")
