extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running Store Fallback Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_store_available()
	await test_consecutive_failures_trigger_outage()
	await test_success_resets_outage()
	await test_error_categorization()
	await test_user_facing_error_messages()
	await test_purchase_blocked_during_outage()
	await test_availability_signal_emitted()

	print("\n=== Store Fallback Test Results ===")
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

func test_initial_store_available() -> void:
	var sm = _create_store_manager()

	if sm.is_store_available and sm._consecutive_failures == 0 and sm._consecutive_successes == 0:
		_pass("test_initial_store_available")
	else:
		_fail("test_initial_store_available", "Store should start as available with zero counters")

	sm.queue_free()

func test_consecutive_failures_trigger_outage() -> void:
	var sm = _create_store_manager()

	sm._record_failure("network")
	if sm.is_store_available:
		_pass("test_single_failure_no_outage")
	else:
		_fail("test_single_failure_no_outage", "Single failure should not trigger outage")

	sm._record_failure("network")
	if not sm.is_store_available:
		_pass("test_double_failure_triggers_outage")
	else:
		_fail("test_double_failure_triggers_outage", "Two failures should trigger outage")

	sm.queue_free()

func test_success_resets_outage() -> void:
	var sm = _create_store_manager()

	sm._record_failure("network")
	sm._record_failure("network")
	if not sm.is_store_available:
		_pass("test_outage_active_before_recovery")
	else:
		_fail("test_outage_active_before_recovery", "Outage should be active")

	sm._record_success()
	if sm.is_store_available:
		_pass("test_success_recovers_outage")
	else:
		_fail("test_success_recovers_outage", "Success should recover outage")

	sm.queue_free()

func test_error_categorization() -> void:
	var sm = _create_store_manager()

	if sm._categorize_error("Network timeout occurred") == "timeout":
		_pass("test_categorize_timeout")
	else:
		_fail("test_categorize_timeout", "Should categorize as timeout")

	if sm._categorize_error("Not connected to server") == "network":
		_pass("test_categorize_network")
	else:
		_fail("test_categorize_network", "Should categorize as network")

	if sm._categorize_error("RevenueCat plugin not found") == "provider":
		_pass("test_categorize_provider")
	else:
		_fail("test_categorize_provider", "Should categorize as provider")

	if sm._categorize_error("Service 503 unavailable") == "maintenance":
		_pass("test_categorize_maintenance")
	else:
		_fail("test_categorize_maintenance", "Should categorize as maintenance")

	if sm._categorize_error("Something unknown") == "generic":
		_pass("test_categorize_generic")
	else:
		_fail("test_categorize_generic", "Should categorize as generic")

	sm.queue_free()

func test_user_facing_error_messages() -> void:
	var sm = _create_store_manager()

	var msg: String = sm.get_user_facing_error("Network timeout occurred")
	if not msg.is_empty() and msg != "Network timeout occurred":
		_pass("test_user_facing_error_differs_from_raw")
	else:
		_fail("test_user_facing_error_differs_from_raw", "User message should differ from raw error")

	var all_have_messages: bool = true
	for key in sm.ERROR_MESSAGES:
		if sm.ERROR_MESSAGES[key].is_empty():
			all_have_messages = false
	if all_have_messages:
		_pass("test_all_error_categories_have_messages")
	else:
		_fail("test_all_error_categories_have_messages", "All categories should have messages")

	sm.queue_free()

func test_purchase_blocked_during_outage() -> void:
	var sm = _create_store_manager()
	# GDScript lambdas capture primitive locals by value, not by reference.
	# Use an Array container so the lambda can mutate state visible outside.
	var signal_state: Array = [false, ""]

	sm.purchase_failed.connect(func(_pid, error):
		signal_state[0] = true
		signal_state[1] = error
	)

	sm._record_failure("network")
	sm._record_failure("network")

	sm.purchase_product(sm.PRODUCT_SMALL_GEMS)

	await get_tree().create_timer(0.1).timeout

	if signal_state[0] and not signal_state[1].is_empty():
		_pass("test_purchase_blocked_during_outage")
	else:
		_fail("test_purchase_blocked_during_outage", "Purchase should fail with outage message")

	sm.queue_free()

func test_availability_signal_emitted() -> void:
	var sm = _create_store_manager()
	# GDScript lambdas capture primitive locals by value, not by reference.
	# Use an Array container so the lambda can mutate state visible outside.
	var signal_state: Array = [false, true, ""]

	sm.store_availability_changed.connect(func(is_available, message):
		signal_state[0] = true
		signal_state[1] = is_available
		signal_state[2] = message
	)

	sm._record_failure("network")
	sm._record_failure("network")

	await get_tree().create_timer(0.1).timeout

	if signal_state[0] and not signal_state[1] and not signal_state[2].is_empty():
		_pass("test_outage_signal_emitted")
	else:
		_fail("test_outage_signal_emitted", "Outage signal should fire with message")

	sm.queue_free()
