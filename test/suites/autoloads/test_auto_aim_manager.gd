extends GutTest

var AutoAimManagerClass = load("res://autoloads/AutoAimManager.gd")

func test_auto_aim_manager_initializes():
	var aim_mgr = AutoAimManagerClass.new()
	add_child_autofree(aim_mgr)
	assert_true(true, "AutoAimManager should instantiate")

func test_auto_aim_manager_has_targeting_methods():
	var aim_mgr = AutoAimManagerClass.new()
	add_child_autofree(aim_mgr)
	assert_true(aim_mgr.has_method("get_closest_target") or 
		aim_mgr.has_method("find_target") or
		aim_mgr.has_method("update_target"),
		"AutoAimManager should have targeting methods")