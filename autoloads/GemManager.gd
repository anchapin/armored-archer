extends Node

# --- Manager References ---
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")
@onready var gear_registry: Node = get_node_or_null("/root/GearRegistry")

# --- Skin Ownership & Equipment ---
var owned_skins: Array = []
var equipped_skins: Dictionary = {}

# --- Slot Type Mapping ---
var slot_type_mapping: Dictionary = {
	"helm": GearSlot.SlotType.HELM,
	"armor": GearSlot.SlotType.ARMOR,
	"bow": GearSlot.SlotType.BOW,
	"arrow": GearSlot.SlotType.ARROW
}

# --- Signals ---
signal skin_purchased(skin_id: String)
signal skin_equipped(skin_id: String, slot: String)
signal skin_unequipped(slot: String)

# --- Save Data Path ---
const SAVE_FILE_PATH = "user://cosmetic_data.save"

# --- Initialization ---
func _ready() -> void:
	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)
	
	load_data()

# --- Gem Management (Delegates to StoreManager) ---
func get_gem_balance() -> int:
	if store_manager:
		return store_manager.get_gems()
	return 0

func _on_currency_updated(gems: int, gold: int) -> void:
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
	
	equipped_skins[slot_name] = skin_id
	skin_equipped.emit(skin_id, slot_name)
	save_data()
	
	return true

func unequip_skin(slot_name: String) -> void:
	if equipped_skins.has(slot_name):
		equipped_skins.erase(slot_name)
		skin_unequipped.emit(slot_name)
		save_data()

func get_equipped_skin(slot_name: String) -> String:
	return equipped_skins.get(slot_name, "")

# --- Save/Load Data ---
func save_data() -> void:
	var config = ConfigFile.new()
	
	config.set_value("skins", "owned", owned_skins)
	config.set_value("skins", "equipped", equipped_skins)
	
	var error = config.save(SAVE_FILE_PATH)
	if error != OK:
		push_error("Failed to save cosmetic data: %s" % error)

func load_data() -> void:
	var config = ConfigFile.new()
	var error = config.load(SAVE_FILE_PATH)
	
	if error == OK:
		owned_skins = config.get_value("skins", "owned", [])
		equipped_skins = config.get_value("skins", "equipped", {})
	else:
		initialize_default_data()

func initialize_default_data() -> void:
	owned_skins = []
	equipped_skins = {}
	save_data()
