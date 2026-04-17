## Season History Dialog
## Displays historical season data in a modal dialog

extends Control

signal closed()

@onready var season_list_container: VBoxContainer = $DialogPanel/MarginContainer/VBoxContainer/SeasonScrollContainer/SeasonListContainer
@onready var close_button: Button = $DialogPanel/MarginContainer/VBoxContainer/ButtonContainer/CloseButton
@onready var empty_label: Label = $DialogPanel/MarginContainer/VBoxContainer/SeasonScrollContainer/SeasonListContainer/EmptyLabel

var season_history: Array = []

func _ready() -> void:
	close_button.pressed.connect(_on_close_button_pressed)

func show_history(history: Array) -> void:
	"""Display season history in the dialog.

	Parameters:
		history: Array of season archive entries
	"""
	season_history = history
	_update_display()
	visible = true

func _update_display() -> void:
	"""Update the dialog with current season history."""
	for child in season_list_container.get_children():
		if child != empty_label:
			child.queue_free()

	if season_history.is_empty():
		empty_label.visible = true
		return

	empty_label.visible = false

	for season in season_history:
		var entry = _create_season_entry(season)
		season_list_container.add_child(entry)

func _create_season_entry(season_data: Dictionary) -> Control:
	"""Create a UI element for a single season entry.

	Parameters:
		season_data: Season archive data

	Returns:
		Control: The season entry UI node
	"""
	var container: HBoxContainer = HBoxContainer.new()
	container.custom_minimum_size = Vector2(0, 60)

	var season_num: int = season_data.get("season_number", 0)
	var status: String = season_data.get("status", "ended")
	var winner_name: String = season_data.get("winner_name", "Unknown")
	var total_players: int = season_data.get("total_players", 0)

	var info_container: VBoxContainer = VBoxContainer.new()

	var season_label: Label = Label.new()
	season_label.text = "Season %d" % season_num
	info_container.add_child(season_label)

	var winner_label: Label = Label.new()
	winner_label.text = "Winner: %s" % winner_name
	info_container.add_child(winner_label)

	var players_label: Label = Label.new()
	players_label.text = "%d players" % total_players
	info_container.add_child(players_label)

	container.add_child(info_container)

	var reward_label: Label = Label.new()
	reward_label.text = "Rewards: %s" % ("Distributed" if season_data.get("rewards_distributed", false) else "Pending")
	reward_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	container.add_child(reward_label)

	return container

func _on_close_button_pressed() -> void:
	"""Handle close button press."""
	visible = false
	closed.emit()

func _on_background_pressed() -> void:
	"""Handle background click to close dialog."""
	visible = false
	closed.emit()