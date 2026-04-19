extends GDScriptTestCase

## Tests for the MonitoringManager unified monitoring coordinator
## Tests cover autoload existence, health snapshot collection,
## error reporting, and signal connections

func _ready() -> void:
	print("=== Running MonitoringManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_monitoring_manager_exists()
	await test_health_snapshot_structure()
	await test_report_error()
	await test_error_buffer()
	await test_crash_handler_installed()
	await test_get_last_health_snapshot()

	print("\n=== MonitoringManager Test Results ===")
	print("Passed: %d" % assertions_passed)
	print("Failed: %d" % assertions_failed)
	queue_free()

func _get_monitoring_manager() -> Node:
	return get_node_or_null("/root/MonitoringManager")

func _pass(test_name: String) -> void:
	test_name = test_name
	assertions_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	test_name = test_name
	assertions_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_monitoring_manager_exists() -> void:
	var test_name = "test_monitoring_manager_exists"
	var manager = _get_monitoring_manager()
	if manager != null:
		_pass(test_name)
	else:
		_fail(test_name, "MonitoringManager should exist as autoload")

func test_health_snapshot_structure() -> void:
	var test_name = "test_health_snapshot_structure"
	var manager = _get_monitoring_manager()
	if not manager:
		_fail(test_name, "MonitoringManager not available")
		return

	var snapshot = manager.get_last_health_snapshot()
	if not snapshot is Dictionary:
		_fail(test_name, "Health snapshot should be a Dictionary")
		return

	if not snapshot.has("timestamp"):
		_fail(test_name, "Health snapshot should have 'timestamp' key")
		return

	if not snapshot.has("performance"):
		_fail(test_name, "Health snapshot should have 'performance' key")
		return

	if not snapshot.has("analytics"):
		_fail(test_name, "Health snapshot should have 'analytics' key")
		return

	if not snapshot.has("matchmaking"):
		_fail(test_name, "Health snapshot should have 'matchmaking' key")
		return

	_pass(test_name)

func test_report_error() -> void:
	var test_name = "test_report_error"
	var manager = _get_monitoring_manager()
	if not manager:
		_fail(test_name, "MonitoringManager not available")
		return

	if not manager.has_method("report_error"):
		_fail(test_name, "MonitoringManager should have report_error method")
		return

	# Report an error and verify it goes into the buffer
	manager.report_error("test error", {"test": true})
	var buffer = manager.get_error_buffer()
	if buffer.size() < 1:
		_fail(test_name, "Error buffer should contain at least 1 error after report_error")
		return

	var last_error = buffer[buffer.size() - 1]
	if last_error.get("message", "") != "test error":
		_fail(test_name, "Last error should have the reported message")
		return

	_pass(test_name)

func test_error_buffer() -> void:
	var test_name = "test_error_buffer"
	var manager = _get_monitoring_manager()
	if not manager:
		_fail(test_name, "MonitoringManager not available")
		return

	if not manager.has_method("get_error_buffer"):
		_fail(test_name, "MonitoringManager should have get_error_buffer method")
		return

	var buffer = manager.get_error_buffer()
	if not buffer is Array:
		_fail(test_name, "Error buffer should be an Array")
		return

	_pass(test_name)

func test_crash_handler_installed() -> void:
	var test_name = "test_crash_handler_installed"
	var manager = _get_monitoring_manager()
	if not manager:
		_fail(test_name, "MonitoringManager not available")
		return

	# Verify the manager has connected to crash signals
	var crash_handled_signal_exists = manager.has_signal("crash_handled")
	if not crash_handled_signal_exists:
		_fail(test_name, "MonitoringManager should have crash_handled signal")
		return

	var health_snapshot_signal_exists = manager.has_signal("health_snapshot_taken")
	if not health_snapshot_signal_exists:
		_fail(test_name, "MonitoringManager should have health_snapshot_taken signal")
		return

	var health_report_signal_exists = manager.has_signal("health_report_sent")
	if not health_report_signal_exists:
		_fail(test_name, "MonitoringManager should have health_report_sent signal")
		return

	_pass(test_name)

func test_get_last_health_snapshot() -> void:
	var test_name = "test_get_last_health_snapshot"
	var manager = _get_monitoring_manager()
	if not manager:
		_fail(test_name, "MonitoringManager not available")
		return

	var snapshot = manager.get_last_health_snapshot()
	if not snapshot is Dictionary:
		_fail(test_name, "get_last_health_snapshot should return a Dictionary")
		return

	_pass(test_name)
