extends Control

class_name GearSystemDemo

@onready var modular_character: ModularCharacterSprite = $CenterContainer/CharacterSprite
@onready var info_label: Label = $InfoLabel
@onready var slot_buttons: HBoxContainer = $SlotButtons
@onready var gear_buttons: HBoxContainer = $GearButtons
@onready var skin_buttons: HBoxContainer = $SkinButtons

var current_slot: String = "helm"
var current_base_gear: String = ""
var current_skin: String = ""

const SLOTS = ["helm", "armor", "bow", "arrow"]

func _ready() -> void:
	_setup_ui()
	_update_character_display()
	_update_info()

func _setup_ui() -> void:
	for slot in SLOTS:
		var button = Button.new()
		button.text = slot.capitalize()
		button.pressed.connect(_on_slot_button_pressed.bind(slot))
		slot_buttons.add_child(button)
	
	var none_button = Button.new()
	none_button.text = "None"
	none_button.pressed.connect(_on_none_skin_pressed)
	skin_buttons.add_child(none_button)

func _on_slot_button_pressed(slot: String) -> void:
	current_slot = slot
	current_base_gear = TransmogManager.current_loadout.base_gear.get(slot, "")
	current_skin = TransmogManager.current_loadout.skins.get(slot, "")
	_update_character_display()
	_update_info()

func _on_base_gear_button_pressed(gear_id: String) -> void:
	TransmogManager.equip_base_gear(current_slot, gear_id)
	current_base_gear = gear_id
	_update_character_display()
	_update_info()

func _on_skin_button_pressed(skin_id: String) -> void:
	TransmogManager.equip_skin(current_slot, skin_id)
	current_skin = skin_id
	_update_character_display()
	_update_info()

func _on_none_skin_pressed() -> void:
	TransmogManager.unequip_skin(current_slot)
	current_skin = ""
	_update_character_display()
	_update_info()

func _update_character_display() -> void:
	var loadout = TransmogManager.get_current_loadout()
	
	for slot in SLOTS:
		var base_gear_id = loadout.base_gear.get(slot, "")
		var skin_id = loadout.skins.get(slot, "")
		
		var gear_data = GearRegistry.get_base_gear(base_gear_id)
		if gear_data:
			modular_character.equip_base_gear(slot, base_gear_id, gear_data.base_texture)
		
		if not skin_id.is_empty():
			var skin_data = GearRegistry.get_skin(skin_id)
			if skin_data:
				modular_character.equip_skin(slot, skin_id, skin_data.skin_texture)
		else:
			modular_character.unequip_skin(slot)

func _update_info() -> void:
	var info_text = "Gear System Demo\n\n"
	info_text += "Current Slot: %s\n" % current_slot.capitalize()
	info_text += "Base Gear: %s\n" % current_base_gear
	info_text += "Skin: %s\n\n" % (current_skin if not current_skin.is_empty() else "None")
	
	var stats = TransmogManager.get_total_stats()
	info_text += "Total Stats:\n"
	info_text += "  Attack: +%d\n" % stats.attack
	info_text += "  Defense: +%d\n" % stats.defense
	info_text += "  Speed: +%d\n" % stats.speed
	info_text += "  Health: +%d\n" % stats.health
	
	info_label.text = info_text
