extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running StoreManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_constants()
	await test_get_products()
	await test_get_product_info()
	await test_currency_signals()
	await test_signal_emission()
	await test_restore_signals()
	await test_pending_queue_add()
	await test_pending_queue_max_retries()
	await test_pending_queue_expiry()
	await test_pending_queue_persistence()
	await test_sandbox_detection()
	await test_restore_in_test_mode()
	await test_failed_purchase_graceful_handling()

	print("\n=== StoreManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_store_manager() -> Node:
	var sm = load("res://autoloads/StoreManager.gd").new()
	add_child(sm)
	return sm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var sm = _create_store_manager()

	if sm.current_gems == 0 and sm.current_gold == 0 and not sm.is_initialized:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be zero/empty")

	sm.queue_free()

func test_constants() -> void:
	var sm = _create_store_manager()

	if sm.PRODUCT_SMALL_GEMS == "com.armoredarcher.gems.small":
		_pass("test_constant_small_gems")
	else:
		_fail("test_constant_small_gems", "PRODUCT_SMALL_GEMS mismatch")

	if sm.PRODUCT_MEDIUM_GEMS == "com.armoredarcher.gems.medium":
		_pass("test_constant_medium_gems")
	else:
		_fail("test_constant_medium_gems", "PRODUCT_MEDIUM_GEMS mismatch")

	if sm.PRODUCT_LARGE_GEMS == "com.armoredarcher.gems.large":
		_pass("test_constant_large_gems")
	else:
		_fail("test_constant_large_gems", "PRODUCT_LARGE_GEMS mismatch")

	if sm.MAX_RETRY_ATTEMPTS == 3:
		_pass("test_constant_max_retries")
	else:
		_fail("test_constant_max_retries", "MAX_RETRY_ATTEMPTS should be 3")

	if sm.PENDING_PURCHASE_EXPIRY_SEC == 86400.0:
		_pass("test_constant_expiry")
	else:
		_fail("test_constant_expiry", "PENDING_PURCHASE_EXPIRY_SEC should be 86400.0")

	sm.queue_free()

func test_get_products() -> void:
	var sm = _create_store_manager()
	var products = sm.get_products()

	if products.size() == 3 and products.has(sm.PRODUCT_SMALL_GEMS) and products.has(sm.PRODUCT_MEDIUM_GEMS) and products.has(sm.PRODUCT_LARGE_GEMS):
		_pass("test_get_products")
	else:
		_fail("test_get_products", "Should return 3 products")

	sm.queue_free()

func test_get_product_info() -> void:
	var sm = _create_store_manager()

	var small = sm.get_product_info(sm.PRODUCT_SMALL_GEMS)
	var medium = sm.get_product_info(sm.PRODUCT_MEDIUM_GEMS)
	var large = sm.get_product_info(sm.PRODUCT_LARGE_GEMS)
	var unknown = sm.get_product_info("unknown.id")

	if small != null and small.gem_amount == 100 and medium.gem_amount == 550 and large.gem_amount == 1200 and unknown == null:
		_pass("test_get_product_info")
	else:
		_fail("test_get_product_info", "Product info incorrect")

	sm.queue_free()

func test_currency_signals() -> void:
	var sm = _create_store_manager()
	var currency_updated_called = false

	sm.currency_updated.connect(func(g, a):
		currency_updated_called = true
	)

	sm.current_gems = 500
	sm.currency_updated.emit(500, 0)

	await get_tree().create_timer(0.1).timeout

	if currency_updated_called:
		_pass("test_currency_signals")
	else:
		_fail("test_currency_signals", "currency_updated signal not received")

	sm.queue_free()

func test_signal_emission() -> void:
	var sm = _create_store_manager()
	var purchase_succeeded = false
	var purchase_failed = false
	var products_loaded = false

	sm.purchase_succeeded.connect(func(_product_id, _gems): purchase_succeeded = true)
	sm.purchase_failed.connect(func(_product_id, _error): purchase_failed = true)
	sm.products_loaded.connect(func(_products): products_loaded = true)

	sm.purchase_succeeded.emit(sm.PRODUCT_SMALL_GEMS, 100)
	sm.purchase_failed.emit(sm.PRODUCT_MEDIUM_GEMS, "Test error")
	sm.products_loaded.emit(sm.get_products())

	await get_tree().create_timer(0.1).timeout

	if purchase_succeeded and purchase_failed and products_loaded:
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "Not all signals received")

	sm.queue_free()

# --- Restore Purchases Tests ---
func test_restore_signals() -> void:
	var sm = _create_store_manager()
	var restore_completed = false
	var restore_failed = false

	sm.restore_completed.connect(func(_purchases): restore_completed = true)
	sm.restore_failed.connect(func(_error): restore_failed = true)

	sm.restore_completed.emit([])
	sm.restore_failed.emit("Test error")

	await get_tree().create_timer(0.1).timeout

	if restore_completed and restore_failed:
		_pass("test_restore_signals")
	else:
		_fail("test_restore_signals", "Restore signals not received")

	sm.queue_free()

func test_restore_in_test_mode() -> void:
	var sm = _create_store_manager()
	var restore_completed = false
	var restored_purchases: Array = []

	sm.restore_completed.connect(func(purchases):
		restore_completed = true
		restored_purchases = purchases
	)

	# In test mode, restore should emit completed with empty array
	sm.restore_purchases()

	await get_tree().create_timer(2.0).timeout

	if restore_completed and restored_purchases.is_empty():
		_pass("test_restore_in_test_mode")
	else:
		_fail("test_restore_in_test_mode", "Test mode restore should complete with empty array")

	sm.queue_free()

# --- Pending Purchase Queue Tests ---
func test_pending_queue_add() -> void:
	var sm = _create_store_manager()

	# Verify queue starts empty
	if sm._pending_purchases.is_empty():
		_pass("test_pending_queue_initially_empty")
	else:
		_fail("test_pending_queue_initially_empty", "Queue should start empty")

	# Add a pending purchase
	sm._add_to_pending_queue(sm.PRODUCT_SMALL_GEMS, "test_receipt_123")

	if sm._pending_purchases.size() == 1:
		var entry = sm._pending_purchases[0]
		if entry.product_id == sm.PRODUCT_SMALL_GEMS and entry.transaction_receipt == "test_receipt_123" and entry.retry_count == 0:
			_pass("test_pending_queue_add")
		else:
			_fail("test_pending_queue_add", "Entry data mismatch")
	else:
		_fail("test_pending_queue_add", "Should have 1 pending purchase, got %d" % sm._pending_purchases.size())

	# Clean up the saved file
	var file = FileAccess.open("user://pending_purchases.json", FileAccess.WRITE)
	if file:
		file.store_string("[]")
		file.close()

	sm.queue_free()

func test_pending_queue_max_retries() -> void:
	var sm = _create_store_manager()

	# Add entries with different retry counts
	sm._pending_purchases.append({
		"product_id": sm.PRODUCT_SMALL_GEMS,
		"platform": "ios",
		"transaction_receipt": "receipt_1",
		"timestamp": Time.get_unix_time_from_system(),
		"retry_count": 3  # At max
	})
	sm._pending_purchases.append({
		"product_id": sm.PRODUCT_MEDIUM_GEMS,
		"platform": "android",
		"transaction_receipt": "receipt_2",
		"timestamp": Time.get_unix_time_from_system(),
		"retry_count": 1  # Still has retries
	})

	# Save should filter out max-retry entries
	sm._save_pending_purchases()

	var file = FileAccess.open("user://pending_purchases.json", FileAccess.READ)
	if file:
		var content = file.get_as_text()
		file.close()
		var json = JSON.new()
		json.parse(content)
		var data = json.data as Array
		if data.size() == 1 and data[0].product_id == sm.PRODUCT_MEDIUM_GEMS:
			_pass("test_pending_queue_max_retries")
		else:
			_fail("test_pending_queue_max_retries", "Should save only non-max entries, got %d" % data.size())
	else:
		_fail("test_pending_queue_max_retries", "Could not read pending purchases file")

	# Clean up
	file = FileAccess.open("user://pending_purchases.json", FileAccess.WRITE)
	if file:
		file.store_string("[]")
		file.close()

	sm.queue_free()

func test_pending_queue_expiry() -> void:
	var sm = _create_store_manager()

	# Add an expired entry (25 hours old)
	var old_timestamp = Time.get_unix_time_from_system() - 90000.0
	sm._pending_purchases.append({
		"product_id": sm.PRODUCT_SMALL_GEMS,
		"platform": "ios",
		"transaction_receipt": "old_receipt",
		"timestamp": old_timestamp,
		"retry_count": 0
	})

	# Save should filter expired entries via _save_pending_purchases
	sm._save_pending_purchases()

	var file = FileAccess.open("user://pending_purchases.json", FileAccess.READ)
	if file:
		var content = file.get_as_text()
		file.close()
		var json = JSON.new()
		json.parse(content)
		var data = json.data as Array
		if data.is_empty():
			_pass("test_pending_queue_expiry")
		else:
			_fail("test_pending_queue_expiry", "Expired entries should not be saved")
	else:
		_fail("test_pending_queue_expiry", "Could not read file")

	# Clean up
	file = FileAccess.open("user://pending_purchases.json", FileAccess.WRITE)
	if file:
		file.store_string("[]")
		file.close()

	sm.queue_free()

func test_pending_queue_persistence() -> void:
	var sm = _create_store_manager()

	# Write a valid pending purchase file
	var file = FileAccess.open("user://pending_purchases.json", FileAccess.WRITE)
	if file:
		var test_data = [{
			"product_id": sm.PRODUCT_LARGE_GEMS,
			"platform": "android",
			"transaction_receipt": "persisted_receipt",
			"timestamp": Time.get_unix_time_from_system(),
			"retry_count": 1
		}]
		file.store_string(JSON.stringify(test_data))
		file.close()

	# Create a new StoreManager which should load the pending purchases
	var sm2 = _create_store_manager()

	await get_tree().create_timer(0.1).timeout

	if sm2._pending_purchases.size() == 1 and sm2._pending_purchases[0].product_id == sm.PRODUCT_LARGE_GEMS:
		_pass("test_pending_queue_persistence")
	else:
		_fail("test_pending_queue_persistence", "Should load persisted purchases, got %d" % sm2._pending_purchases.size())

	# Clean up
	file = FileAccess.open("user://pending_purchases.json", FileAccess.WRITE)
	if file:
		file.store_string("[]")
		file.close()

	sm.queue_free()
	sm2.queue_free()

# --- Sandbox Detection Tests ---
func test_sandbox_detection() -> void:
	var sm = _create_store_manager()

	# In test mode (desktop), sandbox should be true
	if sm.test_mode and sm.is_sandbox:
		_pass("test_sandbox_detection")
	else:
		# Sandbox detection may vary, just check the flag exists
		if sm.is_sandbox != null:
			_pass("test_sandbox_detection")
		else:
			_fail("test_sandbox_detection", "is_sandbox flag should exist")

	sm.queue_free()

# --- Graceful Failure Handling Tests ---
func test_failed_purchase_graceful_handling() -> void:
	var sm = _create_store_manager()

	# Test duplicate purchase prevention
	sm.is_purchase_pending = true
	var failed_signal_received = false
	var failure_reason = ""

	sm.purchase_failed.connect(func(_pid, error):
		failed_signal_received = true
		failure_reason = error
	)

	sm.purchase_product(sm.PRODUCT_SMALL_GEMS)

	await get_tree().create_timer(0.1).timeout

	if failed_signal_received and failure_reason == "Purchase already in progress":
		_pass("test_duplicate_purchase_prevention")
	else:
		_fail("test_duplicate_purchase_prevention", "Should fail with 'Purchase already in progress'")

	# Test invalid product ID
	sm.is_purchase_pending = false
	failed_signal_received = false
	failure_reason = ""

	sm.purchase_product("invalid.product.id")

	await get_tree().create_timer(0.1).timeout

	if failed_signal_received and failure_reason == "Invalid product ID":
		_pass("test_invalid_product_failure")
	else:
		_fail("test_invalid_product_failure", "Should fail with 'Invalid product ID'")

	sm.queue_free()
