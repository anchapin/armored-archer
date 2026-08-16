## Manages cosmetic skin ownership and equipment.
## Handles skin purchases, equipment, and integration with Store and Gear systems.
## Syncs ownership and equipped state to server for cross-device consistency.
##
## Signals:
## - skin_purchased(skin_id: String): Emitted when a skin is bought
## - skin_equipped(skin_id: String, slot: String): Emitted when a skin is equipped
## - skin_unequipped(slot: String): Emitted when a skin is removed
## - sync_completed(owned: Array, equipped: Dictionary): Emitted after server sync
##
extends Node

# --- Manager References ---
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")
@onready var gear_registry: Node = get_node_or_null("/root/GearRegistry")

# --- Analytics Reference ---
@onready var analytics: Node = get_node_or_null("/root/AnalyticsManager")

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- Skin Ownership & Equipment ---
var owned_skins: Array = []
var equipped_skins: Dictionary = {}

# --- Bundle State ---
var owned_bundles: Array = []

# --- Slot Type Mapping ---
var slot_type_mapping: Dictionary = {}

# Import gear enums for GearType enum
const GearEnums = preload("res://scripts/gear_enums.gd")

# --- Sync State ---
var _sync_in_progress: bool = false

func _ready() -> void:
	slot_type_mapping = {
		"helm": GearEnums.GearType.HELM,
		"armor": GearEnums.GearType.ARMOR,
		"bow": GearEnums.GearType.BOW,
		"arrow": GearEnums.GearType.ARROW,
		"amulet": GearEnums.GearType.AMULET
	}

	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)

	# Hook into login for cross-device sync
	if network_manager and network_manager.has_signal("session_created"):
		network_manager.session_created.connect(_on_session_created)

	load_data()

# --- Signals ---
signal skin_purchased(skin_id: String)
signal skin_equipped(skin_id: String, slot: String)
signal skin_unequipped(slot: String)
signal sync_completed(owned: Array, equipped: Dictionary)
signal bundle_purchased(bundle_id: String, items: Array)

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
var completed_achievements: Array = []

# --- Cross-Device Sync ---

func _on_session_created(success: bool, _error_message: String) -> void:
	if success:
		sync_with_server()

func sync_with_server() -> void:
	if _sync_in_progress:
		return
	if not network_manager or not network_manager.is_session_valid():
		return

	_sync_in_progress = true

	# Fetch owned cosmetics from server
	var owned_response: Dictionary = await network_manager.send_rpc("armored_archer/get_owned_cosmetics", "{}")
	if owned_response.get("success", false):
		var server_owned: Array = owned_response.get("items", [])
		# Merge: add any server-known items missing locally
		for skin_id in server_owned:
			if not skin_id in owned_skins:
				owned_skins.append(skin_id)

	# Fetch equipped cosmetics from server
	var equipped_response: Dictionary = await network_manager.send_rpc("armored_archer/get_equipped_cosmetics", "{}")
	if equipped_response.get("success", false):
		var server_equipped: Dictionary = equipped_response.get("equipped", {})
		# Server is authoritative for equipped state
		equipped_skins = server_equipped

	save_data()
	_sync_in_progress = false
	sync_completed.emit(owned_skins, equipped_skins)

func save_equipped_to_server(skins: Dictionary) -> void:
	if not network_manager or not network_manager.is_session_valid():
		return

	var payload = JSON.stringify({"equipped": skins})
	var response: Dictionary = await network_manager.send_rpc("armored_archer/save_cosmetic_loadout", payload)
	if not response.get("success", false):
		push_error("Failed to save loadout to server: %s" % response.get("error", "unknown"))

# --- Achievement Rewards ---
func claim_achievement_reward(achievement_id: String) -> int:
	if achievement_id in completed_achievements:
		return 0

	if not ACHIEVEMENT_GEM_REWARDS.has(achievement_id):
		push_error("Unknown achievement: %s" % achievement_id)
		return 0

	var reward = ACHIEVEMENT_GEM_REWARDS[achievement_id]

	completed_achievements.append(achievement_id)
	add_gems(reward, "achievement:" + achievement_id)

	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("achievement_completed", {
			"achievement_id": achievement_id,
			"gems_awarded": reward,
			"reason": "achievement_reward"
		})

	return reward

func get_achievement_reward(achievement_id: String) -> int:
	return ACHIEVEMENT_GEM_REWARDS.get(achievement_id, 0)

func is_achievement_completed(achievement_id: String) -> bool:
	return achievement_id in completed_achievements

# --- Gem Management (Delegates to StoreManager) ---
signal gems_updated(new_balance: int)

var _local_gems: int = 0

func get_gem_balance() -> int:
	if store_manager:
		return store_manager.get_gems()
	return _local_gems

func add_gems(amount: int, reason: String = "") -> void:
	if amount <= 0:
		push_error("Invalid gem amount to add")
		return

	_local_gems += amount

	if store_manager:
		store_manager.add_gems(amount)

	gems_updated.emit(_local_gems)
	save_data()

func remove_gems(amount: int, reason: String = "") -> void:
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

func _on_currency_updated(_gems: int, _coins: int) -> void:
	pass

# --- Skin Catalog (Delegates to GearRegistry) ---
func get_skins_by_slot(slot_name: String) -> Array:
	if not gear_registry or not slot_type_mapping.has(slot_name):
		return []

	var slot_type = slot_type_mapping[slot_name]
	return gear_registry.get_skins_by_slot(slot_type)

func get_skin_info(skin_id: String):
	if not gear_registry:
		return null

	return gear_registry.get_skin(skin_id)

func is_skin_owned(skin_id: String) -> bool:
	return skin_id in owned_skins

# --- Skin Purchase ---
func purchase_skin(skin_id: String) -> bool:
	if is_skin_owned(skin_id):
		push_error("Skin already owned: %s" % skin_id)
		return false

	var skin_info = get_skin_info(skin_id)
	if not skin_info:
		push_error("Skin not found: %s" % skin_id)
		return false

	# Server-authoritative purchase via RPC
	if network_manager and network_manager.is_session_valid():
		var payload = JSON.stringify({"item_id": skin_id})
		var response: Dictionary = await network_manager.send_rpc("armored_archer/purchase_cosmetic", payload)

		if not response.get("success", false):
			push_error("Server rejected cosmetic purchase: %s" % response.get("error", "unknown"))
			return false

		# Update local gem balance from server response
		var server_balance = response.get("new_balance", -1)
		if server_balance >= 0:
			_local_gems = int(server_balance)
			gems_updated.emit(_local_gems)

		owned_skins.append(skin_id)
		skin_purchased.emit(skin_id)
		save_data()
	else:
		# Offline fallback: client-side validation only
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
			skin_info.skin_name if skin_info.skin_name else skin_id,
			"skin",
			"common",
			skin_info.price,
			"gems"
		)

	return true

# --- Skin Equipment ---
func equip_skin(slot_name: String, skin_id: String) -> bool:
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

	# Server-authoritative equip when online
	if network_manager and network_manager.is_session_valid():
		var payload = JSON.stringify({"slot": slot_name, "skin_id": skin_id})
		var response: Dictionary = await network_manager.send_rpc("armored_archer/equip_cosmetic", payload)
		if not response.get("success", false):
			push_error("Server rejected equip: %s" % response.get("error", "unknown"))
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
	# Server-authoritative unequip when online
	if network_manager and network_manager.is_session_valid() and equipped_skins.has(slot_name):
		var payload = JSON.stringify({"slot": slot_name})
		var response: Dictionary = await network_manager.send_rpc("armored_archer/unequip_cosmetic", payload)
		if not response.get("success", false):
			push_error("Server rejected unequip: %s" % response.get("error", "unknown"))
			return

	if equipped_skins.has(slot_name):
		var _err = equipped_skins.erase(slot_name)
		skin_unequipped.emit(slot_name)
		save_data()

func get_equipped_skin(slot_name: String) -> String:
	return equipped_skins.get(slot_name, "")

func is_bundle_owned(bundle_id: String) -> bool:
	return bundle_id in owned_bundles

func purchase_bundle(bundle_id: String) -> bool:
	if is_bundle_owned(bundle_id):
		push_error("Bundle already owned: %s" % bundle_id)
		return false

	# Server-authoritative purchase via RPC
	if network_manager and network_manager.is_session_valid():
		var payload = JSON.stringify({"bundle_id": bundle_id})
		var response: Dictionary = await network_manager.send_rpc("armored_archer/purchase_bundle", payload)

		if not response.get("success", false):
			push_error("Server rejected bundle purchase: %s" % response.get("error", "unknown"))
			return false

		var server_balance = response.get("new_balance", -1)
		if server_balance >= 0:
			_local_gems = int(server_balance)
			gems_updated.emit(_local_gems)

		var items_granted: Array = response.get("items_granted", [])
		for item_id in items_granted:
			if not item_id in owned_skins:
				owned_skins.append(item_id)

		owned_bundles.append(bundle_id)
		bundle_purchased.emit(bundle_id, items_granted)
		save_data()
	else:
		push_error("Bundle purchases require network connection")
		return false

	return true

func get_bundle_catalog() -> Array:
	if not network_manager or not network_manager.is_session_valid():
		return []

	var response: Dictionary = await network_manager.send_rpc("armored_archer/get_bundle_catalog", "{}")
	if response.get("success", false):
		var bundles: Array = response.get("bundles", [])
		for bundle in bundles:
			if bundle.get("is_owned", false) and not bundle.bundle_id in owned_bundles:
				owned_bundles.append(bundle.bundle_id)
		save_data()
		return bundles
	return []

# --- Save/Load Data ---
func save_data() -> void:
	var config = ConfigFile.new()

	config.set_value("skins", "owned", owned_skins)
	config.set_value("skins", "equipped", equipped_skins)
	config.set_value("gems", "balance", _local_gems)
	config.set_value("achievements", "completed", completed_achievements)
	config.set_value("bundles", "owned", owned_bundles)

	var error = config.save(SAVE_FILE_PATH)
	if error != OK:
		push_error("Failed to save cosmetic data: %s" % error)

func load_data() -> void:
	var config = ConfigFile.new()
	var error = config.load(SAVE_FILE_PATH)

	if error == OK:
		owned_skins = config.get_value("skins", "owned", [])
		equipped_skins = config.get_value("skins", "equipped", {})
		_local_gems = config.get_value("gems", "balance", 0)
		completed_achievements = config.get_value("achievements", "completed", [])
		owned_bundles = config.get_value("bundles", "owned", [])
	else:
		initialize_default_data()

func initialize_default_data() -> void:
	owned_skins = []
	equipped_skins = {}
	_local_gems = 0
	completed_achievements = []
	owned_bundles = []
	save_data()
