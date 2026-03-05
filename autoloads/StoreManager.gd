## Manages in-game store and in-app purchases for currency (gems).
## Handles purchase flows, currency management, and server-side validation.
##
## Signals:
## - currency_updated(gems: int, gold: int): Emitted when currency balances change
## - purchase_succeeded(product_id: String, gems_awarded: int): Emitted when purchase completes
## - purchase_failed(product_id: String, error: String): Emitted when purchase fails
## - products_loaded(products: Dictionary): Emitted when product catalog is available
##
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

# --- PII Masking for Logs ---
func _mask_sensitive_data(data: String, max_length: int = 20) -> String:
	"""Masks sensitive data for logging purposes.
	
	Parameters:
		data: The sensitive string to mask
		max_length: Maximum visible length before masking
	
	Returns:
		String: Masked string showing first few characters
	"""
	if data.is_empty():
		return "(empty)"
	
	if data.length() <= max_length:
		return data.substr(0, 4) + "***"
	
	return data.substr(0, max_length) + "***"

func _ready() -> void:
	"""Detects platform and sets up signal connections."""
	_detect_platform()
	if network_manager:
		network_manager.connection_status_changed.connect(_on_connection_status_changed)

func _on_connection_status_changed(is_online: bool) -> void:
	if is_online:
		await load_currency()

func _detect_platform() -> void:
	"""Determines the current runtime platform."""
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
	"""Loads currency when network connection is established."""
	await load_currency()

# --- Currency Management ---
func load_currency() -> void:
	"""Retrieves currency balances from the server."""
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
	"""Returns current gem balance.
	
	Returns:
		int: Number of gems owned
	"""
	return current_gems

func get_gold() -> int:
	"""Returns current gold balance.
	
	Returns:
		int: Number of gold owned
	"""
	return current_gold

# --- Purchase Flow ---
func purchase_product(product_id: String) -> void:
	"""Initiates a purchase for the specified product.
	
	Parameters:
		product_id: Product identifier to purchase
	"""
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
	
	# Log purchase initiated for analytics
	var product_info: Dictionary = products.get(product_id, {})
	if has_node("/root/AnalyticsManager"):
		var analytics: Node = get_node("/root/AnalyticsManager")
		if analytics.has_method("log_purchase_initiated"):
			analytics.log_purchase_initiated(product_id, product_info.get("display_name", ""), product_info.get("type", ""), product_info.get("price_cents", 0))
	
	if platform == "ios" or platform == "android":
		_initiate_revenuecat_purchase(product_id)
	else:
		# Purchases are only supported on mobile platforms (iOS/Android)
		push_error("Purchases not supported on platform: %s" % platform)
		emit_signal("purchase_failed", product_id, "Purchases not supported on this platform")
		is_purchase_pending = false

func _initiate_revenuecat_purchase(product_id: String) -> void:
	"""Starts RevenueCat purchase flow on mobile platforms."""
	if Engine.has_singleton("RevenueCat"):
		var revenuecat = Engine.get_singleton("RevenueCat")
		revenuecat.purchaseProduct(product_id, _on_revenuecat_purchase_complete)
	else:
		push_error("RevenueCat plugin not found. Install RevenueCat plugin for %s" % platform)
		emit_signal("purchase_failed", product_id, "RevenueCat plugin not installed")

func _on_revenuecat_purchase_complete(result: Dictionary) -> void:
	"""Handles RevenueCat purchase completion callback."""
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

func _validate_purchase_with_server(product_id: String, transaction_receipt: String) -> void:
	"""Validates purchase with server and updates currency.
	
	Parameters:
		product_id: Purchased product ID
		transaction_receipt: Platform-specific purchase receipt
	"""
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
	
	# Log with masked receipt for security
	push_error("Validating purchase: product=%s, platform=%s, receipt=%s" % [
		product_id, platform, _mask_sensitive_data(transaction_receipt)
	])
	
	var response = null
	var has_timed_out = false
	
	# Set up timeout for network request
	var timeout_timer = get_tree().create_timer(30.0)
	timeout_timer.timeout.connect(func(): has_timed_out = true)
	
	# Attempt to get response
	response = await network_manager.send_rpc(RPC_VALIDATE_PURCHASE, payload)
	
	# Clean up timer
	if is_instance_valid(timeout_timer):
		timeout_timer.disconnect("timeout", func(): has_timed_out = true)
		timeout_timer.free()
	
	is_purchase_pending = false
	
	# Handle network failure scenarios
	if has_timed_out:
		push_error("Purchase validation timed out for product: %s" % product_id)
		emit_signal("purchase_failed", product_id, "Network timeout - please try again")
		return
	
	if response == null:
		push_error("Purchase validation failed - no response received for product: %s" % product_id)
		emit_signal("purchase_failed", product_id, "Network error - please try again")
		return
	
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
	"""Deducts gems from balance with server validation.
	
	Parameters:
		amount: Amount of gems to spend (must be positive)
		reason: Optional reason for the spend (for logging)
	"""
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
	"""Returns the product catalog.
	
	Returns:
		Dictionary: Product definitions keyed by product ID
	"""
	return products

func get_product_info(product_id: String) -> Dictionary:
	"""Retrieves information for a specific product.
	
	Parameters:
		product_id: Product identifier
	
	Returns:
		Dictionary: Product data or empty dict if not found
	"""
	return products.get(product_id, {})

func get_product_display_name(product_id: String) -> String:
	"""Gets the display name for a product.
	
	Parameters:
		product_id: Product identifier
	
	Returns:
		String: Localized title or empty string if not found
	"""
	var product = products.get(product_id, {})
	return product.get("localized_title", "")

func get_product_description(product_id: String) -> String:
	"""Gets the description for a product.
	
	Parameters:
		product_id: Product identifier
	
	Returns:
		String: Localized description or empty string if not found
	"""
	var product = products.get(product_id, {})
	return product.get("localized_description", "")

func get_product_gem_amount(product_id: String) -> int:
	"""Gets the gem amount for a product.
	
	Parameters:
		product_id: Product identifier
	
	Returns:
		int: Number of gems included or 0 if not found
	"""
	var product = products.get(product_id, {})
	return product.get("gem_amount", 0)

# --- Utility ---
func format_gems(amount: int) -> String:
	"""Formats gem amount for display.
	
	Parameters:
		amount: Numeric gem amount
	
	Returns:
		String: Formatted string (currently just converts to string)
	"""
	return str(amount)

func format_gold(amount: int) -> String:
	"""Formats gold amount for display.
	
	Parameters:
		amount: Numeric gold amount
	
	Returns:
		String: Formatted string (currently just converts to string)
	"""
	return str(amount)
