extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

# Preload gear enums for access to SlotType
const GearEnums = preload("res://scripts/gear_enums.gd")

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GearRegistry Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_databases()
	await test_get_base_gear()
	await test_get_skin()
	await test_get_gear_by_slot()
	await test_get_skins_by_slot()
	await test_calculate_total_stats()
	await test_get_nonexistent_gear()
	await test_get_nonexistent_skin()

	print("\n=== GearRegistry Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_gear_registry() -> Node:
	var reg = load("res://autoloads/GearRegistry.gd").new()
	add_child(reg)
	return reg

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_databases() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	if not reg.base_gear_db.is_empty():
		_pass("test_base_gear_db_populated")
	else:
		_fail("test_base_gear_db_populated", "Base gear DB should be populated")

	if not reg.skin_db.is_empty():
		_pass("test_skin_db_populated")
	else:
		_fail("test_skin_db_populated", "Skin DB should be populated")

	reg.queue_free()

func test_get_base_gear() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var gear = reg.get_base_gear("helm_basic")

	if gear != null and gear.gear_id == "helm_basic":
		_pass("test_get_base_gear_exists")
	else:
		_fail("test_get_base_gear_exists", "Should return gear data")

	var gear_data = reg.get_base_gear("helm_iron")
	if gear_data and gear_data.rarity == "rare":
		_pass("test_gear_rarity")
	else:
		_fail("test_gear_rarity", "Gear should have correct rarity")

	reg.queue_free()

func test_get_skin() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var skin = reg.get_skin("skin_helm_golden")

	if skin != null and skin.skin_id == "skin_helm_golden":
		_pass("test_get_skin_exists")
	else:
		_fail("test_get_skin_exists", "Should return skin data")

	if skin and skin.price == 500:
		_pass("test_skin_price")
	else:
		_fail("test_skin_price", "Skin should have correct price")

	if skin and skin.is_premium == true:
		_pass("test_skin_premium")
	else:
		_fail("test_skin_premium", "Skin should have correct premium status")

	reg.queue_free()

func test_get_gear_by_slot() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var helms = reg.get_gear_by_slot(GearEnums.SlotType.HELM)

	if helms.size() >= 3:
		_pass("test_get_gear_by_slot_helm")
	else:
		_fail("test_get_gear_by_slot_helm", "Should have multiple helm options")

	var bows = reg.get_gear_by_slot(GearEnums.SlotType.BOW)
	if bows.size() >= 3:
		_pass("test_get_gear_by_slot_bow")
	else:
		_fail("test_get_gear_by_slot_bow", "Should have multiple bow options")

	reg.queue_free()

func test_get_skins_by_slot() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var helm_skins = reg.get_skins_by_slot(GearEnums.SlotType.HELM)

	if helm_skins.size() >= 3:
		_pass("test_get_skins_by_slot_helm")
	else:
		_fail("test_get_skins_by_slot_helm", "Should have multiple helm skins")

	var bow_skins = reg.get_skins_by_slot(GearEnums.SlotType.BOW)
	if bow_skins.size() >= 3:
		_pass("test_get_skins_by_slot_bow")
	else:
		_fail("test_get_skins_by_slot_bow", "Should have multiple bow skins")

	reg.queue_free()

func test_calculate_total_stats() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var loadout = {
		"base_gear": {
			"helm": "helm_iron",
			"armor": "armor_chain",
			"bow": "bow_composite",
			"arrow": "arrow_iron"
		}
	}

	var stats = reg.calculate_total_stats(loadout)

	# helm_iron: 0 atk, 5 def, 0 spd, 10 hp
	# armor_chain: 0 atk, 15 def, 0 spd, 10 hp
	# bow_composite: 15 atk, 0 def, 0 spd, 0 hp
	# arrow_iron: 5 atk, 0 def, 0 spd, 0 hp
	# Total: 20 atk, 20 def, 0 spd, 20 hp

	if stats.attack == 20:
		_pass("test_calculate_stats_attack")
	else:
		_fail("test_calculate_stats_attack", "Attack should be 20, got %d" % stats.attack)

	if stats.defense == 20:
		_pass("test_calculate_stats_defense")
	else:
		_fail("test_calculate_stats_defense", "Defense should be 20, got %d" % stats.defense)

	if stats.health == 20:
		_pass("test_calculate_stats_health")
	else:
		_fail("test_calculate_stats_health", "Health should be 20, got %d" % stats.health)

	# Test with empty loadout
	var empty_stats = reg.calculate_total_stats({})
	if empty_stats.attack == 0:
		_pass("test_calculate_stats_empty")
	else:
		_fail("test_calculate_stats_empty", "Empty loadout should have 0 attack")

	reg.queue_free()

func test_get_nonexistent_gear() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var gear = reg.get_base_gear("nonexistent_gear")

	if gear == null:
		_pass("test_get_nonexistent_gear")
	else:
		_fail("test_get_nonexistent_gear", "Should return null for nonexistent gear")

	reg.queue_free()

func test_get_nonexistent_skin() -> void:
	var reg = _create_gear_registry()
	await get_tree().process_frame

	var skin = reg.get_skin("nonexistent_skin")

	if skin == null:
		_pass("test_get_nonexistent_skin")
	else:
		_fail("test_get_nonexistent_skin", "Should return null for nonexistent skin")

	reg.queue_free()
