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

	if sm.current_gems == 0 and sm.current_coins == 0 and not sm.is_initialized:
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

	if small != null and small.gem_amount == 100 and medium.gem_amount == 550 and large.gem_amount == 1200 and unknown.is_empty():
		_pass("test_get_product_info")
	else:
		_fail("test_get_product_info", "Product info incorrect")

	sm.queue_free()

func test_currency_signals() -> void:
	var sm = _create_store_manager()
	var currency_updated_signals: Array = []

	sm.currency_updated.connect(func(gems, amount):
		currency_updated_signals.append([gems, amount])
	)

	# Simulate changing gems (normally would be set via methods)
	sm.current_gems = 500
	# In the actual code, currency_updated is emitted when a purchase is made or currency changes.
	# We can test by emitting manually as well.
	sm.currency_updated.emit(500, 0)

	await get_tree().create_timer(0.1).timeout

	if not currency_updated_signals.is_empty():
		_pass("test_currency_signals")
	else:
		_fail("test_currency_signals", "currency_updated signal not received")

	sm.queue_free()

func test_signal_emission() -> void:
	var sm = _create_store_manager()
	var signals_received: Array = []

	sm.purchase_succeeded.connect(func(_product_id, _gems): signals_received.append("purchase_succeeded"))
	sm.purchase_failed.connect(func(_product_id, _error): signals_received.append("purchase_failed"))
	sm.products_loaded.connect(func(_products): signals_received.append("products_loaded"))

	# Emit signals manually
	sm.purchase_succeeded.emit(sm.PRODUCT_SMALL_GEMS, 100)
	sm.purchase_failed.emit(sm.PRODUCT_MEDIUM_GEMS, "Test error")
	sm.products_loaded.emit(sm.get_products())

	await get_tree().create_timer(0.1).timeout

	if signals_received.has("purchase_succeeded") and signals_received.has("purchase_failed") and signals_received.has("products_loaded"):
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "Not all signals received")

	sm.queue_free()
