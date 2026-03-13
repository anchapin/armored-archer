## Manages cosmetic skin ownership and equipment.
## Handles skin purchases, equipment, and integration with Store and Gear systems.
##
## Signals:
## - skin_purchased(skin_id: String): Emitted when a skin is bought
## - skin_equipped(skin_id: String, slot: String): Emitted when a skin is equipped
## - skin_unequipped(slot: String): Emitted when a skin is removed
##
extends Node

# --- Manager References ---
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")
@onready var gear_registry: Node = get_node_or_null("/root/GearRegistry")

# --- Analytics Reference ---
@onready var analytics: Node = get_node_or_null("/root/AnalyticsManager")

# --- Skin Ownership & Equipment ---
var owned_skins: Array = []
var equipped_skins: Dictionary = {}

# --- Slot Type Mapping ---
var slot_type_mapping: Dictionary = {}

func _ready() -> void:
	# Initialize slot_type_mapping after GearRegistry is ready
	slot_type_mapping = {
		"helm": GearRegistry.GearSlot.SlotType.HELM,
		"armor": GearRegistry.GearSlot.SlotType.ARMOR,
		"bow": GearRegistry.GearSlot.SlotType.BOW,
		"arrow": GearRegistry.GearSlot.SlotType.ARROW
	}

	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)

	load_data()

# --- Signals ---
signal skin_purchased(skin_id: String)
signal skin_equipped(skin_id: String, slot: String)
signal skin_unequipped(slot: String)

# --- Save Data Path ---
const SAVE_FILE_PATH = "user://cosmetic_data.save"

# --- Default Gem Rewards ---
const ACHIEVEMENT_GEM_REWARDS: Dictionary = {
	"first_battle": 10,
	"first_victory": 25,
	"first_pvp_win": 50,
	"streak_3": 15,
	"streak_5": 30,
	"collect_100_enemies": 100,
	"reach_level_5": 50,
	"reach_level_10": 100,
	"first_purchase": 25
}

# --- Tracked Achievements ---
var completed_achievements: Array = []  # Track completed achievements for one-time rewards

# --- Achievement Rewards ---
func claim_achievement_reward(achievement_id: String) -> int:
	"""Claims gem reward for completing an achievement (one-time only).

	Parameters:
		achievement_id: The achievement identifier

	Returns:
		int: Number of gems awarded (0 if already claimed or invalid)
	"""
	# Check if already claimed
	if achievement_id in completed_achievements:
		print("Achievement reward already claimed: %s" % achievement_id)
		return 0

	# Check if achievement exists in rewards
	if not ACHIEVEMENT_GEM_REWARDS.has(achievement_id):
		push_error("Unknown achievement: %s" % achievement_id)
		return 0

	var reward = ACHIEVEMENT_GEM_REWARDS[achievement_id]

	# Mark as completed and award gems
	completed_achievements.append(achievement_id)
	add_gems(reward, "achievement:" + achievement_id)

	# Track gem reward in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("achievement_completed", {
			"achievement_id": achievement_id,
			"gems_awarded": reward,
			"reason": "achievement_reward"
		})

	print("Achievement completed: %s, Awarded %d gems" % [achievement_id, reward])
	return reward

func get_achievement_reward(achievement_id: String) -> int:
	"""Gets the gem reward amount for an achievement without claiming it.

	Parameters:
		achievement_id: The achievement identifier

	Returns:
		int: Number of gems the achievement awards (0 if invalid)
	"""
	return ACHIEVEMENT_GEM_REWARDS.get(achievement_id, 0)

func is_achievement_completed(achievement_id: String) -> bool:
	"""Checks if an achievement has been completed (reward claimed).

	Parameters:
		achievement_id: The achievement identifier

	Returns:
		bool: True if the achievement reward has been claimed
	"""
	return achievement_id in completed_achievements

# --- Gem Management (Delegates to StoreManager) ---
signal gems_updated(new_balance: int)

var _local_gems: int = 0  # Local cache for gems when server unavailable

func get_gem_balance() -> int:
	"""Gets current gem balance from StoreManager or local cache.

	Returns:
		int: Number of gems available
	"""
	if store_manager:
		return store_manager.get_gems()
	return _local_gems

func add_gems(amount: int, reason: String = "") -> void:
	"""Adds gems to player's balance.

	Parameters:
		amount: Number of gems to add (must be positive)
		reason: Reason for adding gems (achievement, quest_reward, etc.)
	"""
	if amount <= 0:
		push_error("Invalid gem amount to add")
		return

	_local_gems += amount

	if store_manager:
		store_manager.add_gems(amount)

	gems_updated.emit(_local_gems)
	save_data()
	print("Added %d gems. Reason: %s. New balance: %d" % [amount, reason, _local_gems])

func remove_gems(amount: int, reason: String = "") -> void:
	"""Removes gems from player's balance.

	Parameters:
		amount: Number of gems to remove (must be positive)
		reason: Reason for removing gems
	"""
	if amount <= 0:
		push_error("Invalid gem amount to remove")
		return

	if _local_gems < amount:
		push_error("Insufficient gems. Need: %d, Have: %d" % [amount, _local_gems])
		return

	_local_gems -= amount

	if store_manager:
		store_manager.spend_gems(amount, reason)

	gems_updated.emit(_local_gems)
	save_data()
	print("Removed %d gems. Reason: %s. New balance: %d" % [amount, reason, _local_gems])

func _on_currency_updated(_gems: int, _gold: int) -> void:
	"""Handles currency updates (placeholder for future functionality)."""
	pass

# --- Skin Catalog (Delegates to GearRegistry) ---
func get_skins_by_slot(slot_name: String) -> Array:
	"""Gets all available skins for a specific slot.

	Parameters:
		slot_name: Equipment slot name ("helm", "armor", "bow", "arrow")

	Returns:
		Array: List of skin data dictionaries
	"""
	if not gear_registry or not slot_type_mapping.has(slot_name):
		return []

	var slot_type = slot_type_mapping[slot_name]
	return gear_registry.get_skins_by_slot(slot_type)

func get_skin_info(skin_id: String):
	"""Retrieves information about a specific skin.

	Parameters:
		skin_id: Unique skin identifier

	Returns:
		Skin data dictionary or null if not found
	"""
	if not gear_registry:
		return null

	return gear_registry.get_skin(skin_id)

func is_skin_owned(skin_id: String) -> bool:
	"""Checks if the player owns a specific skin.

	Parameters:
		skin_id: Skin identifier to check

	Returns:
		bool: True if skin is owned
	"""
	return skin_id in owned_skins

# --- Skin Purchase ---
func purchase_skin(skin_id: String) -> bool:
	"""Purchases a skin using gems.

	Parameters:
		skin_id: ID of the skin to purchase

	Returns:
		bool: True if purchase succeeded, false otherwise
	"""
	if is_skin_owned(skin_id):
		push_error("Skin already owned: %s" % skin_id)
		return false

	var skin_info = get_skin_info(skin_id)
	if not skin_info:
		push_error("Skin not found: %s" % skin_id)
		return false

	if not store_manager:
		push_error("StoreManager not available")
		return false

	var gem_balance = get_gem_balance()
	if gem_balance < skin_info.price:
		push_error("Not enough gems. Need: %d, Have: %d" % [skin_info.price, gem_balance])
		return false

	store_manager.spend_gems(skin_info.price, "cosmetic_purchase:" + skin_id)

	owned_skins.append(skin_id)
	skin_purchased.emit(skin_id)
	save_data()

	# Track cosmetic purchase in analytics
	if analytics and analytics.has_method("log_cosmetic_purchased"):
		analytics.log_cosmetic_purchased(
			skin_id,
			skin_info.get("name", skin_id),
			"skin",
			skin_info.get("rarity", "common"),
			skin_info.price,
			"gems"
		)

	return true

# --- Skin Equipment ---
func equip_skin(slot_name: String, skin_id: String) -> bool:
	"""Equips a skin to the specified slot.

	Parameters:
		slot_name: Equipment slot name
		skin_id: ID of the skin to equip

	Returns:
		bool: True if equip succeeded, false otherwise
	"""
	if not is_skin_owned(skin_id):
		push_error("Skin not owned: %s" % skin_id)
		return false

	var skin_info = get_skin_info(skin_id)
	if not skin_info:
		push_error("Skin not found: %s" % skin_id)
		return false

	var slot_type = slot_type_mapping.get(slot_name, -1)
	if slot_type == -1 or skin_info.slot_type != slot_type:
		push_error("Skin %s does not belong to slot %s" % [skin_id, slot_name])
		return false

	equipped_skins[slot_name] = skin_id
	skin_equipped.emit(skin_id, slot_name)
	save_data()

	# Track transmog applied in analytics
	if analytics and analytics.has_method("log_transmog_applied"):
		analytics.log_transmog_applied(
			skin_id,
			skin_info.get("name", skin_id) if skin_info else slot_name,
			slot_name
		)

	return true

func unequip_skin(slot_name: String) -> void:
	"""Removes skin from slot, showing only base gear.

	Parameters:
		slot_name: Equipment slot to unequip skin from
	"""
	if equipped_skins.has(slot_name):
		var _err = equipped_skins.erase(slot_name)
		skin_unequipped.emit(slot_name)
		save_data()

func get_equipped_skin(slot_name: String) -> String:
	"""Gets the skin ID equipped in a slot.

	Parameters:
		slot_name: Equipment slot to query

	Returns:
		String: Skin identifier or empty string if none equipped
	"""
	return equipped_skins.get(slot_name, "")

# --- Save/Load Data ---
func save_data() -> void:
	"""Saves skin ownership, equipment, and gem data to disk."""
	var config = ConfigFile.new()

	config.set_value("skins", "owned", owned_skins)
	config.set_value("skins", "equipped", equipped_skins)
	config.set_value("gems", "balance", _local_gems)
	config.set_value("achievements", "completed", completed_achievements)

	var error = config.save(SAVE_FILE_PATH)
	if error != OK:
		push_error("Failed to save cosmetic data: %s" % error)

func load_data() -> void:
	"""Loads skin ownership, equipment, and gem data from disk."""
	var config = ConfigFile.new()
	var error = config.load(SAVE_FILE_PATH)

	if error == OK:
		owned_skins = config.get_value("skins", "owned", [])
		equipped_skins = config.get_value("skins", "equipped", {})
		_local_gems = config.get_value("gems", "balance", 0)
		completed_achievements = config.get_value("achievements", "completed", [])
	else:
		initialize_default_data()

func initialize_default_data() -> void:
	"""Initializes with default empty data."""
	owned_skins = []
	equipped_skins = {}
	_local_gems = 0
	completed_achievements = []
	save_data()
