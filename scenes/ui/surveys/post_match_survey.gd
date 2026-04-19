## Post-match survey popup.
##
## Displays after PvP match results are closed. Collects experience,
## difficulty, and recommendation ratings plus optional free text.

extends Control

signal survey_submitted(survey_type: String, survey_data: Dictionary)
signal survey_dismissed()

var _experience_rating: int = 0
var _difficulty_rating: int = 0
var _would_recommend: int = 0
var _match_data: Dictionary = {}

@onready var _experience_stars: HBoxContainer = %ExperienceStars
@onready var _difficulty_stars: HBoxContainer = %DifficultyStars
@onready var _recommend_stars: HBoxContainer = %RecommendStars
@onready var _free_text_edit: TextEdit = %FreeTextEdit
@onready var _submit_button: Button = %SubmitButton
@onready var _skip_button: Button = %SkipButton


func _ready() -> void:
	_connect_star_signals(_experience_stars, "_on_experience_rated")
	_connect_star_signals(_difficulty_stars, "_on_difficulty_rated")
	_connect_star_signals(_recommend_stars, "_on_recommend_rated")
	_submit_button.pressed.connect(_on_submit_pressed)
	_skip_button.pressed.connect(_on_skip_pressed)
	_animate_in()


func setup(match_data: Dictionary) -> void:
	_match_data = match_data


func _connect_star_signals(container: HBoxContainer, callback_name: String) -> void:
	for child in container.get_children():
		if child is Button:
			var index: int = child.get_index() + 1
			child.pressed.connect(Callable(self, callback_name).bind(index))


func _on_experience_rated(rating: int) -> void:
	_experience_rating = rating
	_update_star_visual(_experience_stars, rating)


func _on_difficulty_rated(rating: int) -> void:
	_difficulty_rating = rating
	_update_star_visual(_difficulty_stars, rating)


func _on_recommend_rated(rating: int) -> void:
	_would_recommend = rating
	_update_star_visual(_recommend_stars, rating)


func _update_star_visual(container: HBoxContainer, rating: int) -> void:
	for child in container.get_children():
		if child is Button:
			var index: int = child.get_index() + 1
			child.modulate = Color(1.0, 0.84, 0.0) if index <= rating else Color(0.5, 0.5, 0.5, 0.6)


func _on_submit_pressed() -> void:
	if _experience_rating == 0 and _difficulty_rating == 0 and _would_recommend == 0:
		return

	var data: Dictionary = {}
	if _experience_rating > 0:
		data["experience_rating"] = _experience_rating
	if _difficulty_rating > 0:
		data["difficulty_rating"] = _difficulty_rating
	if _would_recommend > 0:
		data["would_recommend"] = _would_recommend

	data["match_id"] = _match_data.get("match_id", "")
	data["match_type"] = _match_data.get("match_type", "")
	data["is_victory"] = _match_data.get("is_victory", false)

	var free_text: String = _free_text_edit.text.strip_edges()
	if not free_text.is_empty():
		data["free_text"] = free_text.left(500)

	survey_submitted.emit("post_match", data)
	_animate_out()


func _on_skip_pressed() -> void:
	survey_dismissed.emit()
	_animate_out()


func _animate_in() -> void:
	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.2)
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_CUBIC)


func _animate_out() -> void:
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.2)
	tween.set_ease(Tween.EASE_IN)
	tween.set_trans(Tween.TRANS_CUBIC)
	tween.tween_callback(queue_free)
