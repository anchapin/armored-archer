## Survey Manager autoload
##
## Manages post-match and post-purchase survey prompts.
## Listens to existing signals from MatchResultsManager and StoreManager
## without modifying those systems. Surveys are rate-limited and fully optional.

extends Node

# --- Signals ---
signal survey_shown(survey_type: String)
signal survey_dismissed(survey_type: String)
signal survey_submitted(survey_type: String)
signal survey_submission_failed(survey_type: String, error: String)

# --- Constants ---
const RPC_SUBMIT_SURVEY: String = "armored_archer/submit_survey"
const POST_MATCH_COOLDOWN: float = 14400.0  # 4 hours
const POST_PURCHASE_COOLDOWN: float = 86400.0  # 24 hours
const COOLDOWN_FILE: String = "user://survey_cooldowns.json"

const POST_MATCH_SURVEY_SCENE: PackedScene = preload("res://scenes/ui/surveys/post_match_survey.tscn")
const POST_PURCHASE_SURVEY_SCENE: PackedScene = preload("res://scenes/ui/surveys/post_purchase_survey.tscn")

# --- State ---
var _current_survey_instance: Control = null
var _last_post_match_survey_time: float = 0.0
var _last_post_purchase_survey_time: float = 0.0
var _last_match_data: Dictionary = {}


func _ready() -> void:
	# Connect to match results signals
	var match_results_manager: Node = get_node_or_null("/root/MatchResultsManager")
	if match_results_manager:
		if match_results_manager.has_signal("results_shown"):
			match_results_manager.results_shown.connect(_on_results_shown)
		if match_results_manager.has_signal("results_closed"):
			match_results_manager.results_closed.connect(_on_results_closed)

	# Connect to store purchase signals
	var store_manager: Node = get_node_or_null("/root/StoreManager")
	if store_manager and store_manager.has_signal("purchase_succeeded"):
		store_manager.purchase_succeeded.connect(_on_purchase_succeeded)

	_load_cooldown_data()


func can_show_survey(survey_type: String) -> bool:
	if _current_survey_instance != null:
		return false

	var now: float = Time.get_unix_time_from_system()
	match survey_type:
		"post_match":
			return (now - _last_post_match_survey_time) >= POST_MATCH_COOLDOWN
		"post_purchase":
			return (now - _last_post_purchase_survey_time) >= POST_PURCHASE_COOLDOWN
		_:
			return false


func show_post_match_survey(match_data: Dictionary) -> void:
	if not can_show_survey("post_match"):
		return

	_current_survey_instance = POST_MATCH_SURVEY_SCENE.instantiate() as Control
	if not _current_survey_instance:
		return

	_current_survey_instance.name = "PostMatchSurvey"
	_current_survey_instance.survey_submitted.connect(_on_survey_submitted_from_ui)
	_current_survey_instance.survey_dismissed.connect(_on_survey_dismissed_from_ui)

	var current_scene: Node = get_tree().current_scene
	if current_scene:
		current_scene.add_child(_current_survey_instance)

	if _current_survey_instance.has_method("setup"):
		_current_survey_instance.setup(match_data)

	_last_post_match_survey_time = Time.get_unix_time_from_system()
	_save_cooldown_data()
	survey_shown.emit("post_match")


func show_post_purchase_survey(product_id: String, gems_awarded: int) -> void:
	if not can_show_survey("post_purchase"):
		return

	_current_survey_instance = POST_PURCHASE_SURVEY_SCENE.instantiate() as Control
	if not _current_survey_instance:
		return

	_current_survey_instance.name = "PostPurchaseSurvey"
	_current_survey_instance.survey_submitted.connect(_on_survey_submitted_from_ui)
	_current_survey_instance.survey_dismissed.connect(_on_survey_dismissed_from_ui)

	var current_scene: Node = get_tree().current_scene
	if current_scene:
		current_scene.add_child(_current_survey_instance)

	if _current_survey_instance.has_method("setup"):
		_current_survey_instance.setup(product_id, gems_awarded)

	_last_post_purchase_survey_time = Time.get_unix_time_from_system()
	_save_cooldown_data()
	survey_shown.emit("post_purchase")


func dismiss_survey() -> void:
	if _current_survey_instance:
		_current_survey_instance.queue_free()
		_current_survey_instance = null


func submit_survey(survey_type: String, survey_data: Dictionary) -> void:
	var network_manager: Node = get_node_or_null("/root/NetworkManager")
	if not network_manager or not network_manager.has_method("send_rpc"):
		survey_submission_failed.emit(survey_type, "Network unavailable")
		return

	var payload: String = JSON.stringify({
		"survey_type": survey_type,
		"survey_data": survey_data,
		"client_timestamp": int(Time.get_unix_time_from_system()),
	})

	var response: Dictionary = await network_manager.send_rpc(RPC_SUBMIT_SURVEY, payload)

	if response == null or response.has("error"):
		var error: String = response.get("error", "Unknown error") if response else "No response"
		survey_submission_failed.emit(survey_type, error)
		return

	survey_submitted.emit(survey_type)
	dismiss_survey()


# --- Signal callbacks ---

func _on_results_shown(result_data: Dictionary) -> void:
	_last_match_data = result_data


func _on_results_closed() -> void:
	show_post_match_survey(_last_match_data)


func _on_purchase_succeeded(product_id: String, gems_awarded: int) -> void:
	show_post_purchase_survey(product_id, gems_awarded)


func _on_survey_submitted_from_ui(survey_type: String, survey_data: Dictionary) -> void:
	submit_survey(survey_type, survey_data)


func _on_survey_dismissed_from_ui() -> void:
	_current_survey_instance = null
	survey_dismissed.emit("unknown")


# --- Cooldown persistence ---

func _save_cooldown_data() -> void:
	var data: Dictionary = {
		"post_match": _last_post_match_survey_time,
		"post_purchase": _last_post_purchase_survey_time,
	}
	var file: FileAccess = FileAccess.open(COOLDOWN_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()


func _load_cooldown_data() -> void:
	if not FileAccess.file_exists(COOLDOWN_FILE):
		return
	var file: FileAccess = FileAccess.open(COOLDOWN_FILE, FileAccess.READ)
	if not file:
		return
	var json: JSON = JSON.new()
	if json.parse(file.get_as_text()) == OK:
		var data: Dictionary = json.data
		_last_post_match_survey_time = data.get("post_match", 0.0)
		_last_post_purchase_survey_time = data.get("post_purchase", 0.0)
	file.close()
