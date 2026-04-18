## Season History Dialog
## Displays historical season data and prestige progress in a modal dialog

extends Control

signal closed()

@onready var season_list_container: VBoxContainer = $DialogPanel/MarginContainer/VBoxContainer/SeasonScrollContainer/SeasonListContainer
@onready var close_button: Button = $DialogPanel/MarginContainer/VBoxContainer/ButtonContainer/CloseButton
@onready var empty_label: Label = $DialogPanel/MarginContainer/VBoxContainer/SeasonScrollContainer/SeasonListContainer/EmptyLabel
@onready var prestige_container: VBoxContainer = $DialogPanel/MarginContainer/VBoxContainer/PrestigeSection/PrestigeContainer

var season_history: Array = []

func _ready() -> void:
	close_button.pressed.connect(_on_close_button_pressed)

func show_history(history: Array, prestige_data: Dictionary = {}) -> void:
	"""Display season history and prestige progress in the dialog.

	Parameters:
		history: Array of season archive entries
		prestige_data: Player's prestige progress data
	"""
	season_history = history
	_update_prestige_display(prestige_data)
	_update_display()
	visible = true

func _update_prestige_display(prestige_data: Dictionary) -> void:
	"""Update the prestige progress section."""
	for child in prestige_container.get_children():
		child.queue_free()

	if prestige_data.is_empty():
		var no_prestige_label: Label = Label.new()
		no_prestige_label.text = "No prestige earned yet. Finish in the top 100 across multiple seasons!"
		no_prestige_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		prestige_container.add_child(no_prestige_label)
		return

	var tiers_earned: Array = prestige_data.get("tiers_earned", [])
	var tier_progress: Array = prestige_data.get("tier_progress", [])

	# Show earned tiers
	if not tiers_earned.is_empty():
		var earned_label: Label = Label.new()
		earned_label.text = "Earned: %s" % ", ".join(tiers_earned)
		prestige_container.add_child(earned_label)

	# Show progress toward each tier
	for tier_info in tier_progress:
		var tier_name: String = tier_info.get("tier", "")
		var earned: bool = tier_info.get("earned", false)
		var qualifying: int = tier_info.get("qualifying_seasons", 0)
		var required: int = tier_info.get("required_seasons", 0)
		var title: String = tier_info.get("title", "")

		var tier_label: Label = Label.new()
		if earned:
			tier_label.text = "  %s [%s] - EARNED" % [title, tier_name.capitalize()]
		else:
			tier_label.text = "  %s [%s] - %d/%d qualifying seasons" % [title, tier_name.capitalize(), qualifying, required]
		prestige_container.add_child(tier_label)

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