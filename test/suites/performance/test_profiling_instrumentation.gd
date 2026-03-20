extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ProfilingInstrumentation Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_initial_state()
	await test_marker_lifecycle()
	await test_marker_timing()
	await test_time_function()
	await test_marker_stats()
	await test_profile_report()
	await test_frame_profiling()
	await test_memory_snapshots()
	await test_profiling_toggle()
	await test_clear_data()
	await test_integration_with_performance_profiler()

	print("\n=== ProfilingInstrumentation Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_profiler() -> Node:
	var profiler = load("res://autoloads/ProfilingInstrumentation.gd").new()
	add_child(profiler)
	return profiler

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var profiler = _create_profiler()

	# Test MAX_MARKER_HISTORY constant
	if profiler.MAX_MARKER_HISTORY > 0:
		_pass("test_max_marker_history_constant")
	else:
		_fail("test_max_marker_history_constant", "MAX_MARKER_HISTORY should be positive")

	# Test MIN_SIGNIFICANT_TIME_MS constant
	if profiler.MIN_SIGNIFICANT_TIME_MS > 0:
		_pass("test_min_significant_time_constant")
	else:
		_fail("test_min_significant_time_constant", "MIN_SIGNIFICANT_TIME_MS should be positive")

	# Test MAX_FRAME_HISTORY constant
	if profiler.MAX_FRAME_HISTORY > 0:
		_pass("test_max_frame_history_constant")
	else:
		_fail("test_max_frame_history_constant", "MAX_FRAME_HISTORY should be positive")

	profiler.queue_free()

func test_initial_state() -> void:
	var profiler = _create_profiler()

	# Test initial profiling enabled state
	var enabled = profiler.is_profiling_enabled()
	if typeof(enabled) == TYPE_BOOL:
		_pass("test_initial_profiling_enabled")
	else:
		_fail("test_initial_profiling_enabled", "is_profiling_enabled should return bool")

	# Test initial frame profiling state
	var frame_enabled = profiler.is_frame_profiling_enabled()
	if typeof(frame_enabled) == TYPE_BOOL:
		_pass("test_initial_frame_profiling_enabled")
	else:
		_fail("test_initial_frame_profiling_enabled", "is_frame_profiling_enabled should return bool")

	# Test active markers is initially empty
	var active = profiler.get_active_markers()
	if typeof(active) == TYPE_DICTIONARY and active.is_empty():
		_pass("test_initial_active_markers_empty")
	else:
		_fail("test_initial_active_markers_empty", "Active markers should be empty initially")

	# Test frame times is initially empty
	var frame_times = profiler.get_frame_times()
	if typeof(frame_times) == TYPE_ARRAY and frame_times.is_empty():
		_pass("test_initial_frame_times_empty")
	else:
		_fail("test_initial_frame_times_empty", "Frame times should be empty initially")

	profiler.queue_free()

func test_marker_lifecycle() -> void:
	var profiler = _create_profiler()

	# Test start_marker returns valid ID
	var marker_id = profiler.start_marker("test_marker")
	if marker_id >= 0:
		_pass("test_start_marker_returns_id")
	else:
		_fail("test_start_marker_returns_id", "start_marker should return non-negative ID")

	# Test marker is tracked as active
	var active = profiler.get_active_markers()
	if active.has("test_marker"):
		_pass("test_marker_tracked_as_active")
	else:
		_fail("test_marker_tracked_as_active", "Marker should be in active markers")

	# Test end_marker returns duration
	var duration = profiler.end_marker("test_marker", marker_id)
	if typeof(duration) == TYPE_FLOAT:
		_pass("test_end_marker_returns_duration")
	else:
		_fail("test_end_marker_returns_duration", "end_marker should return float duration")

	# Test marker is no longer active
	active = profiler.get_active_markers()
	if not active.has("test_marker"):
		_pass("test_marker_not_active_after_end")
	else:
		_fail("test_marker_not_active_after_end", "Marker should not be in active markers after end")

	# Test end_marker with non-existent marker
	var no_marker = profiler.end_marker("nonexistent_marker")
	if no_marker == 0.0:
		_pass("test_end_nonexistent_marker")
	else:
		_fail("test_end_nonexistent_marker", "end_marker should return 0 for nonexistent marker")

	profiler.queue_free()

func test_marker_timing() -> void:
	var profiler = _create_profiler()

	# Start and immediately end a marker (should be very fast)
	var marker_id = profiler.start_marker("fast_marker")
	# Small delay to ensure some measurable time
	await get_tree().process_frame
	var duration = profiler.end_marker("fast_marker", marker_id)

	# Duration should be >= 0
	if duration >= 0:
		_pass("test_marker_duration_non_negative")
	else:
		_fail("test_marker_duration_non_negative", "Duration should be non-negative")

	# Test scoped markers
	profiler.scoped_marker("scoped_test")
	await get_tree().process_frame
	var scoped_duration = profiler.end_scoped_marker("scoped_test")

	if scoped_duration >= 0:
		_pass("test_scoped_marker_timing")
	else:
		_fail("test_scoped_marker_timing", "Scoped marker should return valid duration")

	profiler.queue_free()

func test_time_function() -> void:
	var profiler = _create_profiler()

	# Test time_function with simple function
	var result = profiler.time_function(func():
		return 42
	)

	if result == 42:
		_pass("test_time_function_returns_result")
	else:
		_fail("test_time_function_returns_result", "time_function should return function result")

	# Test time_function_named
	var result2 = profiler.time_function_named("named_test", func():
		return "test"
	)

	if result2 == "test":
		_pass("test_time_function_named_returns_result")
	else:
		_fail("test_time_function_named_returns_result", "time_function_named should return result")

	# Test that time_function records the marker
	var stats = profiler.get_marker_stats("Node.1")  # Anonymous callable
	# Note: The exact name depends on how callable is resolved
	# Just verify stats were recorded somewhere
	var all_stats = profiler.get_all_marker_stats()
	if all_stats.size() >= 1:
		_pass("test_time_function_records_marker")
	else:
		_fail("test_time_function_records_marker", "time_function should record marker")

	profiler.queue_free()

func test_marker_stats() -> void:
	var profiler = _create_profiler()

	# Create multiple markers with same name
	for i in range(5):
		var id = profiler.start_marker("repeated_marker")
		profiler.end_marker("repeated_marker", id)

	# Test get_marker_stats returns stats for recorded marker
	var stats = profiler.get_marker_stats("repeated_marker")
	if typeof(stats) == TYPE_DICTIONARY:
		_pass("test_marker_stats_returns_dict")
	else:
		_fail("test_marker_stats_returns_dict", "get_marker_stats should return Dictionary")

	# Test stats contain expected keys
	if stats.has("count") and stats.has("min") and stats.has("max") and stats.has("avg"):
		_pass("test_marker_stats_has_expected_keys")
	else:
		_fail("test_marker_stats_has_expected_keys", "Stats should have count, min, max, avg")

	# Test count is correct
	if stats.get("count") == 5:
		_pass("test_marker_stats_count_correct")
	else:
		_fail("test_marker_stats_count_correct", "Count should be 5")

	# Test min <= avg <= max
	if stats.get("min", 999) <= stats.get("avg", 0) and stats.get("avg", 0) <= stats.get("max", 0):
		_pass("test_marker_stats_min_max_avg_order")
	else:
		_fail("test_marker_stats_min_max_avg_order", "min <= avg <= max")

	# Test get_all_marker_stats
	var all_stats = profiler.get_all_marker_stats()
	if typeof(all_stats) == TYPE_DICTIONARY and all_stats.has("repeated_marker"):
		_pass("test_get_all_marker_stats")
	else:
		_fail("test_get_all_marker_stats", "get_all_marker_stats should return all markers")

	profiler.queue_free()

func test_profile_report() -> void:
	var profiler = _create_profiler()

	# Add some test data
	var id1 = profiler.start_marker("report_test_1")
	profiler.end_marker("report_test_1", id1)

	var id2 = profiler.start_marker("report_test_2")
	profiler.end_marker("report_test_2", id2)

	# Test get_profile_report returns dictionary
	var report = profiler.get_profile_report()
	if typeof(report) == TYPE_DICTIONARY:
		_pass("test_profile_report_returns_dict")
	else:
		_fail("test_profile_report_returns_dict", "get_profile_report should return Dictionary")

	# Test report has expected top-level keys
	if report.has("profiling_enabled") and report.has("frame_profiling_enabled"):
		_pass("test_profile_report_has_enabled_flags")
	else:
		_fail("test_profile_report_has_enabled_flags", "Report should have profiling flags")

	# Test report has markers
	if report.has("markers") and typeof(report.markers) == TYPE_ARRAY:
		_pass("test_profile_report_has_markers")
	else:
		_fail("test_profile_report_has_markers", "Report should have markers array")

	# Test markers contain expected data
	if report.markers.size() > 0:
		var marker = report.markers[0]
		if marker.has("name") and marker.has("count") and marker.has("total_ms"):
			_pass("test_marker_data_structure")
		else:
			_fail("test_marker_data_structure", "Marker should have name, count, total_ms")

	# Test get_formatted_report returns string
	var formatted = profiler.get_formatted_report()
	if typeof(formatted) == TYPE_STRING and formatted.length() > 0:
		_pass("test_formatted_report_returns_string")
	else:
		_fail("test_formatted_report_returns_string", "get_formatted_report should return non-empty string")

	profiler.queue_free()

func test_frame_profiling() -> void:
	var profiler = _create_profiler()

	# Enable frame profiling
	profiler.set_frame_profiling_enabled(true)

	if profiler.is_frame_profiling_enabled():
		_pass("test_frame_profiling_can_enable")
	else:
		_fail("test_frame_profiling_can_enable", "Frame profiling should be enabled")

	# Process a few frames
	for i in range(10):
		await get_tree().process_frame

	# Test frame times are being recorded
	var frame_times = profiler.get_frame_times()
	if frame_times.size() > 0:
		_pass("test_frame_times_recorded")
	else:
		_fail("test_frame_times_recorded", "Frame times should be recorded")

	# Test average frame time
	var avg = profiler.get_average_frame_time_ms()
	if typeof(avg) == TYPE_FLOAT and avg >= 0:
		_pass("test_average_frame_time")
	else:
		_fail("test_average_frame_time", "Average frame time should be non-negative float")

	# Test max frame time
	var max_time = profiler.get_max_frame_time_ms()
	if typeof(max_time) == TYPE_FLOAT and max_time >= 0:
		_pass("test_max_frame_time")
	else:
		_fail("test_max_frame_time", "Max frame time should be non-negative float")

	# Disable frame profiling
	profiler.set_frame_profiling_enabled(false)
	if not profiler.is_frame_profiling_enabled():
		_pass("test_frame_profiling_can_disable")
	else:
		_fail("test_frame_profiling_can_disable", "Frame profiling should be disabled")

	profiler.queue_free()

func test_memory_snapshots() -> void:
	var profiler = _create_profiler()

	# Take a memory snapshot
	var snapshot = profiler.take_memory_snapshot("test_snapshot")

	if typeof(snapshot) == TYPE_DICTIONARY:
		_pass("test_take_memory_snapshot")
	else:
		_fail("test_take_memory_snapshot", "take_memory_snapshot should return Dictionary")

	# Test snapshot has expected keys
	if snapshot.has("timestamp") and snapshot.has("memory_mb"):
		_pass("test_memory_snapshot_keys")
	else:
		_fail("test_memory_snapshot_keys", "Snapshot should have timestamp and memory_mb")

	# Test snapshot has label
	if snapshot.has("label") and snapshot.get("label") == "test_snapshot":
		_pass("test_memory_snapshot_label")
	else:
		_fail("test_memory_snapshot_label", "Snapshot should have correct label")

	# Test get_memory_snapshots
	var snapshots = profiler.get_memory_snapshots()
	if typeof(snapshots) == TYPE_ARRAY and snapshots.size() > 0:
		_pass("test_get_memory_snapshots")
	else:
		_fail("test_get_memory_snapshots", "get_memory_snapshots should return snapshots")

	# Test get_memory_growth_mb (should be 0 or close to 0 for no growth)
	var growth = profiler.get_memory_growth_mb()
	if typeof(growth) == TYPE_FLOAT:
		_pass("test_get_memory_growth")
	else:
		_fail("test_get_memory_growth", "get_memory_growth_mb should return float")

	profiler.queue_free()

func test_profiling_toggle() -> void:
	var profiler = _create_profiler()

	# Store initial state
	var initial_state = profiler.is_profiling_enabled()

	# Disable profiling
	profiler.set_profiling_enabled(false)
	if not profiler.is_profiling_enabled():
		_pass("test_profiling_can_disable")
	else:
		_fail("test_profiling_can_disable", "Profiling should be disabled")

	# Enable profiling
	profiler.set_profiling_enabled(true)
	if profiler.is_profiling_enabled():
		_pass("test_profiling_can_enable")
	else:
		_fail("test_profiling_can_enable", "Profiling should be enabled")

	# Test start_marker when disabled returns -1
	var disabled_id = profiler.start_marker("disabled_test")
	if disabled_id == -1:
		_pass("test_start_marker_disabled")
	else:
		_fail("test_start_marker_disabled", "start_marker should return -1 when disabled")

	# Test end_marker when disabled returns 0
	var disabled_duration = profiler.end_marker("disabled_test")
	if disabled_duration == 0.0:
		_pass("test_end_marker_disabled")
	else:
		_fail("test_end_marker_disabled", "end_marker should return 0 when disabled")

	profiler.queue_free()

func test_clear_data() -> void:
	var profiler = _create_profiler()

	# Add some test data
	var id = profiler.start_marker("clear_test")
	profiler.end_marker("clear_test", id)
	profiler.take_memory_snapshot("test")

	# Test clear_profiling_data
	profiler.clear_profiling_data()

	# Test markers are cleared
	var stats = profiler.get_marker_stats("clear_test")
	if stats.is_empty():
		_pass("test_clear_markers")
	else:
		_fail("test_clear_markers", "Markers should be cleared")

	# Test frame times are cleared
	var frame_times = profiler.get_frame_times()
	if frame_times.is_empty():
		_pass("test_clear_frame_times")
	else:
		_fail("test_clear_frame_times", "Frame times should be cleared")

	profiler.queue_free()

func test_integration_with_performance_profiler() -> void:
	# First create ProfilingInstrumentation
	var profiler = _create_profiler()

	# Add some profiling data
	var id = profiler.start_marker("integration_test")
	profiler.end_marker("integration_test", id)

	# Now test if PerformanceProfiler can access it
	var perf_profiler = load("res://autoloads/PerformanceProfiler.gd").new()
	add_child(perf_profiler)

	# Test get_instrumentation_data returns data
	var instrumentation = perf_profiler.get_instrumentation_data()
	if typeof(instrumentation) == TYPE_DICTIONARY:
		_pass("test_instrumentation_data_returns_dict")
	else:
		_fail("test_instrumentation_data_returns_dict", "get_instrumentation_data should return Dictionary")

	# Test get_combined_report
	var combined = perf_profiler.get_combined_report()
	if typeof(combined) == TYPE_DICTIONARY:
		_pass("test_combined_report_returns_dict")
	else:
		_fail("test_combined_report_returns_dict", "get_combined_report should return Dictionary")

	# Test combined report has both snapshot and instrumentation
	if combined.has("instrumentation"):
		_pass("test_combined_report_has_instrumentation")
	else:
		_fail("test_combined_report_has_instrumentation", "Combined report should have instrumentation")

	profiler.queue_free()
	perf_profiler.queue_free()
