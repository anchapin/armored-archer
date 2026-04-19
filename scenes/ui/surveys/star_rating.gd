## Star rating component for survey popups.
##
## Attach to an HBoxContainer with 5 Button children.
## Emits rating_changed when the user selects a rating.

extends HBoxContainer

signal rating_changed(rating: int)

var current_rating: int = 0

var _star_buttons: Array[Button] = []

func _ready() -> void:
	for child in get_children():
		if child is Button:
			var btn: Button = child as Button
			_star_buttons.append(btn)
			var index: int = _star_buttons.size()
			btn.pressed.connect(_on_star_pressed.bind(index))
	_update_visual()

func _on_star_pressed(index: int) -> void:
	current_rating = index
	_update_visual()
	rating_changed.emit(current_rating)

func _update_visual() -> void:
	for i in range(_star_buttons.size()):
		var filled: bool = (i + 1) <= current_rating
		_star_buttons[i].modulate = Color(1.0, 0.84, 0.0) if filled else Color(0.5, 0.5, 0.5, 0.6)

func reset() -> void:
	current_rating = 0
	_update_visual()
