## Individual equipment slot for loadout UI.
## Supports tap-to-select and drag-and-drop for equipping gear.
##
extends Control

signal slot_clicked(slot_type: int)
signal gear_dropped(gear_data: Dictionary, target_slot: int)

# Import gear enums for slot type
const GearEnums = preload("res://scripts/gear_enums.gd")

var slot_type: int = 0
var slot_name: String = ""
var current_gear: Dictionary = {}

# --- Visual Constants ---
const RARITY_ACCENT_WIDTH: float = 4.0
const EQUIPPED_GLOW_COLOR: Color = Color(1, 0.675, 0.329, 0.5)  # Golden

@onready var slot_button: Button = $SlotButton
@onready var slot_label: Label = $SlotLabel
@onready var gear_name_label: Label = $GearNameLabel
@onready var gear_icon: TextureRect = $GearIcon

func _ready() -> void:
	slot_button.pressed.connect(_on_slot_button_pressed)

	# Enable drag-and-drop on the slot button
	# Note: Control nodes support drag-and-drop via set_drag_forwarding
	set_drag_forwarding(_get_drag_data, _can_drop_data, _drop_data)

	_update_display()

func _update_display() -> void:
	slot_label.text = slot_name

	if current_gear.is_empty():
		gear_name_label.text = "Empty"
		gear_name_label.modulate = Color(0.5, 0.5, 0.5)
		gear_icon.texture = null
		_clear_rarity_accent()
	else:
		var gear_name: String = current_gear.get("name", "Unknown")
		gear_name_label.text = gear_name

		var rarity: String = current_gear.get("rarity", "common")
		var rarity_colors: Dictionary = {
			"common": Color.WHITE,
			"rare": Color(0.3, 0.6, 1.0),      # Blue
			"epic": Color(0.7, 0.4, 1.0),      # Purple
			"legendary": Color(1, 0.675, 0.329) # Golden
		}
		var rarity_color: Color = rarity_colors.get(rarity, Color.WHITE)
		gear_name_label.modulate = rarity_color
		
		# Add rarity accent bar
		_add_rarity_accent(rarity_color)

func _add_rarity_accent(color: Color) -> void:
	# Remove existing accent if any
	_clear_rarity_accent()
	
	# Create rarity accent bar on left edge
	var accent := ColorRect.new()
	accent.name = "RarityAccent"
	accent.color = color
	accent.anchor_left = 0
	accent.anchor_top = 0
	accent.anchor_right = 0
	accent.anchor_bottom = 1
	accent.offset_left = 0
	accent.offset_top = 0
	accent.offset_right = RARITY_ACCENT_WIDTH
	accent.offset_bottom = 0
	
	move_child(accent, 0)  # Add behind other controls
	add_child(accent)

func _clear_rarity_accent() -> void:
	var accent = get_node_or_null("RarityAccent")
	if accent:
		accent.queue_free()

func set_gear(gear_data: Dictionary) -> void:
	current_gear = gear_data
	_update_display()

func clear_gear() -> void:
	current_gear = {}
	_update_display()

func _on_slot_button_pressed() -> void:
	slot_clicked.emit(slot_type)

# --- Drag and Drop Handlers ---

func _get_drag_data(_at_position: Vector2) -> Variant:
	if current_gear.is_empty():
		return null

	var preview: Control = Control.new()
	var label: Label = Label.new()
	label.text = current_gear.get("name", "Gear")
	label.add_theme_color_override("font_color", Color(1, 0.675, 0.329))  # Golden text
	label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	label.add_theme_constant_override("outline_size", 1)
	preview.add_child(label)
	preview.set_anchors_preset(Control.PRESET_CENTER)

	current_gear["_drag_source_slot"] = slot_type

	return current_gear

func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	if typeof(data) != TYPE_DICTIONARY:
		return false

	var gear_data: Dictionary = data
	var gear_slot_str: String = gear_data.get("type", "")
	var target_slot_str: String = _get_slot_key(slot_type)

	return gear_slot_str == target_slot_str

func _drop_data(_at_position: Vector2, data: Variant) -> void:
	gear_dropped.emit(data, slot_type)

func _get_slot_key(type_val: int) -> String:
	match type_val:
		GearEnums.GearType.HELM:
			return "helm"
		GearEnums.GearType.ARMOR:
			return "armor"
		GearEnums.GearType.BOW:
			return "bow"
		GearEnums.GearType.ARROW:
			return "arrow"
		GearEnums.GearType.AMULET:
			return "amulet"
	return ""
