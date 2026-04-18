## Manages in-game store and in-app purchases for currency (gems).
## Handles purchase flows, currency management, and server-side validation.
##
## Signals:
## - currency_updated(gems: int, gold: int): Emitted when currency balances change
## - purchase_succeeded(product_id: String, gems_awarded: int): Emitted when purchase completes
## - purchase_failed(product_id: String, error: String): Emitted when purchase fails
## - products_loaded(products: Dictionary): Emitted when product catalog is available
## - restore_completed(purchases: Array): Emitted when restore finishes
## - restore_failed(error: String): Emitted when restore fails
## - store_availability_changed(is_available: bool, message: String): Emitted when outage starts/ends
##
extends Node

# --- RPC IDs ---
const RPC_VALIDATE_PURCHASE = "armored_archer/validate_purchase"
const RPC_GET_CURRENCY = "armored_archer/get_currency"
const RPC_SPEND_GEMS = "armored_archer/spend_gems"
const RPC_RESTORE_PURCHASES = "armored_archer/restore_purchases"
const RPC_PROCESS_PENDING = "armored_archer/process_pending_purchases"

# --- Product Identifiers ---
const PRODUCT_SMALL_GEMS = "com.armoredarcher.gems.small"
const PRODUCT_MEDIUM_GEMS = "com.armoredarcher.gems.medium"
const PRODUCT_LARGE_GEMS = "com.armoredarcher.gems.large"

# --- Retry Configuration ---
const MAX_RETRY_ATTEMPTS: int = 3
const RETRY_DELAYS: Array[float] = [2.0, 5.0, 15.0]
const PENDING_PURCHASE_EXPIRY_SEC: float = 86400.0  # 24 hours

# --- Health Check Configuration ---
const HEALTH_CHECK_INTERVAL_SEC: float = 30.0
const OUTAGE_THRESHOLD: int = 2  # consecutive failures before declaring outage
const RECOVERY_CONFIRMATIONS: int = 1  # consecutive successes to declare recovery

# --- User-Facing Error Messages ---
const ERROR_MESSAGES: Dictionary = {
	"network": "The store is temporarily unavailable. Please check your connection and try again.",
	"provider": "The payment provider is experiencing issues. Your purchases are safe and will complete shortly.",
	"timeout": "The store is taking longer than expected. Please try again in a moment.",
	"validation": "We couldn't verify your purchase. It has been queued and will complete automatically.",
	"maintenance": "The store is temporarily down for maintenance. Please try again later.",
	"generic": "The store is temporarily unavailable. Please try again shortly.",
}

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
var is_restoring: bool = false

# --- Pending Purchase Queue ---
# Locally queued purchases that failed due to network issues
var _pending_purchases: Array[Dictionary] = []

# --- Signals ---
signal currency_updated(gems: int, gold: int)
signal purchase_succeeded(product_id: String, gems_awarded: int)
signal purchase_failed(product_id: String, error: String)
signal products_loaded(products: Dictionary)
signal restore_completed(purchases: Array)
signal restore_failed(error: String)
signal store_availability_changed(is_available: bool, message: String)

# --- Outage Detection State ---
var is_store_available: bool = true
var _consecutive_failures: int = 0
var _consecutive_successes: int = 0
var _health_check_timer: Timer = null
var _outage_category: String = ""
var _is_health_checking: bool = false

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- Platform Detection ---
var platform: String = ""

# --- Development/Test Mode ---
# Enable test mode to simulate purchases on desktop platforms
var test_mode: bool = false

# --- Sandbox Mode ---
# True when running against sandbox/test environment (Apple/Google sandbox)
var is_sandbox: bool = false

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
	_detect_platform()
	if platform in ["linux", "windows", "macos"]:
		test_mode = true
		print("[StoreManager] Test mode enabled for development on %s" % platform)
	_detect_sandbox()
	_load_pending_purchases()
	_start_health_check_timer()
	if network_manager:
		network_manager.connection_status_changed.connect(_on_connection_status_changed)

func _on_connection_status_changed(is_online: bool) -> void:
	if is_online:
		if _pending_purchases.size() > 0:
			_process_pending_purchases()
		if not is_store_available:
			_perform_health_check()
	else:
		_record_failure("network")

func _detect_sandbox() -> void:
	if platform == "ios":
		if Engine.has_singleton("RevenueCat"):
			var rc = Engine.get_singleton("RevenueCat")
			if rc.has_method("isSandbox"):
				is_sandbox = rc.isSandbox()
		if OS.has_environment("SIMULATOR_RUNTIME_VERSION"):
			is_sandbox = true
	elif platform == "android":
		if OS.has_environment("BUILD_TYPE"):
			is_sandbox = OS.get_environment("BUILD_TYPE") == "debug"
	elif test_mode:
		is_sandbox = true
	if is_sandbox:
		print("[StoreManager] Sandbox environment detected")

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

# --- Health Check & Outage Detection ---
func _start_health_check_timer() -> void:
	_health_check_timer = Timer.new()
	_health_check_timer.one_shot = false
	_health_check_timer.wait_time = HEALTH_CHECK_INTERVAL_SEC
	_health_check_timer.timeout.connect(_on_health_check_tick)
	add_child(_health_check_timer)
	_health_check_timer.start()

func _on_health_check_tick() -> void:
	if is_store_available:
		return
	_perform_health_check()

func _perform_health_check() -> void:
	if _is_health_checking:
		return
	_is_health_checking = true

	if not network_manager or not network_manager.is_connected:
		_record_failure("network")
		_is_health_checking = false
		return

	if test_mode:
		_record_success()
		_is_health_checking = false
		return

	var payload = JSON.stringify({})
	var response = await network_manager.send_rpc(RPC_GET_CURRENCY, payload)
	_is_health_checking = false

	if response == null or response.has("error"):
		var err_msg: String = response.get("error", "") if response else ""
		var category: String = _categorize_error(err_msg)
		_record_failure(category)
	else:
		_record_success()

func _record_failure(category: String) -> void:
	_consecutive_failures += 1
	_consecutive_successes = 0
	_outage_category = category

	if _consecutive_failures >= OUTAGE_THRESHOLD and is_store_available:
		is_store_available = false
		var msg: String = ERROR_MESSAGES.get(category, ERROR_MESSAGES["generic"])
		print("[StoreManager] Store outage detected: %s" % category)
		emit_signal("store_availability_changed", false, msg)

func _record_success() -> void:
	_consecutive_successes += 1
	_consecutive_failures = 0

	if not is_store_available and _consecutive_successes >= RECOVERY_CONFIRMATIONS:
		is_store_available = true
		_outage_category = ""
		print("[StoreManager] Store recovered")
		emit_signal("store_availability_changed", true, "")

func _categorize_error(error: String) -> String:
	var lower: String = error.to_lower()
	if "timeout" in lower or "timed out" in lower:
		return "timeout"
	if "network" in lower or "connection" in lower or "not connected" in lower:
		return "network"
	if "validation" in lower or "receipt" in lower:
		return "validation"
	if "maintenance" in lower or "503" in lower:
		return "maintenance"
	if "revenuecat" in lower or "provider" in lower or "plugin" in lower:
		return "provider"
	return "generic"

func get_user_facing_error(raw_error: String) -> String:
	var category: String = _categorize_error(raw_error)
	return ERROR_MESSAGES.get(category, ERROR_MESSAGES["generic"])

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

	var currency_data = response  # Response is already a Dictionary from send_rpc
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

func add_gems(amount: int, reason: String = "") -> void:
	"""Adds gems to player's balance (for rewards, achievements, etc).

	Parameters:
		amount: Number of gems to add
		reason: Reason for adding gems (for logging)
	"""
	if amount <= 0:
		push_error("Invalid gem amount to add")
		return

	current_gems += amount
	emit_signal("currency_updated", current_gems, current_gold)

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

	if not is_store_available:
		push_error("Store temporarily unavailable")
		var msg: String = ERROR_MESSAGES.get(_outage_category, ERROR_MESSAGES["generic"])
		emit_signal("purchase_failed", product_id, msg)
		return

	is_purchase_pending = true
	pending_product_id = product_id

	# Log purchase initiated for analytics
	var product_info: Dictionary = products.get(product_id, {})
	var analytics = get_node_or_null("/root/AnalyticsManager")
	if analytics and analytics.has_method("log_purchase_initiated"):
		analytics.log_purchase_initiated(product_id, product_info.get("display_name", ""), product_info.get("type", ""), product_info.get("price_cents", 0))

	if platform == "ios" or platform == "android":
		_initiate_revenuecat_purchase(product_id)
	elif test_mode:
		# Simulate purchase in test mode for desktop development
		_simulate_test_purchase(product_id)
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

func _simulate_test_purchase(product_id: String) -> void:
	"""Simulates a successful purchase for desktop development/testing.

	Parameters:
		product_id: Product identifier to simulate purchase for
	"""
	print("[StoreManager] TEST MODE: Simulating purchase of %s" % product_id)

	# Simulate network delay for realism
	await get_tree().create_timer(1.0).timeout

	var product_info: Dictionary = products.get(product_id, {})
	var gems_awarded: int = product_info.get("gem_amount", 0)

	if gems_awarded <= 0:
		push_error("Invalid product: %s" % product_id)
		is_purchase_pending = false
		emit_signal("purchase_failed", product_id, "Invalid product")
		return

	# Award gems directly in test mode
	current_gems += gems_awarded
	is_purchase_pending = false

	print("[StoreManager] TEST MODE: Purchase succeeded! Awarded %d gems" % gems_awarded)
	emit_signal("purchase_succeeded", product_id, gems_awarded)
	emit_signal("currency_updated", current_gems, current_gold)

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
		_add_to_pending_queue(product_id, transaction_receipt)
		is_purchase_pending = false
		_record_failure("network")
		emit_signal("purchase_failed", product_id, "Not connected - purchase queued for retry")
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
		_add_to_pending_queue(product_id, transaction_receipt)
		_record_failure("timeout")
		emit_signal("purchase_failed", product_id, "Network timeout - purchase queued for retry")
		return

	if response == null:
		push_error("Purchase validation failed - no response received for product: %s" % product_id)
		_add_to_pending_queue(product_id, transaction_receipt)
		_record_failure("network")
		emit_signal("purchase_failed", product_id, "Network error - purchase queued for retry")
		return

	if response.has("error"):
		push_error("Purchase validation failed: %s" % response.error)
		_record_failure(_categorize_error(response.error))
		emit_signal("purchase_failed", product_id, response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		var gems_awarded: int = result.get("gems_awarded", 0)
		current_gems = result.get("new_balance", current_gems)
		_record_success()
		emit_signal("currency_updated", current_gems, current_gold)
		emit_signal("purchase_succeeded", product_id, gems_awarded)

		# Track purchase completed in analytics for conversion
		var purchase_analytics = get_node_or_null("/root/AnalyticsManager")
		if purchase_analytics and purchase_analytics.has_method("log_purchase_completed"):
			var product_info: Dictionary = products.get(product_id, {})
			purchase_analytics.log_purchase_completed(
				product_id,
				product_info.get("display_name", ""),
				product_info.get("type", ""),
				product_info.get("price_cents", 0),
				"USD",
				result.get("transaction_id", "")
			)
		# Also log gem purchase specifically
		if purchase_analytics and purchase_analytics.has_method("log_gem_purchased"):
			var product_info: Dictionary = products.get(product_id, {})
			purchase_analytics.log_gem_purchased(
				product_info.get("gem_amount", 0),
				product_info.get("price_cents", 0),
				"USD",
				"iap",
				result.get("offer_id", "")
			)
	else:
		emit_signal("purchase_failed", product_id, "Validation failed")

		# Track purchase failed in analytics
		var fail_analytics = get_node_or_null("/root/AnalyticsManager")
		if fail_analytics and fail_analytics.has_method("log_purchase_failed"):
			var product_info: Dictionary = products.get(product_id, {})
			fail_analytics.log_purchase_failed(
				product_id,
				product_info.get("display_name", ""),
				"Validation failed"
			)

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

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		current_gems = result.get("new_balance", current_gems)
		emit_signal("currency_updated", current_gems, current_gold)

# --- Product Info ---
func get_products() -> Dictionary:
	return products

# --- Restore Purchases ---
func restore_purchases() -> void:
	if is_restoring:
		push_error("Restore already in progress")
		return

	is_restoring = true
	print("[StoreManager] Starting purchase restore...")

	if platform == "ios" or platform == "android":
		if Engine.has_singleton("RevenueCat"):
			var rc = Engine.get_singleton("RevenueCat")
			if rc.has_method("restorePurchases"):
				rc.restorePurchases(_on_revenuecat_restore_complete)
				return
		push_error("RevenueCat plugin not found for restore")
		is_restoring = false
		emit_signal("restore_failed", "RevenueCat plugin not installed")
	elif test_mode:
		await _simulate_test_restore()
	else:
		is_restoring = false
		emit_signal("restore_failed", "Purchases not supported on this platform")

func _on_revenuecat_restore_complete(result: Dictionary) -> void:
	is_restoring = false

	if not result.get("success", false):
		var error: String = result.get("error", "Unknown restore error")
		push_error("Restore failed: %s" % error)
		emit_signal("restore_failed", error)
		return

	var restored: Array = result.get("purchases", [])

	if restored.is_empty():
		print("[StoreManager] No purchases to restore")
		emit_signal("restore_completed", [])
		return

	var server_results: Array = []
	for purchase in restored:
		var product_id: String = purchase.get("productIdentifier", "")
		var receipt: String = purchase.get("transactionReceipt", "")
		if not product_id.is_empty() and not receipt.is_empty():
			server_results.append(await _validate_purchase_with_server(product_id, receipt))

	await load_currency()
	print("[StoreManager] Restore complete: %d purchases processed" % restored.size())
	emit_signal("restore_completed", restored)

func _simulate_test_restore() -> void:
	await get_tree().create_timer(1.0).timeout
	is_restoring = false
	print("[StoreManager] TEST MODE: Restore complete (no purchases to restore)")
	emit_signal("restore_completed", [])

# --- Pending Purchase Queue ---
func _add_to_pending_queue(product_id: String, transaction_receipt: String) -> void:
	var entry: Dictionary = {
		"product_id": product_id,
		"platform": platform,
		"transaction_receipt": transaction_receipt,
		"timestamp": Time.get_unix_time_from_system(),
		"retry_count": 0
	}
	_pending_purchases.append(entry)
	_save_pending_purchases()
	print("[StoreManager] Purchase queued for retry: %s" % product_id)

func _process_pending_purchases() -> void:
	if _pending_purchases.is_empty():
		return
	if not network_manager or not network_manager.is_connected:
		return

	var remaining: Array[Dictionary] = []
	var now: float = Time.get_unix_time_from_system()

	for entry in _pending_purchases:
		var age: float = now - entry.get("timestamp", 0.0)
		if age > PENDING_PURCHASE_EXPIRY_SEC:
			print("[StoreManager] Expiring pending purchase: %s" % entry.get("product_id", ""))
			continue

		var retry_count: int = entry.get("retry_count", 0)
		if retry_count >= MAX_RETRY_ATTEMPTS:
			print("[StoreManager] Max retries exceeded: %s" % entry.get("product_id", ""))
			continue

		entry["retry_count"] = retry_count + 1
		var product_id: String = entry.get("product_id", "")
		var receipt: String = entry.get("transaction_receipt", "")

		print("[StoreManager] Retrying pending purchase: %s (attempt %d)" % [product_id, retry_count + 1])

		var delay: float = RETRY_DELAYS[min(retry_count, RETRY_DELAYS.size() - 1)]
		await get_tree().create_timer(delay).timeout

		await _validate_purchase_with_server(product_id, receipt)

		if is_purchase_pending:
			remaining.append(entry)
		else:
			print("[StoreManager] Pending purchase resolved: %s" % product_id)

	_pending_purchases = remaining
	_save_pending_purchases()

func _save_pending_purchases() -> void:
	var save_data: Array = []
	for entry in _pending_purchases:
		if entry.get("retry_count", 0) < MAX_RETRY_ATTEMPTS:
			save_data.append(entry)
	var file = FileAccess.open("user://pending_purchases.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))
		file.close()

func _load_pending_purchases() -> void:
	if not FileAccess.file_exists("user://pending_purchases.json"):
		return
	var file = FileAccess.open("user://pending_purchases.json", FileAccess.READ)
	if not file:
		return
	var json_text: String = file.get_as_text()
	file.close()
	var json = JSON.new()
	var error = json.parse(json_text)
	if error != OK:
		return
	var data = json.data
	if data is Array:
		var now: float = Time.get_unix_time_from_system()
		for entry in data:
			if entry is Dictionary:
				var age: float = now - entry.get("timestamp", 0.0)
				if age < PENDING_PURCHASE_EXPIRY_SEC and entry.get("retry_count", 0) < MAX_RETRY_ATTEMPTS:
					_pending_purchases.append(entry)
		if not _pending_purchases.is_empty():
			print("[StoreManager] Loaded %d pending purchases" % _pending_purchases.size())

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
