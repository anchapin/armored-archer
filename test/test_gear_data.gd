extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GearData Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_values()
	await test_set_gear_id()
	await test_set_gear_name()
	await test_set_slot_type()
	await test_set_rarity()
	await test_default_stats()
	await test_custom_stats()
	await test_resource_type()

	print("\n=== GearData Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_gear_data() -> Resource:
	return load("res://scenes/player/gear/gear_data.gd").new()

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_default_values() -> void:
	var gd = _create_gear_data()
	var passed = gd.gear_id == "" and gd.gear_name == "" and gd.rarity == "common"
	if passed:
		_pass("test_default_values")
	else:
		_fail("test_default_values", "Default values should be empty strings and 'common' rarity")
	gd.free()

func test_set_gear_id() -> void:
	var gd = _create_gear_data()
	gd.gear_id = "iron_helm_01"
	if gd.gear_id == "iron_helm_01":
		_pass("test_set_gear_id")
	else:
		_fail("test_set_gear_id", "gear_id should be settable")
	gd.free()

func test_set_gear_name() -> void:
	var gd = _create_gear_data()
	gd.gear_name = "Iron Helm"
	if gd.gear_name == "Iron Helm":
		_pass("test_set_gear_name")
	else:
		_fail("test_set_gear_name", "gear_name should be settable")
	gd.free()

func test_set_slot_type() -> void:
	var gd = _create_gear_data()
	# GearSlot.SlotType is referenced, we just verify the property exists and can be assigned
	gd.slot_type = 0  # HELM
	if gd.slot_type == 0:
		_pass("test_set_slot_type")
	else:
		_fail("test_set_slot_type", "slot_type should be settable")
	gd.free()

func test_set_rarity() -> void:
	var gd = _create_gear_data()
	gd.rarity = "legendary"
	if gd.rarity == "legendary":
		_pass("test_set_rarity")
	else:
		_fail("test_set_rarity", "rarity should be settable to 'legendary'")
	gd.free()

func test_default_stats() -> void:
	var gd = _create_gear_data()
	var stats = gd.stats
	if stats.has("attack") and stats.has("defense") and stats.has("speed") and stats.has("health"):
		if stats["attack"] == 0 and stats["defense"] == 0 and stats["speed"] == 0 and stats["health"] == 0:
			_pass("test_default_stats")
		else:
			_fail("test_default_stats", "Default stats should all be 0")
	else:
		_fail("test_default_stats", "Default stats should have attack, defense, speed, health keys")
	gd.free()

func test_custom_stats() -> void:
	var gd = _create_gear_data()
	gd.stats = {"attack": 15, "defense": 10, "speed": 5, "health": 20}
	if gd.stats["attack"] == 15 and gd.stats["defense"] == 10 and gd.stats["speed"] == 5 and gd.stats["health"] == 20:
		_pass("test_custom_stats")
	else:
		_fail("test_custom_stats", "Stats should be settable with custom values")
	gd.free()

func test_resource_type() -> void:
	var gd = _create_gear_data()
	if gd is Resource:
		_pass("test_resource_type")
	else:
		_fail("test_resource_type", "GearData should extend Resource")
	gd.free()
