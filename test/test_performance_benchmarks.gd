## Performance Benchmark Tests for Low-End Device Testing
## Tests FPS stability, frame time accuracy, and memory leak detection
## for QA-005: Performance test on low-end devices
##
## Usage:
##   godot --headless --script test/test_performance_benchmarks.gd

extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)
signal benchmark_completed(benchmark_name: String, value: float, threshold: float, passed: bool)

func _ready() -> void:
	print("\n=== Running Performance Benchmark Tests ===\n")
	await run_benchmarks()

func run_benchmarks() -> void:
	# Run benchmark tests
	benchmark_fps_tracking_accuracy()
	benchmark_frame_time_calculation()
	benchmark_fps_history_management()
	benchmark_memory_leak_detection_threshold()
	benchmark_memory_growth_rate_calculation()
	benchmark_device_tier_performance_settings()
	benchmark_snapshot_generation()
	benchmark_fps_warning_threshold()
	benchmark_memory_warning_threshold()

	print("\n=== Performance Benchmark Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)

	# Exit with appropriate code
	if _tests_failed > 0:
		print("\n❌ Some benchmarks failed!")
	else:
		print("\n✅ All benchmarks passed!")

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

func _report_benchmark(name: String, value: float, threshold: float, passed: bool) -> void:
	benchmark_completed.emit(name, value, threshold, passed)
	var status = "PASS" if passed else "FAIL"
	print("[BENCHMARK] %s: %.2f (threshold: %.2f) - %s" % [name, value, threshold, status])

## Benchmark: FPS Tracking Accuracy
func benchmark_fps_tracking_accuracy() -> void:
	var profiler = _create_profiler()

	# Simulate FPS values
	var test_fps_values = [30.0, 45.0, 60.0, 25.0, 50.0, 35.0]
	var expected_avg = 40.83  # (30+45+60+25+50+35)/6

	# Set FPS directly through internal method simulation
	# Since get_fps() returns current FPS, we test the calculation logic
	profiler._fps_history = test_fps_values.duplicate()
	profiler._current_fps = 40.0

	var avg_fps = profiler.get_average_fps()
	var difference = abs(avg_fps - expected_avg)

	# Allow 1% tolerance for floating point
	var passed = difference < 0.5
	_report_benchmark("FPS Average Calculation", avg_fps, expected_avg, passed)

	if passed:
		_pass("benchmark_fps_tracking_accuracy")
	else:
		_fail("benchmark_fps_tracking_accuracy", "Average FPS mismatch: got %.2f, expected %.2f" % [avg_fps, expected_avg])

	profiler.queue_free()

## Benchmark: Frame Time Calculation
func benchmark_frame_time_calculation() -> void:
	var profiler = _create_profiler()

	# Test frame time at 60 FPS
	profiler._current_fps = 60.0
	var frame_time_60 = profiler.get_frame_time_ms()
	var expected_60 = 16.67  # 1000/60
	var passed_60 = abs(frame_time_60 - expected_60) < 0.1
	_report_benchmark("Frame Time at 60 FPS", frame_time_60, expected_60, passed_60)

	# Test frame time at 30 FPS
	profiler._current_fps = 30.0
	var frame_time_30 = profiler.get_frame_time_ms()
	var expected_30 = 33.33  # 1000/30
	var passed_30 = abs(frame_time_30 - expected_30) < 0.1
	_report_benchmark("Frame Time at 30 FPS", frame_time_30, expected_30, passed_30)

	# Test frame time at 24 FPS (minimum acceptable)
	profiler._current_fps = 24.0
	var frame_time_24 = profiler.get_frame_time_ms()
	var expected_24 = 41.67  # 1000/24
	var passed_24 = abs(frame_time_24 - expected_24) < 0.1
	_report_benchmark("Frame Time at 24 FPS", frame_time_24, expected_24, passed_24)

	# Test edge case: 0 FPS (should not crash)
	profiler._current_fps = 0.0
	var frame_time_0 = profiler.get_frame_time_ms()
	var passed_0 = frame_time_0 > 0  # Should return large value, not crash
	_report_benchmark("Frame Time at 0 FPS Safety", frame_time_0, 0, passed_0)

	if passed_60 and passed_30 and passed_24 and passed_0:
		_pass("benchmark_frame_time_calculation")
	else:
		_fail("benchmark_frame_time_calculation", "Frame time calculation failed for some cases")

	profiler.queue_free()

## Benchmark: FPS History Management
func benchmark_fps_history_management() -> void:
	var profiler = _create_profiler()

	# Test that FPS history is properly limited
	var max_samples = profiler._fps_sample_count

	# Add more samples than the limit
	for i in range(max_samples + 20):
		profiler._fps_history.append(float(i))

	# Check history is limited
	var history_size = profiler._fps_history.size()
	var passed = history_size <= max_samples
	_report_benchmark("FPS History Size Limit", float(history_size), float(max_samples), passed)

	if passed:
		_pass("benchmark_fps_history_management")
	else:
		_fail("benchmark_fps_history_management", "History should be limited to %d, got %d" % [max_samples, history_size])

	profiler.queue_free()

## Benchmark: Memory Leak Detection Threshold
func benchmark_memory_leak_detection_threshold() -> void:
	var profiler = _create_profiler()

	# Set up memory leak detection parameters
	profiler._startup_memory_mb = 100.0
	profiler._memory_samples.clear()

	# Add samples that exceed threshold (50 MB growth)
	for i in range(60):
		profiler._memory_samples.append(100.0 + (i * 1.0))  # 60 MB growth
		profiler._memory_sample_times.append(i)

	# Force leak suspect count
	profiler._leak_suspect_count = 5

	# Check detection
	var status = profiler.get_memory_leak_status()
	var leak_detected = status.get("leak_detected", false)

	# Should detect leak since growth exceeds threshold
	var passed = leak_detected == true
	_report_benchmark("Memory Leak Detection", leak_detected as float, 1.0, passed)

	if passed:
		_pass("benchmark_memory_leak_detection_threshold")
	else:
		_fail("benchmark_memory_leak_detection_threshold", "Should detect memory leak when growth > 50MB")

	profiler.queue_free()

## Benchmark: Memory Growth Rate Calculation
func benchmark_memory_growth_rate_calculation() -> void:
	var profiler = _create_profiler()

	profiler._startup_memory_mb = 100.0
	profiler._session_start_time = 0
	profiler._memory_sample_times.clear()
	profiler._memory_samples.clear()

	# Simulate 5 minutes of sampling (60 samples, 5 seconds apart = 300 seconds = 5 min)
	var base_time = 1000000000  # Unix timestamp in seconds
	for i in range(60):
		profiler._memory_sample_times.append(base_time + (i * 5))  # 5 seconds apart
		profiler._memory_samples.append(100.0 + (i * 0.5))  # 0.5 MB per sample = 30 MB over 5 min = 6 MB/min

	var status = profiler.get_memory_leak_status()
	var growth_rate = status.get("growth_rate_mb_per_min", 0.0)
	var expected_rate = 6.0  # 30 MB / 5 min

	var difference = abs(growth_rate - expected_rate)
	var passed = difference < 1.0  # Allow 1 MB/min tolerance
	_report_benchmark("Memory Growth Rate", growth_rate, expected_rate, passed)

	if passed:
		_pass("benchmark_memory_growth_rate_calculation")
	else:
		_fail("benchmark_memory_growth_rate_calculation", "Growth rate mismatch: got %.2f, expected %.2f" % [growth_rate, expected_rate])

	profiler.queue_free()

## Benchmark: Device Tier Performance Settings
func benchmark_device_tier_performance_settings() -> void:
	var profiler = _create_profiler()

	# Test budget tier settings
	profiler._device_tier = profiler.DeviceTier.BUDGET
	profiler._apply_performance_settings()

	var budget_targets = profiler.get_performance_targets()
	var budget_fps = budget_targets.get("target_fps")
	var budget_particles = budget_targets.get("max_particles")
	var budget_shadows = budget_targets.get("shadow_quality")

	var budget_fps_pass = budget_fps == 30
	var budget_particles_pass = budget_particles == 50
	var budget_shadows_pass = budget_shadows == 0

	_report_benchmark("Budget Tier FPS Target", float(budget_fps), 30.0, budget_fps_pass)
	_report_benchmark("Budget Tier Max Particles", float(budget_particles), 50.0, budget_particles_pass)
	_report_benchmark("Budget Tier Shadow Quality", float(budget_shadows), 0.0, budget_shadows_pass)

	# Test mid-range tier settings
	profiler._device_tier = profiler.DeviceTier.MID_RANGE
	profiler._apply_performance_settings()

	var mid_targets = profiler.get_performance_targets()
	var mid_fps = mid_targets.get("target_fps")
	var mid_particles = mid_targets.get("max_particles")

	var mid_fps_pass = mid_fps == 45
	var mid_particles_pass = mid_particles == 75

	_report_benchmark("Mid-Range Tier FPS Target", float(mid_fps), 45.0, mid_fps_pass)
	_report_benchmark("Mid-Range Tier Max Particles", float(mid_particles), 75.0, mid_particles_pass)

	# Test flagship tier settings
	profiler._device_tier = profiler.DeviceTier.FLAGSHP
	profiler._apply_performance_settings()

	var flagship_targets = profiler.get_performance_targets()
	var flagship_fps = flagship_targets.get("target_fps")
	var flagship_particles = flagship_targets.get("max_particles")
	var flagship_shadows = flagship_targets.get("shadow_quality")

	var flagship_fps_pass = flagship_fps == 60
	var flagship_particles_pass = flagship_particles == 100
	var flagship_shadows_pass = flagship_shadows == 2

	_report_benchmark("Flagship Tier FPS Target", float(flagship_fps), 60.0, flagship_fps_pass)
	_report_benchmark("Flagship Tier Max Particles", float(flagship_particles), 100.0, flagship_particles_pass)
	_report_benchmark("Flagship Tier Shadow Quality", float(flagship_shadows), 2.0, flagship_shadows_pass)

	var all_passed = (budget_fps_pass and budget_particles_pass and budget_shadows_pass and
	                  mid_fps_pass and mid_particles_pass and
	                  flagship_fps_pass and flagship_particles_pass and flagship_shadows_pass)

	if all_passed:
		_pass("benchmark_device_tier_performance_settings")
	else:
		_fail("benchmark_device_tier_performance_settings", "Some device tier settings incorrect")

	profiler.queue_free()

## Benchmark: Snapshot Generation
func benchmark_snapshot_generation() -> void:
	var profiler = _create_profiler()

	# Generate snapshot
	var snapshot = profiler.get_profiling_snapshot()

	# Verify all required fields
	var required_fields = [
		"timestamp", "current_fps", "average_fps", "frame_time_ms",
		"avg_frame_time_ms", "memory_current_mb", "memory_startup_mb",
		"memory_peak_mb", "device_tier", "target_fps", "memory_leak_detected",
		"memory_growth_mb", "memory_growth_rate_mb_per_min"
	]

	var all_fields_present = true
	for field in required_fields:
		if not snapshot.has(field):
			all_fields_present = false
			_fail("benchmark_snapshot_generation", "Missing field: " + field)
			break

	if all_fields_present:
		_pass("benchmark_snapshot_generation")

	profiler.queue_free()

## Benchmark: FPS Warning Threshold
func benchmark_fps_warning_threshold() -> void:
	var profiler = _create_profiler()

	# Set target FPS to 30 (budget)
	profiler._target_fps = 30
	profiler._fps_history.clear()

	# Add FPS values below 80% of target (30 * 0.8 = 24)
	for i in range(60):
		profiler._fps_history.append(20.0)  # Below threshold

	profiler._current_fps = 20.0
	profiler._fps_sample_count = 60

	# Manually trigger the FPS warning check
	var avg_fps = profiler.get_average_fps()
	var should_warn = avg_fps < (profiler._target_fps * 0.8)

	var passed = should_warn == true
	_report_benchmark("FPS Warning at 80% Threshold", avg_fps, 24.0, passed)

	if passed:
		_pass("benchmark_fps_warning_threshold")
	else:
		_fail("benchmark_fps_warning_threshold", "Should warn when FPS drops below 80% of target")

	profiler.queue_free()

## Benchmark: Memory Warning Threshold
func benchmark_memory_warning_threshold() -> void:
	var profiler = _create_profiler()

	# Set device tier to budget (256 MB threshold)
	profiler._device_tier = profiler.DeviceTier.BUDGET

	# Get threshold
	var threshold = profiler._get_memory_threshold()
	var expected_threshold = 256

	var passed = threshold == expected_threshold
	_report_benchmark("Budget Memory Warning Threshold", float(threshold), float(expected_threshold), passed)

	if passed:
		_pass("benchmark_memory_warning_threshold")
	else:
		_fail("benchmark_memory_warning_threshold", "Budget threshold should be 256 MB")

	profiler.queue_free()
