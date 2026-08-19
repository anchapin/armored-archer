## Headless Client Performance Benchmark Harness (issue #1073)
##
## Runs the REAL gameplay scene (res://scenes/main.tscn) headlessly and exports
## a PerformanceProfiler snapshot measured from the actual game loop: real
## frame times, real FPS, real static-memory usage. The backend benchmark gate
## (backend/tests/integration/low_end_device_performance.test.ts) consumes the
## exported snapshot and fails without it, so CI can no longer pass vacuously.
##
## Usage (from repo root, or via scripts/run-headless-performance-benchmark.sh):
##   godot4 --headless --script test/benchmark/headless_benchmark.gd
##
## Environment overrides:
##   BENCHMARK_OUTPUT_PATH    - output snapshot path (absolute or res:// path)
##   BENCHMARK_SCENE          - scene to measure (default res://scenes/main.tscn)
##   BENCHMARK_WARMUP_SECONDS - seconds of scene-load jitter to skip (default 2.0)
##   BENCHMARK_MIN_SECONDS    - minimum measurement window in seconds (default 10.0)
##   BENCHMARK_MIN_FRAMES     - minimum measured frames (default 600)
##   BENCHMARK_MAX_FRAMES     - hard safety cap on total frames (default 30000)
##
## Output: JSON snapshot (schema documented in docs/PERFORMANCE.md), exit 0 on
## success, exit 1 on any setup/teardown failure.
extends SceneTree

const DEFAULT_OUTPUT_PATH: String = "res://backend/tests/fixtures/performance/generated/headless_benchmark.snapshot.json"
const DEFAULT_SCENE: String = "res://scenes/main.tscn"
const DEFAULT_WARMUP_SECONDS: float = 2.0
const DEFAULT_MIN_SECONDS: float = 10.0
const DEFAULT_MIN_FRAMES: int = 600
const DEFAULT_MAX_FRAMES: int = 30000

var _output_path: String = DEFAULT_OUTPUT_PATH
var _scene_path: String = DEFAULT_SCENE
var _warmup_seconds: float = DEFAULT_WARMUP_SECONDS
var _min_seconds: float = DEFAULT_MIN_SECONDS
var _min_frames: int = DEFAULT_MIN_FRAMES
var _max_frames: int = DEFAULT_MAX_FRAMES

var _benchmark_scene: Node = null
var _setup_done: bool = false
var _failed: bool = false
var _phase: String = "warmup"
var _phase_start_ms: int = 0
var _measured_frames: int = 0
var _total_frames: int = 0


func _init() -> void:
	_read_configuration()


func _initialize() -> void:
	# Autoload singletons are registered by the time the main loop starts;
	# defer scene setup so PerformanceProfiler is addressable (same pattern as
	# test/run_all_tests.gd).
	call_deferred("_setup_benchmark")


func _read_configuration() -> void:
	_output_path = _env_string("BENCHMARK_OUTPUT_PATH", DEFAULT_OUTPUT_PATH)
	_scene_path = _env_string("BENCHMARK_SCENE", DEFAULT_SCENE)
	if OS.has_environment("BENCHMARK_WARMUP_SECONDS"):
		_warmup_seconds = maxf(OS.get_environment("BENCHMARK_WARMUP_SECONDS").to_float(), 0.0)
	if OS.has_environment("BENCHMARK_MIN_SECONDS"):
		_min_seconds = maxf(OS.get_environment("BENCHMARK_MIN_SECONDS").to_float(), 1.0)
	if OS.has_environment("BENCHMARK_MIN_FRAMES"):
		_min_frames = maxi(OS.get_environment("BENCHMARK_MIN_FRAMES").to_int(), 1)
	if OS.has_environment("BENCHMARK_MAX_FRAMES"):
		_max_frames = maxi(OS.get_environment("BENCHMARK_MAX_FRAMES").to_int(), _min_frames)


func _env_string(name: String, fallback: String) -> String:
	if OS.has_environment(name) and OS.get_environment(name) != "":
		return OS.get_environment(name)
	return fallback


func _setup_benchmark() -> void:
	if _get_profiler() == null:
		_fail("PerformanceProfiler autoload not found at /root/PerformanceProfiler")
		return

	print("[BENCHMARK] scene=%s warmup=%.1fs window>=%.1fs/>=%d frames" % [
		_scene_path, _warmup_seconds, _min_seconds, _min_frames
	])

	# Load the real gameplay scene (player, enemy spawner, arrows, pooling, VFX).
	if not ResourceLoader.exists(_scene_path):
		_fail("Benchmark scene not found: %s" % _scene_path)
		return
	var packed: PackedScene = ResourceLoader.load(_scene_path)
	if packed == null:
		_fail("Failed to load benchmark scene: %s" % _scene_path)
		return
	_benchmark_scene = packed.instantiate()
	if _benchmark_scene == null:
		_fail("Failed to instantiate benchmark scene: %s" % _scene_path)
		return
	root.add_child(_benchmark_scene)

	_phase = "warmup"
	_phase_start_ms = Time.get_ticks_msec()
	_setup_done = true


func _process(_delta: float) -> bool:
	if _failed or not _setup_done:
		return _failed

	_total_frames += 1

	if _phase == "warmup":
		var elapsed_s: float = (Time.get_ticks_msec() - _phase_start_ms) / 1000.0
		if elapsed_s >= _warmup_seconds:
			_start_measurement()
		elif _total_frames >= _max_frames:
			_fail("Warmup exceeded hard frame cap (%d frames)" % _max_frames)
		return false

	# Measurement phase: count frames until both the minimum duration and the
	# minimum frame count are satisfied (or the hard cap trips).
	_measured_frames += 1
	var measured_s: float = (Time.get_ticks_msec() - _phase_start_ms) / 1000.0
	if (_measured_frames >= _min_frames and measured_s >= _min_seconds) or _total_frames >= _max_frames:
		_finish_benchmark()
		return true
	return false


func _start_measurement() -> void:
	# Open a clean measurement window: clear warm-up jitter from the profiler.
	var profiler := _get_profiler()
	if profiler == null:
		_fail("PerformanceProfiler autoload disappeared during run")
		return
	profiler.reset_frame_statistics()
	profiler.reset_memory_leak_detection()
	# Headless runs are classified as budget devices, and budget tier settings
	# cap Engine.max_fps at 30 - the throttle would hide the real per-frame
	# cost behind sleep time (avg frame time would always read ~33.3ms).
	# Uncap so frame time reflects actual simulation cost of the game loop.
	Engine.max_fps = 0
	_phase = "measure"
	_phase_start_ms = Time.get_ticks_msec()
	print("[BENCHMARK] warmup done, measuring (uncapped)...")


func _finish_benchmark() -> void:
	var profiler := _get_profiler()
	if profiler == null:
		_fail("PerformanceProfiler autoload disappeared during run")
		return

	var measured_s: float = (Time.get_ticks_msec() - _phase_start_ms) / 1000.0
	var snapshot: Dictionary = profiler.get_profiling_snapshot()
	var scene_node_count: int = 0
	if _benchmark_scene != null:
		scene_node_count = _count_nodes(_benchmark_scene)

	var output: Dictionary = {
		"schemaVersion": 1,
		"source": "headless_godot",
		"generatedAt": Time.get_unix_time_from_system(),
		"godotVersion": Engine.get_version_info().get("string", "unknown"),
		"platform": OS.get_name(),
		"displayServer": DisplayServer.get_name(),
		"scenePath": _scene_path,
		"framesRun": _measured_frames,
		"warmupFrames": _total_frames - _measured_frames,
		"measuredWallSeconds": measured_s,
		"engineMaxFps": Engine.max_fps,
		"benchmarkSceneNodeCount": scene_node_count,
		"profiler": snapshot,
	}

	var write_error := _write_snapshot(output)
	if write_error != OK:
		_fail("Failed to write snapshot to %s (error %d)" % [_output_path, write_error])
		return

	print("[BENCHMARK] avg_fps=%.1f avg_frame_time=%.3fms peak_memory=%.1fMB frames=%d duration=%.1fs" % [
		snapshot.get("average_fps", 0.0),
		snapshot.get("avg_frame_time_ms", 0.0),
		snapshot.get("memory_peak_mb", 0.0),
		_measured_frames,
		measured_s,
	])
	print("[BENCHMARK] wrote %s" % _output_path)
	quit(0)


func _write_snapshot(output: Dictionary) -> int:
	var dir_path: String = _output_path.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		var mkdir_error: int = DirAccess.make_dir_recursive_absolute(dir_path)
		if mkdir_error != OK:
			return mkdir_error

	var file := FileAccess.open(_output_path, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(output, "  "))
	file.close()
	return OK


func _count_nodes(node: Node) -> int:
	var count: int = 1
	for child in node.get_children():
		count += _count_nodes(child)
	return count


func _get_profiler() -> Node:
	return root.get_node_or_null("/root/PerformanceProfiler")


func _fail(reason: String) -> void:
	_failed = true
	push_error("[BENCHMARK] FAILED: " + reason)
	quit(1)
