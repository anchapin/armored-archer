extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running CosmeticSkinData Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_values()
	await test_set_skin_id()
	await test_set_skin_name()
	await test_set_slot_type()
	await test_set_base_gear_required()
	await test_set_price()
	await test_set_is_premium()
	await test_resource_type()

	print("\n=== CosmeticSkinData Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_skin_data() -> Resource:
	return load("res://scenes/player/gear/cosmetic_skin_data.gd").new()

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_default_values() -> void:
	var skin = _create_skin_data()
	var passed = skin.skin_id == "" and skin.skin_name == "" and skin.price == 0 and skin.is_premium == false and skin.base_gear_required == ""
	if passed:
		_pass("test_default_values")
	else:
		_fail("test_default_values", "Default values should be empty/zero/false")
	skin.free()

func test_set_skin_id() -> void:
	var skin = _create_skin_data()
	skin.skin_id = "flame_skin_01"
	if skin.skin_id == "flame_skin_01":
		_pass("test_set_skin_id")
	else:
		_fail("test_set_skin_id", "skin_id should be settable")
	skin.free()

func test_set_skin_name() -> void:
	var skin = _create_skin_data()
	skin.skin_name = "Flame Armor"
	if skin.skin_name == "Flame Armor":
		_pass("test_set_skin_name")
	else:
		_fail("test_set_skin_name", "skin_name should be settable")
	skin.free()

func test_set_slot_type() -> void:
	var skin = _create_skin_data()
	skin.slot_type = 1  # ARMOR
	if skin.slot_type == 1:
		_pass("test_set_slot_type")
	else:
		_fail("test_set_slot_type", "slot_type should be settable")
	skin.free()

func test_set_base_gear_required() -> void:
	var skin = _create_skin_data()
	skin.base_gear_required = "iron_helm"
	if skin.base_gear_required == "iron_helm":
		_pass("test_set_base_gear_required")
	else:
		_fail("test_set_base_gear_required", "base_gear_required should be settable")
	skin.free()

func test_set_price() -> void:
	var skin = _create_skin_data()
	skin.price = 500
	if skin.price == 500:
		_pass("test_set_price")
	else:
		_fail("test_set_price", "price should be settable")
	skin.free()

func test_set_is_premium() -> void:
	var skin = _create_skin_data()
	skin.is_premium = true
	if skin.is_premium == true:
		_pass("test_set_is_premium")
	else:
		_fail("test_set_is_premium", "is_premium should be settable")
	skin.free()

func test_resource_type() -> void:
	var skin = _create_skin_data()
	if skin is Resource:
		_pass("test_resource_type")
	else:
		_fail("test_resource_type", "CosmeticSkinData should extend Resource")
	skin.free()
