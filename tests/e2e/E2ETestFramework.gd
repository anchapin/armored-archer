extends Node

var test_results: Array = []
var test_start_time: int = 0

signal test_started(test_name: String)
signal test_passed(test_name: String, duration_ms: int)
signal test_failed(test_name: String, error: String, duration_ms: int)
signal all_tests_completed(results: Array, total_duration_ms: int)

func _ready() -> void:
	print("=== E2E Test Framework Initialized ===")

func run_test(test_name: String, test_func: Callable) -> void:
	test_started.emit(test_name)
	test_start_time = Time.get_ticks_msec()

	var test_node = Node.new()
	test_node.name = "TestContext"
	get_tree().root.add_child(test_node)

	var error: String = ""

	try:
		await test_func.call(test_node)
	except Exception as e:
		error = "Exception: %s" % str(e)

	var duration_ms = Time.get_ticks_msec() - test_start_time

	test_node.queue_free()

	if error.is_empty():
		test_results.append({
			"name": test_name,
			"passed": true,
			"duration_ms": duration_ms
		})
		test_passed.emit(test_name, duration_ms)
		print("[PASS] %s (%dms)" % [test_name, duration_ms])
	else:
		test_results.append({
			"name": test_name,
			"passed": false,
			"error": error,
			"duration_ms": duration_ms
		})
		test_failed.emit(test_name, error, duration_ms)
		print("[FAIL] %s: %s (%dms)" % [test_name, error, duration_ms])

func run_all_tests() -> void:
	test_results.clear()
	print("\n=== Running E2E Test Suite ===\n")

	await get_tree().create_timer(0.1).timeout

	var total_duration = 0
	for result in test_results:
		total_duration += result.get("duration_ms", 0)

	all_tests_completed.emit(test_results, total_duration)
	print("\n=== Test Suite Complete ===")
	print("Total: %d tests, %d passed, %d failed" % [
		test_results.size(),
		test_results.filter(func(r): return r.get("passed", false)).size(),
		test_results.filter(func(r): return not r.get("passed", false)).size()
	])

func get_test_results() -> Array:
	return test_results

func get_summary() -> Dictionary:
	var passed = 0
	var failed = 0
	var total_duration = 0

	for result in test_results:
		total_duration += result.get("duration_ms", 0)
		if result.get("passed", false):
			passed += 1
		else:
			failed += 1

	return {
		"total": test_results.size(),
		"passed": passed,
		"failed": failed,
		"total_duration_ms": total_duration
	}

func simulate_input(input_name: String, pressed: bool = true) -> void:
	var event = InputEventKey.new()
	event.pressed = pressed

	match input_name:
		"move_left":
			event.physical_keycode = KEY_A
		"move_right":
			event.physical_keycode = KEY_D
		"move_up":
			event.physical_keycode = KEY_W
		"move_down":
			event.physical_keycode = KEY_S
		"aim_left":
			event.physical_keycode = KEY_LEFT
		"aim_right":
			event.physical_keycode = KEY_RIGHT
		"aim_up":
			event.physical_keycode = KEY_UP
		"aim_down":
			event.physical_keycode = KEY_DOWN

	Input.parse_input_event(event)

func wait_seconds(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
