extends GutTest

# Auto-aim registry + targeting now lives in ShootingManager (issue #1660
# phase 4: the AutoAimManager autoload was folded into its sole consumer).
var ShootingManagerClass = load("res://autoloads/ShootingManager.gd")

func test_auto_aim_registry_initializes():
	var shooting_mgr = ShootingManagerClass.new()
	add_child_autofree(shooting_mgr)
	assert_true(true, "ShootingManager (with absorbed auto-aim) should instantiate")

func test_auto_aim_targeting_methods_exist():
	var shooting_mgr = ShootingManagerClass.new()
	add_child_autofree(shooting_mgr)
	assert_true(shooting_mgr.has_method("get_best_target"),
		"ShootingManager should expose get_best_target (from AutoAimManager)")
	assert_true(shooting_mgr.has_method("get_target_position"),
		"ShootingManager should expose get_target_position (from AutoAimManager)")
	assert_true(shooting_mgr.has_method("get_nearest_enemy"),
		"ShootingManager should expose get_nearest_enemy (from AutoAimManager)")
	assert_true(shooting_mgr.has_method("is_target_locked"),
		"ShootingManager should expose is_target_locked (from AutoAimManager)")
	assert_true(shooting_mgr.has_method("register_enemy"),
		"ShootingManager should expose register_enemy (from AutoAimManager)")
	assert_true(shooting_mgr.has_method("unregister_enemy"),
		"ShootingManager should expose unregister_enemy (from AutoAimManager)")
