extends Node
## Manages gear loading, equipping, and stat calculation.
## Handles inventory state and gear persistence via Nakama.
##
## Signals:
## - gear_loaded(inventory: Dictionary): Emitted when inventory is loaded
## - gear_equipped(slot: int, gear_id: String): Emitted when gear is equipped
## - stats_updated(total_stats: Dictionary): Emitted when stats change

# --- Signals ---
signal gear_loaded(inventory: Dictionary)
signal gear_equipped(slot: int, gear_id: String)
signal stats_updated(total_stats: Dictionary)

# --- Properties ---
var inventory: Dictionary = {}  # { gear_id: { "name": "...", "stats": {...} } }
var equipped_gear: Array[String] = ["", "", "", "", ""]  # 5 gear slots

# --- State ---
var is_loading: bool = false
var _loaded: bool = false

# --- Gear Slots Enum ---
enum GearSlot {
	HEAD = 0,
	CHEST = 1,
	HANDS = 2,
	LEGS = 3,
	FEET = 4
}

# --- Initialization ---
func _ready() -> void:
	pass

# --- Inventory Loading ---

## Loads gear inventory from Nakama
func load_gear() -> bool:
	if is_loading:
		push_warning("[InventoryManager] Gear load already in progress")
		return false
	
	if not NetworkManager.is_session_valid():
		push_error("[InventoryManager] Cannot load gear: not authenticated")
		return false
	
	is_loading = true
	
	var response: Dictionary = await NetworkManager.send_rpc("armored_archer/get_inventory", "{}")
	is_loading = false
	
	if response.has("error"):
		push_error("[InventoryManager] Load gear error: %s" % response.error)
		return false
	
	if response.has("inventory"):
		inventory = response.inventory
		_loaded = true
	
	if response.has("equipped"):
		equipped_gear = response.equipped
	
	gear_loaded.emit(inventory)
	return true

# --- Gear Equipping ---

## Equips gear to a specific slot
## Parameters:
##   gear_id: String - ID of the gear to equip
##   slot: int - Slot index (0-4) or use GearSlot enum
func equip_gear(gear_id: String, slot: int = GearSlot.HEAD) -> bool:
	if not _loaded:
		push_warning("[InventoryManager] Inventory not loaded yet")
		return false
	
	if not inventory.has(gear_id):
		push_error("[InventoryManager] Gear not found: %s" % gear_id)
		return false
	
	if slot < 0 or slot >= equipped_gear.size():
		push_error("[InventoryManager] Invalid slot: %d" % slot)
		return false
	
	var rpc_payload: String = JSON.stringify({
		"gear_id": gear_id,
		"slot": slot
	})
	
	var response: Dictionary = await NetworkManager.send_rpc("armored_archer/equip_gear", rpc_payload)
	
	if response.has("error"):
		push_error("[InventoryManager] Equip gear error: %s" % response.error)
		return false
	
	# Update local state
	equipped_gear[slot] = gear_id

	gear_equipped.emit(slot, gear_id)
	_update_total_stats()
	
	return true

## Unequips gear from a slot
## Parameters:
##   slot: int - Slot index (0-4) or use GearSlot enum
func unequip_gear(slot: int = GearSlot.HEAD) -> bool:
	if not _loaded:
		push_warning("[InventoryManager] Inventory not loaded yet")
		return false
	
	if slot < 0 or slot >= equipped_gear.size():
		push_error("[InventoryManager] Invalid slot: %d" % slot)
		return false
	
	if equipped_gear[slot].is_empty():
		return true
	
	var rpc_payload: String = JSON.stringify({
		"slot": slot
	})
	
	var response: Dictionary = await NetworkManager.send_rpc("armored_archer/unequip_gear", rpc_payload)
	
	if response.has("error"):
		push_error("[InventoryManager] Unequip gear error: %s" % response.error)
		return false
	
	# Update local state
	equipped_gear[slot] = ""

	gear_equipped.emit(slot, "")
	_update_total_stats()
	
	return true

# --- Stats Calculation ---

## Calculates total stats from equipped gear
func get_total_stats() -> Dictionary:
	var total_stats: Dictionary = {
		"attack": 0,
		"defense": 0,
		"health": 0,
		"speed": 0,
		"critical_chance": 0.0,
		"armor_penetration": 0.0
	}
	
	# Sum stats from all equipped gear
	for slot in equipped_gear.size():
		var gear_id: String = equipped_gear[slot]
		if not gear_id.is_empty() and inventory.has(gear_id):
			var gear_data: Dictionary = inventory[gear_id]
			if gear_data.has("stats"):
				var gear_stats: Dictionary = gear_data.stats
				total_stats["attack"] += gear_stats.get("attack", 0)
				total_stats["defense"] += gear_stats.get("defense", 0)
				total_stats["health"] += gear_stats.get("health", 0)
				total_stats["speed"] += gear_stats.get("speed", 0)
				total_stats["critical_chance"] += gear_stats.get("critical_chance", 0.0)
				total_stats["armor_penetration"] += gear_stats.get("armor_penetration", 0.0)
	
	return total_stats

## Internal: Updates total stats and emits signal
func _update_total_stats() -> void:
	var total_stats: Dictionary = get_total_stats()
	stats_updated.emit(total_stats)

# --- Gear Info ---

## Gets gear data by ID
func get_gear_info(gear_id: String) -> Dictionary:
	if inventory.has(gear_id):
		return inventory[gear_id].duplicate()
	return {}

## Gets currently equipped gear for a slot
func get_equipped_gear_id(slot: int) -> String:
	if slot >= 0 and slot < equipped_gear.size():
		return equipped_gear[slot]
	return ""

## Gets all currently equipped gear
func get_all_equipped_gear() -> Array[String]:
	return equipped_gear.duplicate()

## Gets inventory size
func get_inventory_size() -> int:
	return inventory.size()

## Checks if gear is equipped
func is_gear_equipped(gear_id: String) -> bool:
	return gear_id in equipped_gear

# --- Slot Management ---

## Gets human-readable slot name
func get_slot_name(slot: int) -> String:
	match slot:
		GearSlot.HEAD:
			return "Head"
		GearSlot.CHEST:
			return "Chest"
		GearSlot.HANDS:
			return "Hands"
		GearSlot.LEGS:
			return "Legs"
		GearSlot.FEET:
			return "Feet"
		_:
			return "Unknown"

# --- Cleanup ---
func _exit_tree() -> void:
	pass
