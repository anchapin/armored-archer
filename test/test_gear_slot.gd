extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GearSlot Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_slot_type_enum()
	await test_slot_type_strings_mapping()
	await test_default_slot_type()
	await test_set_skin()
	await test_clear_skin()
	await test_get_equipped_gear()
	await test_gear_updated_signal()

	print("\n=== GearSlot Test Results ===")
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

func _create_gear_slot() -> Node2D:
	var slot = Node2D.new()
	slot.set_script(load("res://scenes/player/gear/gear_slot.gd"))
	# Add required child nodes
	var base_sprite = Sprite2D.new()
	base_sprite.name = "BaseSprite"
	slot.add_child(base_sprite)
	var skin_sprite = Sprite2D.new()
	skin_sprite.name = "SkinSprite"
	slot.add_child(skin_sprite)
	add_child(slot)
	return slot

func test_slot_type_enum() -> void:
	var slot = _create_gear_slot()
	var passed = (
		slot.SlotType.HELM == 0 and
		slot.SlotType.ARMOR == 1 and
		slot.SlotType.BOW == 2 and
		slot.SlotType.ARROW == 3 and
		slot.SlotType.AMULET == 4
	)
	if passed:
		_pass("test_slot_type_enum")
	else:
		_fail("test_slot_type_enum", "SlotType enum values should be 0-4")
	slot.queue_free()

func test_slot_type_strings_mapping() -> void:
	var slot = _create_gear_slot()
	var mapping = slot.slot_type_strings
	var passed = (
		mapping[slot.SlotType.HELM] == "helm" and
		mapping[slot.SlotType.ARMOR] == "armor" and
		mapping[slot.SlotType.BOW] == "bow" and
		mapping[slot.SlotType.ARROW] == "arrow" and
		mapping[slot.SlotType.AMULET] == "amulet"
	)
	if passed:
		_pass("test_slot_type_strings_mapping")
	else:
		_fail("test_slot_type_strings_mapping", "slot_type_strings should map all slot types correctly")
	slot.queue_free()

func test_default_slot_type() -> void:
	var slot = _create_gear_slot()
	if slot.slot_type == slot.SlotType.HELM:
		_pass("test_default_slot_type")
	else:
		_fail("test_default_slot_type", "Default slot_type should be HELM")
	slot.queue_free()

func test_set_skin() -> void:
	var slot = _create_gear_slot()
	slot.set_skin("skin_test", null)
	if slot.skin_id == "skin_test":
		_pass("test_set_skin")
	else:
		_fail("test_set_skin", "set_skin should update skin_id")
	slot.queue_free()

func test_clear_skin() -> void:
	var slot = _create_gear_slot()
	slot.set_skin("skin_test", null)
	slot.clear_skin()
	if slot.skin_id == "":
		_pass("test_clear_skin")
	else:
		_fail("test_clear_skin", "clear_skin should reset skin_id to empty")
	slot.queue_free()

func test_get_equipped_gear() -> void:
	var slot = _create_gear_slot()
	slot.slot_type = slot.SlotType.BOW
	slot.base_gear_id = "iron_bow"
	slot.skin_id = "flame_skin"
	var gear = slot.get_equipped_gear()
	if gear["base_gear_id"] == "iron_bow" and gear["skin_id"] == "flame_skin" and gear["slot_type"] == slot.SlotType.BOW:
		_pass("test_get_equipped_gear")
	else:
		_fail("test_get_equipped_gear", "get_equipped_gear should return correct data")
	slot.queue_free()

func test_gear_updated_signal() -> void:
	var slot = _create_gear_slot()
	var received = false
	slot.gear_updated.connect(func(_slot_type, _data): received = true)
	slot.gear_updated.emit(0, {})
	await get_tree().create_timer(0.05).timeout
	if received:
		_pass("test_gear_updated_signal")
	else:
		_fail("test_gear_updated_signal", "gear_updated signal should emit")
	slot.queue_free()
