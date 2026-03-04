extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running PerformanceProfiler Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_constants()
	test_initial_state()
	test_device_tier_detection()
	test_performance_targets()
	test_memory_tracking()
	test_memory_leak_detection()
	test_memory_leak_status()
	test_memory_leak_reset()
	test_profiling_snapshot()
	test_set_target_fps()
	
	print("\n=== PerformanceProfiler Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_profiler() -> Node:
	var profiler = load("res://autoloads/PerformanceProfiler.gd").new()
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
	
	# Test FPS constants
	if profiler.FLAGSHIP_TARGET_FPS == 60:
		_pass("test_flagship_target_fps_constant")
	else:
		_fail("test_flagship_target_fps_constant", "FLAGSHIP_TARGET_FPS should be 60")
	
	if profiler.BUDGET_MIN_FPS == 30:
		_pass("test_budget_min_fps_constant")
	else:
		_fail("test_budget_min_fps_constant", "BUDGET_MIN_FPS should be 30")
	
	# Test memory constants
	if profiler.BUDGET_MEMORY_THRESHOLD == 256:
		_pass("test_budget_memory_threshold_constant")
	else:
		_fail("test_budget_memory_threshold_constant", "BUDGET_MEMORY_THRESHOLD should be 256")
	
	if profiler.MID_RANGE_MEMORY_THRESHOLD == 512:
		_pass("test_mid_range_memory_threshold_constant")
	else:
		_fail("test_mid_range_memory_threshold_constant", "MID_RANGE_MEMORY_THRESHOLD should be 512")
	
	# Test memory leak detection constants
	if profiler.MEMORY_LEAK_THRESHOLD_MB == 50.0:
		_pass("test_memory_leak_threshold_constant")
	else:
		_fail("test_memory_leak_threshold_constant", "MEMORY_LEAK_THRESHOLD_MB should be 50.0")
	
	if profiler.MEMORY_GROWTH_RATE_THRESHOLD == 10.0:
		_pass("test_memory_growth_rate_threshold_constant")
	else:
		_fail("test_memory_growth_rate_threshold_constant", "MEMORY_GROWTH_RATE_THRESHOLD should be 10.0")
	
	if profiler.MEMORY_LEAK_SAMPLE_COUNT == 60:
		_pass("test_memory_leak_sample_count_constant")
	else:
		_fail("test_memory_leak_sample_count_constant", "MEMORY_LEAK_SAMPLE_COUNT should be 60")
	
	profiler.queue_free()

func test_initial_state() -> void:
	var profiler = _create_profiler()
	
	# Test initial FPS tracking
	if profiler.get_fps() >= 0:
		_pass("test_initial_fps")
	else:
		_fail("test_initial_fps", "FPS should be non-negative")
	
	# Test initial memory tracking
	if profiler.get_startup_memory_mb() >= 0:
		_pass("test_initial_startup_memory")
	else:
		_fail("test_initial_startup_memory", "Startup memory should be non-negative")
	
	# Test initial peak memory
	if profiler.get_peak_memory_mb() >= 0:
		_pass("test_initial_peak_memory")
	else:
		_fail("test_initial_peak_memory", "Peak memory should be non-negative")
	
	# Test device tier is set
	var tier = profiler.get_device_tier()
	if tier in [0, 1, 2]:
		_pass("test_initial_device_tier")
	else:
		_fail("test_initial_device_tier", "Device tier should be 0, 1, or 2")
	
	profiler.queue_free()

func test_device_tier_detection() -> void:
	var profiler = _create_profiler()
	
	# Test is_budget_device returns boolean
	var is_budget = profiler.is_budget_device()
	if typeof(is_budget) == TYPE_BOOL:
		_pass("test_is_budget_device_type")
	else:
		_fail("test_is_budget_device_type", "is_budget_device should return bool")
	
	# Test is_mid_range_device returns boolean
	var is_mid = profiler.is_mid_range_device()
	if typeof(is_mid) == TYPE_BOOL:
		_pass("test_is_mid_range_device_type")
	else:
		_fail("test_is_mid_range_device_type", "is_mid_range_device should return bool")
	
	# Test get_device_tier returns valid enum value
	var tier = profiler.get_device_tier()
	if tier >= 0 and tier <= 2:
		_pass("test_device_tier_range")
	else:
		_fail("test_device_tier_range", "Device tier should be 0-2")
	
	profiler.queue_free()

func test_performance_targets() -> void:
	var profiler = _create_profiler()
	
	# Test get_performance_targets returns dictionary
	var targets = profiler.get_performance_targets()
	if typeof(targets) == TYPE_DICTIONARY:
		_pass("test_performance_targets_type")
	else:
		_fail("test_performance_targets_type", "get_performance_targets should return Dictionary")
	
	# Test required keys are present
	if targets.has("target_fps"):
		_pass("test_performance_targets_has_target_fps")
	else:
		_fail("test_performance_targets_has_target_fps", "Should have target_fps")
	
	if targets.has("min_acceptable_fps"):
		_pass("test_performance_targets_has_min_fps")
	else:
		_fail("test_performance_targets_has_min_fps", "Should have min_acceptable_fps")
	
	if targets.has("max_particles"):
		_pass("test_performance_targets_has_max_particles")
	else:
		_fail("test_performance_targets_has_max_particles", "Should have max_particles")
	
	if targets.has("shadow_quality"):
		_pass("test_performance_targets_has_shadow_quality")
	else:
		_fail("test_performance_targets_has_shadow_quality", "Should have shadow_quality")
	
	if targets.has("device_tier"):
		_pass("test_performance_targets_has_device_tier")
	else:
		_fail("test_performance_targets_has_device_tier", "Should have device_tier")
	
	# Test target_fps is valid
	var target_fps = targets.get("target_fps")
	if target_fps >= 30 and target_fps <= 60:
		_pass("test_target_fps_valid_range")
	else:
		_fail("test_target_fps_valid_range", "Target FPS should be between 30-60")
	
	profiler.queue_free()

func test_memory_tracking() -> void:
	var profiler = _create_profiler()
	
	# Test get_memory_usage_mb returns float
	var mem = profiler.get_memory_usage_mb()
	if typeof(mem) == TYPE_FLOAT:
		_pass("test_memory_usage_type")
	else:
		_fail("test_memory_usage_type", "get_memory_usage_mb should return float")
	
	# Test get_peak_memory_mb returns float
	var peak = profiler.get_peak_memory_mb()
	if typeof(peak) == TYPE_FLOAT:
		_pass("test_peak_memory_type")
	else:
		_fail("test_peak_memory_type", "get_peak_memory_mb should return float")
	
	# Test get_startup_memory_mb returns float
	var startup = profiler.get_startup_memory_mb()
	if typeof(startup) == TYPE_FLOAT:
		_pass("test_startup_memory_type")
	else:
		_fail("test_startup_memory_type", "get_startup_memory_mb should return float")
	
	# Test memory values are non-negative
	if mem >= 0:
		_pass("test_memory_non_negative")
	else:
		_fail("test_memory_non_negative", "Memory should be non-negative")
	
	profiler.queue_free()

func test_memory_leak_detection() -> void:
	var profiler = _create_profiler()
	
	# Test memory_leak_detected signal exists
	if profiler.has_signal("memory_leak_detected"):
		_pass("test_memory_leak_signal_exists")
	else:
		_fail("test_memory_leak_signal_exists", "Should have memory_leak_detected signal")
	
	# Test get_memory_leak_status returns dictionary
	var status = profiler.get_memory_leak_status()
	if typeof(status) == TYPE_DICTIONARY:
		_pass("test_memory_leak_status_type")
	else:
		_fail("test_memory_leak_status_type", "get_memory_leak_status should return Dictionary")
	
	# Test status has expected keys
	if status.has("leak_detected"):
		_pass("test_memory_leak_status_has_leak_detected")
	else:
		_fail("test_memory_leak_status_has_leak_detected", "Should have leak_detected key")
	
	if status.has("current_memory_mb"):
		_pass("test_memory_leak_status_has_current_memory")
	else:
		_fail("test_memory_leak_status_has_current_memory", "Should have current_memory_mb key")
	
	if status.has("memory_growth_mb"):
		_pass("test_memory_leak_status_has_memory_growth")
	else:
		_fail("test_memory_leak_status_has_memory_growth", "Should have memory_growth_mb key")
	
	if status.has("growth_rate_mb_per_min"):
		_pass("test_memory_leak_status_has_growth_rate")
	else:
		_fail("test_memory_leak_status_has_growth_rate", "Should have growth_rate_mb_per_min key")
	
	profiler.queue_free()

func test_memory_leak_status() -> void:
	var profiler = _create_profiler()
	
	# Test initial leak status shows not enough samples
	var status = profiler.get_memory_leak_status()
	
	# Should indicate not enough samples initially (web or insufficient samples)
	if status.has("reason") or status.has("leak_detected"):
		_pass("test_memory_leak_status_structure")
	else:
		_fail("test_memory_leak_status_structure", "Status should have reason or leak_detected")
	
	profiler.queue_free()

func test_memory_leak_reset() -> void:
	var profiler = _create_profiler()
	
	# Test reset_memory_leak_detection method exists and doesn't crash
	profiler.reset_memory_leak_detection()
	_pass("test_reset_memory_leak_detection")
	
	# Test status after reset
	var status = profiler.get_memory_leak_status()
	if status.has("leak_detected") and status.leak_detected == false:
		_pass("test_reset_clears_leak_status")
	else:
		_fail("test_reset_clears_leak_status", "Reset should clear leak status")
	
	profiler.queue_free()

func test_profiling_snapshot() -> void:
	var profiler = _create_profiler()
	
	# Test get_profiling_snapshot returns dictionary
	var snapshot = profiler.get_profiling_snapshot()
	if typeof(snapshot) == TYPE_DICTIONARY:
		_pass("test_profiling_snapshot_type")
	else:
		_fail("test_profiling_snapshot_type", "get_profiling_snapshot should return Dictionary")
	
	# Test required keys
	if snapshot.has("timestamp"):
		_pass("test_profiling_snapshot_has_timestamp")
	else:
		_fail("test_profiling_snapshot_has_timestamp", "Should have timestamp")
	
	if snapshot.has("current_fps"):
		_pass("test_profiling_snapshot_has_current_fps")
	else:
		_fail("test_profiling_snapshot_has_current_fps", "Should have current_fps")
	
	if snapshot.has("average_fps"):
		_pass("test_profiling_snapshot_has_average_fps")
	else:
		_fail("test_profiling_snapshot_has_average_fps", "Should have average_fps")
	
	if snapshot.has("frame_time_ms"):
		_pass("test_profiling_snapshot_has_frame_time")
	else:
		_fail("test_profiling_snapshot_has_frame_time", "Should have frame_time_ms")
	
	if snapshot.has("memory_current_mb"):
		_pass("test_profiling_snapshot_has_memory")
	else:
		_fail("test_profiling_snapshot_has_memory", "Should have memory_current_mb")
	
	if snapshot.has("device_tier"):
		_pass("test_profiling_snapshot_has_device_tier")
	else:
		_fail("test_profiling_snapshot_has_device_tier", "Should have device_tier")
	
	if snapshot.has("target_fps"):
		_pass("test_profiling_snapshot_has_target_fps")
	else:
		_fail("test_profiling_snapshot_has_target_fps", "Should have target_fps")
	
	# Test new memory leak fields
	if snapshot.has("memory_leak_detected"):
		_pass("test_profiling_snapshot_has_memory_leak")
	else:
		_fail("test_profiling_snapshot_has_memory_leak", "Should have memory_leak_detected")
	
	if snapshot.has("memory_growth_mb"):
		_pass("test_profiling_snapshot_has_memory_growth")
	else:
		_fail("test_profiling_snapshot_has_memory_growth", "Should have memory_growth_mb")
	
	if snapshot.has("memory_growth_rate_mb_per_min"):
		_pass("test_profiling_snapshot_has_memory_growth_rate")
	else:
		_fail("test_profiling_snapshot_has_memory_growth_rate", "Should have memory_growth_rate_mb_per_min")
	
	profiler.queue_free()

func test_set_target_fps() -> void:
	var profiler = _create_profiler()
	
	# Store original target
	var original_target = profiler.get_target_fps()
	
	# Test set_target_fps with valid value
	profiler.set_target_fps(45)
	if profiler.get_target_fps() == 45:
		_pass("test_set_target_fps_valid")
	else:
		_fail("test_set_target_fps_valid", "Should set target FPS to 45")
	
	# Test set_target_fps clamps to minimum
	profiler.set_target_fps(10)
	if profiler.get_target_fps() == profiler.BUDGET_MIN_FPS:
		_pass("test_set_target_fps_clamp_min")
	else:
		_fail("test_set_target_fps_clamp_min", "Should clamp to minimum FPS")
	
	# Test set_target_fps clamps to maximum
	profiler.set_target_fps(120)
	if profiler.get_target_fps() == profiler.FLAGSHIP_TARGET_FPS:
		_pass("test_set_target_fps_clamp_max")
	else:
		_fail("test_set_target_fps_clamp_max", "Should clamp to maximum FPS")
	
	# Restore original
	profiler.set_target_fps(original_target)
	
	profiler.queue_free()
