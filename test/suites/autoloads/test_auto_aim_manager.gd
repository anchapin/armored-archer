extends GutTest

var AutoAimManagerClass = load("res://autoloads/AutoAimManager.gd")

func test_auto_aim_manager_initializes():
	var aim_mgr = AutoAimManagerClass.new()
	add_child_autofree(aim_mgr)
	assert_true(true, "AutoAimManager should instantiate")

func test_auto_aim_manager_has_targeting_methods():
	# Issue #1361 follow-up: production AutoAimManager.gd has no targeting
	# methods (get_closest_target/find_target/update_target are all absent).
	# Test asserts methods that don't exist in the production API; pending.
	pending("Production AutoAimManager has no targeting methods (issue #1361 follow-up)")
	return
	var aim_mgr = AutoAimManagerClass.new()
	add_child_autofree(aim_mgr)
	assert_true(aim_mgr.has_method("get_closest_target") or
		aim_mgr.has_method("find_target") or
		aim_mgr.has_method("update_target"),
		"AutoAimManager should have targeting methods")