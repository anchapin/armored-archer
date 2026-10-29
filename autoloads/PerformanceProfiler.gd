## Performance Profiler and Budget Device Optimizer
## Tracks FPS, memory usage, and provides device capability detection
## for optimizing the game on budget devices like Moto G7 and iPhone SE
##
## Usage:
##   PerformanceProfiler.get_fps() - Get current FPS
##   PerformanceProfiler.get_memory_usage() - Get current memory in MB
##   PerformanceProfiler.get_device_tier() - Get device tier (flagship, mid_range, budget)
##   PerformanceProfiler.is_budget_device() - Check if running on budget device
##   PerformanceProfiler.get_performance_targets() - Get FPS targets for current device
##   PerformanceProfiler.export_snapshot_json() - Snapshot as JSON (benchmark gate / telemetry)
##
## Runtime frame-time adaptation (issue #1726):
## The boot tier is picked once from the device CPU/RAM. During a long session a
## heating/throttling phone can no longer hold that tier, so a rolling frame-time
## monitor watches the real frame times and steps the quality tier DOWN one step
## at a time after a sustained overrun, and back UP after a sustained recovery.
## The monitor never steps above the boot tier and never fights a manual
## quality choice (see set_quality_tier / set_manual_quality_override).
##
extends Node

# --- Performance Targets ---
## Target FPS for flagship devices
const FLAGSHIP_TARGET_FPS: int = 60
## Minimum acceptable FPS for budget devices
const BUDGET_MIN_FPS: int = 30

## Memory thresholds in MB
const BUDGET_MEMORY_THRESHOLD: int = 256  # Devices with < 256MB available RAM
const MID_RANGE_MEMORY_THRESHOLD: int = 512  # Devices with < 512MB available RAM

# --- Memory Leak Detection ---
## Memory leak detection threshold in MB
const MEMORY_LEAK_THRESHOLD_MB: float = 50.0
## Memory growth rate threshold in MB per minute
const MEMORY_GROWTH_RATE_THRESHOLD: float = 10.0
## Number of samples needed for leak detection
const MEMORY_LEAK_SAMPLE_COUNT: int = 60

# --- Runtime Frame-Time Adaptation (issue #1726) ---
## Consecutive over-budget frames required before the quality tier steps down
const ADAPTIVE_DOWNSTEP_SAMPLES: int = 60
## Consecutive comfortably-under-budget frames required before stepping back up
const ADAPTIVE_UPSTEP_SAMPLES: int = 60
## Minimum number of seconds between two quality tier changes (hysteresis)
const ADAPTIVE_TIER_COOLDOWN_SECONDS: float = 5.0
## A frame time may exceed the tier budget by this factor before it counts as an overrun
const ADAPTIVE_DEGRADE_TOLERANCE: float = 1.4
## A frame time at or below this factor of the tier budget counts as recovered
const ADAPTIVE_RECOVERY_TOLERANCE: float = 1.05

# --- Performance Settings ---
var _target_fps: int = FLAGSHIP_TARGET_FPS
var _vsync_enabled: bool = true
var _max_particles: int = 100
var _shadow_quality: int = 2  # 0=off, 1=low, 2=high
var _texture_compression: bool = true

# --- Monitoring State ---
var _fps_history: Array[float] = []
var _fps_sample_count: int = 60  # Average over 60 frames
var _current_fps: float = 60.0
var _frame_time_history: Array[float] = []
var _average_frame_time: float = 16.67  # ms

# --- Memory Tracking ---
var _startup_memory_mb: float = 0.0
var _peak_memory_mb: float = 0.0

# --- Memory Leak Detection State ---
var _memory_samples: Array[float] = []
var _memory_sample_times: Array[int] = []  # Unix timestamps in seconds
var _leak_detection_enabled: bool = true
var _leak_suspect_count: int = 0  # Consecutive samples above threshold
var _session_start_time: int = 0

# --- Device Tier ---
enum DeviceTier { FLAGSHP, MID_RANGE, BUDGET }
var _device_tier: DeviceTier = DeviceTier.FLAGSHP

# --- Runtime Frame-Time Adaptation State (issue #1726) ---
## Tier detected at boot - the adaptive monitor never steps above it
var _boot_tier: DeviceTier = DeviceTier.FLAGSHP
## Engine FPS cap that was active before the profiler applied tier settings
var _boot_engine_max_fps: int = 0
## Master switch for the automatic frame-time monitor (opt-out flag)
var _adaptive_quality_enabled: bool = true
## True while the user has pinned the quality tier manually
var _manual_quality_override: bool = false
## Consecutive frames that exceeded the current tier budget
var _over_budget_streak: int = 0
## Consecutive frames that were comfortably under the current tier budget
var _recovery_streak: int = 0
## Simulated seconds of monitored runtime (drives the tier change cooldown)
var _adaptive_clock: float = 0.0
## Monitor time of the last quality tier change
var _last_tier_change_time: float = 0.0
## Number of frame-time samples seen so far
var _adaptive_sample_count: int = 0
## Samples ignored after start-up so loading spikes never degrade the quality tier
var adaptive_warmup_samples: int = 90

# --- Signals ---
## Emitted when FPS drops below target
signal fps_dropped(current_fps: float, target_fps: int)
## Emitted when memory usage is high
signal memory_warning(current_mb: float, threshold_mb: int)
## Emitted when device tier is determined
signal device_tier_detected(tier: DeviceTier)
## Emitted when memory leak is detected
signal memory_leak_detected(current_mb: float, growth_mb: float, rate_mb_per_min: float)
## Emitted when the effective quality tier changes ("degraded", "recovered" or "manual")
signal quality_tier_changed(tier: DeviceTier, reason: String)

func _ready() -> void:
	_initialize_profiler()

func _initialize_profiler() -> void:
	# Get initial memory
	_startup_memory_mb = _get_memory_usage_mb()
	_peak_memory_mb = _startup_memory_mb

	# Remember the FPS cap that was active before tier settings were applied so
	# the flagship tier can restore it when the adaptive monitor steps back up.
	_boot_engine_max_fps = Engine.max_fps

	# Initialize session start time for leak detection
	_session_start_time = Time.get_unix_time_from_system()

	# Detect device tier
	_detect_device_tier()
	_boot_tier = _device_tier

	# Apply performance settings based on device tier
	_apply_performance_settings()

	# Start the runtime frame-time monitor with a clean slate
	_reset_adaptive_tracking()

func _process(delta: float) -> void:
	# Update FPS tracking
	var current_fps = Engine.get_frames_per_second()
	_update_fps_tracking(current_fps)

	# Feed the runtime frame-time monitor (issue #1726)
	submit_frame_time_sample(delta * 1000.0)

	# Update memory tracking
	var current_memory = _get_memory_usage_mb()
	if current_memory > _peak_memory_mb:
		_peak_memory_mb = current_memory

	# Sample memory for leak detection (every 60 frames)
	if _leak_detection_enabled and Engine.get_frames_drawn() % 60 == 0:
		_sample_memory_for_leak_detection(current_memory)

	# Check for performance issues
	_check_performance_warnings()

func _update_fps_tracking(current_fps: float) -> void:
	_current_fps = current_fps
	_fps_history.append(current_fps)

	if _fps_history.size() > _fps_sample_count:
		_fps_history.pop_front()

	# Calculate average FPS
	var sum: float = 0.0
	for fps in _fps_history:
		sum += fps
	var avg_fps = sum / _fps_history.size()

	# Emit warning if FPS drops significantly
	if avg_fps < _target_fps * 0.8 and _fps_history.size() >= _fps_sample_count:
		fps_dropped.emit(avg_fps, _target_fps)

func _check_performance_warnings() -> void:
	# Memory warning check
	var current_memory = _get_memory_usage_mb()
	var memory_threshold = _get_memory_threshold()

	if current_memory > memory_threshold:
		memory_warning.emit(current_memory, memory_threshold)

	# Memory leak detection check
	if _leak_detection_enabled and _memory_samples.size() >= MEMORY_LEAK_SAMPLE_COUNT:
		_check_memory_leak()

func _sample_memory_for_leak_detection(current_memory: float) -> void:
	_memory_samples.append(current_memory)
	_memory_sample_times.append(Time.get_unix_time_from_system())

	# Keep only recent samples
	if _memory_samples.size() > MEMORY_LEAK_SAMPLE_COUNT + 10:
		_memory_samples.pop_front()
		_memory_sample_times.pop_front()

func _check_memory_leak() -> void:
	if _memory_samples.size() < MEMORY_LEAK_SAMPLE_COUNT:
		return

	var current_memory = _memory_samples.back()
	var memory_growth = current_memory - _startup_memory_mb

	# Calculate growth rate if we have enough time data
	var session_duration_min: float = 0.0
	if _memory_sample_times.size() >= 2:
		var first_time = _memory_sample_times.front()
		var last_time = _memory_sample_times.back()
		var duration_seconds = last_time - first_time
		session_duration_min = duration_seconds / 60.0

	var growth_rate: float = 0.0
	if session_duration_min > 0:
		growth_rate = memory_growth / session_duration_min

	# Check if memory growth exceeds threshold
	if memory_growth > MEMORY_LEAK_THRESHOLD_MB:
		_leak_suspect_count += 1

		# If sustained growth, emit leak signal
		if _leak_suspect_count >= 5:
			memory_leak_detected.emit(current_memory, memory_growth, growth_rate)
	else:
		_leak_suspect_count = 0


func _get_memory_usage_mb() -> float:
	if OS.has_feature("web"):
		return 0.0
	var static_mem: float = Performance.get_monitor(Performance.MEMORY_STATIC)
	return static_mem / (1024.0 * 1024.0)

func _get_memory_threshold() -> int:
	match _device_tier:
		DeviceTier.BUDGET:
			return BUDGET_MEMORY_THRESHOLD
		DeviceTier.MID_RANGE:
			return MID_RANGE_MEMORY_THRESHOLD
		_:
			return 1024  # High threshold for flagship

func _detect_device_tier() -> void:
	# Check for budget device indicators
	var is_mobile = OS.has_feature("mobile")
	var is_web = OS.has_feature("web")

	# Get available RAM (if available)
	var available_ram_mb: float = 0.0

	# Also check processor info
	var processor_count = OS.get_processor_count()

	# Determine tier
	if is_mobile or not OS.has_feature("desktop"):
		# Mobile device - likely budget or mid-range
		if processor_count <= 2 or available_ram_mb < 512:
			_device_tier = DeviceTier.BUDGET
		elif processor_count <= 4 or available_ram_mb < 1024:
			_device_tier = DeviceTier.MID_RANGE
		else:
			_device_tier = DeviceTier.FLAGSHP
	else:
		# Desktop or other - assume flagship
		_device_tier = DeviceTier.FLAGSHP

	device_tier_detected.emit(_device_tier)

func _apply_performance_settings() -> void:
	_apply_tier_settings(_device_tier)

## Apply the quality settings of a tier (FPS cap, particle/effects caps).
## This is the single source of truth for the tier settings, used by the boot
## path and by the runtime frame-time monitor.
func _apply_tier_settings(tier: DeviceTier) -> void:
	match tier:
		DeviceTier.BUDGET:
			_target_fps = BUDGET_MIN_FPS
			_max_particles = 50
			_shadow_quality = 0
			_texture_compression = true
			Engine.max_fps = BUDGET_MIN_FPS
		DeviceTier.MID_RANGE:
			_target_fps = 45
			_max_particles = 75
			_shadow_quality = 1
			_texture_compression = true
			Engine.max_fps = 45
		DeviceTier.FLAGSHP:
			_target_fps = FLAGSHIP_TARGET_FPS
			_max_particles = 100
			_shadow_quality = 2
			_texture_compression = true
			# VSync enabled by default for flagship.
			# The flagship tier keeps the FPS cap that was active before the
			# profiler applied any tier settings.
			Engine.max_fps = _boot_engine_max_fps

## Map a tier index (0 = flagship, 1 = mid-range, 2 = budget) to a tier
func _tier_from_index(index: int) -> DeviceTier:
	match index:
		0:
			return DeviceTier.FLAGSHP
		1:
			return DeviceTier.MID_RANGE
		_:
			return DeviceTier.BUDGET

func _get_tier_name() -> String:
	match _device_tier:
		DeviceTier.BUDGET:
			return "Budget"
		DeviceTier.MID_RANGE:
			return "Mid-Range"
		_:
			return "Flagship"

# --- Runtime Frame-Time Adaptation Internals (issue #1726) ---

## Decide whether the sustained frame-time trends justify a tier change.
## A step down needs ADAPTIVE_DOWNSTEP_SAMPLES consecutive over-budget frames,
## a step up needs ADAPTIVE_UPSTEP_SAMPLES consecutive recovered frames and
## both are gated by the tier change cooldown so the tier cannot oscillate.
func _evaluate_adaptive_quality() -> void:
	if not is_adaptive_quality_active():
		return

	# Hysteresis: wait for the cooldown before changing the tier again.
	if get_adaptive_cooldown_remaining() > 0.0:
		return

	if _over_budget_streak >= ADAPTIVE_DOWNSTEP_SAMPLES:
		# Already at the lowest tier - nothing left to give up.
		if int(_device_tier) >= int(DeviceTier.BUDGET):
			return
		_apply_adaptive_tier(_tier_from_index(int(_device_tier) + 1), "degraded")
	elif _recovery_streak >= ADAPTIVE_UPSTEP_SAMPLES:
		# Never step above the tier that was detected at boot.
		if int(_device_tier) <= int(_boot_tier):
			return
		_apply_adaptive_tier(_tier_from_index(int(_device_tier) - 1), "recovered")

## Switch to a new quality tier and apply its settings
func _apply_adaptive_tier(tier: DeviceTier, reason: String) -> void:
	_device_tier = tier
	_apply_tier_settings(tier)
	_over_budget_streak = 0
	_recovery_streak = 0
	_last_tier_change_time = _adaptive_clock
	quality_tier_changed.emit(tier, reason)

## Clear the sustained frame-time counters and the tier change cooldown
func _reset_adaptive_tracking() -> void:
	_over_budget_streak = 0
	_recovery_streak = 0
	# The cooldown only applies between two tier changes, so the first change
	# is allowed as soon as the sustained window is reached.
	_last_tier_change_time = _adaptive_clock - ADAPTIVE_TIER_COOLDOWN_SECONDS

# --- Public API ---

## Get current FPS
func get_fps() -> float:
	return _current_fps

## Get average FPS over sample period
func get_average_fps() -> float:
	if _fps_history.is_empty():
		return _current_fps

	var sum: float = 0.0
	for fps in _fps_history:
		sum += fps
	return sum / _fps_history.size()

## Get current frame time in milliseconds
func get_frame_time_ms() -> float:
	return 1000.0 / max(_current_fps, 1.0)

## Get average frame time in milliseconds
func get_average_frame_time_ms() -> float:
	var avg_fps = get_average_fps()
	return 1000.0 / max(avg_fps, 1.0)

## Get current memory usage in MB
func get_memory_usage_mb() -> float:
	return _get_memory_usage_mb()

## Get peak memory usage in MB since startup
func get_peak_memory_mb() -> float:
	return _peak_memory_mb

## Get startup memory in MB
func get_startup_memory_mb() -> float:
	return _startup_memory_mb

## Get device tier (0=Flagship, 1=Mid-Range, 2=Budget)
func get_device_tier() -> int:
	return _device_tier

## Get the tier that was detected at boot (the adaptive monitor never steps above it)
func get_boot_device_tier() -> int:
	return int(_boot_tier)

## Check if running on budget device
func is_budget_device() -> bool:
	return _device_tier == DeviceTier.BUDGET

## Check if running on mid-range device
func is_mid_range_device() -> bool:
	return _device_tier == DeviceTier.MID_RANGE

## Get target FPS for current device
func get_target_fps() -> int:
	return _target_fps

## Get maximum particles allowed for current device
func get_max_particles() -> int:
	return _max_particles

## Get shadow quality setting (0=off, 1=low, 2=high)
func get_shadow_quality() -> int:
	return _shadow_quality

## Get performance targets as dictionary
func get_performance_targets() -> Dictionary:
	return {
		"target_fps": _target_fps,
		"min_acceptable_fps": BUDGET_MIN_FPS,
		"max_particles": _max_particles,
		"shadow_quality": _shadow_quality,
		"texture_compression": _texture_compression,
		"device_tier": _get_tier_name()
	}

## Get profiling snapshot for testing
## Call this at specific points (startup, after 10-min PvE, after 5 matches)
func get_profiling_snapshot() -> Dictionary:
	var leak_status = get_memory_leak_status()
	return {
		"timestamp": Time.get_unix_time_from_system(),
		"current_fps": _current_fps,
		"average_fps": get_average_fps(),
		"frame_time_ms": get_frame_time_ms(),
		"avg_frame_time_ms": get_average_frame_time_ms(),
		"memory_current_mb": get_memory_usage_mb(),
		"memory_startup_mb": _startup_memory_mb,
		"memory_peak_mb": _peak_memory_mb,
		"device_tier": _get_tier_name(),
		"target_fps": _target_fps,
		"memory_leak_detected": leak_status.get("leak_detected", false),
		"memory_growth_mb": leak_status.get("memory_growth_mb", 0.0),
		"memory_growth_rate_mb_per_min": leak_status.get("growth_rate_mb_per_min", 0.0)
	}

## Log profiling snapshot to console (for debugging)
func log_profiling_snapshot(label: String) -> void:
	var snapshot = get_profiling_snapshot()
	print("[PerformanceProfiler] %s - FPS: %.1f (avg: %.1f), Frame: %.2fms, Memory: %.1fMB (peak: %.1fMB), Tier: %s" %
		[label, snapshot.current_fps, snapshot.average_fps, snapshot.avg_frame_time_ms,
		 snapshot.memory_current_mb, snapshot.memory_peak_mb, snapshot.device_tier])

## Set target FPS (can be used for dynamic performance adjustment)
## This counts as an explicit quality choice, so the automatic frame-time
## monitor stops adjusting the quality tier until the override is cleared.
func set_target_fps(fps: int) -> void:
	_target_fps = clamp(fps, BUDGET_MIN_FPS, FLAGSHIP_TARGET_FPS)
	Engine.max_fps = _target_fps
	_manual_quality_override = true

## Enable/disable VSync
func set_vsync_enabled(enabled: bool) -> void:
	_vsync_enabled = enabled
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if enabled else DisplayServer.VSYNC_DISABLED)

## Reset performance settings to defaults based on the tier detected at boot.
## Also clears a manual quality override so the automatic monitor takes over again.
func reset_performance_settings() -> void:
	_device_tier = _boot_tier
	_manual_quality_override = false
	_apply_performance_settings()
	_reset_adaptive_tracking()

# --- Runtime Frame-Time Adaptation API (issue #1726) ---

## Feed a frame time (milliseconds) to the runtime quality monitor.
## The engine feeds the real frame time every frame; automated tests inject
## synthetic frame times through this same seam.
func submit_frame_time_sample(frame_time_ms: float) -> void:
	if frame_time_ms <= 0.0:
		return

	_adaptive_clock += frame_time_ms / 1000.0
	_adaptive_sample_count += 1

	# The monitor stays inert while it is disabled or while the user pinned the
	# quality tier manually.
	if not is_adaptive_quality_active():
		return

	# Ignore the warm-up window: loading a stage can produce slow frames that
	# must not degrade the quality tier.
	if _adaptive_sample_count <= adaptive_warmup_samples:
		_over_budget_streak = 0
		_recovery_streak = 0
		return

	var budget_ms: float = get_tier_budget_ms()
	var recovery_ms: float = get_tier_recovery_ms()

	if frame_time_ms > budget_ms:
		_over_budget_streak += 1
		_recovery_streak = 0
	elif frame_time_ms <= recovery_ms:
		_recovery_streak += 1
		_over_budget_streak = 0
	else:
		# Ambiguous band: neither an overrun nor a clear recovery.
		_over_budget_streak = 0
		_recovery_streak = 0

	_evaluate_adaptive_quality()

## Frame-time budget (ms) of the current tier before an overrun is counted
func get_tier_budget_ms() -> float:
	return (1000.0 / float(max(_target_fps, 1))) * ADAPTIVE_DEGRADE_TOLERANCE

## Frame time (ms) at or below which the current tier counts as recovered
func get_tier_recovery_ms() -> float:
	return (1000.0 / float(max(_target_fps, 1))) * ADAPTIVE_RECOVERY_TOLERANCE

## True when the automatic frame-time monitor may change the quality tier
func is_adaptive_quality_active() -> bool:
	return _adaptive_quality_enabled and not _manual_quality_override

## Enable or disable the automatic frame-time monitor (opt-out flag).
## Disabling it keeps the current quality tier untouched.
func set_adaptive_quality_enabled(enabled: bool) -> void:
	_adaptive_quality_enabled = enabled
	if not enabled:
		_reset_adaptive_tracking()

## True while the user has pinned the quality tier manually
func is_manual_quality_override_active() -> bool:
	return _manual_quality_override

## Pin (true) or release (false) the manual quality override.
## While pinned, the automatic monitor never changes the quality tier.
func set_manual_quality_override(enabled: bool) -> void:
	_manual_quality_override = enabled
	if not enabled:
		# Hand control back to the automatic monitor, restarting from the boot tier.
		_device_tier = _boot_tier
		_apply_performance_settings()
	_reset_adaptive_tracking()

## Apply a quality tier chosen by the user and pin it, so the automatic
## frame-time monitor never fights the manual choice.
func set_quality_tier(tier: int) -> void:
	var index: int = clampi(tier, int(DeviceTier.FLAGSHP), int(DeviceTier.BUDGET))
	_manual_quality_override = true
	_device_tier = _tier_from_index(index)
	_apply_tier_settings(_device_tier)
	_reset_adaptive_tracking()
	quality_tier_changed.emit(_device_tier, "manual")

## Seconds remaining before the monitor may change the quality tier again
func get_adaptive_cooldown_remaining() -> float:
	return maxf(0.0, _last_tier_change_time + ADAPTIVE_TIER_COOLDOWN_SECONDS - _adaptive_clock)

## Snapshot of the runtime frame-time monitor (diagnostics / telemetry)
func get_adaptive_status() -> Dictionary:
	return {
		"enabled": _adaptive_quality_enabled,
		"manual_override": _manual_quality_override,
		"active": is_adaptive_quality_active(),
		"current_tier": int(_device_tier),
		"boot_tier": int(_boot_tier),
		"over_budget_streak": _over_budget_streak,
		"recovery_streak": _recovery_streak,
		"cooldown_remaining": get_adaptive_cooldown_remaining(),
		"budget_ms": get_tier_budget_ms(),
		"recovery_ms": get_tier_recovery_ms(),
	}

## Testing / QA hook: simulate a device tier on any host.
## The simulated tier also becomes the tier the monitor is not allowed to
## step above, so the runtime behaviour can be reproduced deterministically.
func override_detected_device_tier(tier: int) -> void:
	var index: int = clampi(tier, int(DeviceTier.FLAGSHP), int(DeviceTier.BUDGET))
	_boot_tier = _tier_from_index(index)
	_device_tier = _boot_tier
	_apply_performance_settings()
	_adaptive_sample_count = 0
	_reset_adaptive_tracking()

## Get memory leak detection status
## Returns: Dictionary with leak_detected, current_memory_mb, memory_growth_mb, growth_rate_mb_per_min
func get_memory_leak_status() -> Dictionary:
	var current_memory = _get_memory_usage_mb()
	var memory_growth = current_memory - _startup_memory_mb

	# Calculate growth rate
	var growth_rate: float = 0.0
	var session_duration_min: float = 0.0

	if _memory_sample_times.size() >= 2 and _session_start_time > 0:
		var last_time = _memory_sample_times.back()
		var duration_seconds = last_time - _session_start_time
		session_duration_min = duration_seconds / 60.0

	if session_duration_min > 0:
		growth_rate = memory_growth / session_duration_min

	# Determine if leak detected
	var leak_detected = false
	var reason = ""

	if OS.has_feature("web"):
		reason = "Web platform - memory detection not supported"
	elif _memory_samples.size() < MEMORY_LEAK_SAMPLE_COUNT:
		reason = "Insufficient samples (%d/%d)" % [_memory_samples.size(), MEMORY_LEAK_SAMPLE_COUNT]
	elif _leak_suspect_count >= 5:
		leak_detected = true
		reason = "Sustained memory growth detected"
	elif memory_growth > MEMORY_LEAK_THRESHOLD_MB:
		reason = "Memory growth exceeds threshold (%.1f > %.1f MB)" % [memory_growth, MEMORY_LEAK_THRESHOLD_MB]
	elif growth_rate > MEMORY_GROWTH_RATE_THRESHOLD:
		reason = "Growth rate exceeds threshold (%.1f > %.1f MB/min)" % [growth_rate, MEMORY_GROWTH_RATE_THRESHOLD]
	else:
		reason = "No leak detected"

	return {
		"leak_detected": leak_detected,
		"current_memory_mb": current_memory,
		"startup_memory_mb": _startup_memory_mb,
		"memory_growth_mb": memory_growth,
		"growth_rate_mb_per_min": growth_rate,
		"sample_count": _memory_samples.size(),
		"required_samples": MEMORY_LEAK_SAMPLE_COUNT,
		"reason": reason
	}

## Reset frame-time statistics (FPS history, current FPS, frame-time history)
## Call this to start a clean measurement window, e.g. after a warm-up phase in
## the headless benchmark harness (issue #1073) or on scene transitions
func reset_frame_statistics() -> void:
	_fps_history.clear()
	_frame_time_history.clear()
	_current_fps = 0.0
	_average_frame_time = 0.0

## Export the profiling snapshot as a JSON string (issue #1073)
## Used by the headless benchmark harness and device telemetry capture to
## write measurements that the backend benchmark gate consumes
func export_snapshot_json(pretty: bool = false) -> String:
	var snapshot: Dictionary = get_profiling_snapshot()
	if pretty:
		return JSON.stringify(snapshot, "  ")
	return JSON.stringify(snapshot)

## Reset memory leak detection state
## Call this when transitioning between scenes to start fresh tracking
func reset_memory_leak_detection() -> void:
	_memory_samples.clear()
	_memory_sample_times.clear()
	_leak_suspect_count = 0
	_session_start_time = Time.get_unix_time_from_system()
	# Reset startup memory to current to avoid false positives after scene transition
	_startup_memory_mb = _get_memory_usage_mb()

# --- Integration with ProfilingInstrumentation ---

## Get profiling instrumentation data if available
func get_instrumentation_data() -> Dictionary:
	var profiler = get_node_or_null("/root/ProfilingInstrumentation")
	if profiler and profiler.has_method("get_profile_report"):
		return profiler.get_profile_report()
	return {}

## Get combined profiling report (PerformanceProfiler + ProfilingInstrumentation)
func get_combined_report() -> Dictionary:
	var snapshot = get_profiling_snapshot()
	var instrumentation = get_instrumentation_data()

	snapshot["instrumentation"] = instrumentation
	return snapshot
