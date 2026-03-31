extends Node

const GE = preload("res://scripts/gear_enums.gd")

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GearEnums Script Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_slot_type_enum()
	await test_gear_type_enum()
	await test_gear_rarity_enum()
	await test_modifier_type_enum()
	await test_stat_type_enum()
	await test_gear_type_to_string()
	await test_string_to_gear_type()
	await test_gear_rarity_to_string()
	await test_string_to_gear_rarity()
	await test_get_rarity_color()
	await test_get_rarity_display_name()
	await test_unknown_type_handling()

	print("\n=== GearEnums Script Test Results ===")
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

func test_slot_type_enum() -> void:
	if GE.SlotType.HELM == 0 and GE.SlotType.ARMOR == 1 and GE.SlotType.BOW == 2 and GE.SlotType.ARROW == 3 and GE.SlotType.AMULET == 4:
		_pass("test_slot_type_enum")
	else:
		_fail("test_slot_type_enum", "SlotType enum values should be correct")

func test_gear_type_enum() -> void:
	if GE.GearType.HELM == 0 and GE.GearType.ARMOR == 1 and GE.GearType.BOW == 2 and GE.GearType.ARROW == 3 and GE.GearType.AMULET == 4:
		_pass("test_gear_type_enum")
	else:
		_fail("test_gear_type_enum", "GearType enum values should be correct")

func test_gear_rarity_enum() -> void:
	if GE.GearRarity.COMMON == 0 and GE.GearRarity.RARE == 1 and GE.GearRarity.EPIC == 2 and GE.GearRarity.LEGENDARY == 3:
		_pass("test_gear_rarity_enum")
	else:
		_fail("test_gear_rarity_enum", "GearRarity enum values should be correct")

func test_modifier_type_enum() -> void:
	if GE.ModifierType.STAT_BONUS == 0 and GE.ModifierType.ABILITY_MODIFIER == 1 and GE.ModifierType.SET_BONUS == 2 and GE.ModifierType.SOCKET == 3 and GE.ModifierType.PASSIVE == 4:
		_pass("test_modifier_type_enum")
	else:
		_fail("test_modifier_type_enum", "ModifierType enum values should be correct")

func test_stat_type_enum() -> void:
	if GE.StatType.HEALTH == 0 and GE.StatType.ATTACK == 1 and GE.StatType.DEFENSE == 2 and GE.StatType.SPEED == 3 and GE.StatType.CRITICAL_CHANCE == 4:
		_pass("test_stat_type_enum")
	else:
		_fail("test_stat_type_enum", "StatType enum values should be correct")

func test_gear_type_to_string() -> void:
	if GE.gear_type_to_string(GE.SlotType.HELM) == "helm" and GE.gear_type_to_string(GE.SlotType.ARMOR) == "armor" and GE.gear_type_to_string(GE.SlotType.BOW) == "bow" and GE.gear_type_to_string(GE.SlotType.AMULET) == "amulet":
		_pass("test_gear_type_to_string")
	else:
		_fail("test_gear_type_to_string", "Should convert gear types to strings")

func test_string_to_gear_type() -> void:
	if GE.string_to_gear_type("helm") == GE.SlotType.HELM and GE.string_to_gear_type("armor") == GE.SlotType.ARMOR and GE.string_to_gear_type("bow") == GE.SlotType.BOW:
		_pass("test_string_to_gear_type")
	else:
		_fail("test_string_to_gear_type", "Should convert strings to gear types")

func test_gear_rarity_to_string() -> void:
	if GE.gear_rarity_to_string(GE.GearRarity.COMMON) == "common" and GE.gear_rarity_to_string(GE.GearRarity.RARE) == "rare" and GE.gear_rarity_to_string(GE.GearRarity.EPIC) == "epic" and GE.gear_rarity_to_string(GE.GearRarity.LEGENDARY) == "legendary":
		_pass("test_gear_rarity_to_string")
	else:
		_fail("test_gear_rarity_to_string", "Should convert rarity to strings")

func test_string_to_gear_rarity() -> void:
	if GE.string_to_gear_rarity("common") == GE.GearRarity.COMMON and GE.string_to_gear_rarity("rare") == GE.GearRarity.RARE and GE.string_to_gear_rarity("epic") == GE.GearRarity.EPIC and GE.string_to_gear_rarity("legendary") == GE.GearRarity.LEGENDARY:
		_pass("test_string_to_gear_rarity")
	else:
		_fail("test_string_to_gear_rarity", "Should convert strings to rarity")

func test_get_rarity_color() -> void:
	var common_color = GE.get_rarity_color(GE.GearRarity.COMMON)
	var rare_color = GE.get_rarity_color(GE.GearRarity.RARE)
	var epic_color = GE.get_rarity_color(GE.GearRarity.EPIC)
	var legendary_color = GE.get_rarity_color(GE.GearRarity.LEGENDARY)

	if common_color == Color.WHITE and rare_color == Color(0.2, 0.8, 0.2) and epic_color == Color(0.6, 0.2, 0.8) and legendary_color == Color(1.0, 0.6, 0.0):
		_pass("test_get_rarity_color")
	else:
		_fail("test_get_rarity_color", "Should return correct colors for rarities")

func test_get_rarity_display_name() -> void:
	if GE.get_rarity_display_name(GE.GearRarity.COMMON) == "Common" and GE.get_rarity_display_name(GE.GearRarity.RARE) == "Rare" and GE.get_rarity_display_name(GE.GearRarity.EPIC) == "Epic" and GE.get_rarity_display_name(GE.GearRarity.LEGENDARY) == "Legendary":
		_pass("test_get_rarity_display_name")
	else:
		_fail("test_get_rarity_display_name", "Should return correct display names")

func test_unknown_type_handling() -> void:
	if GE.gear_type_to_string(99) == "unknown" and GE.string_to_gear_type("invalid") == GE.SlotType.HELM and GE.gear_rarity_to_string(99) == "unknown" and GE.string_to_gear_rarity("invalid") == GE.GearRarity.COMMON:
		_pass("test_unknown_type_handling")
	else:
		_fail("test_unknown_type_handling", "Should handle unknown values gracefully")
