## Profiling Instrumentation System
## Provides runtime performance profiling and code timing utilities
## for debugging and observability
##
## Usage:
##   ProfilingInstrumentation.start_marker("name") - Start timing a code section
##   ProfilingInstrumentation.end_marker("name") - End timing and record
##   ProfilingInstrumentation.time_function(func) - Time a function call
##   ProfilingInstrumentation.get_profile_report() - Get detailed profile report
##   ProfilingInstrumentation.is_profiling_enabled() - Check if profiling is active
##
extends Node

# --- Configuration ---
## Enable/disable all profiling (can be toggled at runtime)
var _profiling_enabled: bool = true

## Maximum markers to keep in history
const MAX_MARKER_HISTORY: int = 1000

## Minimum time (ms) to consider significant for reporting
const MIN_SIGNIFICANT_TIME_MS: float = 1.0

# --- Marker Data ---
## Active markers currently being timed
var _active_markers: Dictionary = {}

## Completed marker records: {name: [times_ms]}
var _marker_history: Dictionary = {}

## Total marker calls: {name: call_count}
var _marker_call_counts: Dictionary = {}

## Total time per marker: {name: total_ms}
var _marker_total_times: Dictionary = {}

## Marker statistics: {name: {min, max, avg, count}}
var _marker_stats: Dictionary = {}

# --- Frame Profiling ---
## Enable per-frame timing
var _frame_profiling_enabled: bool = false

## Frame time history
var _frame_times: Array[float] = []

## Maximum frame time history size
const MAX_FRAME_HISTORY: int = 300  # ~5 seconds at 60fps

## Current frame start time
var _frame_start_time: int = 0

# --- Memory Profiling ---
## Enable memory tracking
var _memory_profiling_enabled: bool = true

## Memory snapshots
var _memory_snapshots: Array[Dictionary] = []

## Last memory check time
var _last_memory_check: int = 0

# --- Signals ---
## Emitted when a slow marker is detected (>MIN_SIGNIFICANT_TIME_MS)
signal slow_marker_detected(name: String, time_ms: float, call_count: int)

## Emitted when profiling is toggled
signal profiling_toggled(enabled: bool)

## Emitted on each frame if frame profiling is enabled
signal frame_profiled(frame_time_ms: float, average_frame_time_ms: float)

func _ready() -> void:
	_initialize_profiler()

func _initialize_profiler() -> void:
	# Initialize frame timing
	_frame_start_time = _get_tick_count()

	# Check for profiling enable flag in project settings or environment
	_profiling_enabled = _should_enable_profiling()
	_frame_profiling_enabled = _profiling_enabled

	print("[ProfilingInstrumentation] Initialized - Profiling: %s, Frame Profiling: %s" %
		[_profiling_enabled, _frame_profiling_enabled])

func _should_enable_profiling() -> bool:
	# Enable in debug builds or when explicitly enabled
	if OS.has_feature("debug"):
		return true

	# Check for environment variable
	var env_value = OS.get_environment("PROFILING_ENABLED")
	if env_value == "true" or env_value == "1":
		return true

	# Default to enabled for development
	return true

func _process(_delta: float) -> void:
	if _frame_profiling_enabled:
		_update_frame_profiling()

func _update_frame_profiling() -> void:
	var current_time = _get_tick_count()
	var frame_time = (current_time - _frame_start_time) / 1000.0  # Convert to ms
	_frame_start_time = current_time

	_frame_times.append(frame_time)
	if _frame_times.size() > MAX_FRAME_HISTORY:
		_frame_times.pop_front()

	# Calculate average
	var sum: float = 0.0
	for ft in _frame_times:
		sum += ft
	var avg = sum / _frame_times.size() if _frame_times.size() > 0 else 0.0

	frame_profiled.emit(frame_time, avg)

func _get_tick_count() -> int:
	return Time.get_ticks_msec()

# --- Public API ---

## Check if profiling is currently enabled
func is_profiling_enabled() -> bool:
	return _profiling_enabled

## Enable or disable profiling
func set_profiling_enabled(enabled: bool) -> void:
	_profiling_enabled = enabled
	profiling_toggled.emit(enabled)
	print("[ProfilingInstrumentation] Profiling %s" % ["disabled", "enabled"][int(enabled)])

## Check if frame profiling is enabled
func is_frame_profiling_enabled() -> bool:
	return _frame_profiling_enabled

## Enable or disable frame profiling
func set_frame_profiling_enabled(enabled: bool) -> void:
	_frame_profiling_enabled = enabled
	print("[ProfilingInstrumentation] Frame profiling %s" % ["disabled", "enabled"][int(enabled)])

## Start timing a code section
## Returns a unique marker ID that should be passed to end_marker
func start_marker(name: String) -> int:
	if not _profiling_enabled:
		return -1

	var marker_id = _get_tick_count()
	_active_markers[name] = {
		"start_time": marker_id,
		"name": name,
		"call_stack": _get_call_stack()
	}
	return marker_id

## End timing a code section started with start_marker
func end_marker(name: String, marker_id: int = -1) -> float:
	if not _profiling_enabled:
		return 0.0

	var marker = _active_markers.get(name)
	if marker == null:
		push_warning("[ProfilingInstrumentation] No active marker found: " + name)
		return 0.0

	var end_time = _get_tick_count()
	var duration = (end_time - marker.start_time) as float

	# Record the marker
	_record_marker(name, duration)

	# Remove active marker
	_active_markers.erase(name)

	# Emit warning for slow markers
	if duration > MIN_SIGNIFICANT_TIME_MS:
		slow_marker_detected.emit(name, duration, _marker_call_counts.get(name, 0))

	return duration

## Time a function call and return the result
## Usage: var result = ProfilingInstrumentation.time_function(my_function)
func time_function(func_call: Callable) -> Variant:
	if not _profiling_enabled:
		return func_call.call()

	# Generate marker name from callable
	var func_name = _get_callable_name(func_call)
	var start = _get_tick_count()

	var result = func_call.call()

	var duration = (_get_tick_count() - start) as float
	_record_marker(func_name, duration)

	if duration > MIN_SIGNIFICANT_TIME_MS:
		slow_marker_detected.emit(func_name, duration, _marker_call_counts.get(func_name, 0))

	return result

## Time a function with custom name
func time_function_named(name: String, func_call: Callable) -> Variant:
	if not _profiling_enabled:
		return func_call.call()

	var start = _get_tick_count()

	var result = func_call.call()

	var duration = (_get_tick_count() - start) as float
	_record_marker(name, duration)

	if duration > MIN_SIGNIFICANT_TIME_MS:
		slow_marker_detected.emit(name, duration, _marker_call_counts.get(name, 0))

	return result

## Time a block of code using a scoped helper
## Usage: var _block = ProfilingInstrumentation.create_profile_block("combat_calc")
##        # ... code to profile ...
##        _block = null  # This will trigger end_marker automatically
class_name ProfileBlock

var _profiler: Node
var _name: String
var _start_time: int
var _ended: bool = false

func _init(profiler: Node, name: String):
	_profiler = profiler
	_name = name
	_start_time = Time.get_ticks_msec()

func _notification(what):
	if what == NOTIFICATION_PREDELETE and not _ended:
		_ended = true
		if _profiler and _profiler.has_method("end_marker"):
			_profiler.end_marker(_name)

## Manually end the profile block
func end() -> float:
	if _ended:
		return 0.0
	_ended = true
	if _profiler and _profiler.has_method("end_marker"):
		return _profiler.end_marker(_name)
	return 0.0

## Create a scoped profile block (call with 'await' or use as variable)
## Usage: var _ = ProfilingInstrumentation.scoped_marker("combat_calc")
func scoped_marker(name: String) -> void:
	start_marker(name)

## Create a ProfileBlock instance for scoped profiling
## Usage: var _block = ProfilingInstrumentation.create_profile_block("combat_calc")
##        # ... code to profile ...
##        _block.end()  # or let it go out of scope
func create_profile_block(name: String) -> ProfileBlock:
	return ProfileBlock.new(self, name)

## End a scoped profile block
func end_scoped_marker(name: String) -> float:
	return end_marker(name)

## Record a marker timing
func _record_marker(name: String, duration_ms: float) -> void:
	# Initialize if needed
	if not _marker_history.has(name):
		_marker_history[name] = []
		_marker_call_counts[name] = 0
		_marker_total_times[name] = 0.0
		_marker_stats[name] = {
			"min": duration_ms,
			"max": duration_ms,
			"avg": duration_ms,
			"count": 0
		}

	# Record timing
	_marker_history[name].append(duration_ms)
	_marker_call_counts[name] += 1
	_marker_total_times[name] += duration_ms

	# Keep history limited
	if _marker_history[name].size() > MAX_MARKER_HISTORY:
		_marker_history[name].pop_front()

	# Update statistics
	var stats = _marker_stats[name]
	stats.min = min(stats.min, duration_ms)
	stats.max = max(stats.max, duration_ms)
	stats.count = _marker_call_counts[name]
	stats.avg = _marker_total_times[name] / stats.count

## Get callable name for profiling
func _get_callable_name(callable: Callable) -> String:
	var method = callable.get_method()
	var target = callable.get_object()
	var target_name = "unknown"

	if target != null:
		target_name = target.get_class()
		if target.has_method("get_class_name"):
			target_name = target.get_class_name()

	return target_name + "." + method

## Get current call stack (debug)
func _get_call_stack() -> String:
	# In Godot, getting full call stack is limited
	# Return a simplified version
	return ""

## Get marker statistics
func get_marker_stats(name: String) -> Dictionary:
	if _marker_stats.has(name):
		return _marker_stats[name].duplicate()
	return {}

## Get all marker statistics
func get_all_marker_stats() -> Dictionary:
	var result: Dictionary = {}
	for name in _marker_stats:
		result[name] = _marker_stats[name].duplicate()
	return result

## Get profile report as dictionary
func get_profile_report() -> Dictionary:
	var markers: Array[Dictionary] = []

	for name in _marker_stats:
		var stats = _marker_stats[name]
		markers.append({
			"name": name,
			"count": stats.count,
			"total_ms": _marker_total_times[name],
			"avg_ms": stats.avg,
			"min_ms": stats.min,
			"max_ms": stats.max
		})

	# Sort by total time descending
	markers.sort_custom(func(a, b): return a.total_ms > b.total_ms)

	# Get frame stats
	var frame_avg: float = 0.0
	var frame_max: float = 0.0
	if _frame_times.size() > 0:
		var sum: float = 0.0
		for ft in _frame_times:
			sum += ft
		frame_avg = sum / _frame_times.size()
		for ft in _frame_times:
			frame_max = max(frame_max, ft)

	return {
		"profiling_enabled": _profiling_enabled,
		"frame_profiling_enabled": _frame_profiling_enabled,
		"marker_count": markers.size(),
		"markers": markers,
		"frame_stats": {
			"average_ms": frame_avg,
			"max_ms": frame_max,
			"sample_count": _frame_times.size()
		}
	}

## Get formatted profile report for printing
func get_formatted_report() -> String:
	var report = get_profile_report()
	var lines: Array[String] = []

	lines.append("=== Profiling Report ===")
	lines.append("Profiling: %s | Frame Profiling: %s" % [report.profiling_enabled, report.frame_profiling_enabled])
	lines.append("Total Markers: %d" % report.marker_count)

	if report.frame_stats.sample_count > 0:
		lines.append("")
		lines.append("--- Frame Stats ---")
		lines.append("Avg: %.2fms | Max: %.2fms | Samples: %d" %
			[report.frame_stats.average_ms, report.frame_stats.max_ms, report.frame_stats.sample_count])

	if report.markers.size() > 0:
		lines.append("")
		lines.append("--- Top Markers (by total time) ---")
		lines.append("%-40s %10s %10s %10s %10s" % ["Name", "Calls", "Total(ms)", "Avg(ms)", "Max(ms)"])

		# Show top 20
		var count = 0
		for marker in report.markers:
			if count >= 20:
				break
			lines.append("%-40s %10d %10.2f %10.2f %10.2f" %
				[marker.name.substr(0, 40), marker.count, marker.total_ms, marker.avg_ms, marker.max_ms])
			count += 1

	return "\n".join(lines)

## Print profile report to console
func log_profile_report(label: String = "") -> void:
	var prefix = "[ProfilingInstrumentation]"
	if label != "":
		prefix += " [" + label + "]"

	print(prefix)
	print(get_formatted_report())

## Clear all profiling data
func clear_profiling_data() -> void:
	_active_markers.clear()
	_marker_history.clear()
	_marker_call_counts.clear()
	_marker_total_times.clear()
	_marker_stats.clear()
	_frame_times.clear()
	print("[ProfilingInstrumentation] Profiling data cleared")

## Get active markers (for debugging)
func get_active_markers() -> Dictionary:
	return _active_markers.duplicate()

## Get frame time history
func get_frame_times() -> Array[float]:
	return _frame_times.duplicate()

## Get average frame time
func get_average_frame_time_ms() -> float:
	if _frame_times.is_empty():
		return 0.0
	var sum: float = 0.0
	for ft in _frame_times:
		sum += ft
	return sum / _frame_times.size()

## Get maximum frame time
func get_max_frame_time_ms() -> float:
	if _frame_times.is_empty():
		return 0.0
	var max_time: float = 0.0
	for ft in _frame_times:
		max_time = max(max_time, ft)
	return max_time

# --- Memory Profiling ---

## Get current memory usage in MB (approximation)
func get_memory_usage_mb() -> float:
	# Use Godot's Performance monitor
	var object_count = Performance.get_monitor(Performance.OBJECT_NODE_COUNT)
	var memory = Performance.get_monitor(Performance.MEMORY_STATIC)

	# Rough estimation - actual memory usage varies by platform
	# This is a simplified version
	return memory / (1024.0 * 1024.0)

## Take a memory snapshot
func take_memory_snapshot(label: String = "") -> Dictionary:
	var snapshot = {
		"timestamp": Time.get_unix_time_from_system(),
		"label": label,
		"memory_mb": get_memory_usage_mb(),
		"object_count": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
		"frame_time_ms": get_average_frame_time_ms()
	}

	_memory_snapshots.append(snapshot)

	# Keep limited history
	if _memory_snapshots.size() > 100:
		_memory_snapshots.pop_front()

	return snapshot

## Get memory snapshots
func get_memory_snapshots() -> Array[Dictionary]:
	return _memory_snapshots.duplicate()

## Calculate memory growth between snapshots
func get_memory_growth_mb() -> float:
	if _memory_snapshots.size() < 2:
		return 0.0
	return _memory_snapshots.back().memory_mb - _memory_snapshots.front().memory_mb
