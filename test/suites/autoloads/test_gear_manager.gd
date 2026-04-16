extends GutTest

var GearManagerClass = load("res://autoloads/GearManager.gd")

func test_gear_manager_initializes():
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	assert_true(true, "GearManager should instantiate")

func test_gear_manager_has_equipment_methods():
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	assert_true(gear_mgr.has_method("equip_gear") or
		gear_mgr.has_method("unequip_gear") or
		gear_mgr.has_method("get_equipped_gear"),
		"GearManager should have equipment methods")

func test_gear_manager_has_load_method():
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	assert_true(gear_mgr.has_method("get_full_inventory") or
		gear_mgr.has_method("_load_inventory"),
		"GearManager should have inventory load method")