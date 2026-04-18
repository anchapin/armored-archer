extends Control

# --- UI References ---
@onready var gem_label: Label = $HeaderContainer/GemContainer/GemLabel
@onready var back_button: Button = $HeaderContainer/BackButton

@onready var helm_button: Button = $MainContainer/SlotTabs/HelmButton
@onready var armor_button: Button = $MainContainer/SlotTabs/ArmorButton
@onready var bow_button: Button = $MainContainer/SlotTabs/BowButton
@onready var arrow_button: Button = $MainContainer/SlotTabs/ArrowButton
@onready var amulet_button: Button = $MainContainer/SlotTabs/AmuletButton

@onready var skin_grid: GridContainer = $MainContainer/SkinCatalog/SkinGrid
@onready var preview_name_label: Label = $MainContainer/PreviewContainer/PreviewNameLabel
@onready var preview_price_label: Label = $MainContainer/PreviewContainer/PreviewPriceLabel
@onready var preview_owned_label: Label = $MainContainer/PreviewContainer/PreviewOwnedLabel
@onready var purchase_button: Button = $MainContainer/PreviewContainer/PurchaseButton
@onready var equip_button: Button = $MainContainer/PreviewContainer/EquipButton

@onready var bundle_container: PanelContainer = $MainContainer/BundleContainer
@onready var bundle_name_label: Label = $MainContainer/BundleContainer/BundleNameLabel
@onready var bundle_description_label: Label = $MainContainer/BundleContainer/BundleDescriptionLabel
@onready var bundle_price_label: Label = $MainContainer/BundleContainer/BundlePriceLabel
@onready var bundle_save_label: Label = $MainContainer/BundleContainer/BundleSaveLabel
@onready var bundle_purchase_button: Button = $MainContainer/BundleContainer/BundlePurchaseButton

@onready var purchase_confirmation_dialog: ConfirmationDialog = $PurchaseConfirmationDialog
@onready var confirmation_label: Label = $PurchaseConfirmationDialog/ConfirmationLabel
@onready var yes_button: Button = $PurchaseConfirmationDialog/ButtonContainer/YesButton
@onready var no_button: Button = $PurchaseConfirmationDialog/ButtonContainer/NoButton

# --- GemManager Reference ---
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")

# --- Shop State ---
var current_slot: String = "helm"
var selected_skin_id: String = ""
var available_bundles: Array = []

# --- Skin Buttons Dictionary ---
var skin_buttons: Dictionary = {}

# --- Initialization ---
func _ready() -> void:
	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)

	if gem_manager:
		gem_manager.skin_purchased.connect(_on_skin_purchased)
		gem_manager.skin_equipped.connect(_on_skin_equipped)
		gem_manager.bundle_purchased.connect(_on_bundle_purchased)

	_setup_button_connections()
	_update_gem_display()
	_load_slot(current_slot)
	_load_bundles()

func _setup_button_connections() -> void:
	back_button.pressed.connect(_on_back_pressed)

	helm_button.pressed.connect(func(): _on_slot_button_pressed("helm"))
	armor_button.pressed.connect(func(): _on_slot_button_pressed("armor"))
	bow_button.pressed.connect(func(): _on_slot_button_pressed("bow"))
	arrow_button.pressed.connect(func(): _on_slot_button_pressed("arrow"))
	amulet_button.pressed.connect(func(): _on_slot_button_pressed("amulet"))

	purchase_button.pressed.connect(_on_purchase_button_pressed)
	equip_button.pressed.connect(_on_equip_button_pressed)

	yes_button.pressed.connect(_on_purchase_confirmed)
	no_button.pressed.connect(_on_purchase_canceled)

	if bundle_purchase_button:
		bundle_purchase_button.pressed.connect(_on_bundle_purchase_pressed)

# --- Gem Display ---
func _update_gem_display() -> void:
	if gem_manager:
		gem_label.text = str(gem_manager.get_gem_balance())

func _on_currency_updated( _gems: int, _gold: int) -> void:
	_update_gem_display()
	_update_preview_buttons()
	_update_bundle_display()

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
	var display_name = skin_data.skin_name
	if skin_data.get("is_launch_exclusive"):
		display_name += " [LAUNCH]"
	button.text = display_name

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

	var display_name = skin_info.skin_name
	if skin_info.get("is_launch_exclusive"):
		display_name += " [LAUNCH]"
	preview_name_label.text = display_name
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
	purchase_confirmation_dialog.hide()

	if selected_skin_id.is_empty():
		return

	if await gem_manager.purchase_skin(selected_skin_id):
		_show_skin_preview(selected_skin_id)
		_load_slot(current_slot)
	else:
		push_error("Failed to purchase skin")

func _on_purchase_canceled() -> void:
	purchase_confirmation_dialog.hide()

func _on_skin_purchased(skin_id: String) -> void:
	_show_skin_preview(skin_id)

# --- Equip Flow ---
func _on_equip_button_pressed() -> void:
	if selected_skin_id.is_empty():
		return

	var result = await gem_manager.equip_skin(current_slot, selected_skin_id)
	if result:
		_show_skin_preview(selected_skin_id)
		_load_slot(current_slot)
	else:
		push_error("Failed to equip skin")

func _on_skin_equipped(skin_id: String, slot: String) -> void:
	if slot == current_slot:
		_show_skin_preview(skin_id)

# --- Bundle Section ---
func _load_bundles() -> void:
	if not bundle_container:
		return

	if gem_manager and gem_manager.has_method("get_bundle_catalog"):
		available_bundles = await gem_manager.get_bundle_catalog()
		_update_bundle_display()

func _update_bundle_display() -> void:
	if not bundle_container or available_bundles.is_empty():
		return

	var bundle = available_bundles[0]
	if not bundle:
		return

	var is_owned = gem_manager.is_bundle_owned(bundle.get("bundle_id", ""))
	if is_owned:
		bundle_container.visible = false
		return

	bundle_container.visible = true
	bundle_name_label.text = bundle.get("name", "Bundle")
	bundle_description_label.text = bundle.get("description", "")

	var price: int = bundle.get("price", 0)
	var original: int = bundle.get("original_total", 0)
	bundle_price_label.text = "%d gems" % price

	if original > price:
		var save_percent = int((1.0 - float(price) / float(original)) * 100)
		bundle_save_label.text = "SAVE %d%%" % save_percent
	else:
		bundle_save_label.text = ""

	bundle_purchase_button.disabled = gem_manager.get_gem_balance() < price
	bundle_purchase_button.text = "Purchase Bundle (%d gems)" % price

func _on_bundle_purchase_pressed() -> void:
	if available_bundles.is_empty():
		return

	var bundle = available_bundles[0]
	var bundle_id: String = bundle.get("bundle_id", "")
	var price: int = bundle.get("price", 0)

	confirmation_label.text = "Purchase %s for %d gems?\nIncludes %d cosmetic items." % [bundle.get("name", "Bundle"), price, bundle.get("item_ids", []).size()]
	purchase_confirmation_dialog.popup_centered()

	# Temporarily override the confirmation handler
	yes_button.pressed.disconnect(_on_purchase_confirmed)
	yes_button.pressed.connect(func(): _on_bundle_purchase_confirmed(bundle_id))

func _on_bundle_purchase_confirmed(bundle_id: String) -> void:
	purchase_confirmation_dialog.hide()

	# Restore the normal confirmation handler
	yes_button.pressed.disconnect(func(): _on_bundle_purchase_confirmed(bundle_id))
	yes_button.pressed.connect(_on_purchase_confirmed)

	if await gem_manager.purchase_bundle(bundle_id):
		_update_bundle_display()
		_load_slot(current_slot)
	else:
		push_error("Failed to purchase bundle")

func _on_bundle_purchased(bundle_id: String, _items: Array) -> void:
	_update_bundle_display()
	_load_slot(current_slot)

# --- Navigation ---
func _on_back_pressed() -> void:
	# Show the main menu again
	var main_menu = get_tree().root.get_node_or_null("MainMenu")
	if main_menu:
		main_menu.visible = true
	queue_free()


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if store_manager and store_manager.currency_updated.is_connected(_on_currency_updated):
		store_manager.currency_updated.disconnect(_on_currency_updated)

	if gem_manager:
		if gem_manager.skin_purchased.is_connected(_on_skin_purchased):
			gem_manager.skin_purchased.disconnect(_on_skin_purchased)
		if gem_manager.skin_equipped.is_connected(_on_skin_equipped):
			gem_manager.skin_equipped.disconnect(_on_skin_equipped)
		if gem_manager.bundle_purchased.is_connected(_on_bundle_purchased):
			gem_manager.bundle_purchased.disconnect(_on_bundle_purchased)
