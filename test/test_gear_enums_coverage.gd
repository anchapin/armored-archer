extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GearEnums Coverage Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_all_slot_type_values()
	await test_slot_type_gear_type_equivalence()
	await test_all_rarity_values()
	await test_all_modifier_types()
	await test_all_stat_types()
	await test_gear_type_to_string_all()
	await test_string_to_gear_type_all()
	await test_gear_rarity_to_string_all()
	await test_string_to_gear_rarity_all()
	await test_get_rarity_color_all()
	await test_get_rarity_display_name_all()
	await test_case_insensitive_string_conversions()
	await test_roundtrip_gear_type_conversion()
	await test_roundtrip_rarity_conversion()

	print("\n=== GearEnums Coverage Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

const GE = preload("res://scripts/gear_enums.gd")

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_all_slot_type_values() -> void:
	var passed = (
		GE.SlotType.HELM == 0 and
		GE.SlotType.ARMOR == 1 and
		GE.SlotType.BOW == 2 and
		GE.SlotType.ARROW == 3 and
		GE.SlotType.AMULET == 4
	)
	if passed:
		_pass("test_all_slot_type_values")
	else:
		_fail("test_all_slot_type_values", "SlotType values should be 0-4")

func test_slot_type_gear_type_equivalence() -> void:
	# GearType is an alias for SlotType
	var passed = (
		GE.GearType.HELM == GE.SlotType.HELM and
		GE.GearType.ARMOR == GE.SlotType.ARMOR and
		GE.GearType.BOW == GE.SlotType.BOW and
		GE.GearType.ARROW == GE.SlotType.ARROW and
		GE.GearType.AMULET == GE.SlotType.AMULET
	)
	if passed:
		_pass("test_slot_type_gear_type_equivalence")
	else:
		_fail("test_slot_type_gear_type_equivalence", "GearType should mirror SlotType values")

func test_all_rarity_values() -> void:
	var passed = (
		GE.GearRarity.COMMON == 0 and
		GE.GearRarity.RARE == 1 and
		GE.GearRarity.EPIC == 2 and
		GE.GearRarity.LEGENDARY == 3
	)
	if passed:
		_pass("test_all_rarity_values")
	else:
		_fail("test_all_rarity_values", "GearRarity values should be 0-3")

func test_all_modifier_types() -> void:
	var passed = (
		GE.ModifierType.STAT_BONUS == 0 and
		GE.ModifierType.ABILITY_MODIFIER == 1 and
		GE.ModifierType.SET_BONUS == 2 and
		GE.ModifierType.SOCKET == 3 and
		GE.ModifierType.PASSIVE == 4
	)
	if passed:
		_pass("test_all_modifier_types")
	else:
		_fail("test_all_modifier_types", "ModifierType values should be 0-4")

func test_all_stat_types() -> void:
	var passed = (
		GE.StatType.HEALTH == 0 and
		GE.StatType.ATTACK == 1 and
		GE.StatType.DEFENSE == 2 and
		GE.StatType.SPEED == 3 and
		GE.StatType.CRITICAL_CHANCE == 4 and
		GE.StatType.CRITICAL_DAMAGE == 5 and
		GE.StatType.ABILITY_POWER == 6 and
		GE.StatType.ABILITY_HASTE == 7 and
		GE.StatType.ARMOR_PENETRATION == 8 and
		GE.StatType.LIFE_STEAL == 9
	)
	if passed:
		_pass("test_all_stat_types")
	else:
		_fail("test_all_stat_types", "StatType values should be 0-9")

func test_gear_type_to_string_all() -> void:
	var passed = (
		GE.gear_type_to_string(GE.SlotType.HELM) == "helm" and
		GE.gear_type_to_string(GE.SlotType.ARMOR) == "armor" and
		GE.gear_type_to_string(GE.SlotType.BOW) == "bow" and
		GE.gear_type_to_string(GE.SlotType.ARROW) == "arrow" and
		GE.gear_type_to_string(GE.SlotType.AMULET) == "amulet"
	)
	if passed:
		_pass("test_gear_type_to_string_all")
	else:
		_fail("test_gear_type_to_string_all", "gear_type_to_string should handle all types")

func test_string_to_gear_type_all() -> void:
	var passed = (
		GE.string_to_gear_type("helm") == GE.SlotType.HELM and
		GE.string_to_gear_type("armor") == GE.SlotType.ARMOR and
		GE.string_to_gear_type("bow") == GE.SlotType.BOW and
		GE.string_to_gear_type("arrow") == GE.SlotType.ARROW and
		GE.string_to_gear_type("amulet") == GE.SlotType.AMULET
	)
	if passed:
		_pass("test_string_to_gear_type_all")
	else:
		_fail("test_string_to_gear_type_all", "string_to_gear_type should handle all type strings")

func test_gear_rarity_to_string_all() -> void:
	var passed = (
		GE.gear_rarity_to_string(GE.GearRarity.COMMON) == "common" and
		GE.gear_rarity_to_string(GE.GearRarity.RARE) == "rare" and
		GE.gear_rarity_to_string(GE.GearRarity.EPIC) == "epic" and
		GE.gear_rarity_to_string(GE.GearRarity.LEGENDARY) == "legendary"
	)
	if passed:
		_pass("test_gear_rarity_to_string_all")
	else:
		_fail("test_gear_rarity_to_string_all", "gear_rarity_to_string should handle all rarities")

func test_string_to_gear_rarity_all() -> void:
	var passed = (
		GE.string_to_gear_rarity("common") == GE.GearRarity.COMMON and
		GE.string_to_gear_rarity("rare") == GE.GearRarity.RARE and
		GE.string_to_gear_rarity("epic") == GE.GearRarity.EPIC and
		GE.string_to_gear_rarity("legendary") == GE.GearRarity.LEGENDARY
	)
	if passed:
		_pass("test_string_to_gear_rarity_all")
	else:
		_fail("test_string_to_gear_rarity_all", "string_to_gear_rarity should handle all rarity strings")

func test_get_rarity_color_all() -> void:
	var passed = (
		GE.get_rarity_color(GE.GearRarity.COMMON) == Color.WHITE and
		GE.get_rarity_color(GE.GearRarity.RARE) == Color(0.2, 0.8, 0.2) and
		GE.get_rarity_color(GE.GearRarity.EPIC) == Color(0.6, 0.2, 0.8) and
		GE.get_rarity_color(GE.GearRarity.LEGENDARY) == Color(1.0, 0.6, 0.0)
	)
	if passed:
		_pass("test_get_rarity_color_all")
	else:
		_fail("test_get_rarity_color_all", "get_rarity_color should return correct colors")

func test_get_rarity_display_name_all() -> void:
	var passed = (
		GE.get_rarity_display_name(GE.GearRarity.COMMON) == "Common" and
		GE.get_rarity_display_name(GE.GearRarity.RARE) == "Rare" and
		GE.get_rarity_display_name(GE.GearRarity.EPIC) == "Epic" and
		GE.get_rarity_display_name(GE.GearRarity.LEGENDARY) == "Legendary"
	)
	if passed:
		_pass("test_get_rarity_display_name_all")
	else:
		_fail("test_get_rarity_display_name_all", "get_rarity_display_name should return correct names")

func test_case_insensitive_string_conversions() -> void:
	# string_to_gear_type uses to_lower() so uppercase should work
	var passed = (
		GE.string_to_gear_type("HELM") == GE.SlotType.HELM and
		GE.string_to_gear_type("Armor") == GE.SlotType.ARMOR and
		GE.string_to_gear_rarity("LEGENDARY") == GE.GearRarity.LEGENDARY and
		GE.string_to_gear_rarity("Epic") == GE.GearRarity.EPIC
	)
	if passed:
		_pass("test_case_insensitive_string_conversions")
	else:
		_fail("test_case_insensitive_string_conversions", "String conversions should be case-insensitive")

func test_roundtrip_gear_type_conversion() -> void:
	# Convert type to string and back
	for type_val in [GE.SlotType.HELM, GE.SlotType.ARMOR, GE.SlotType.BOW, GE.SlotType.ARROW, GE.SlotType.AMULET]:
		var str_val = GE.gear_type_to_string(type_val)
		var back_val = GE.string_to_gear_type(str_val)
		if back_val != type_val:
			_fail("test_roundtrip_gear_type_conversion", "Roundtrip failed for type %d" % type_val)
			return
	_pass("test_roundtrip_gear_type_conversion")

func test_roundtrip_rarity_conversion() -> void:
	for rarity_val in [GE.GearRarity.COMMON, GE.GearRarity.RARE, GE.GearRarity.EPIC, GE.GearRarity.LEGENDARY]:
		var str_val = GE.gear_rarity_to_string(rarity_val)
		var back_val = GE.string_to_gear_rarity(str_val)
		if back_val != rarity_val:
			_fail("test_roundtrip_rarity_conversion", "Roundtrip failed for rarity %d" % rarity_val)
			return
	_pass("test_roundtrip_rarity_conversion")
