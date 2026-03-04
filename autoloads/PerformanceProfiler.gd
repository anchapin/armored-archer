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

# --- Performance Settings ---
var _target_fps: int = FLAGSHIP_TARGET_FPS
var _vsync_enabled: bool = true
var _max_particles: int = 100
var _shadow_quality: int = 2  # 0=off, 1=low, 2=high
var _texture_compression: bool = true

# --- Monitoring State ---
# Ring buffer for FPS tracking - O(1) operations instead of O(n)
var _fps_history: PackedFloat32Array = PackedFloat32Array()
var _fps_sample_count: int = 60  # Average over 60 frames
var _fps_buffer_index: int = 0
var _fps_buffer_filled: bool = false
var _current_fps: float = 60.0
var _average_fps_cache: float = 60.0  # Cache for average FPS
var _average_fps_valid: bool = false
var _frame_time_history: Array[float] = []
var _average_frame_time: float = 16.67  # ms

# --- Memory Tracking ---
var _startup_memory_mb: float = 0.0
var _peak_memory_mb: float = 0.0

# --- Device Tier ---
enum DeviceTier { FLAGSHP, MID_RANGE, BUDGET }
var _device_tier: DeviceTier = DeviceTier.FLAGSHP

# --- Signals ---
## Emitted when FPS drops below target
signal fps_dropped(current_fps: float, target_fps: int)
## Emitted when memory usage is high
signal memory_warning(current_mb: float, threshold_mb: int)
## Emitted when device tier is determined
signal device_tier_detected(tier: DeviceTier)

func _ready() -> void:
	_initialize_profiler()

func _initialize_profiler() -> void:
	# Get initial memory
	_startup_memory_mb = _get_memory_usage_mb()
	_peak_memory_mb = _startup_memory_mb
	
	# Detect device tier
	_detect_device_tier()
	
	# Apply performance settings based on device tier
	_apply_performance_settings()
	
	print("[PerformanceProfiler] Initialized - Device tier: %s, Target FPS: %d, Startup Memory: %.1f MB" % 
		[_get_tier_name(), _target_fps, _startup_memory_mb])

func _process(_delta: float) -> void:
	# Update FPS tracking
	var current_fps = Engine.get_frames_per_second()
	_update_fps_tracking(current_fps)
	
	# Update memory tracking
	var current_memory = _get_memory_usage_mb()
	if current_memory > _peak_memory_mb:
		_peak_memory_mb = current_memory
	
	# Check for performance issues
	_check_performance_warnings()

func _update_fps_tracking(current_fps: float) -> void:
	_current_fps = current_fps
	
	# Ring buffer implementation - O(1) insert instead of O(n)
	if _fps_history.size() < _fps_sample_count:
		_fps_history.append(current_fps)
	else:
		_fps_history[_fps_buffer_index] = current_fps
		_fps_buffer_index = (_fps_buffer_index + 1) % _fps_sample_count
		_fps_buffer_filled = true
	
	# Invalidate cache when FPS changes significantly
	_average_fps_valid = false
	
	# Emit warning if FPS drops significantly (only when buffer is full)
	if _fps_buffer_filled:
		var avg_fps = get_average_fps()
		if avg_fps < _target_fps * 0.8:
			fps_dropped.emit(avg_fps, _target_fps)

func _check_performance_warnings() -> void:
	# Memory warning check
	var current_memory = _get_memory_usage_mb()
	var memory_threshold = _get_memory_threshold()
	
	if current_memory > memory_threshold:
		memory_warning.emit(current_memory, memory_threshold)

func _get_memory_usage_mb() -> float:
	if OS.has_feature("web"):
		return 0.0  # Web platform doesn't support memory queries
	
	# Get process memory info
	var mem_info = OS.get_memory_info()
	return mem_info["physical"]["used"] / (1024.0 * 1024.0)

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
	if OS.has_method("get_free_memory"):
		available_ram_mb = OS.get_free_memory() / (1024.0 * 1024.0)
	
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
	match _device_tier:
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
			# VSync enabled by default for flagship

func _get_tier_name() -> String:
	match _device_tier:
		DeviceTier.BUDGET:
			return "Budget"
		DeviceTier.MID_RANGE:
			return "Mid-Range"
		_:
			return "Flagship"

# --- Public API ---

## Get current FPS
func get_fps() -> float:
	return _current_fps

## Get average FPS over sample period
## Uses cached value for efficiency, only recalculates when needed
func get_average_fps() -> float:
	if _average_fps_valid:
		return _average_fps_cache
	
	if _fps_history.is_empty():
		return _current_fps
	
	# Sum all values in the ring buffer
	var sum: float = 0.0
	for i in range(_fps_history.size()):
		sum += _fps_history[i]
	
	var count = _fps_history.size()
	_average_fps_cache = sum / count
	_average_fps_valid = true
	return _average_fps_cache

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
		"target_fps": _target_fps
	}

## Log profiling snapshot to console (for debugging)
func log_profiling_snapshot(label: String) -> void:
	var snapshot = get_profiling_snapshot()
	print("[PerformanceProfiler] %s - FPS: %.1f (avg: %.1f), Frame: %.2fms, Memory: %.1fMB (peak: %.1fMB), Tier: %s" %
		[label, snapshot.current_fps, snapshot.average_fps, snapshot.avg_frame_time_ms, 
		 snapshot.memory_current_mb, snapshot.memory_peak_mb, snapshot.device_tier])

## Set target FPS (can be used for dynamic performance adjustment)
func set_target_fps(fps: int) -> void:
	_target_fps = clamp(fps, BUDGET_MIN_FPS, FLAGSHIP_TARGET_FPS)
	Engine.max_fps = _target_fps

## Enable/disable VSync
func set_vsync_enabled(enabled: bool) -> void:
	_vsync_enabled = enabled
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if enabled else DisplayServer.VSYNC_DISABLED)

## Reset performance settings to defaults based on device tier
func reset_performance_settings() -> void:
	_apply_performance_settings()
