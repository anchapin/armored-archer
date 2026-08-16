extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GearManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_get_gear_stats_summary()
	await test_compare_gear()
	await test_calculate_gear_score()
	await test_signal_emission()
	await test_inventory_sync()

	print("\n=== GearManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_gear_manager() -> Node:
	var gm = load("res://autoloads/GearManager.gd").new()
	add_child(gm)
	return gm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var gm = _create_gear_manager()

	if gm.player_inventory.is_empty() and gm.equipped_gear.is_empty() and gm.unlocked_modifier_pools.is_empty():
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be empty")

	gm.queue_free()

func test_get_gear_stats_summary() -> void:
	var gm = _create_gear_manager()

	var gear = {
		"id": "test_gear",
		"name": "Test Bow",
		"type": "weapon",
		"stats": [
			{"name": "attack", "value": 15},
			{"name": "crit_rate", "value": 5}
		]
	}

	var summary = gm.get_gear_stats_summary(gear)

	if not summary.is_empty() and "attack" in summary and "15" in summary:
		_pass("test_get_gear_stats_summary")
	else:
		_fail("test_get_gear_stats_summary", "Should return correct stats summary")

	gm.queue_free()

func test_compare_gear() -> void:
	var gm = _create_gear_manager()

	var better_gear = {
		"id": "better",
		"stats": [{"name": "attack", "value": 20}]
	}
	var worse_gear = {
		"id": "worse",
		"stats": [{"name": "attack", "value": 10}]
	}
	var empty_gear = {}

	var comp1 = gm.compare_gear(better_gear, worse_gear)
	var comp2 = gm.compare_gear(worse_gear, better_gear)
	var comp3 = gm.compare_gear(better_gear, {})

	if comp1.better == "gear1" and comp2.better == "gear2" and comp3.better == "gear1":
		_pass("test_compare_gear")
	else:
		_fail("test_compare_gear", "Comparison logic incorrect")

	gm.queue_free()

func test_calculate_gear_score() -> void:
	var gm = _create_gear_manager()

	var gear = {
		"id": "test",
		"stats": [
			{"name": "attack", "value": 10},
			{"name": "defense", "value": 5}
		]
	}

	var score = gm._calculate_gear_score(gear)

	if score > 0:
		_pass("test_calculate_gear_score")
	else:
		_fail("test_calculate_gear_score", "Gear score should be positive")

	gm.queue_free()

func test_signal_emission() -> void:
	var gm = _create_gear_manager()
	# Array-based tracking: lambdas capture locals by value, so signal
	# reception is recorded via Array appends (reference semantics).
	var signals_received: Array = []

	gm.gear_generated.connect(func(_gear_data): signals_received.append("gear_generated"))
	gm.gear_equipped.connect(func(_slot, _item_id): signals_received.append("gear_equipped"))
	gm.gear_unequipped.connect(func(_slot): signals_received.append("gear_unequipped"))
	gm.inventory_updated.connect(func(_inventory): signals_received.append("inventory_updated"))

	# Emit signals manually
	gm.gear_generated.emit({"id": "test"})
	gm.gear_equipped.emit("weapon", "gear1")
	gm.gear_unequipped.emit("weapon")
	gm.inventory_updated.emit({})

	await get_tree().create_timer(0.1).timeout

	if signals_received.has("gear_generated") and signals_received.has("gear_equipped") and signals_received.has("gear_unequipped") and signals_received.has("inventory_updated"):
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "Not all signals received")

	gm.queue_free()

func test_inventory_sync() -> void:
	var gm = _create_gear_manager()

	# Set inventory directly
	gm.player_inventory = {"gear": [{"id": "bow1"}, {"id": "plate1"}]}
	gm.equipped_gear = {"weapon": "bow1"}
	gm.unlocked_modifier_pools = ["pool1", "pool2"]

	# Use actual methods from GearManager
	var inv = gm.get_full_inventory()
	var eq_gear = gm.get_equipped_gear("weapon")
	# unlocked_modifier_pools is not directly accessible, test through full_inventory

	var expected_gear_ids = ["bow1", "plate1"]
	var actual_gear_ids = []
	for gear in inv.get("gear", []):
		actual_gear_ids.append(gear.get("id", ""))

	if actual_gear_ids == expected_gear_ids and inv.get("equipped_gear", {}).get("weapon") == "bow1" and inv.get("unlocked_modifier_pools", []) == ["pool1", "pool2"]:
		_pass("test_inventory_sync")
	else:
		_fail("test_inventory_sync", "Sync methods should return current state")

	gm.queue_free()
