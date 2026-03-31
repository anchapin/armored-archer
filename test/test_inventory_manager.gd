extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running InventoryManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_gear_slot_enum()
	await test_get_total_stats_empty()
	await test_get_total_stats_with_gear()
	await test_get_gear_info()
	await test_get_gear_info_not_found()
	await test_get_equipped_gear_id()
	await test_get_all_equipped_gear()
	await test_get_inventory_size()
	await test_is_gear_equipped()
	await test_get_slot_name()
	await test_equip_gear_not_loaded()
	await test_unequip_gear_not_loaded()
	await test_unequip_empty_slot()
	await test_equip_gear_invalid_slot()
	await test_equip_gear_not_in_inventory()
	await test_unequip_gear_invalid_slot()
	await test_get_total_stats_with_missing_gear()
	await test_stats_updated_signal()
	await test_equipped_gear_isolation()

	print("\n=== InventoryManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_inventory_manager() -> Node:
	var im = load("res://autoloads/InventoryManager.gd").new()
	add_child(im)
	return im

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var im = _create_inventory_manager()

	if im.inventory.is_empty() and im.equipped_gear.size() == 5 and not im.is_loading and not im._loaded:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should have empty inventory and 5 gear slots")

	im.queue_free()

func test_gear_slot_enum() -> void:
	var im = _create_inventory_manager()

	if im.GearSlot.HEAD == 0 and im.GearSlot.CHEST == 1 and im.GearSlot.HANDS == 2 and im.GearSlot.LEGS == 3 and im.GearSlot.FEET == 4:
		_pass("test_gear_slot_enum")
	else:
		_fail("test_gear_slot_enum", "GearSlot enum values should be correct")

	im.queue_free()

func test_get_total_stats_empty() -> void:
	var im = _create_inventory_manager()
	im._loaded = true

	var stats = im.get_total_stats()

	if stats.has("attack") and stats.attack == 0 and stats.has("defense") and stats.defense == 0 and stats.has("critical_chance") and stats.critical_chance == 0.0:
		_pass("test_get_total_stats_empty")
	else:
		_fail("test_get_total_stats_empty", "Empty gear should return zero stats")

	im.queue_free()

func test_get_total_stats_with_gear() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.inventory = {
		"gear_helm_01": {
			"name": "Iron Helm",
			"stats": {"attack": 5, "defense": 10, "health": 20, "speed": 2, "critical_chance": 0.05, "armor_penetration": 0.1}
		},
		"gear_armor_01": {
			"name": "Steel Armor",
			"stats": {"attack": 2, "defense": 25, "health": 50, "speed": -5, "critical_chance": 0.0, "armor_penetration": 0.0}
		}
	}
	im.equipped_gear = ["gear_helm_01", "gear_armor_01", "", "", ""]

	var stats = im.get_total_stats()

	if stats.attack == 7 and stats.defense == 35 and stats.health == 70 and stats.speed == -3 and stats.critical_chance == 0.05 and stats.armor_penetration == 0.1:
		_pass("test_get_total_stats_with_gear")
	else:
		_fail("test_get_total_stats_with_gear", "Expected attack=7, defense=35, health=70, speed=-3, crit=0.05, armor_pen=0.1, got: " + str(stats))

	im.queue_free()

func test_get_gear_info() -> void:
	var im = _create_inventory_manager()
	im.inventory = {
		"gear_test_01": {"name": "Test Gear", "type": "weapon", "rarity": "rare"}
	}

	var info = im.get_gear_info("gear_test_01")

	if info.has("name") and info.name == "Test Gear":
		_pass("test_get_gear_info")
	else:
		_fail("test_get_gear_info", "Should return gear info by ID")

	im.queue_free()

func test_get_equipped_gear_id() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.equipped_gear = ["helm_01", "armor_01", "", "", ""]

	if im.get_equipped_gear_id(0) == "helm_01" and im.get_equipped_gear_id(1) == "armor_01" and im.get_equipped_gear_id(5).is_empty():
		_pass("test_get_equipped_gear_id")
	else:
		_fail("test_get_equipped_gear_id", "Should return correct equipped gear ID")

	im.queue_free()

func test_get_all_equipped_gear() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.equipped_gear = ["a", "b", "c", "d", "e"]

	var all_gear = im.get_all_equipped_gear()

	if all_gear.size() == 5 and all_gear[0] == "a" and all_gear[4] == "e":
		_pass("test_get_all_equipped_gear")
	else:
		_fail("test_get_all_equipped_gear", "Should return copy of equipped gear array")

	im.queue_free()

func test_get_inventory_size() -> void:
	var im = _create_inventory_manager()
	im.inventory = {"a": {}, "b": {}, "c": {}}

	if im.get_inventory_size() == 3:
		_pass("test_get_inventory_size")
	else:
		_fail("test_get_inventory_size", "Should return correct inventory size")

	im.queue_free()

func test_is_gear_equipped() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.equipped_gear = ["helm_01", "", "weapon_01", "", ""]

	if im.is_gear_equipped("helm_01") and im.is_gear_equipped("weapon_01") and not im.is_gear_equipped("missing_01"):
		_pass("test_is_gear_equipped")
	else:
		_fail("test_is_gear_equipped", "Should correctly check if gear is equipped")

	im.queue_free()

func test_get_slot_name() -> void:
	var im = _create_inventory_manager()

	if im.get_slot_name(0) == "Head" and im.get_slot_name(1) == "Chest" and im.get_slot_name(2) == "Hands" and im.get_slot_name(3) == "Legs" and im.get_slot_name(4) == "Feet" and im.get_slot_name(99) == "Unknown":
		_pass("test_get_slot_name")
	else:
		_fail("test_get_slot_name", "Should return correct slot names")

	im.queue_free()

func test_equip_gear_not_loaded() -> void:
	var im = _create_inventory_manager()
	im.inventory = {"gear_01": {}}

	var result = im.equip_gear("gear_01", 0)

	if not result:
		_pass("test_equip_gear_not_loaded")
	else:
		_fail("test_equip_gear_not_loaded", "Should fail when inventory not loaded")

	im.queue_free()

func test_unequip_gear_not_loaded() -> void:
	var im = _create_inventory_manager()

	var result = im.unequip_gear(0)

	if not result:
		_pass("test_unequip_gear_not_loaded")
	else:
		_fail("test_unequip_gear_not_loaded", "Should fail when inventory not loaded")

	im.queue_free()

func test_unequip_empty_slot() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.equipped_gear = ["", "", "", "", ""]

	var result = im.unequip_gear(0)

	if result:
		_pass("test_unequip_empty_slot")
	else:
		_fail("test_unequip_empty_slot", "Should succeed when unequipping empty slot")

	im.queue_free()

func test_get_gear_info_not_found() -> void:
	var im = _create_inventory_manager()

	var info = im.get_gear_info("nonexistent_gear")

	if info.is_empty():
		_pass("test_get_gear_info_not_found")
	else:
		_fail("test_get_gear_info_not_found", "Should return empty dict for nonexistent gear")

	im.queue_free()

func test_equip_gear_invalid_slot() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.inventory = {"gear_01": {}}

	var result = im.equip_gear("gear_01", 99)

	if not result:
		_pass("test_equip_gear_invalid_slot")
	else:
		_fail("test_equip_gear_invalid_slot", "Should fail with invalid slot")

	im.queue_free()

func test_equip_gear_not_in_inventory() -> void:
	var im = _create_inventory_manager()
	im._loaded = true

	var result = im.equip_gear("nonexistent_gear", 0)

	if not result:
		_pass("test_equip_gear_not_in_inventory")
	else:
		_fail("test_equip_gear_not_in_inventory", "Should fail when gear not in inventory")

	im.queue_free()

func test_unequip_gear_invalid_slot() -> void:
	var im = _create_inventory_manager()
	im._loaded = true

	var result = im.unequip_gear(-1)

	if not result:
		_pass("test_unequip_gear_invalid_slot")
	else:
		_fail("test_unequip_gear_invalid_slot", "Should fail with invalid slot")

	im.queue_free()

func test_get_total_stats_with_missing_gear() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.equipped_gear = ["nonexistent_gear", "", "", "", ""]

	var stats = im.get_total_stats()

	if stats.attack == 0 and stats.defense == 0:
		_pass("test_get_total_stats_with_missing_gear")
	else:
		_fail("test_get_total_stats_with_missing_gear", "Missing gear should not contribute stats")

	im.queue_free()

func test_stats_updated_signal() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.inventory = {
		"gear_01": {
			"name": "Test Gear",
			"stats": {"attack": 10, "defense": 5, "health": 20, "speed": 3, "critical_chance": 0.1, "armor_penetration": 0.05}
		}
	}
	im.equipped_gear = ["gear_01", "", "", "", ""]

	var signal_emitted = false
	var emitted_stats = {}

	im.stats_updated.connect(func(stats: Dictionary):
		signal_emitted = true
		emitted_stats = stats
	)

	im._update_total_stats()

	if signal_emitted:
		_pass("test_stats_updated_signal_emitted")
	else:
		_fail("test_stats_updated_signal_emitted", "stats_updated signal should emit")

	if emitted_stats.has("attack") and emitted_stats.attack == 10:
		_pass("test_stats_updated_signal_contains_stats")
	else:
		_fail("test_stats_updated_signal_contains_stats", "Signal should contain calculated stats")

	im.queue_free()

func test_equipped_gear_isolation() -> void:
	var im = _create_inventory_manager()
	im._loaded = true
	im.equipped_gear = ["a", "b", "c", "d", "e"]

	var copy = im.get_all_equipped_gear()
	copy[0] = "modified"

	if im.get_equipped_gear_id(0) == "a":
		_pass("test_equipped_gear_isolation")
	else:
		_fail("test_equipped_gear_isolation", "get_all_equipped_gear should return a copy")

	im.queue_free()
