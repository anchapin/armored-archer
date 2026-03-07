extends Control

# --- UI References ---
@onready var gem_label: Label = $HeaderContainer/GemContainer/GemLabel
@onready var back_button: Button = $HeaderContainer/BackButton

@onready var helm_button: Button = $MainContainer/SlotTabs/HelmButton
@onready var armor_button: Button = $MainContainer/SlotTabs/ArmorButton
@onready var bow_button: Button = $MainContainer/SlotTabs/BowButton
@onready var arrow_button: Button = $MainContainer/SlotTabs/ArrowButton

@onready var skin_grid: GridContainer = $MainContainer/SkinCatalog/SkinGrid
@onready var preview_name_label: Label = $MainContainer/PreviewContainer/PreviewNameLabel
@onready var preview_price_label: Label = $MainContainer/PreviewContainer/PreviewPriceLabel
@onready var preview_owned_label: Label = $MainContainer/PreviewContainer/PreviewOwnedLabel
@onready var purchase_button: Button = $MainContainer/PreviewContainer/PurchaseButton
@onready var equip_button: Button = $MainContainer/PreviewContainer/EquipButton

@onready var purchase_confirmation_dialog: ConfirmationDialog = $PurchaseConfirmationDialog
@onready var confirmation_label: Label = $PurchaseConfirmationDialog/ConfirmationLabel

# --- GemManager Reference ---
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")

# --- Shop State ---
var current_slot: String = "helm"
var selected_skin_id: String = ""

# --- Skin Buttons Dictionary ---
var skin_buttons: Dictionary = {}

# --- Initialization ---
func _ready() -> void:
	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)

	if gem_manager:
		gem_manager.skin_purchased.connect(_on_skin_purchased)
		gem_manager.skin_equipped.connect(_on_skin_equipped)

	_setup_button_connections()
	_update_gem_display()
	_load_slot(current_slot)

func _setup_button_connections() -> void:
	back_button.pressed.connect(_on_back_pressed)

	helm_button.pressed.connect(func(): _on_slot_button_pressed("helm"))
	armor_button.pressed.connect(func(): _on_slot_button_pressed("armor"))
	bow_button.pressed.connect(func(): _on_slot_button_pressed("bow"))
	arrow_button.pressed.connect(func(): _on_slot_button_pressed("arrow"))

	purchase_button.pressed.connect(_on_purchase_button_pressed)
	equip_button.pressed.connect(_on_equip_button_pressed)

	purchase_confirmation_dialog.confirmed.connect(_on_purchase_confirmed)
	purchase_confirmation_dialog.canceled.connect(_on_purchase_canceled)

# --- Gem Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = str(gem_manager.get_gem_balance())

func _on_currency_updated(gems: int, gold: int) -> void:
	_update_gem_display()
	_update_preview_buttons()

# --- Slot Management ---
func _on_slot_button_pressed(slot: String) -> void:
	current_slot = slot
	selected_skin_id = ""
	_load_slot(slot)
	_clear_preview()

func _load_slot(slot: String) -> void:
	_clear_skin_grid()

	var skins = gem_manager.get_skins_by_slot(slot)

	for skin in skins:
		var button = _create_skin_button(skin)
		skin_grid.add_child(button)
		skin_buttons[skin.skin_id] = button

func _clear_skin_grid() -> void:
	for child in skin_grid.get_children():
		child.queue_free()
	skin_buttons.clear()

func _create_skin_button(skin_data) -> Button:
	var button = Button.new()
	button.custom_minimum_size = Vector2(100, 100)
	button.text = skin_data.skin_name

	if gem_manager.is_skin_owned(skin_data.skin_id):
		button.modulate = Color(1, 1, 1, 1)
	else:
		button.modulate = Color(0.6, 0.6, 0.6, 1)

	var equipped_skin_id = gem_manager.get_equipped_skin(current_slot)
	if skin_data.skin_id == equipped_skin_id:
		button.text += " (Equipped)"

	button.pressed.connect(func(): _on_skin_button_pressed(skin_data.skin_id))

	return button

# --- Skin Selection ---
func _on_skin_button_pressed(skin_id: String) -> void:
	selected_skin_id = skin_id
	_show_skin_preview(skin_id)

func _show_skin_preview(skin_id: String) -> void:
	var skin_info = gem_manager.get_skin_info(skin_id)

	if not skin_info:
		_clear_preview()
		return

	preview_name_label.text = skin_info.skin_name
	preview_price_label.text = "Price: %d gems" % skin_info.price

	var is_owned = gem_manager.is_skin_owned(skin_id)
	var is_equipped = gem_manager.get_equipped_skin(current_slot) == skin_id

	if is_owned:
		preview_owned_label.text = "Owned"
		if is_equipped:
			preview_owned_label.text += " (Equipped)"
		preview_owned_label.modulate = Color.GREEN
	else:
		preview_owned_label.text = "Not Owned"
		preview_owned_label.modulate = Color.RED

	_update_preview_buttons()

func _clear_preview() -> void:
	preview_name_label.text = "Select a skin"
	preview_price_label.text = ""
	preview_owned_label.text = ""
	purchase_button.disabled = true
	equip_button.disabled = true

func _update_preview_buttons() -> void:
	if selected_skin_id.is_empty():
		purchase_button.disabled = true
		equip_button.disabled = true
		return

	var skin_info = gem_manager.get_skin_info(selected_skin_id)
	var is_owned = gem_manager.is_skin_owned(selected_skin_id)
	var is_equipped = gem_manager.get_equipped_skin(current_slot) == selected_skin_id

	if is_owned:
		purchase_button.disabled = true
		equip_button.disabled = is_equipped
	else:
		purchase_button.disabled = gem_manager.get_gem_balance() < skin_info.price
		equip_button.disabled = true

# --- Purchase Flow ---
func _on_purchase_button_pressed() -> void:
	if selected_skin_id.is_empty():
		return

	var skin_info = gem_manager.get_skin_info(selected_skin_id)
	if not skin_info:
		return

	confirmation_label.text = "Are you sure you want to purchase %s for %d gems?" % [skin_info.skin_name, skin_info.price]
	purchase_confirmation_dialog.popup_centered()

func _on_purchase_confirmed() -> void:
	if selected_skin_id.is_empty():
		return

	if gem_manager.purchase_skin(selected_skin_id):
		_show_skin_preview(selected_skin_id)
		_load_slot(current_slot)
	else:
		push_error("Failed to purchase skin")

func _on_purchase_canceled() -> void:
	pass

func _on_skin_purchased(skin_id: String) -> void:
	_show_skin_preview(skin_id)

# --- Equip Flow ---
func _on_equip_button_pressed() -> void:
	if selected_skin_id.is_empty():
		return

	if gem_manager.equip_skin(current_slot, selected_skin_id):
		_show_skin_preview(selected_skin_id)
		_load_slot(current_slot)
	else:
		push_error("Failed to equip skin")

func _on_skin_equipped(skin_id: String, slot: String) -> void:
	if slot == current_slot:
		_show_skin_preview(skin_id)

# --- Navigation ---
func _on_back_pressed() -> void:
	queue_free()
