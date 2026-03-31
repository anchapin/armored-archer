extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running Loadout Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_slot_order_count()
	await test_slot_names_mapping()
	await test_rarity_colors_mapping()
	await test_get_slot_key_helm()
	await test_get_slot_key_armor()
	await test_get_slot_key_bow()
	await test_get_slot_key_arrow()
	await test_get_slot_key_amulet()
	await test_get_slot_key_invalid()
	await test_gear_enums_import()

	print("\n=== Loadout Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func _create_loadout() -> Control:
	var loadout = Control.new()
	loadout.set_script(load("res://scenes/ui/loadout.gd"))
	# Add required child nodes for the scene tree
	var vbox = VBoxContainer.new()
	vbox.name = "VBoxContainer"
	var slots = GridContainer.new()
	slots.name = "SlotsContainer"
	vbox.add_child(slots)
	var stats = VBoxContainer.new()
	stats.name = "StatsContainer"
	vbox.add_child(stats)
	var back_btn = Button.new()
	back_btn.name = "BackButton"
	vbox.add_child(back_btn)
	var inv_btn = Button.new()
	inv_btn.name = "InventoryButton"
	vbox.add_child(inv_btn)
	loadout.add_child(vbox)
	add_child(loadout)
	return loadout

func test_slot_order_count() -> void:
	var loadout = _create_loadout()
	if loadout.SLOT_ORDER.size() == 5:
		_pass("test_slot_order_count")
	else:
		_fail("test_slot_order_count", "SLOT_ORDER should have 5 entries (got %d)" % loadout.SLOT_ORDER.size())
	loadout.queue_free()

func test_slot_names_mapping() -> void:
	var loadout = _create_loadout()
	var names = loadout.SLOT_NAMES
	var passed = names.size() == 5
	if passed:
		_pass("test_slot_names_mapping")
	else:
		_fail("test_slot_names_mapping", "SLOT_NAMES should have 5 entries")
	loadout.queue_free()

func test_rarity_colors_mapping() -> void:
	var loadout = _create_loadout()
	var colors = loadout.rarity_colors
	if colors.has("common") and colors.has("uncommon") and colors.has("rare") and colors.has("legendary"):
		_pass("test_rarity_colors_mapping")
	else:
		_fail("test_rarity_colors_mapping", "rarity_colors should have common, uncommon, rare, legendary")
	loadout.queue_free()

func test_get_slot_key_helm() -> void:
	var loadout = _create_loadout()
	var key = loadout._get_slot_key(loadout.GearEnums.GearType.HELM)
	if key == "helm":
		_pass("test_get_slot_key_helm")
	else:
		_fail("test_get_slot_key_helm", "HELM should map to 'helm' (got '%s')" % key)
	loadout.queue_free()

func test_get_slot_key_armor() -> void:
	var loadout = _create_loadout()
	var key = loadout._get_slot_key(loadout.GearEnums.GearType.ARMOR)
	if key == "armor":
		_pass("test_get_slot_key_armor")
	else:
		_fail("test_get_slot_key_armor", "ARMOR should map to 'armor'")
	loadout.queue_free()

func test_get_slot_key_bow() -> void:
	var loadout = _create_loadout()
	var key = loadout._get_slot_key(loadout.GearEnums.GearType.BOW)
	if key == "bow":
		_pass("test_get_slot_key_bow")
	else:
		_fail("test_get_slot_key_bow", "BOW should map to 'bow'")
	loadout.queue_free()

func test_get_slot_key_arrow() -> void:
	var loadout = _create_loadout()
	var key = loadout._get_slot_key(loadout.GearEnums.GearType.ARROW)
	if key == "arrow":
		_pass("test_get_slot_key_arrow")
	else:
		_fail("test_get_slot_key_arrow", "ARROW should map to 'arrow'")
	loadout.queue_free()

func test_get_slot_key_amulet() -> void:
	var loadout = _create_loadout()
	var key = loadout._get_slot_key(loadout.GearEnums.GearType.AMULET)
	if key == "amulet":
		_pass("test_get_slot_key_amulet")
	else:
		_fail("test_get_slot_key_amulet", "AMULET should map to 'amulet'")
	loadout.queue_free()

func test_get_slot_key_invalid() -> void:
	var loadout = _create_loadout()
	var key = loadout._get_slot_key(99)
	if key == "":
		_pass("test_get_slot_key_invalid")
	else:
		_fail("test_get_slot_key_invalid", "Invalid slot type should return empty string")
	loadout.queue_free()

func test_gear_enums_import() -> void:
	var loadout = _create_loadout()
	if loadout.GearEnums != null:
		_pass("test_gear_enums_import")
	else:
		_fail("test_gear_enums_import", "GearEnums should be imported via preload")
	loadout.queue_free()
