extends Node

# --- RPC IDs ---
const RPC_VALIDATE_PURCHASE = "armored_archer/validate_purchase"
const RPC_GET_CURRENCY = "armored_archer/get_currency"
const RPC_SPEND_GEMS = "armored_archer/spend_gems"

# --- Product Identifiers ---
const PRODUCT_SMALL_GEMS = "com.armoredarcher.gems.small"
const PRODUCT_MEDIUM_GEMS = "com.armoredarcher.gems.medium"
const PRODUCT_LARGE_GEMS = "com.armoredarcher.gems.large"

# --- Product Definitions ---
var products: Dictionary = {
	PRODUCT_SMALL_GEMS: {
		"product_id": PRODUCT_SMALL_GEMS,
		"gem_amount": 100,
		"localized_title": "Small Gem Pack",
		"localized_description": "100 Gems"
	},
	PRODUCT_MEDIUM_GEMS: {
		"product_id": PRODUCT_MEDIUM_GEMS,
		"gem_amount": 550,
		"localized_title": "Medium Gem Pack",
		"localized_description": "550 Gems"
	},
	PRODUCT_LARGE_GEMS: {
		"product_id": PRODUCT_LARGE_GEMS,
		"gem_amount": 1200,
		"localized_title": "Large Gem Pack",
		"localized_description": "1200 Gems"
	}
}

# --- Player Currency ---
var current_gems: int = 0
var current_gold: int = 0
var is_initialized: bool = false

# --- IAP State ---
var is_purchase_pending: bool = false
var pending_product_id: String = ""

# --- Signals ---
signal currency_updated(gems: int, gold: int)
signal purchase_succeeded(product_id: String, gems_awarded: int)
signal purchase_failed(product_id: String, error: String)
signal products_loaded(products: Dictionary)

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- Platform Detection ---
var platform: String = ""

func _ready() -> void:
	_detect_platform()
	if network_manager:
		network_manager.connected.connect(_on_connected)

func _detect_platform() -> void:
	if OS.has_feature("ios"):
		platform = "ios"
	elif OS.has_feature("android"):
		platform = "android"
	elif OS.has_feature("windows"):
		platform = "windows"
	elif OS.has_feature("macos"):
		platform = "macos"
	elif OS.has_feature("linux"):
		platform = "linux"
	else:
		platform = "unknown"

func _on_connected() -> void:
	await load_currency()

# --- Currency Management ---
func load_currency() -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var payload = JSON.stringify({})
	var response = await network_manager.send_rpc(RPC_GET_CURRENCY, payload)
	
	if response.has("error"):
		push_error("Failed to load currency: %s" % response.error)
		return
	
	var currency_data = JSON.parse_string(response)
	current_gems = currency_data.get("gems", 0)
	current_gold = currency_data.get("gold", 0)
	is_initialized = true
	
	emit_signal("currency_updated", current_gems, current_gold)

func get_gems() -> int:
	return current_gems

func get_gold() -> int:
	return current_gold

# --- Purchase Flow ---
func purchase_product(product_id: String) -> void:
	if not products.has(product_id):
		push_error("Invalid product ID: %s" % product_id)
		emit_signal("purchase_failed", product_id, "Invalid product ID")
		return
	
	if is_purchase_pending:
		push_error("Purchase already in progress")
		emit_signal("purchase_failed", product_id, "Purchase already in progress")
		return
	
	is_purchase_pending = true
	pending_product_id = product_id
	
	if platform == "ios" or platform == "android":
		_initiate_revenuecat_purchase(product_id)
	else:
		_simulate_purchase_for_testing(product_id)

func _initiate_revenuecat_purchase(product_id: String) -> void:
	if Engine.has_singleton("RevenueCat"):
		var revenuecat = Engine.get_singleton("RevenueCat")
		revenuecat.purchaseProduct(product_id, _on_revenuecat_purchase_complete)
	else:
		push_error("RevenueCat plugin not found. Install RevenueCat plugin for %s" % platform)
		emit_signal("purchase_failed", product_id, "RevenueCat plugin not installed")

func _on_revenuecat_purchase_complete(result: Dictionary) -> void:
	var product_id: String = result.get("productIdentifier", "")
	var success: bool = result.get("success", false)
	var error: String = result.get("error", "")
	var transaction_receipt: String = result.get("transactionReceipt", "")
	
	if not success:
		push_error("RevenueCat purchase failed: %s" % error)
		is_purchase_pending = false
		emit_signal("purchase_failed", product_id, error)
		return
	
	if transaction_receipt.is_empty():
		push_error("No transaction receipt from RevenueCat")
		is_purchase_pending = false
		emit_signal("purchase_failed", product_id, "No transaction receipt")
		return
	
	await _validate_purchase_with_server(product_id, transaction_receipt)

func _simulate_purchase_for_testing(product_id: String) -> void:
	print("Simulating purchase for testing purposes: %s" % product_id)
	
	await get_tree().create_timer(1.0).timeout
	
	var mock_receipt: String = "mock_receipt_" + str(Time.get_unix_time_from_system())
	await _validate_purchase_with_server(product_id, mock_receipt)

func _validate_purchase_with_server(product_id: String, transaction_receipt: String) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		is_purchase_pending = false
		emit_signal("purchase_failed", product_id, "Not connected to server")
		return
	
	var payload = JSON.stringify({
		"product_id": product_id,
		"platform": platform,
		"transaction_receipt": transaction_receipt
	})
	
	var response = await network_manager.send_rpc(RPC_VALIDATE_PURCHASE, payload)
	
	is_purchase_pending = false
	
	if response.has("error"):
		push_error("Purchase validation failed: %s" % response.error)
		emit_signal("purchase_failed", product_id, response.error)
		return
	
	var result = JSON.parse_string(response)
	
	if result.get("success", false):
		var gems_awarded: int = result.get("gems_awarded", 0)
		current_gems = result.get("new_balance", current_gems)
		emit_signal("currency_updated", current_gems, current_gold)
		emit_signal("purchase_succeeded", product_id, gems_awarded)
	else:
		emit_signal("purchase_failed", product_id, "Validation failed")

# --- Spend Gems ---
func spend_gems(amount: int, reason: String = "") -> void:
	if amount <= 0:
		push_error("Invalid gem amount")
		return
	
	if current_gems < amount:
		push_error("Insufficient gems")
		return
	
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var payload = JSON.stringify({
		"amount": amount,
		"reason": reason
	})
	
	var response = await network_manager.send_rpc(RPC_SPEND_GEMS, payload)
	
	if response.has("error"):
		push_error("Failed to spend gems: %s" % response.error)
		return
	
	var result = JSON.parse_string(response)
	
	if result.get("success", false):
		current_gems = result.get("new_balance", current_gems)
		emit_signal("currency_updated", current_gems, current_gold)

# --- Product Info ---
func get_products() -> Dictionary:
	return products

func get_product_info(product_id: String) -> Dictionary:
	return products.get(product_id, {})

func get_product_display_name(product_id: String) -> String:
	var product = products.get(product_id, {})
	return product.get("localized_title", "")

func get_product_description(product_id: String) -> String:
	var product = products.get(product_id, {})
	return product.get("localized_description", "")

func get_product_gem_amount(product_id: String) -> int:
	var product = products.get(product_id, {})
	return product.get("gem_amount", 0)

# --- Utility ---
func format_gems(amount: int) -> String:
	return str(amount)

func format_gold(amount: int) -> String:
	return str(amount)
