extends Control

# --- UI References ---
@onready var gems_label: Label = $SafeAreaContainer/CenterContainer/VBoxContainer/HeaderContainer/GemsContainer/GemsLabel
@onready var gold_label: Label = $SafeAreaContainer/CenterContainer/VBoxContainer/HeaderContainer/GoldContainer/GoldLabel
@onready var purchase_container: Control = $SafeAreaContainer/CenterContainer/VBoxContainer/PurchaseContainer

@onready var small_gems_button: ArcheryBaseButton = $SafeAreaContainer/CenterContainer/VBoxContainer/PurchaseContainer/SmallGemContainer/BuyButton
@onready var medium_gems_button: ArcheryBaseButton = $SafeAreaContainer/CenterContainer/VBoxContainer/PurchaseContainer/MediumGemContainer/BuyButton
@onready var large_gems_button: ArcheryBaseButton = $SafeAreaContainer/CenterContainer/VBoxContainer/PurchaseContainer/LargeGemContainer/BuyButton
@onready var restore_button: ArcheryBaseButton = $SafeAreaContainer/CenterContainer/VBoxContainer/RestoreButton
@onready var back_button: ArcheryBaseButton = $SafeAreaContainer/CenterContainer/VBoxContainer/BackButton

@onready var loading_indicator: Control = $LoadingIndicator
@onready var error_dialog: AcceptDialog = $ErrorDialog

# --- Manager References ---
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Signal connections for cleanup ---
var _currency_updated_connection: Callable = Callable()
var _purchase_succeeded_connection: Callable = Callable()
var _purchase_failed_connection: Callable = Callable()
var _restore_completed_connection: Callable = Callable()
var _restore_failed_connection: Callable = Callable()

# --- State ---
var is_processing: bool = false

func _ready() -> void:
	theme_manager = get_node_or_null("/root/ThemeManager")

	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	_connect_signals()
	_update_currency_display()
	_update_product_buttons()
	_apply_design_tokens()

func _exit_tree() -> void:
	_cleanup_signal_connection(StoreManager, "currency_updated", _currency_updated_connection)
	_cleanup_signal_connection(StoreManager, "purchase_succeeded", _purchase_succeeded_connection)
	_cleanup_signal_connection(StoreManager, "purchase_failed", _purchase_failed_connection)
	_cleanup_signal_connection(StoreManager, "restore_completed", _restore_completed_connection)
	_cleanup_signal_connection(StoreManager, "restore_failed", _restore_failed_connection)

	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

func _cleanup_signal_connection(node: Node, signal_name: String, connection: Callable) -> void:
	if node and connection.is_valid() and node.is_connected(signal_name, connection):
		node.disconnect(signal_name, connection)

func _connect_signals() -> void:
	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)
		store_manager.purchase_succeeded.connect(_on_purchase_succeeded)
		store_manager.purchase_failed.connect(_on_purchase_failed)
		store_manager.restore_completed.connect(_on_restore_completed)
		store_manager.restore_failed.connect(_on_restore_failed)
		_currency_updated_connection = _on_currency_updated
		_purchase_succeeded_connection = _on_purchase_succeeded
		_purchase_failed_connection = _on_purchase_failed
		_restore_completed_connection = _on_restore_completed
		_restore_failed_connection = _on_restore_failed

	small_gems_button.pressed.connect(_on_small_gems_pressed)
	medium_gems_button.pressed.connect(_on_medium_gems_pressed)
	large_gems_button.pressed.connect(_on_large_gems_pressed)
	restore_button.pressed.connect(_on_restore_pressed)
	back_button.pressed.connect(_on_back_pressed)

func _update_currency_display() -> void:
	if store_manager:
		gems_label.text = str(store_manager.get_gems())
		gold_label.text = str(store_manager.get_gold())
	elif gem_manager:
		gems_label.text = str(gem_manager.get_gem_balance())

func _update_product_buttons() -> void:
	if not store_manager:
		return

	var products = store_manager.get_products()

	if products.has(store_manager.PRODUCT_SMALL_GEMS):
		var product = products[store_manager.PRODUCT_SMALL_GEMS]
		small_gems_button.text = "%s\n$0.99" % product.localized_title

	if products.has(store_manager.PRODUCT_MEDIUM_GEMS):
		var product = products[store_manager.PRODUCT_MEDIUM_GEMS]
		medium_gems_button.text = "%s\n$4.99" % product.localized_title

	if products.has(store_manager.PRODUCT_LARGE_GEMS):
		var product = products[store_manager.PRODUCT_LARGE_GEMS]
		large_gems_button.text = "%s\n$9.99" % product.localized_title

# --- Purchase Handlers ---
func _on_small_gems_pressed() -> void:
	_initiate_purchase(store_manager.PRODUCT_SMALL_GEMS)

func _on_medium_gems_pressed() -> void:
	_initiate_purchase(store_manager.PRODUCT_MEDIUM_GEMS)

func _on_large_gems_pressed() -> void:
	_initiate_purchase(store_manager.PRODUCT_LARGE_GEMS)

func _initiate_purchase(product_id: String) -> void:
	if is_processing:
		return

	if not store_manager:
		push_error("StoreManager not available")
		return

	is_processing = true
	_set_buttons_enabled(false)
	loading_indicator.visible = true

	store_manager.purchase_product(product_id)

# --- Restore Handlers ---
func _on_restore_pressed() -> void:
	if is_processing:
		return

	if not store_manager:
		push_error("StoreManager not available")
		return

	is_processing = true
	_set_buttons_enabled(false)
	restore_button.disabled = true
	loading_indicator.visible = true

	store_manager.restore_purchases()

func _on_restore_completed(purchases: Array) -> void:
	is_processing = false
	loading_indicator.visible = false
	_set_buttons_enabled(true)
	restore_button.disabled = false

	if purchases.is_empty():
		error_dialog.dialog_text = "No purchases found to restore."
		error_dialog.popup_centered()
	else:
		print("Restore completed: %d purchases restored" % purchases.size())

func _on_restore_failed(error: String) -> void:
	is_processing = false
	loading_indicator.visible = false
	_set_buttons_enabled(true)
	restore_button.disabled = false

	error_dialog.dialog_text = "Restore failed: %s" % error
	error_dialog.popup_centered()

# --- Callbacks ---
func _on_currency_updated(gems: int, gold: int) -> void:
	_update_currency_display()

	if gem_manager:
		var current_balance = gem_manager.get_gem_balance()
		if gems != current_balance:
			var diff = gems - current_balance
			if diff > 0:
				gem_manager.add_gems(diff)
			elif diff < 0:
				gem_manager.remove_gems(-diff)

func _on_purchase_succeeded(product_id: String, gems_awarded: int) -> void:
	is_processing = false
	loading_indicator.visible = false
	_set_buttons_enabled(true)

	print("Purchase succeeded! Product: %s, Gems awarded: %d" % [product_id, gems_awarded])

func _on_purchase_failed(product_id: String, error: String) -> void:
	is_processing = false
	loading_indicator.visible = false
	_set_buttons_enabled(true)

	error_dialog.dialog_text = "Purchase failed: %s" % error
	error_dialog.popup_centered()

func _set_buttons_enabled(enabled: bool) -> void:
	small_gems_button.disabled = not enabled
	medium_gems_button.disabled = not enabled
	large_gems_button.disabled = not enabled

func _on_back_pressed() -> void:
	var result = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	theme_manager.apply_background(self)

	if purchase_container:
		purchase_container.modulate = colors["surface"]

func _apply_design_tokens() -> void:
	if gold_label and ArcherDesignTokens:
		gold_label.modulate = ArcherDesignTokens.COLOR_GOLD

	if gems_label and ArcherDesignTokens:
		gems_label.modulate = ArcherDesignTokens.COLOR_GEMS

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
	_apply_design_tokens()
