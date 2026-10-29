extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running PerformanceProfiler Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_initial_state()
	await test_device_tier_detection()
	await test_performance_targets()
	await test_memory_tracking()
	await test_memory_leak_detection()
	await test_memory_leak_status()
	await test_memory_leak_reset()
	await test_profiling_snapshot()
	await test_set_target_fps()
	await test_adaptive_quality_step_down()
	await test_adaptive_quality_step_up()
	await test_adaptive_quality_spike_immunity()
	await test_adaptive_quality_healthy_frames()
	await test_adaptive_quality_manual_override()
	await test_adaptive_quality_opt_out()

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

# --- Runtime Frame-Time Adaptation Tests (issue #1726) ---

## Create a profiler instance with a deterministic device tier.
## The real frame loop is disabled so only injected frame times are monitored.
func _create_adaptive_profiler(tier: int) -> Node:
	var profiler = load("res://autoloads/PerformanceProfiler.gd").new()
	add_child(profiler)
	# Deterministic tests: no real frames feed the monitor and no warm-up window.
	profiler.set_process(false)
	profiler.adaptive_warmup_samples = 0
	profiler.override_detected_device_tier(tier)
	return profiler

## Keep the real autoload monitor from touching the global FPS cap while the
## adaptive tests run.
func _disable_autoload_adaptive_monitor() -> void:
	var autoload = _get_autoload_profiler()
	if autoload != null and autoload.has_method("set_adaptive_quality_enabled"):
		autoload.set_adaptive_quality_enabled(false)

## Re-enable the real autoload monitor after the adaptive tests are done.
func _restore_autoload_adaptive_monitor() -> void:
	var autoload = _get_autoload_profiler()
	if autoload != null and autoload.has_method("set_adaptive_quality_enabled"):
		autoload.set_adaptive_quality_enabled(true)

## Get the PerformanceProfiler autoload instance (null outside a running tree)
func _get_autoload_profiler() -> Node:
	var tree := get_tree()
	if tree == null:
		return null
	return tree.root.get_node_or_null("PerformanceProfiler")

func test_adaptive_quality_step_down() -> void:
	_disable_autoload_adaptive_monitor()
	var original_max_fps = Engine.max_fps
	var profiler = _create_adaptive_profiler(0)  # simulate a flagship device

	var over_budget_ms = profiler.get_tier_budget_ms() * 2.0

	# The sustained window must be exhausted before anything changes.
	for _i in range(profiler.ADAPTIVE_DOWNSTEP_SAMPLES - 1):
		profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 0:
		_pass("test_adaptive_no_step_down_before_sustained_window")
	else:
		_fail("test_adaptive_no_step_down_before_sustained_window",
			"Tier changed before the sustained window elapsed")

	# The sustained overrun steps the quality down exactly one tier.
	profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 1:
		_pass("test_adaptive_step_down_after_sustained_overrun")
	else:
		_fail("test_adaptive_step_down_after_sustained_overrun",
			"Sustained overrun should step the tier down one step, got tier %d" % profiler.get_device_tier())

	# The tier settings (FPS cap, particle/effects caps) follow the new tier.
	if profiler.get_target_fps() == 45 and profiler.get_max_particles() == 75 and profiler.get_shadow_quality() == 1:
		_pass("test_adaptive_step_down_applies_tier_settings")
	else:
		_fail("test_adaptive_step_down_applies_tier_settings",
			"Mid-range tier settings were not applied")

	if Engine.max_fps == 45:
		_pass("test_adaptive_step_down_applies_fps_cap")
	else:
		_fail("test_adaptive_step_down_applies_fps_cap",
			"Engine.max_fps should be 45 after the step down, got %d" % Engine.max_fps)

	Engine.max_fps = original_max_fps
	profiler.queue_free()

func test_adaptive_quality_step_up() -> void:
	_disable_autoload_adaptive_monitor()
	var original_max_fps = Engine.max_fps
	var profiler = _create_adaptive_profiler(1)  # simulate a mid-range device

	# A sustained overrun pushes the device into the budget tier.
	var over_budget_ms = profiler.get_tier_budget_ms() * 2.0
	for _i in range(profiler.ADAPTIVE_DOWNSTEP_SAMPLES):
		profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 2:
		_pass("test_adaptive_step_down_to_budget_tier")
	else:
		_fail("test_adaptive_step_down_to_budget_tier",
			"Sustained overrun should reach the budget tier, got tier %d" % profiler.get_device_tier())

	# The device recovers: the frame times are back at the tier's target.
	var recovered = false
	for _i in range(600):
		var target_frame_ms = 1000.0 / float(max(profiler.get_target_fps(), 1))
		profiler.submit_frame_time_sample(target_frame_ms)
		if profiler.get_device_tier() == 1:
			recovered = true
			break
	if recovered:
		_pass("test_adaptive_step_up_after_sustained_recovery")
	else:
		_fail("test_adaptive_step_up_after_sustained_recovery",
			"Sustained recovery should step the tier back up")

	# The monitor never steps above the tier that was detected at boot.
	for _i in range(300):
		var target_frame_ms = 1000.0 / float(max(profiler.get_target_fps(), 1))
		profiler.submit_frame_time_sample(target_frame_ms)
	if profiler.get_device_tier() == 1:
		_pass("test_adaptive_never_steps_above_boot_tier")
	else:
		_fail("test_adaptive_never_steps_above_boot_tier",
			"The monitor must never step above the boot tier, got tier %d" % profiler.get_device_tier())

	Engine.max_fps = original_max_fps
	profiler.queue_free()

func test_adaptive_quality_spike_immunity() -> void:
	_disable_autoload_adaptive_monitor()
	var original_max_fps = Engine.max_fps
	var profiler = _create_adaptive_profiler(0)

	var healthy_ms = 1000.0 / float(max(profiler.get_target_fps(), 1))
	var spike_ms = profiler.get_tier_budget_ms() * 10.0

	# A single spike is ignored.
	profiler.submit_frame_time_sample(spike_ms)
	for _i in range(120):
		profiler.submit_frame_time_sample(healthy_ms)
	if profiler.get_device_tier() == 0:
		_pass("test_adaptive_single_spike_ignored")
	else:
		_fail("test_adaptive_single_spike_ignored",
			"A single slow frame must not change the quality tier")

	# Interleaved spikes are ignored as well.
	for _i in range(30):
		profiler.submit_frame_time_sample(spike_ms)
		profiler.submit_frame_time_sample(healthy_ms)
	if profiler.get_device_tier() == 0:
		_pass("test_adaptive_interleaved_spikes_ignored")
	else:
		_fail("test_adaptive_interleaved_spikes_ignored",
			"Interleaved slow frames must not change the quality tier")

	Engine.max_fps = original_max_fps
	profiler.queue_free()

func test_adaptive_quality_healthy_frames() -> void:
	_disable_autoload_adaptive_monitor()
	var original_max_fps = Engine.max_fps
	var profiler = _create_adaptive_profiler(0)

	var healthy_ms = 1000.0 / float(max(profiler.get_target_fps(), 1))
	for _i in range(300):
		profiler.submit_frame_time_sample(healthy_ms)

	# Healthy frame times keep the boot settings untouched.
	if profiler.get_device_tier() == 0 and profiler.get_target_fps() == 60 and profiler.get_max_particles() == 100:
		_pass("test_adaptive_healthy_frames_keep_boot_settings")
	else:
		_fail("test_adaptive_healthy_frames_keep_boot_settings",
			"Healthy frame times must not change the boot tier settings")

	Engine.max_fps = original_max_fps
	profiler.queue_free()

func test_adaptive_quality_manual_override() -> void:
	_disable_autoload_adaptive_monitor()
	var original_max_fps = Engine.max_fps
	var profiler = _create_adaptive_profiler(0)

	# The user picks a quality tier: the monitor must not fight that choice.
	profiler.set_quality_tier(0)
	if profiler.is_manual_quality_override_active() and not profiler.is_adaptive_quality_active():
		_pass("test_adaptive_manual_override_engaged")
	else:
		_fail("test_adaptive_manual_override_engaged",
			"A manual quality override should disable the automatic monitor")

	var over_budget_ms = profiler.get_tier_budget_ms() * 2.0
	for _i in range(300):
		profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 0 and profiler.get_target_fps() == 60:
		_pass("test_adaptive_manual_override_blocks_tier_changes")
	else:
		_fail("test_adaptive_manual_override_blocks_tier_changes",
			"The automatic monitor must not fight a manual quality choice")

	# Releasing the override hands control back to the monitor.
	profiler.set_manual_quality_override(false)
	if profiler.is_adaptive_quality_active():
		_pass("test_adaptive_manual_override_released")
	else:
		_fail("test_adaptive_manual_override_released",
			"Releasing the override should re-enable the automatic monitor")

	for _i in range(profiler.ADAPTIVE_DOWNSTEP_SAMPLES):
		profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 1:
		_pass("test_adaptive_resumes_after_override_released")
	else:
		_fail("test_adaptive_resumes_after_override_released",
			"The monitor should step down again once the override is released")

	Engine.max_fps = original_max_fps
	profiler.queue_free()

func test_adaptive_quality_opt_out() -> void:
	_disable_autoload_adaptive_monitor()
	var original_max_fps = Engine.max_fps
	var profiler = _create_adaptive_profiler(0)

	# The opt-out flag keeps the profiler completely passive.
	profiler.set_adaptive_quality_enabled(false)
	if not profiler.is_adaptive_quality_active():
		_pass("test_adaptive_opt_out_disables_monitor")
	else:
		_fail("test_adaptive_opt_out_disables_monitor",
			"set_adaptive_quality_enabled(false) should disable the automatic monitor")

	var over_budget_ms = profiler.get_tier_budget_ms() * 2.0
	for _i in range(300):
		profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 0:
		_pass("test_adaptive_opt_out_keeps_tier")
	else:
		_fail("test_adaptive_opt_out_keeps_tier",
			"The opt-out flag must keep the quality tier untouched")

	# Re-enabling the monitor makes it react to sustained overruns again.
	profiler.set_adaptive_quality_enabled(true)
	for _i in range(profiler.ADAPTIVE_DOWNSTEP_SAMPLES):
		profiler.submit_frame_time_sample(over_budget_ms)
	if profiler.get_device_tier() == 1:
		_pass("test_adaptive_reenabled_after_opt_out")
	else:
		_fail("test_adaptive_reenabled_after_opt_out",
			"The monitor should step down again after being re-enabled")

	_restore_autoload_adaptive_monitor()
	Engine.max_fps = original_max_fps
	profiler.queue_free()
