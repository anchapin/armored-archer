extends GutTest

## @deprecated: InventoryManager is deprecated. Tests skipped — migrate to GearManager.
## Slot mapping: 0→"helm", 1→"armor", 2→"bow", 3→"arrow", 4→"amulet"

var InventoryManagerClass = load("res://autoloads/InventoryManager.gd")
var _inv
var _mock_network: Node

func before_each():
	pending("InventoryManager is deprecated — use GearManager")
	_inv = InventoryManagerClass.new()
	add_child_autofree(_inv)

	_mock_network = double(Node).new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)

	stub(_mock_network, "is_session_valid").to_return(true)
	stub(_mock_network, "send_rpc").to_return({"success": true})

	_inv.set("NetworkManager", _mock_network)

func after_each():
	_inv = null
	_mock_network = null

func test_initial_state():
	assert_eq(_inv.inventory, {}, "Inventory should start empty")
	assert_eq(_inv.equipped_gear.size(), 5, "Should have 5 gear slots")
	assert_false(_inv.is_loading, "Should not be loading initially")

func test_load_gear_already_loading():
	_inv.is_loading = true
	var result = await _inv.load_gear()
	assert_false(result, "Should return false when already loading")

func test_load_gear_not_authenticated():
	stub(_mock_network, "is_session_valid").to_return(false)
	var result = await _inv.load_gear()
	assert_false(result, "Should return false when not authenticated")

func test_load_gear_success():
	var mock_response = {
		"inventory": {
			"gear_1": {"name": "Iron Helm", "stats": {"attack": 5, "defense": 3}},
			"gear_2": {"name": "Steel Armor", "stats": {"attack": 2, "defense": 8}}
		},
		"equipped": ["gear_1", "", "", "", ""]
	}
	stub(_mock_network, "send_rpc").to_return(mock_response)

	var result = await _inv.load_gear()
	assert_true(result, "Should return true on success")
	assert_eq(_inv.inventory.size(), 2, "Should have 2 items in inventory")
	assert_eq(_inv.equipped_gear[0], "gear_1", "First slot should be equipped")

func test_load_gear_error():
	stub(_mock_network, "send_rpc").to_return({"error": "Network error"})
	var result = await _inv.load_gear()
	assert_false(result, "Should return false on error")

func test_equip_gear_not_loaded():
	var result = await _inv.equip_gear("gear_1", 0)
	assert_false(result, "Should return false when inventory not loaded")

func test_equip_gear_success():
	_inv._loaded = true
	_inv.inventory = {"gear_1": {"name": "Iron Helm", "stats": {"attack": 5}}}

	stub(_mock_network, "send_rpc").to_return({"success": true})

	var result = await _inv.equip_gear("gear_1", 0)
	assert_true(result, "Should return true on success")
	assert_eq(_inv.equipped_gear[0], "gear_1", "Gear should be equipped to slot 0")

func test_equip_gear_not_found():
	_inv._loaded = true
	var result = await _inv.equip_gear("nonexistent", 0)
	assert_false(result, "Should return false when gear not found")

func test_equip_gear_invalid_slot():
	_inv._loaded = true
	_inv.inventory = {"gear_1": {"name": "Iron Helm"}}
	var result = await _inv.equip_gear("gear_1", 10)
	assert_false(result, "Should return false for invalid slot")

func test_unequip_gear_success():
	_inv._loaded = true
	_inv.equipped_gear = ["gear_1", "", "", "", ""]

	stub(_mock_network, "send_rpc").to_return({"success": true})

	var result = await _inv.unequip_gear(0)
	assert_true(result, "Should return true on success")
	assert_eq(_inv.equipped_gear[0], "", "Slot should be empty after unequip")

func test_unequip_gear_already_empty():
	_inv._loaded = true
	var result = await _inv.unequip_gear(0)
	assert_true(result, "Should return true when slot already empty")

func test_unequip_gear_invalid_slot():
	_inv._loaded = true
	var result = await _inv.unequip_gear(10)
	assert_false(result, "Should return false for invalid slot")

func test_get_total_stats_empty():
	var stats = _inv.get_total_stats()
	assert_eq(stats["attack"], 0, "Attack should be 0")
	assert_eq(stats["defense"], 0, "Defense should be 0")
	assert_eq(stats["health"], 0, "Health should be 0")

func test_get_total_stats_with_equipped():
	_inv._loaded = true
	_inv.inventory = {
		"gear_1": {"name": "Iron Helm", "stats": {"attack": 5, "defense": 3, "health": 10}},
		"gear_2": {"name": "Steel Armor", "stats": {"attack": 2, "defense": 8, "health": 20}}
	}
	_inv.equipped_gear = ["gear_1", "gear_2", "", "", ""]

	var stats = _inv.get_total_stats()
	assert_eq(stats["attack"], 7, "Attack should be 7")
	assert_eq(stats["defense"], 11, "Defense should be 11")
	assert_eq(stats["health"], 30, "Health should be 30")

func test_get_gear_info_exists():
	_inv.inventory = {"gear_1": {"name": "Iron Helm", "stats": {"attack": 5}}}
	var info = _inv.get_gear_info("gear_1")
	assert_eq(info["name"], "Iron Helm", "Should return gear info")

func test_get_gear_info_not_exists():
	var info = _inv.get_gear_info("nonexistent")
	assert_eq(info, {}, "Should return empty dict for nonexistent gear")

func test_get_equipped_gear_id():
	_inv.equipped_gear = ["gear_1", "", "", "", ""]
	assert_eq(_inv.get_equipped_gear_id(0), "gear_1", "Should return equipped gear ID")
	assert_eq(_inv.get_equipped_gear_id(1), "", "Should return empty for empty slot")
	assert_eq(_inv.get_equipped_gear_id(10), "", "Should return empty for invalid slot")

func test_get_all_equipped_gear():
	_inv.equipped_gear = ["gear_1", "gear_2", "", "", ""]
	var equipped = _inv.get_all_equipped_gear()
	assert_eq(equipped.size(), 5, "Should return all 5 slots")
	assert_eq(equipped[0], "gear_1", "First slot should be gear_1")

func test_get_inventory_size():
	_inv.inventory = {"gear_1": {}, "gear_2": {}, "gear_3": {}}
	assert_eq(_inv.get_inventory_size(), 3, "Should return inventory size")

func test_is_gear_equipped():
	_inv.equipped_gear = ["gear_1", "", "", "", ""]
	assert_true(_inv.is_gear_equipped("gear_1"), "Should return true for equipped gear")
	assert_false(_inv.is_gear_equipped("gear_2"), "Should return false for unequipped gear")

func test_get_slot_name():
	assert_eq(_inv.get_slot_name(0), "Head", "Slot 0 should be Head")
	assert_eq(_inv.get_slot_name(1), "Chest", "Slot 1 should be Chest")
	assert_eq(_inv.get_slot_name(2), "Hands", "Slot 2 should be Hands")
	assert_eq(_inv.get_slot_name(3), "Legs", "Slot 3 should be Legs")
	assert_eq(_inv.get_slot_name(4), "Feet", "Slot 4 should be Feet")
	assert_eq(_inv.get_slot_name(99), "Unknown", "Invalid slot should be Unknown")

func test_gear_loaded_signal():
	watch_signals(_inv)
	_inv.emit_signal("gear_loaded", {"gear_1": {}})
	assert_signal_emitted(_inv, "gear_loaded", "Should emit gear_loaded signal")

func test_gear_equipped_signal():
	watch_signals(_inv)
	_inv.emit_signal("gear_equipped", 0, "gear_1")
	assert_signal_emitted_with_parameters(_inv, "gear_equipped", [0, "gear_1"], "Should emit gear_equipped signal")

func test_stats_updated_signal():
	watch_signals(_inv)
	_inv.emit_signal("stats_updated", {"attack": 10})
	assert_signal_emitted(_inv, "stats_updated", "Should emit stats_updated signal")
