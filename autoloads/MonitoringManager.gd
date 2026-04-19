## Unified Monitoring Coordinator
##
## Consolidates crash/error monitoring, analytics, and health checks into
## a single production path. Coordinates AnalyticsManager, PerformanceProfiler,
## and MatchmakingAnalyticsManager autoloads.
##
## Features:
## - Periodic health snapshots from all monitoring autoloads
## - Consolidated error reporting through AnalyticsManager to backend
## - Global crash handler with full context capture
## - Health report delivery to backend via health_check RPC
extends Node

signal health_snapshot_taken(snapshot: Dictionary)
signal health_report_sent(success: bool)
signal crash_handled(error_message: String)

# Configuration
var _report_interval_seconds: float = 60.0
var _max_error_buffer_size: int = 50

# State
var _last_health_snapshot: Dictionary = {}
var _error_buffer: Array[Dictionary] = []
var _report_timer: Timer
var _crash_handler_installed: bool = false

# References to other autoloads (resolved lazily)
var _analytics_manager: Node
var _performance_profiler: Node
var _matchmaking_analytics: Node
var _network_manager: Node


func _ready() -> void:
	_install_global_crash_handler()
	_start_periodic_reporting()
	print("MonitoringManager: Initialized and monitoring active")


func _exit_tree() -> void:
	if _report_timer:
		_report_timer.queue_free()


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED:
			_flush_error_buffer()
			_collect_and_emit_snapshot()
		NOTIFICATION_APPLICATION_RESUMED:
			if _report_timer:
				_report_timer.start()
			_collect_and_emit_snapshot()


func _flush_error_buffer() -> void:
	if _error_buffer.is_empty():
		return
	var analytics := _get_analytics_manager()
	if analytics and analytics.has_method("track_event_to_backend"):
		for entry in _error_buffer:
			analytics.track_event_to_backend("client_error", {
				"error_message": entry.get("message", ""),
				"context": entry.get("context", {}),
				"flushed_on_pause": true,
			})
	_error_buffer.clear()


# ============================================================================
# Autoload References (lazy resolution)
# ============================================================================

func _get_analytics_manager() -> Node:
	if _analytics_manager == null:
		_analytics_manager = get_node_or_null("/root/AnalyticsManager")
	return _analytics_manager


func _get_performance_profiler() -> Node:
	if _performance_profiler == null:
		_performance_profiler = get_node_or_null("/root/PerformanceProfiler")
	return _performance_profiler


func _get_matchmaking_analytics() -> Node:
	if _matchmaking_analytics == null:
		_matchmaking_analytics = get_node_or_null("/root/MatchmakingAnalyticsManager")
	return _matchmaking_analytics


func _get_network_manager() -> Node:
	if _network_manager == null:
		_network_manager = get_node_or_null("/root/NetworkManager")
	return _network_manager


# ============================================================================
# Crash Handler
# ============================================================================

func _install_global_crash_handler() -> void:
	if _crash_handler_installed:
		return

	var analytics := _get_analytics_manager()
	if analytics and analytics.has_signal("crash_reported"):
		analytics.crash_reported.connect(_on_crash_reported)

	var profiler := _get_performance_profiler()
	if profiler:
		if profiler.has_signal("fps_dropped"):
			profiler.fps_dropped.connect(_on_fps_dropped)
		if profiler.has_signal("memory_warning"):
			profiler.memory_warning.connect(_on_memory_warning)
		if profiler.has_signal("memory_leak_detected"):
			profiler.memory_leak_detected.connect(_on_memory_leak_detected)

	_crash_handler_installed = true


func _on_crash_reported(crash_id: String, message: String) -> void:
	var context := _collect_crash_context()
	context["crash_id"] = crash_id
	report_error(message, context)
	crash_handled.emit(message)


func _on_fps_dropped(current_fps: float, target_fps: int) -> void:
	report_error(
		"FPS dropped below target: %.1f (target: %d)" % [current_fps, target_fps],
		{"type": "performance", "fps": current_fps, "target_fps": target_fps}
	)


func _on_memory_warning(current_mb: float, threshold_mb: int) -> void:
	report_error(
		"Memory warning: %.1f MB (threshold: %d MB)" % [current_mb, threshold_mb],
		{"type": "performance", "memory_mb": current_mb, "threshold_mb": threshold_mb}
	)


func _on_memory_leak_detected(current_mb: float, growth_mb: float, rate_mb_per_min: float) -> void:
	report_error(
		"Memory leak detected: %.1f MB (growth: %.1f MB, rate: %.1f MB/min)" % [current_mb, growth_mb, rate_mb_per_min],
		{"type": "performance", "memory_mb": current_mb, "growth_mb": growth_mb, "rate_mb_per_min": rate_mb_per_min}
	)


# ============================================================================
# Health Snapshot Collection
# ============================================================================

func _collect_health_snapshot() -> Dictionary:
	var snapshot: Dictionary = {
		"timestamp": Time.get_unix_time_from_system(),
		"performance": {},
		"analytics": {},
		"matchmaking": {},
	}

	var profiler := _get_performance_profiler()
	if profiler and profiler.has_method("get_profiling_snapshot"):
		snapshot["performance"] = profiler.get_profiling_snapshot()

	var analytics := _get_analytics_manager()
	if analytics and analytics.has_method("get_session_summary"):
		snapshot["analytics"] = analytics.get_session_summary()

	var matchmaking := _get_matchmaking_analytics()
	if matchmaking and matchmaking.has_method("get_match_quality_metrics"):
		snapshot["matchmaking"] = matchmaking.get_match_quality_metrics()

	return snapshot


func get_last_health_snapshot() -> Dictionary:
	return _last_health_snapshot


# ============================================================================
# Error Reporting
# ============================================================================

func report_error(error_message: String, context: Dictionary = {}) -> void:
	var error_entry: Dictionary = {
		"message": error_message,
		"context": context,
		"timestamp": Time.get_unix_time_from_system(),
	}

	_error_buffer.append(error_entry)
	if _error_buffer.size() > _max_error_buffer_size:
		_error_buffer.pop_front()

	var analytics := _get_analytics_manager()
	if analytics and analytics.has_method("track_event_to_backend"):
		var payload: Dictionary = {
			"error_message": error_message,
			"context": context,
			"health_snapshot": _last_health_snapshot,
		}
		analytics.track_event_to_backend("client_error", payload)


func get_error_buffer() -> Array[Dictionary]:
	return _error_buffer.duplicate()


# ============================================================================
# Periodic Reporting
# ============================================================================

func _start_periodic_reporting() -> void:
	_report_timer = Timer.new()
	_report_timer.wait_time = _report_interval_seconds
	_report_timer.one_shot = false
	_report_timer.timeout.connect(_on_report_timer)
	add_child(_report_timer)
	_report_timer.start()

	# Collect initial snapshot
	_collect_and_emit_snapshot()


func _on_report_timer() -> void:
	_collect_and_emit_snapshot()


func _collect_and_emit_snapshot() -> void:
	_last_health_snapshot = _collect_health_snapshot()
	health_snapshot_taken.emit(_last_health_snapshot)
	_send_health_report_to_backend()


func _send_health_report_to_backend() -> void:
	var network := _get_network_manager()
	if network == null:
		return
	if not network.get("is_connected"):
		return

	var payload := JSON.stringify({
		"client_health": _last_health_snapshot,
		"error_count": _error_buffer.size(),
	})
	var response = await network.send_rpc("armored_archer/health_check", payload)
	health_report_sent.emit(response != null and not response.is_empty())


# ============================================================================
# Crash Context Collection
# ============================================================================

func _collect_crash_context() -> Dictionary:
	var context: Dictionary = {
		"performance": {},
		"breadcrumbs": [],
	}

	var profiler := _get_performance_profiler()
	if profiler and profiler.has_method("get_profiling_snapshot"):
		context["performance"] = profiler.get_profiling_snapshot()

	var analytics := _get_analytics_manager()
	if analytics and analytics.has_method("get_breadcrumbs"):
		context["breadcrumbs"] = analytics.get_breadcrumbs()

	return context
