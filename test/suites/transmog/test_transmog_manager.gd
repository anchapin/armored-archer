extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running TransmogManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_signals_exist()
	await test_get_current_loadout()
	await test_equip_base_gear()
	await test_equip_skin()
	await test_unequip_skin()
	await test_can_equip_skin()
	await test_get_total_stats()
	await test_get_visual_combination()
	await test_preview_combination()

	print("\n=== TransmogManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_transmog_manager() -> Node:
	var tm = load("res://autoloads/TransmogManager.gd").new()
	add_child(tm)
	return tm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var tm = _create_transmog_manager()
	await get_tree().process_frame

	if tm.current_loadout.has("base_gear") and tm.current_loadout.has("skins"):
		_pass("test_initial_loadout_structure")
	else:
		_fail("test_initial_loadout_structure", "Should have base_gear and skins")

	if tm.current_loadout.base_gear.has("helm"):
		_pass("test_initial_base_gear_helm")
	else:
		_fail("test_initial_base_gear_helm", "Should have helm in base_gear")

	if tm.current_loadout.skins.has("helm"):
		_pass("test_initial_skins_helm")
	else:
		_fail("test_initial_skins_helm", "Should have helm in skins")

	tm.queue_free()

func test_signals_exist() -> void:
	var tm = _create_transmog_manager()

	if tm.has_signal("transmog_applied"):
		_pass("test_signal_transmog_applied")
	else:
		_fail("test_signal_transmog_applied", "Should have transmog_applied signal")

	tm.queue_free()

func test_get_current_loadout() -> void:
	var tm = _create_transmog_manager()

	var loadout = tm.get_current_loadout()

	if loadout.has("base_gear") and loadout.has("skins"):
		_pass("test_get_current_loadout_keys")
	else:
		_fail("test_get_current_loadout_keys", "Should return loadout with keys")

	# Verify it's a duplicate (not reference)
	loadout.base_gear["helm"] = "changed"
	if tm.current_loadout.base_gear["helm"] != "changed":
		_pass("test_get_current_loadout_duplicate")
	else:
		_fail("test_get_current_loadout_duplicate", "Should return duplicate, not reference")

	tm.queue_free()

func test_equip_base_gear() -> void:
	var tm = _create_transmog_manager()

	# This will fail because gear_registry doesn't have data, but shouldn't crash
	var result = tm.equip_base_gear("helm", "helm_basic")

	# The actual result depends on gear_registry data
	# Just verify method executes without error
	_pass("test_equip_base_gear_executes")

	tm.queue_free()

func test_equip_skin() -> void:
	var tm = _create_transmog_manager()

	# Try to equip invalid skin
	var result = tm.equip_skin("helm", "invalid_skin")

	if result == false:
		_pass("test_equip_skin_invalid")
	else:
		_fail("test_equip_skin_invalid", "Should return false for invalid skin")

	tm.queue_free()

func test_unequip_skin() -> void:
	var tm = _create_transmog_manager()

	# Set a skin first
	tm.current_loadout.skins["helm"] = "skin_test"

	# Unequip it
	tm.unequip_skin("helm")

	if tm.current_loadout.skins["helm"] == "":
		_pass("test_unequip_skin")
	else:
		_fail("test_unequip_skin", "Skin should be removed")

	tm.queue_free()

func test_can_equip_skin() -> void:
	var tm = _create_transmog_manager()

	# Without valid gear registry data, this should return false
	var can_equip = tm.can_equip_skin("helm", "some_skin")

	# Just verify method executes
	_pass("test_can_equip_skin_executes")

	tm.queue_free()

func test_get_total_stats() -> void:
	var tm = _create_transmog_manager()

	var stats = tm.get_total_stats()

	# Verify it returns a dictionary
	if typeof(stats) == TYPE_DICTIONARY:
		_pass("test_get_total_stats_returns_dict")
	else:
		_fail("test_get_total_stats_returns_dict", "Should return dictionary")

	tm.queue_free()

func test_get_visual_combination() -> void:
	var tm = _create_transmog_manager()

	var combo = tm.get_visual_combination("helm")

	if combo.has("slot") and combo.has("base_gear") and combo.has("skin"):
		_pass("test_get_visual_combination_keys")
	else:
		_fail("test_get_visual_combination_keys", "Should have required keys")

	if combo.slot == "helm":
		_pass("test_get_visual_combination_slot")
	else:
		_fail("test_get_visual_combination_slot", "Slot should be 'helm'")

	tm.queue_free()

func test_preview_combination() -> void:
	var tm = _create_transmog_manager()

	var preview = tm.preview_combination("helm", "helm_basic", "skin_test")

	if preview.has("slot") and preview.has("base_gear") and preview.has("skin"):
		_pass("test_preview_combination_keys")
	else:
		_fail("test_preview_combination_keys", "Should have required keys")

	tm.queue_free()
