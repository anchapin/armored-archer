extends Node
class_name GDScriptTestCase

## Base class for all GDScript test cases
## Provides common test functionality including assertion counters,
## pass/fail tracking, and signal emission for test results

var test_name: String
var assertions_passed: int = 0
var assertions_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	# To be overridden by subclasses
	pass

func assert_equal(actual, expected, message: String = "") -> void:
	if actual == expected:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected %s, got %s" % [str(expected), str(actual)])

func assert_not_equal(actual, expected, message: String = "") -> void:
	if actual != expected:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected not %s, but got %s" % [str(expected), str(actual)])

func assert_true(condition: bool, message: String = "") -> void:
	if condition:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected true but got false")

func assert_false(condition: bool, message: String = "") -> void:
	if not condition:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected false but got true")

func assert_null(value, message: String = "") -> void:
	if value == null:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected null but got %s" % [str(value)])

func assert_not_null(value, message: String = "") -> void:
	if value != null:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected not null but got null")

func assert_greater(actual, expected, message: String = "") -> void:
	if actual > expected:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected %s > %s" % [str(actual), str(expected)])

func assert_less(actual, expected, message: String = "") -> void:
	if actual < expected:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected %s < %s" % [str(actual), str(expected)])

func assert_has(dict: Dictionary, key: String, message: String = "") -> void:
	if dict.has(key):
		_pass_internal()
	else:
		_fail_internal(message if message else "Dictionary missing key '%s'" % key)

func assert_has_key(value, key, message: String = "") -> void:
	if value is Dictionary and value.has(key):
		_pass_internal()
	else:
		_fail_internal(message if message else "Value missing key '%s'" % key)

func assert_empty(array: Array, message: String = "") -> void:
	if array.is_empty():
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected empty array but got %d items" % array.size())

func assert_not_empty(array: Array, message: String = "") -> void:
	if not array.is_empty():
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected non-empty array")

func assert_between(value, min_value, max_value, message: String = "") -> void:
	if value >= min_value and value <= max_value:
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected %s between %s and %s" % [str(value), str(min_value), str(max_value)])

func assert_contains(array: Array, element, message: String = "") -> void:
	if array.has(element):
		_pass_internal()
	else:
		_fail_internal(message if message else "Array does not contain %s" % [str(element)])

func assert_instance_of(object, expected_class, message: String = "") -> void:
	if is_instance_of(object, expected_class):
		_pass_internal()
	else:
		_fail_internal(message if message else "Expected instance of %s" % expected_class)

func assert_method_exists(object: Object, method_name: String, message: String = "") -> void:
	if object.has_method(method_name):
		_pass_internal()
	else:
		_fail_internal(message if message else "Object missing method '%s'" % method_name)

func assert_signal_exists(object: Object, signal_name: String, message: String = "") -> void:
	if object.has_signal(signal_name):
		_pass_internal()
	else:
		_fail_internal(message if message else "Object missing signal '%s'" % signal_name)

func fail_test(message: String) -> void:
	_fail_internal(message)

func pass_test() -> void:
	_pass_internal()

func get_results() -> Dictionary:
	return {
		"test_name": test_name,
		"passed": assertions_passed,
		"failed": assertions_failed,
		"total": assertions_passed + assertions_failed
	}

func print_results() -> void:
	print("\n=== Test Results ===")
	print("Passed: %d" % assertions_passed)
	print("Failed: %d" % assertions_failed)
	print("Total: %d" % (assertions_passed + assertions_failed))

func _pass_internal() -> void:
	assertions_passed += 1

func _fail_internal(message: String) -> void:
	assertions_failed += 1
	push_error("[FAIL] " + (test_name if test_name else "Unknown test") + ": " + message)
	test_completed.emit(test_name if test_name else "Unknown test", false)
