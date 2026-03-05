extends Control

# --- UI References ---
@onready var gems_label: Label = $CenterContainer/VBoxContainer/HeaderContainer/GemsContainer/GemsLabel
@onready var gold_label: Label = $CenterContainer/VBoxContainer/HeaderContainer/GoldContainer/GoldLabel

@onready var small_gems_button: Button = $CenterContainer/VBoxContainer/PurchaseContainer/SmallGemContainer/BuyButton
@onready var medium_gems_button: Button = $CenterContainer/VBoxContainer/PurchaseContainer/MediumGemContainer/BuyButton
@onready var large_gems_button: Button = $CenterContainer/VBoxContainer/PurchaseContainer/LargeGemContainer/BuyButton

@onready var loading_indicator: Control = $LoadingIndicator
@onready var error_dialog: AcceptDialog = $ErrorDialog

# --- Manager References ---
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")
@onready var gem_manager: Node = get_node_or_null("/root/GemManager")

# --- Signal connections for cleanup ---
var _currency_updated_connection: Callable = Callable()
var _purchase_succeeded_connection: Callable = Callable()
var _purchase_failed_connection: Callable = Callable()

# --- State ---
var is_processing: bool = false

func _ready() -> void:
	_connect_signals()
	_update_currency_display()
	_update_product_buttons()

func _exit_tree() -> void:
	# Clean up connected signals to prevent memory leaks
	_cleanup_signal_connection(StoreManager, "currency_updated", _currency_updated_connection)
	_cleanup_signal_connection(StoreManager, "purchase_succeeded", _purchase_succeeded_connection)
	_cleanup_signal_connection(StoreManager, "purchase_failed", _purchase_failed_connection)

func _cleanup_signal_connection(node: Node, signal_name: String, connection: Callable) -> void:
	if node and connection.is_valid() and node.is_connected(signal_name, connection):
		node.disconnect(signal_name, connection)

func _connect_signals() -> void:
	if store_manager:
		_currency_updated_connection = store_manager.currency_updated.connect(_on_currency_updated)
		_purchase_succeeded_connection = store_manager.purchase_succeeded.connect(_on_purchase_succeeded)
		_purchase_failed_connection = store_manager.purchase_failed.connect(_on_purchase_failed)
	
	small_gems_button.pressed.connect(_on_small_gems_pressed)
	medium_gems_button.pressed.connect(_on_medium_gems_pressed)
	large_gems_button.pressed.connect(_on_large_gems_pressed)

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
