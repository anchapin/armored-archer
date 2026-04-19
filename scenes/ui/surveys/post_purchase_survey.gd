## Post-purchase survey popup.
##
## Displays after a successful purchase. Collects satisfaction
## and value ratings plus optional free text.

extends Control

signal survey_submitted(survey_type: String, survey_data: Dictionary)
signal survey_dismissed()

var _satisfaction_rating: int = 0
var _value_rating: int = 0
var _product_id: String = ""
var _gems_awarded: int = 0

@onready var _satisfaction_stars: HBoxContainer = %SatisfactionStars
@onready var _value_stars: HBoxContainer = %ValueStars
@onready var _free_text_edit: TextEdit = %FreeTextEdit
@onready var _submit_button: Button = %SubmitButton
@onready var _skip_button: Button = %SkipButton


func _ready() -> void:
	_connect_star_signals(_satisfaction_stars, "_on_satisfaction_rated")
	_connect_star_signals(_value_stars, "_on_value_rated")
	_submit_button.pressed.connect(_on_submit_pressed)
	_skip_button.pressed.connect(_on_skip_pressed)
	_animate_in()


func setup(product_id: String, gems_awarded: int) -> void:
	_product_id = product_id
	_gems_awarded = gems_awarded


func _connect_star_signals(container: HBoxContainer, callback_name: String) -> void:
	for child in container.get_children():
		if child is Button:
			var index: int = child.get_index() + 1
			child.pressed.connect(Callable(self, callback_name).bind(index))


func _on_satisfaction_rated(rating: int) -> void:
	_satisfaction_rating = rating
	_update_star_visual(_satisfaction_stars, rating)


func _on_value_rated(rating: int) -> void:
	_value_rating = rating
	_update_star_visual(_value_stars, rating)


func _update_star_visual(container: HBoxContainer, rating: int) -> void:
	for child in container.get_children():
		if child is Button:
			var index: int = child.get_index() + 1
			child.modulate = Color(1.0, 0.84, 0.0) if index <= rating else Color(0.5, 0.5, 0.5, 0.6)


func _on_submit_pressed() -> void:
	if _satisfaction_rating == 0 and _value_rating == 0:
		return

	var data: Dictionary = {}
	if _satisfaction_rating > 0:
		data["satisfaction_rating"] = _satisfaction_rating
	if _value_rating > 0:
		data["value_rating"] = _value_rating

	data["product_id"] = _product_id
	data["gems_awarded"] = _gems_awarded

	var free_text: String = _free_text_edit.text.strip_edges()
	if not free_text.is_empty():
		data["free_text"] = free_text.left(500)

	survey_submitted.emit("post_purchase", data)
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
