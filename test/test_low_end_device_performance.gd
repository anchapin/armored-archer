extends Node

## Low-End Device Performance Tests
## Tests performance characteristics specifically for budget devices
## Simulates low-end device conditions and verifies performance targets
##
## Budget device targets (from PERFORMANCE.md):
## - Target FPS: 30
## - Min FPS: 24
## - Memory: < 256MB
## - Max Particles: 50
## - Shadow Quality: Off

var _tests_passed: int = 0
var _tests_failed: int = 0
var _profiler: Node = null

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running Low-End Device Performance Tests ===\n")
	await run_tests()

func run_tests() -> void:
	_create_profiler()

	# Test budget device tier settings
	test_budget_device_tier_constants()
	test_budget_fps_targets()
	test_budget_memory_thresholds()
	test_budget_particle_limits()
	test_budget_shadow_quality()

	# Test performance under stress conditions
	test_frame_time_under_budget_load()
	test_memory_growth_detection()
	test_fps_drop_detection()

	# Test device simulation
	test_simulate_budget_device()
	test_simulate_mid_range_device()
	test_simulate_flagship_device()

	# Test performance optimization methods
	test_apply_budget_optimization()
	test_dynamic_performance_adjustment()

	# Cleanup
	if _profiler:
		_profiler.queue_free()

	print("\n=== Low-End Device Performance Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_profiler() -> void:
	_profiler = load("res://autoloads/PerformanceProfiler.gd").new()
	add_child(_profiler)

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

# --- Budget Device Tier Constants Tests ---

func test_budget_device_tier_constants() -> void:
	# Test BUDGET_MIN_FPS constant matches documentation
	if _profiler.BUDGET_MIN_FPS == 30:
		_pass("test_budget_min_fps_constant")
	else:
		_fail("test_budget_min_fps_constant", "BUDGET_MIN_FPS should be 30, got %d" % _profiler.BUDGET_MIN_FPS)

	# Test BUDGET_MEMORY_THRESHOLD matches documentation
	if _profiler.BUDGET_MEMORY_THRESHOLD == 256:
		_pass("test_budget_memory_threshold_constant")
	else:
		_fail("test_budget_memory_threshold_constant", "BUDGET_MEMORY_THRESHOLD should be 256, got %d" % _profiler.BUDGET_MEMORY_THRESHOLD)

	# Test MEMORY_LEAK_THRESHOLD_MB
	if _profiler.MEMORY_LEAK_THRESHOLD_MB == 50.0:
		_pass("test_memory_leak_threshold_constant")
	else:
		_fail("test_memory_leak_threshold_constant", "MEMORY_LEAK_THRESHOLD_MB should be 50.0")

	# Test MEMORY_GROWTH_RATE_THRESHOLD
	if _profiler.MEMORY_GROWTH_RATE_THRESHOLD == 10.0:
		_pass("test_memory_growth_rate_threshold_constant")
	else:
		_fail("test_memory_growth_rate_threshold_constant", "MEMORY_GROWTH_RATE_THRESHOLD should be 10.0")

# --- Budget FPS Targets Tests ---

func test_budget_fps_targets() -> void:
	# Force budget device tier for testing
	_profiler.set_target_fps(30)
	var target = _profiler.get_target_fps()

	if target == 30:
		_pass("test_budget_fps_target_set")
	else:
		_fail("test_budget_fps_target_set", "Target FPS should be 30, got %d" % target)

	# Test min acceptable FPS
	var targets = _profiler.get_performance_targets()
	if targets.get("min_acceptable_fps") == 30:
		_pass("test_min_acceptable_fps")
	else:
		_fail("test_min_acceptable_fps", "Min acceptable FPS should be 30")

	# Test target FPS clamping doesn't go below budget minimum
	_profiler.set_target_fps(20)  # Below budget minimum
	if _profiler.get_target_fps() == _profiler.BUDGET_MIN_FPS:
		_pass("test_fps_clamp_above_minimum")
	else:
		_fail("test_fps_clamp_above_minimum", "FPS should be clamped to minimum budget FPS")

# --- Budget Memory Thresholds Tests ---

func test_budget_memory_thresholds() -> void:
	# Test memory threshold for budget devices
	var threshold = _profiler.BUDGET_MEMORY_THRESHOLD

	if threshold <= 256:
		_pass("test_budget_memory_threshold_valid")
	else:
		_fail("test_budget_memory_threshold_valid", "Budget memory threshold should be <= 256MB")

	# Test mid-range threshold
	if _profiler.MID_RANGE_MEMORY_THRESHOLD == 512:
		_pass("test_mid_range_memory_threshold")
	else:
		_fail("test_mid_range_memory_threshold", "Mid-range threshold should be 512MB")

	# Test get_memory_usage returns non-negative
	var mem = _profiler.get_memory_usage_mb()
	if mem >= 0:
		_pass("test_memory_usage_non_negative")
	else:
		_fail("test_memory_usage_non_negative", "Memory usage should be non-negative")

# --- Budget Particle Limits Tests ---

func test_budget_particle_limits() -> void:
	# Test max particles for budget device
	var targets = _profiler.get_performance_targets()
	var max_particles = targets.get("max_particles", 0)

	# Budget devices should have max 50 particles
	if max_particles == 50:
		_pass("test_budget_max_particles")
	else:
		_fail("test_budget_max_particles", "Budget max particles should be 50, got %d" % max_particles)

	# Test get_max_particles method
	var particles = _profiler.get_max_particles()
	if particles > 0:
		_pass("test_get_max_particles")
	else:
		_fail("test_get_max_particles", "Max particles should be positive")

# --- Budget Shadow Quality Tests ---

func test_budget_shadow_quality() -> void:
	# Test shadow quality for budget device (should be off = 0)
	var shadow = _profiler.get_shadow_quality()

	if shadow == 0:
		_pass("test_budget_shadow_quality_off")
	else:
		_fail("test_budget_shadow_quality_off", "Budget shadow quality should be 0 (off), got %d" % shadow)

	# Test performance targets include shadow_quality
	var targets = _profiler.get_performance_targets()
	if targets.has("shadow_quality"):
		_pass("test_performance_targets_has_shadow_quality")
	else:
		_fail("test_performance_targets_has_shadow_quality", "Should have shadow_quality in targets")

# --- Frame Time Tests ---

func test_frame_time_under_budget_load() -> void:
	# Test frame time calculation at budget FPS (30 FPS)
	_profiler.set_target_fps(30)
	var frame_time = _profiler.get_frame_time_ms()

	# 30 FPS = 33.33ms per frame, allow some tolerance
	if frame_time >= 33.0 and frame_time <= 35.0:
		_pass("test_frame_time_at_30fps")
	else:
		_fail("test_frame_time_at_30fps", "Frame time at 30fps should be ~33ms, got %.2fms" % frame_time)

	# Test average frame time calculation
	var avg_frame_time = _profiler.get_average_frame_time_ms()
	if avg_frame_time > 0:
		_pass("test_average_frame_time_calculation")
	else:
		_fail("test_average_frame_time_calculation", "Average frame time should be positive")

# --- Memory Growth Detection Tests ---

func test_memory_growth_detection() -> void:
	# Reset memory leak detection for clean test
	_profiler.reset_memory_leak_detection()

	# Test initial memory leak status structure
	var status = _profiler.get_memory_leak_status()

	if status.has("leak_detected"):
		_pass("test_memory_leak_status_structure")
	else:
		_fail("test_memory_leak_status_structure", "Status should have leak_detected key")

	if status.has("memory_growth_mb"):
		_pass("test_memory_leak_status_has_growth")
	else:
		_fail("test_memory_leak_status_has_growth", "Status should have memory_growth_mb")

	if status.has("growth_rate_mb_per_min"):
		_pass("test_memory_leak_status_has_growth_rate")
	else:
		_fail("test_memory_leak_status_has_growth_rate", "Status should have growth_rate_mb_per_min")

	if status.has("sample_count"):
		_pass("test_memory_leak_status_has_sample_count")
	else:
		_fail("test_memory_leak_status_has_sample_count", "Status should have sample_count")

# --- FPS Drop Detection Tests ---

func test_fps_drop_detection() -> void:
	# Test that fps_dropped signal exists
	if _profiler.has_signal("fps_dropped"):
		_pass("test_fps_dropped_signal_exists")
	else:
		_fail("test_fps_dropped_signal_exists", "Should have fps_dropped signal")

	# Test memory_warning signal exists
	if _profiler.has_signal("memory_warning"):
		_pass("test_memory_warning_signal_exists")
	else:
		_fail("test_memory_warning_signal_exists", "Should have memory_warning signal")

	# Test device_tier_detected signal exists
	if _profiler.has_signal("device_tier_detected"):
		_pass("test_device_tier_detected_signal_exists")
	else:
		_fail("test_device_tier_detected_signal_exists", "Should have device_tier_detected signal")

# --- Device Simulation Tests ---

func test_simulate_budget_device() -> void:
	# Test is_budget_device method
	var is_budget = _profiler.is_budget_device()
	if typeof(is_budget) == TYPE_BOOL:
		_pass("test_is_budget_device_returns_bool")
	else:
		_fail("test_is_budget_device_returns_bool", "is_budget_device should return bool")

	# Test device tier value is in valid range
	var tier = _profiler.get_device_tier()
	if tier >= 0 and tier <= 2:
		_pass("test_device_tier_valid_range")
	else:
		_fail("test_device_tier_valid_range", "Device tier should be 0-2")

func test_simulate_mid_range_device() -> void:
	# Test is_mid_range_device method
	var is_mid = _profiler.is_mid_range_device()
	if typeof(is_mid) == TYPE_BOOL:
		_pass("test_is_mid_range_device_returns_bool")
	else:
		_fail("test_is_mid_range_device_returns_bool", "is_mid_range_device should return bool")

func test_simulate_flagship_device() -> void:
	# Test flagship device settings via performance targets
	var targets = _profiler.get_performance_targets()

	# Verify device_tier is in the targets
	if targets.has("device_tier"):
		_pass("test_device_tier_in_targets")
	else:
		_fail("test_device_tier_in_targets", "Device tier should be in performance targets")

# --- Performance Optimization Tests ---

func test_apply_budget_optimization() -> void:
	# Test reset_performance_settings method exists
	if _profiler.has_method("reset_performance_settings"):
		_pass("test_reset_performance_settings_method_exists")
	else:
		_fail("test_reset_performance_settings_method_exists", "Should have reset_performance_settings method")

	# Test set_vsync_enabled method exists
	if _profiler.has_method("set_vsync_enabled"):
		_pass("test_set_vsync_enabled_method_exists")
	else:
		_fail("test_set_vsync_enabled_method_exists", "Should have set_vsync_enabled method")

func test_dynamic_performance_adjustment() -> void:
	# Test set_target_fps dynamically
	var original = _profiler.get_target_fps()

	_profiler.set_target_fps(24)  # Below budget minimum
	var clamped = _profiler.get_target_fps()

	# Should clamp to BUDGET_MIN_FPS (30)
	if clamped >= 30:
		_pass("test_dynamic_fps_clamping")
	else:
		_fail("test_dynamic_fps_clamping", "FPS should be clamped to minimum 30")

	# Restore original
	_profiler.set_target_fps(original)

	# Test profiling snapshot includes all budget device metrics
	var snapshot = _profiler.get_profiling_snapshot()

	if snapshot.has("device_tier"):
		_pass("test_snapshot_has_device_tier")
	else:
		_fail("test_snapshot_has_device_tier", "Snapshot should have device_tier")

	if snapshot.has("target_fps"):
		_pass("test_snapshot_has_target_fps")
	else:
		_fail("test_snapshot_has_target_fps", "Snapshot should have target_fps")

	if snapshot.has("memory_leak_detected"):
		_pass("test_snapshot_has_memory_leak_detected")
	else:
		_fail("test_snapshot_has_memory_leak_detected", "Snapshot should have memory_leak_detected")
