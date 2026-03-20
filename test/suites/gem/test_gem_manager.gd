extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GemManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_constants()
	await test_get_gem_balance_no_store()
	await test_is_skin_owned()
	await test_skin_equipment_empty()
	await test_unequip_skin()
	await test_get_equipped_skin()
	await test_slot_type_mapping()

	print("\n=== GemManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_gem_manager() -> Node:
	var gem = load("res://autoloads/GemManager.gd").new()
	add_child(gem)
	return gem

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var gem = _create_gem_manager()

	if gem.owned_skins.is_empty():
		_pass("test_initial_owned_skins_empty")
	else:
		_fail("test_initial_owned_skins_empty", "Initial owned skins should be empty")

	if gem.equipped_skins.is_empty():
		_pass("test_initial_equipped_empty")
	else:
		_fail("test_initial_equipped_empty", "Initial equipped skins should be empty")

	gem.queue_free()

func test_constants() -> void:
	var gem = _create_gem_manager()

	if gem.slot_type_mapping.has("helm"):
		_pass("test_slot_mapping_helm")
	else:
		_fail("test_slot_mapping_helm", "Should have helm mapping")

	if gem.slot_type_mapping.has("armor"):
		_pass("test_slot_mapping_armor")
	else:
		_fail("test_slot_mapping_armor", "Should have armor mapping")

	if gem.slot_type_mapping.has("bow"):
		_pass("test_slot_mapping_bow")
	else:
		_fail("test_slot_mapping_bow", "Should have bow mapping")

	if gem.slot_type_mapping.has("arrow"):
		_pass("test_slot_mapping_arrow")
	else:
		_fail("test_slot_mapping_arrow", "Should have arrow mapping")

	gem.queue_free()

func test_get_gem_balance_no_store() -> void:
	var gem = _create_gem_manager()

	# No store manager, should return 0
	var balance = gem.get_gem_balance()

	if balance == 0:
		_pass("test_get_gem_balance_no_store")
	else:
		_fail("test_get_gem_balance_no_store", "Should return 0 without store manager")

	gem.queue_free()

func test_is_skin_owned() -> void:
	var gem = _create_gem_manager()

	if not gem.is_skin_owned("skin_001"):
		_pass("test_is_skin_owned_false")
	else:
		_fail("test_is_skin_owned_false", "Should return false for unowned skin")

	gem.owned_skins.append("skin_001")

	if gem.is_skin_owned("skin_001"):
		_pass("test_is_skin_owned_true")
	else:
		_fail("test_is_skin_owned_true", "Should return true for owned skin")

	gem.queue_free()

func test_skin_equipment_empty() -> void:
	var gem = _create_gem_manager()

	# Test equipping without owning should fail
	var result = gem.equip_skin("helm", "skin_001")

	if not result:
		_pass("test_equip_without_own_fail")
	else:
		_fail("test_equip_without_own_fail", "Should fail when skin not owned")

	gem.queue_free()

func test_unequip_skin() -> void:
	var gem = _create_gem_manager()

	# Unequip from empty slot - should not crash
	gem.unequip_skin("helm")

	if not gem.equipped_skins.has("helm"):
		_pass("test_unequip_empty_slot")
	else:
		_fail("test_unequip_empty_slot", "Should handle unequip from empty slot")

	# Add and unequip
	gem.equipped_skins["helm"] = "skin_001"
	gem.unequip_skin("helm")

	if not gem.equipped_skins.has("helm"):
		_pass("test_unequip_skin")
	else:
		_fail("test_unequip_skin", "Should remove skin from equipped")

	gem.queue_free()

func test_get_equipped_skin() -> void:
	var gem = _create_gem_manager()

	var equipped = gem.get_equipped_skin("helm")

	if equipped == "":
		_pass("test_get_equipped_skin_empty")
	else:
		_fail("test_get_equipped_skin_empty", "Should return empty string for empty slot")

	gem.equipped_skins["helm"] = "skin_001"
	equipped = gem.get_equipped_skin("helm")

	if equipped == "skin_001":
		_pass("test_get_equipped_skin_value")
	else:
		_fail("test_get_equipped_skin_value", "Should return equipped skin id")

	gem.queue_free()

func test_slot_type_mapping() -> void:
	var gem = _create_gem_manager()

	# Verify slot types exist
	var helm_type = gem.slot_type_mapping.get("helm", -1)
	var armor_type = gem.slot_type_mapping.get("armor", -1)
	var bow_type = gem.slot_type_mapping.get("bow", -1)
	var arrow_type = gem.slot_type_mapping.get("arrow", -1)

	if helm_type != -1 and armor_type != -1 and bow_type != -1 and arrow_type != -1:
		_pass("test_slot_type_mapping_complete")
	else:
		_fail("test_slot_type_mapping_complete", "All slot types should be mapped")

	gem.queue_free()
