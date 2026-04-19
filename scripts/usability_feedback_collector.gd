## Usability Feedback Collector
## Captures timestamped events during usability testing sessions.
## Activate by creating user://usability_config.json with {"enabled": true}
##
## Tracks:
## - Scene transitions and timing
## - Button presses and interaction timestamps
## - Tutorial step completion/skip events
## - Hesitation detection (pauses >3 seconds)
## - Purchase flow events
## - Error occurrences
##
extends Node

# --- Configuration ---
const CONFIG_PATH := "user://usability_config.json"
const OUTPUT_DIR := "user://usability_sessions/"

# --- State ---
var is_active: bool = false
var session_id: String = ""
var session_start_time: float = 0.0
var last_interaction_time: float = 0.0
var events: Array[Dictionary] = []
var milestones: Dictionary = {}
var hesitation_count: int = 0
var error_count: int = 0

# --- Hesitation Detection ---
const HESITATION_THRESHOLD_SEC: float = 3.0
var _hesitation_timer: Timer

# --- Signals ---
signal usability_event_recorded(event: Dictionary)
signal milestone_reached(milestone_id: String, elapsed_sec: float)
signal hesitation_detected(duration: float)

func _ready() -> void:
	_load_config()
	if is_active:
		_setup_session()
		_connect_global_signals()

func _load_config() -> void:
	if not FileAccess.file_exists(CONFIG_PATH):
		return
	var file := FileAccess.open(CONFIG_PATH, FileAccess.READ)
	if not file:
		return
	var json := JSON.new()
	if json.parse(file.get_as_text()) != OK:
		file.close()
		return
	file.close()
	var data: Dictionary = json.data
	is_active = data.get("enabled", false)

func _setup_session() -> void:
	session_id = "session_%d" % Time.get_unix_time_from_system()
	session_start_time = Time.get_ticks_msec() / 1000.0
	last_interaction_time = session_start_time

	DirAccess.make_dir_recursive_absolute(OUTPUT_DIR)

	_hesitation_timer = Timer.new()
	_hesitation_timer.one_shot = false
	_hesitation_timer.wait_time = 1.0
	_hesitation_timer.timeout.connect(_check_hesitation)
	add_child(_hesitation_timer)
	_hesitation_timer.start()

	_record_event("session_start", {"session_id": session_id})
	print("[Usability] Session recording started: %s" % session_id)

func _connect_global_signals() -> void:
	var tutorial_manager = get_node_or_null("/root/TutorialManager")
	if tutorial_manager:
		tutorial_manager.tutorial_started.connect(_on_tutorial_started)
		tutorial_manager.tutorial_step_started.connect(_on_tutorial_step)
		tutorial_manager.tutorial_step_completed.connect(_on_tutorial_step_completed)
		tutorial_manager.tutorial_completed.connect(_on_tutorial_completed)
		tutorial_manager.tutorial_skipped.connect(_on_tutorial_skipped)

	var store_manager = get_node_or_null("/root/StoreManager")
	if store_manager:
		store_manager.purchase_succeeded.connect(_on_purchase_succeeded)
		store_manager.purchase_failed.connect(_on_purchase_failed)
		store_manager.store_availability_changed.connect(_on_store_availability_changed)

func _check_hesitation() -> void:
	if not is_active:
		return
	var now: float = Time.get_ticks_msec() / 1000.0
	var idle_time: float = now - last_interaction_time
	if idle_time >= HESITATION_THRESHOLD_SEC and idle_time < HESITATION_THRESHOLD_SEC + 1.0:
		hesitation_count += 1
		_record_event("hesitation", {"duration_sec": idle_time})
		hesitation_detected.emit(idle_time)

# --- Event Recording ---

func record_button_press(button_name: String, scene_path: String = "") -> void:
	if not is_active:
		return
	last_interaction_time = Time.get_ticks_msec() / 1000.0
	_record_event("button_press", {"button": button_name, "scene": scene_path})

func record_scene_change(from_scene: String, to_scene: String) -> void:
	if not is_active:
		return
	last_interaction_time = Time.get_ticks_msec() / 1000.0
	_record_event("scene_change", {"from": from_scene, "to": to_scene})

func record_error(error_type: String, message: String) -> void:
	if not is_active:
		return
	error_count += 1
	_record_event("error", {"type": error_type, "message": message})

func record_milestone(milestone_id: String) -> void:
	if not is_active:
		return
	var elapsed: float = _elapsed_sec()
	milestones[milestone_id] = elapsed
	_record_event("milestone", {"milestone_id": milestone_id, "elapsed_sec": elapsed})
	milestone_reached.emit(milestone_id, elapsed)

func record_custom_event(event_name: String, data: Dictionary = {}) -> void:
	if not is_active:
		return
	_record_event("custom", {"name": event_name, "data": data})

# --- Signal Handlers ---

func _on_tutorial_started(tutorial_id: String) -> void:
	record_milestone("tutorial_%s_started" % tutorial_id)

func _on_tutorial_step(step_id: String, step_index: int) -> void:
	_record_event("tutorial_step_started", {"step_id": step_id, "step_index": step_index})

func _on_tutorial_step_completed(step_id: String) -> void:
	last_interaction_time = Time.get_ticks_msec() / 1000.0
	_record_event("tutorial_step_completed", {"step_id": step_id})

func _on_tutorial_completed(tutorial_id: String) -> void:
	record_milestone("tutorial_%s_completed" % tutorial_id)

func _on_tutorial_skipped(tutorial_id: String) -> void:
	_record_event("tutorial_skipped", {"tutorial_id": tutorial_id})

func _on_purchase_succeeded(product_id: String, gems_awarded: int) -> void:
	record_milestone("first_purchase")

func _on_purchase_failed(product_id: String, error: String) -> void:
	record_error("purchase_failed", error)

func _on_store_availability_changed(is_available: bool, message: String) -> void:
	if not is_available:
		record_error("store_outage", message)

# --- Private Methods ---

func _record_event(event_type: String, data: Dictionary = {}) -> void:
	var event: Dictionary = {
		"type": event_type,
		"timestamp": Time.get_unix_time_from_system(),
		"elapsed_sec": _elapsed_sec(),
		"data": data
	}
	events.append(event)
	usability_event_recorded.emit(event)

func _elapsed_sec() -> float:
	return (Time.get_ticks_msec() / 1000.0) - session_start_time

# --- Session Output ---

func save_session() -> String:
	var output := {
		"session_id": session_id,
		"session_start": session_start_time,
		"session_end": Time.get_ticks_msec() / 1000.0,
		"total_duration_sec": _elapsed_sec(),
		"total_events": events.size(),
		"hesitation_count": hesitation_count,
		"error_count": error_count,
		"milestones": milestones,
		"events": events
	}

	var file_path: String = OUTPUT_DIR + session_id + ".json"
	var file := FileAccess.open(file_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(output, "\t"))
		file.close()
		print("[Usability] Session saved to: %s" % file_path)
		return file_path
	return ""

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST and is_active:
		save_session()
		get_tree().quit()

# --- Analysis Helpers ---

func get_time_to_milestone(milestone_id: String) -> float:
	return milestones.get(milestone_id, -1.0)

func get_summary() -> Dictionary:
	return {
		"session_id": session_id,
		"duration_sec": _elapsed_sec(),
		"events_count": events.size(),
		"hesitation_count": hesitation_count,
		"error_count": error_count,
		"milestones": milestones,
		"time_to_first_interaction": milestones.get("first_interaction", -1.0),
		"time_to_gameplay": milestones.get("first_combat", -1.0),
		"time_to_store": milestones.get("store_opened", -1.0),
		"time_to_first_purchase": milestones.get("first_purchase", -1.0),
		"tutorial_completed": milestones.has("tutorial_welcome_completed"),
	}
