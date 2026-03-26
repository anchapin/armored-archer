extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0
var _current_test_name: String = ""

signal test_started(test_name: String)
signal test_passed(test_name: String)
signal test_failed(test_name: String, error_message: String)
signal all_tests_completed(passed: int, failed: int)

func _ready() -> void:
	print("Test Framework Ready")

func assert_true(condition: bool, message: String = "") -> void:
	if condition:
		_pass()
	else:
		_fail("Expected true but got false: " + message)

func assert_false(condition: bool, message: String = "") -> void:
	if not condition:
		_pass()
	else:
		_fail("Expected false but got true: " + message)

func assert_eq(actual, expected, message: String = "") -> void:
	if actual == expected:
		_pass()
	else:
		_fail("Expected %s but got %s: %s" % [str(expected), str(actual), message])

func assert_ne(actual, expected, message: String = "") -> void:
	if actual != expected:
		_pass()
	else:
		_fail("Expected not %s but got %s: %s" % [str(expected), str(actual), message])

func assert_null(value, message: String = "") -> void:
	if value == null:
		_pass()
	else:
		_fail("Expected null but got %s: %s" % [str(value), message])

func assert_not_null(value, message: String = "") -> void:
	if value != null:
		_pass()
	else:
		_fail("Expected not null but got null: " + message)

func assert_gt(actual, expected, message: String = "") -> void:
	if actual > expected:
		_pass()
	else:
		_fail("Expected %s > %s: %s" % [str(actual), str(expected), message])

func assert_lt(actual, expected, message: String = "") -> void:
	if actual < expected:
		_pass()
	else:
		_fail("Expected %s < %s: %s" % [str(actual), str(expected), message])

func assert_has(dict: Dictionary, key: String, message: String = "") -> void:
	if dict.has(key):
		_pass()
	else:
		_fail("Dictionary missing key '%s': %s" % [key, message])

func assert_empty(array: Array, message: String = "") -> void:
	if array.is_empty():
		_pass()
	else:
		_fail("Expected empty array but got %s items: %s" % [str(array.size()), message])

func assert_not_empty(array: Array, message: String = "") -> void:
	if not array.is_empty():
		_pass()
	else:
		_fail("Expected non-empty array: " + message)

func _pass() -> void:
	_tests_passed += 1
	test_passed.emit(_current_test_name)
	print("[PASS] " + _current_test_name)

func _fail(error_message: String) -> void:
	_tests_failed += 1
	test_failed.emit(_current_test_name, error_message)
	print("[FAIL] " + _current_test_name + ": " + error_message)

func run_test(test_name: String, test_func: Callable) -> void:
	_current_test_name = test_name
	test_started.emit(test_name)
	print("\n=== Running: " + test_name + " ===")
	test_func.call()
	await get_tree().process_frame

func get_results() -> Dictionary:
	return {
		"passed": _tests_passed,
		"failed": _tests_failed,
		"total": _tests_passed + _tests_failed
	}

func print_results() -> void:
	print("\n=== Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	print("Total: %d" % (_tests_passed + _tests_failed))
	all_tests_completed.emit(_tests_passed, _tests_failed)
