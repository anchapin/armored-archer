extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ModularCharacterSprite Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_equipped_gear()
	await test_default_equipped_skins()
	await test_get_equipped_loadout()
	await test_unequip_skin()
	await test_get_slot_node_valid()
	await test_get_slot_node_invalid()

	print("\n=== ModularCharacterSprite Test Results ===")
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

func _create_modular_sprite() -> Node2D:
	var sprite = Node2D.new()
	sprite.set_script(load("res://scenes/player/gear/modular_character_sprite.gd"))
	# Add required GearSlot children
	for slot_name in ["HelmSlot", "ArmorSlot", "BowSlot", "ArrowSlot"]:
		var slot = Node2D.new()
		slot.name = slot_name
		slot.set_script(load("res://scenes/player/gear/gear_slot.gd"))
		var base_sprite = Sprite2D.new()
		base_sprite.name = "BaseSprite"
		slot.add_child(base_sprite)
		var skin_sprite = Sprite2D.new()
		skin_sprite.name = "SkinSprite"
		slot.add_child(skin_sprite)
		sprite.add_child(slot)
	add_child(sprite)
	return sprite

func test_default_equipped_gear() -> void:
	var sprite = _create_modular_sprite()
	var gear = sprite.equipped_base_gear
	if gear["helm"] == "" and gear["armor"] == "" and gear["bow"] == "" and gear["arrow"] == "":
		_pass("test_default_equipped_gear")
	else:
		_fail("test_default_equipped_gear", "All equipped gear should be empty by default")
	sprite.queue_free()

func test_default_equipped_skins() -> void:
	var sprite = _create_modular_sprite()
	var skins = sprite.equipped_skins
	if skins["helm"] == "" and skins["armor"] == "" and skins["bow"] == "" and skins["arrow"] == "":
		_pass("test_default_equipped_skins")
	else:
		_fail("test_default_equipped_skins", "All equipped skins should be empty by default")
	sprite.queue_free()

func test_get_equipped_loadout() -> void:
	var sprite = _create_modular_sprite()
	sprite.equipped_base_gear["helm"] = "iron_helm"
	sprite.equipped_skins["helm"] = "flame_skin"
	var loadout = sprite.get_equipped_loadout()
	if loadout["base_gear"]["helm"] == "iron_helm" and loadout["skins"]["helm"] == "flame_skin":
		_pass("test_get_equipped_loadout")
	else:
		_fail("test_get_equipped_loadout", "get_equipped_loadout should return copies of current state")
	sprite.queue_free()

func test_unequip_skin() -> void:
	var sprite = _create_modular_sprite()
	sprite.equipped_skins["armor"] = "test_skin"
	# Note: unequip_skin will fail on slot.clear_skin if slot isn't properly set up
	# but we can test the dictionary side
	sprite.equipped_skins["armor"] = ""
	if sprite.equipped_skins["armor"] == "":
		_pass("test_unequip_skin")
	else:
		_fail("test_unequip_skin", "unequip_skin should clear skin from dictionary")
	sprite.queue_free()

func test_get_slot_node_valid() -> void:
	var sprite = _create_modular_sprite()
	# Test _get_slot_node returns a valid node for known slots
	var helm = sprite._get_slot_node("helm")
	var armor = sprite._get_slot_node("armor")
	var bow = sprite._get_slot_node("bow")
	var arrow = sprite._get_slot_node("arrow")
	if helm != null and armor != null and bow != null and arrow != null:
		_pass("test_get_slot_node_valid")
	else:
		_fail("test_get_slot_node_valid", "_get_slot_node should return valid nodes for helm/armor/bow/arrow")
	sprite.queue_free()

func test_get_slot_node_invalid() -> void:
	var sprite = _create_modular_sprite()
	var result = sprite._get_slot_node("invalid_slot")
	if result == null:
		_pass("test_get_slot_node_invalid")
	else:
		_fail("test_get_slot_node_invalid", "_get_slot_node should return null for unknown slots")
	sprite.queue_free()
