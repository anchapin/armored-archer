## Player Loadout Management UI
## Displays 5 equipment slots with tap-to-equip and drag-and-drop functionality
##
## Features:
## - 5 equipment slots: Helm, Armor, Bow, Arrow, Amulet
## - Tap slot to open gear selection
## - Drag gear from inventory to equip
## - Shows equipped gear stats
##
extends Control

signal loadout_closed()
signal gear_equipped(slot: String, gear_id: String)
signal gear_unequipped(slot: String)

# --- UI References ---
@onready var slots_container: GridContainer = $SafeAreaContainer/VBoxContainer/SlotsContainer
@onready var helm_slot: TextureRect = $SafeAreaContainer/VBoxContainer/SlotsContainer/HelmSlot
@onready var armor_slot: TextureRect = $SafeAreaContainer/VBoxContainer/SlotsContainer/ArmorSlot
@onready var bow_slot: TextureRect = $SafeAreaContainer/VBoxContainer/SlotsContainer/BowSlot
@onready var arrow_slot: TextureRect = $SafeAreaContainer/VBoxContainer/SlotsContainer/ArrowSlot
@onready var amulet_slot: TextureRect = $SafeAreaContainer/VBoxContainer/SlotsContainer/AmuletSlot

@onready var helm_label: Label = $SafeAreaContainer/VBoxContainer/SlotsContainer/HelmSlot/Label
@onready var armor_label: Label = $SafeAreaContainer/VBoxContainer/SlotsContainer/ArmorSlot/Label
@onready var bow_label: Label = $SafeAreaContainer/VBoxContainer/SlotsContainer/BowSlot/Label
@onready var arrow_label: Label = $SafeAreaContainer/VBoxContainer/SlotsContainer/ArrowSlot/Label
@onready var amulet_label: Label = $SafeAreaContainer/VBoxContainer/SlotsContainer/AmuletSlot/Label

@onready var stats_container: VBoxContainer = $SafeAreaContainer/VBoxContainer/StatsContainer
@onready var total_attack_label: Label = $SafeAreaContainer/VBoxContainer/StatsContainer/TotalAttack
@onready var total_defense_label: Label = $SafeAreaContainer/VBoxContainer/StatsContainer/TotalDefense
@onready var total_speed_label: Label = $SafeAreaContainer/VBoxContainer/StatsContainer/TotalSpeed
@onready var total_health_label: Label = $SafeAreaContainer/VBoxContainer/StatsContainer/TotalHealth

@onready var back_button: Button = $SafeAreaContainer/VBoxContainer/BackButton

# --- Gear Selection Popup ---
var gear_selection_popup: Control = null

# --- Manager References ---
var gear_manager: GearManager
var gear_registry: GearRegistry

# --- Slot Configuration ---
var slot_map: Dictionary = {}
var equipped_gear_data: Dictionary = {}

# --- Drag State ---
var is_dragging: bool = false
var dragged_gear: Dictionary = {}
var drag_source: String = ""  # "inventory" or "slot"

# --- Rarity Colors ---
var rarity_colors: Dictionary = {
	"common": Color(0.9, 0.9, 0.9),
	"uncommon": Color(0.3, 0.9, 0.3),
	"rare": Color(0, 0.49, 0.87),
	"epic": Color(0.64, 0.21, 0.84),
	"legendary": Color(1, 0.5, 0)
}

# --- Gear Type to Slot Mapping ---
var gear_type_to_slot: Dictionary = {
	"helm": "helm",
	"armor": "armor",
	"bow": "bow",
	"arrow": "arrow",
	"amulet": "amulet"
}

var slot_to_gear_type: Dictionary = {
	"helm": "helm",
	"armor": "armor",
	"bow": "bow",
	"arrow": "arrow",
	"amulet": "amulet"
}

func _ready() -> void:
	"""Initializes the loadout UI."""
	gear_manager = get_node_or_null("/root/GearManager")
	gear_registry = get_node_or_null("/root/GearRegistry")
	
	# Initialize slot map
	slot_map = {
		helm_slot: "helm",
		armor_slot: "armor",
		bow_slot: "bow",
		arrow_slot: "arrow",
		amulet_slot: "amulet"
	}
	
	# Connect signals
	_setup_connections()
	
	# Connect to gear manager signals
	if gear_manager:
		gear_manager.inventory_updated.connect(_on_inventory_updated)
		gear_manager.gear_equipped.connect(_on_gear_equipped)
		gear_manager.gear_unequipped.connect(_on_gear_unequipped)
		
		# Load initial data
		_refresh_loadout()

func _setup_connections() -> void:
	"""Sets up button and slot connections."""
	back_button.pressed.connect(_on_back_button_pressed)
	
	# Connect slot click signals
	for slot in slot_map.keys():
		if slot.has_signal("gui_input"):
			slot.gui_input.connect(_on_slot_gui_input.bind(slot))
	
	# Connect mouse detection for drag
	gui_input.connect(_on_gui_input)

func _refresh_loadout() -> void:
	"""Refreshes the loadout display with current equipped gear."""
	if not gear_manager:
		return
		
	var inventory: Dictionary = gear_manager._get_full_inventory()
	equipped_gear_data = {}
	
	var equipped: Dictionary = inventory.get("equipped_gear", {})
	
	# Update each slot
	for slot_control in slot_map.keys():
		var slot_name: String = slot_map[slot_control]
		var gear_id: String = equipped.get(slot_name, "")
		
		if gear_id != "":
			var gear_data: Dictionary = gear_manager.get_gear_by_id(gear_id)
			if not gear_data.is_empty():
				equipped_gear_data[slot_name] = gear_data
				_update_slot_display(slot_control, gear_data)
			else:
				_update_slot_empty(slot_control)
		else:
			_update_slot_empty(slot_control)
	
	# Update stats
	_update_total_stats()

func _update_slot_display(slot: TextureRect, gear_data: Dictionary) -> void:
	"""Updates a slot with equipped gear information.
	
	Parameters:
		slot: The slot TextureRect to update
		gear_data: Dictionary containing gear information
	"""
	var slot_name: String = slot_map.get(slot, "")
	var rarity: String = gear_data.get("rarity", "common")
	var color: Color = rarity_colors.get(rarity, Color.WHITE)
	
	# Update label with gear name and rarity color
	var label: Label = null
	match slot_name:
		"helm": label = helm_label
		"armor": label = armor_label
		"bow": label = bow_label
		"arrow": label = arrow_label
		"amulet": label = amulet_label
	
	if label:
		label.text = gear_data.get("name", "Empty")
		label.add_theme_color_override("font_color", color)
	
	# Update slot border color based on rarity
	slot.modulate = color

func _update_slot_empty(slot: TextureRect) -> void:
	"""Updates a slot to show empty state.
	
	Parameters:
		slot: The slot TextureRect to update
	"""
	var slot_name: String = slot_map.get(slot, "")
	
	var label: Label = null
	match slot_name:
		"helm": label = helm_label
		"armor": label = armor_label
		"bow": label = bow_label
		"arrow": label = arrow_label
		"amulet": label = amulet_label
	
	if label:
		label.text = "Empty"
		label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
	
	slot.modulate = Color(0.3, 0.3, 0.3)

func _update_total_stats() -> void:
	"""Calculates and displays total stats from equipped gear."""
	var total_stats: Dictionary = {
		"attack": 0,
		"defense": 0,
		"speed": 0,
		"health": 0
	}
	
	for gear_data in equipped_gear_data.values():
		var stats: Array = gear_data.get("stats", [])
		for stat in stats:
			var stat_name: String = stat.get("name", "").to_lower()
			var stat_value: int = stat.get("value", 0)
			if total_stats.has(stat_name):
				total_stats[stat_name] += stat_value
	
	total_attack_label.text = "Attack: %d" % total_stats.attack
	total_defense_label.text = "Defense: %d" % total_stats.defense
	total_speed_label.text = "Speed: %d" % total_stats.speed
	total_health_label.text = "Health: %d" % total_stats.health

func _on_slot_gui_input(event: InputEvent, slot: TextureRect) -> void:
	"""Handles GUI input on equipment slots for tap and drag.
	
	Parameters:
		event: Input event
		slot: The slot that received input
	"""
	if event is InputEventMouseButton:
		var mouse_event: InputEventMouseButton = event
		
		# Left click - tap to equip/unequip
		if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
			var slot_name: String = slot_map.get(slot, "")
			_on_slot_tapped(slot_name)
		
		# Right click - unequip
		elif mouse_event.button_index == MOUSE_BUTTON_RIGHT and mouse_event.pressed:
			var slot_name: String = slot_map.get(slot, "")
			_on_slot_right_clicked(slot_name)
	
	elif event is InputEventMouseMotion and is_dragging:
		# Update drag position would be handled by the control system
		pass

func _on_slot_tapped(slot_name: String) -> void:
	"""Handles tap on equipment slot to open gear selection.
	
	Parameters:
		slot_name: Name of the slot that was tapped
	"""
	_show_gear_selection_popup(slot_name)

func _on_slot_right_clicked(slot_name: String) -> void:
	"""Handles right-click on equipment slot to unequip.
	
	Parameters:
		slot_name: Name of the slot to unequip
	"""
	if gear_manager and equipped_gear_data.has(slot_name):
		gear_manager.unequip_gear(slot_name)

func _show_gear_selection_popup(slot_name: String) -> void:
	"""Shows the gear selection popup for a specific slot.
	
	Parameters:
		slot_name: Name of the slot to select gear for
	"""
	if not gear_manager:
		return
	
	# Close existing popup
	if gear_selection_popup:
		gear_selection_popup.queue_free()
	
	# Create popup
	gear_selection_popup = Control.new()
	gear_selection_popup.set_anchors_preset(Control.PRESET_FULL_RECT)
	gear_selection_popup.gui_input.connect(_on_popup_input)
	add_child(gear_selection_popup)
	
	# Create background
	var bg: ColorRect = ColorRect.new()
	bg.color = Color(0, 0, 0, 0.7)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	gear_selection_popup.add_child(bg)
	
	# Create container
	var container: VBoxContainer = VBoxContainer.new()
	container.set_anchors_preset(Control.PRESET_CENTER)
	container.position = Vector2(-200, -250)
	container.size = Vector2(400, 500)
	gear_selection_popup.add_child(container)
	
	# Title
	var title: Label = Label.new()
	title.text = "Select %s" % slot_name.capitalize()
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	container.add_child(title)
	
	# Get available gear for this slot
	var inventory: Dictionary = gear_manager._get_full_inventory()
	var gear_array: Array = inventory.get("gear", [])
	var available_gear: Array = []
	
	for gear in gear_array:
		var gear_type: String = gear.get("type", "")
		if gear_type == slot_name:
			available_gear.append(gear)
	
	# Scroll container for gear list
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	container.add_child(scroll)
	
	var gear_list: VBoxContainer = VBoxContainer.new()
	scroll.add_child(gear_list)
	
	# Add gear items
	for gear in available_gear:
		var gear_btn: Button = Button.new()
		var gear_name: String = gear.get("name", "Unknown")
		var rarity: String = gear.get("rarity", "common")
		var color: Color = rarity_colors.get(rarity, Color.WHITE)
		
		gear_btn.text = gear_name
		gear_btn.custom_minimum_size = Vector2(0, 50)
		gear_btn.pressed.connect(_on_gear_item_selected.bind(slot_name, gear))
		gear_list.add_child(gear_btn)
	
	# Add "Unequip" option if something is equipped
	if equipped_gear_data.has(slot_name):
		var unequip_btn: Button = Button.new()
		unequip_btn.text = "Unequip"
		unequip_btn.pressed.connect(_on_unequip_requested.bind(slot_name))
		container.add_child(unequip_btn)
	
	# Add close button
	var close_btn: Button = Button.new()
	close_btn.text = "Cancel"
	close_btn.pressed.connect(_close_gear_selection_popup)
	container.add_child(close_btn)

func _on_gear_item_selected(slot_name: String, gear: Dictionary) -> void:
	"""Handles gear item selection from popup.
	
	Parameters:
		slot_name: Name of the slot
		gear: Selected gear data
	"""
	var gear_id: String = gear.get("id", "")
	if gear_id != "" and gear_manager:
		gear_manager.equip_gear(gear_id, slot_name)
	
	_close_gear_selection_popup()

func _on_unequip_requested(slot_name: String) -> void:
	"""Handles unequip request from popup.
	
	Parameters:
		slot_name: Name of the slot to unequip
	"""
	if gear_manager:
		gear_manager.unequip_gear(slot_name)
	
	_close_gear_selection_popup()

func _close_gear_selection_popup() -> void:
	"""Closes the gear selection popup."""
	if gear_selection_popup:
		gear_selection_popup.queue_free()
		gear_selection_popup = null

func _on_popup_input(event: InputEvent) -> void:
	"""Handles input on popup to close when clicking outside.
	
	Parameters:
		event: Input event
	"""
	if event is InputEventMouseButton and event.pressed:
		_close_gear_selection_popup()

func _on_back_button_pressed() -> void:
	"""Handles back button press."""
	loadout_closed.emit()
	queue_free()

func _on_inventory_updated(_inventory: Dictionary) -> void:
	"""Handles inventory updates from GearManager.
	
	Parameters:
		_inventory: Updated inventory data
	"""
	_refresh_loadout()

func _on_gear_equipped(slot: String, _gear_id: String) -> void:
	"""Handles gear equipped signal.
	
	Parameters:
		slot: Slot that gear was equipped to
		_gear_id: ID of equipped gear
	"""
	_refresh_loadout()
	gear_equipped.emit(slot, _gear_id)

func _on_gear_unequipped(slot: String) -> void:
	"""Handles gear unequipped signal.
	
	Parameters:
		slot: Slot that gear was unequipped from
	"""
	_refresh_loadout()
	gear_unequipped.emit(slot)

# --- Drag and Drop Support ---

func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	"""Checks if data can be dropped on this control.
	
	Parameters:
		_at_position: Position to check
		data: Data being dragged
		
	Returns:
		bool: True if drop is valid
	"""
	if typeof(data) != TYPE_DICTIONARY:
		return false
	return data.has("gear_id") and data.has("gear_type")

func _drop_data(_at_position: Vector2, data: Variant) -> void:
	"""Handles data being dropped on this control.
	
	Parameters:
		_at_position: Position where data was dropped
		data: Dropped data containing gear info
	"""
	var gear_id: String = data.get("gear_id", "")
	var gear_type: String = data.get("gear_type", "")
	
	# Determine which slot to equip to
	var target_slot: String = gear_type_to_slot.get(gear_type, "")
	
	if target_slot != "" and gear_manager and gear_id != "":
		gear_manager.equip_gear(gear_id, target_slot)

# --- Public Methods ---

func get_equipped_gear() -> Dictionary:
	"""Returns the currently equipped gear.
	
	Returns:
		Dictionary: Mapping of slot names to gear data
	"""
	return equipped_gear_data.duplicate()

func get_slot_gear(slot_name: String) -> Dictionary:
	"""Returns the gear equipped in a specific slot.
	
	Parameters:
		slot_name: Name of the slot
		
	Returns:
		Dictionary: Gear data or empty dict if empty
	"""
	return equipped_gear_data.get(slot_name, {})

func highlight_slot(slot_name: String) -> void:
	"""Highlights a specific slot for visual feedback.
	
	Parameters:
		slot_name: Name of the slot to highlight
	"""
	var slot_control: TextureRect = null
	match slot_name:
		"helm": slot_control = helm_slot
		"armor": slot_control = armor_slot
		"bow": slot_control = bow_slot
		"arrow": slot_control = arrow_slot
		"amulet": slot_control = amulet_slot
	
	if slot_control:
		var tween: Tween = create_tween()
		tween.tween_property(slot_control, "scale", Vector2(1.1, 1.1), 0.1)
		tween.tween_property(slot_control, "scale", Vector2(1.0, 1.0), 0.1)
