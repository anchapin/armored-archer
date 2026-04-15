## Match Results Screen Controller
##
## Displays comprehensive match results including XP gained, rank changes, season position,
## and other progression data after a PvP match completion.
##
## Signals (Emitted):
## - results_closed(): Emitted when player closes the results screen
## - replay_requested(): Emitted when player wants to watch replay (stretch)
## - continue_to_menu(): Emitted when player continues to main menu

extends Control

# --- Signals ---
signal results_closed()
signal replay_requested()
signal continue_to_menu()

# --- Node References ---
@onready var outcome_label: Label = get_node_or_null("OutcomeLabel")
@onready var xp_gained_label: Label = get_node_or_null("XPGainedLabel")
@onready var xp_animation: AnimationPlayer = get_node_or_null("XPAnimation/AnimationPlayer")
@onready var rank_change_container: Control = get_node_or_null("RankChangeContainer")
@onready var old_rank_label: Label = get_node_or_null("RankChangeContainer/OldRankLabel")
@onready var new_rank_label: Label = get_node_or_null("RankChangeContainer/NewRankLabel")
@onready var rank_delta_label: Label = get_node_or_null("RankChangeContainer/RankDeltaLabel")
@onready var rank_change_arrow: TextureRect = get_node_or_null("RankChangeContainer/ArrowIcon")
@onready var season_position_label: Label = get_node_or_null("SeasonPositionLabel")
@onready var rewards_container: VBoxContainer = get_node_or_null("RewardsContainer")
@onready var continue_button: Button = get_node_or_null("ContinueButton")
@onready var match_details_label: Label = get_node_or_null("MatchDetailsLabel")

# --- State ---
var _match_result_data: Dictionary = {}
var _season_manager: Node
var _player_stats_manager: Node
var _player_rating_manager: Node

# --- Constants ---
const VICTORY_COLOR: Color = Color(0.2, 0.8, 0.2, 1.0)  # Green
const DEFEAT_COLOR: Color = Color(0.8, 0.2, 0.2, 1.0)   # Red
const NEUTRAL_COLOR: Color = Color(0.5, 0.5, 0.5, 1.0)   # Gray

# --- Animation constants ---
const XP_POPUP_SCALE: float = 1.3
const XP_POPUP_DURATION: float = 0.3
const RANK_CHANGE_DURATION: float = 1.0

## Initialize and connect signals
func _ready() -> void:
	_season_manager = get_node_or_null("/root/SeasonManager")
	_player_stats_manager = get_node_or_null("/root/PlayerStatsManager")
	_player_rating_manager = get_node_or_null("/root/PlayerRatingManager")

	# Connect continue button
	if continue_button:
		continue_button.pressed.connect(_on_continue_pressed)

	# Hide initially - MatchResultsManager will show this scene
	visible = false

## Display match results with comprehensive data
##
## @param result_data: Dictionary containing match result data
## Expected format:
## {
##   "winner_id": "user_id",
##   "loser_id": "user_id",
##   "is_victory": bool,
##   "match_type": "ranked" | "casual",
##   "is_punch_up": bool,
##   "xp_gained": int,
##   "old_rank": int,
##   "new_rank": int,
##   "rank_delta": int,
##   "season_position": int,
##   "season_delta": int,
##   "match_duration": float (in seconds),
##   "rewards": Array
## }
func show_match_results(result_data: Dictionary) -> void:
	_match_result_data = result_data

	# Set outcome
	_set_outcome(result_data.get("is_victory", false))

	# Set XP gained
	_set_xp_gained(result_data.get("xp_gained", 0))

	# Set rank change
	_set_rank_change(
		result_data.get("old_rank", 0),
		result_data.get("new_rank", 0),
		result_data.get("rank_delta", 0)
	)

	# Set season position
	_set_season_position(
		result_data.get("season_position", 0),
		result_data.get("season_delta", 0)
	)

	# Set rewards
	_set_rewards(result_data.get("rewards", []))

	# Set match details
	_set_match_details(result_data)

	# Show the screen with animation
	visible = true
	_play_appear_animation()

## Set the match outcome (Victory/Defeat)
func _set_outcome(is_victory: bool) -> void:
	if not outcome_label:
		return

	var text: String = "VICTORY" if is_victory else "DEFEAT"
	outcome_label.text = text

	if is_victory:
		outcome_label.modulate = VICTORY_COLOR
	else:
		outcome_label.modulate = DEFEAT_COLOR

## Set XP gained with animation
func _set_xp_gained(xp: int) -> void:
	if not xp_gained_label:
		return

	xp_gained_label.text = "+%d XP" % xp

	if xp > 0 and xp_animation:
		xp_animation.play("popup")
		await xp_animation.animation_finished
		xp_animation.stop()

## Set rank change with old, new, and delta values
func _set_rank_change(old_rank: int, new_rank: int, delta: int) -> void:
	if not old_rank_label or not new_rank_label or not rank_delta_label:
		return

	old_rank_label.text = str(old_rank)
	new_rank_label.text = str(new_rank)

	if delta > 0:
		rank_delta_label.text = "+%d" % delta
		rank_delta_label.modulate = VICTORY_COLOR
		_play_rank_arrow_up()
	elif delta < 0:
		rank_delta_label.text = "%d" % delta
		rank_delta_label.modulate = DEFEAT_COLOR
		_play_rank_arrow_down()
	else:
		rank_delta_label.text = "0"
		rank_delta_label.modulate = NEUTRAL_COLOR
		if rank_change_arrow:
			rank_change_arrow.modulate = NEUTRAL_COLOR

## Set season position and change
func _set_season_position(position: int, delta: int) -> void:
	if not season_position_label:
		return

	var position_text: String = "Season Rank: #%d" % position
	if delta != 0:
		var sign: String = "+" if delta > 0 else ""
		var delta_text: String = " (%s%d)" % [sign, delta]
		position_text += delta_text

	season_position_label.text = position_text

## Set rewards display
func _set_rewards(rewards: Array) -> void:
	if not rewards_container:
		return

	# Clear existing rewards
	for child in rewards_container.get_children():
		if child.name != "RewardsLabel":  # Keep the label
			child.queue_free()

	# Add new rewards
	for reward in rewards:
		var reward_item = _create_reward_item(reward)
		rewards_container.add_child(reward_item)

## Create a reward item display
func _create_reward_item(reward_data: Dictionary) -> Control:
	var reward_item = HBoxContainer.new()

	var icon_texture = TextureRect.new()
	icon_texture.custom_minimum_size = Vector2(32, 32)
	icon_texture.custom_minimum_size = Vector2(32, 32)

	var label = Label.new()
	label.text = reward_data.get("name", "Unknown Reward")

	var quantity = reward_data.get("quantity", 1)
	if quantity > 1:
		label.text += " x%d" % quantity

	reward_item.add_child(icon_texture)
	reward_item.add_child(label)

	return reward_item

## Set match details (type, duration, punch-up status)
func _set_match_details(data: Dictionary) -> void:
	if not match_details_label:
		return

	var details: Array = []

	# Match type
	var match_type: String = data.get("match_type", "Ranked")
	details.append(match_type.capitalize())

	# Punch-up status
	if data.get("is_punch_up", false):
		details.append("Punch-Up")

	# Duration
	var duration: float = data.get("match_duration", 0.0)
	if duration > 0:
		var minutes: int = int(duration / 60.0)
		var seconds: int = int(duration) % 60
		details.append("%d:%02d" % [minutes, seconds])

	match_details_label.text = " | ".join(details)

## Play appear animation for the whole screen
func _play_appear_animation() -> void:
	var tween = create_tween()
	tween.set_parallel(true)

	# Animate in from bottom
	position = Vector2(0, get_viewport_rect().size.y)
	tween.tween_property(self, "position", Vector2(0, 0), 0.5)
	tween.set_ease(Tween.EASE_OUT_BACK)
	tween.play()

## Play rank arrow up animation
func _play_rank_arrow_up() -> void:
	if not rank_change_arrow:
		return

	var tween = create_tween()
	tween.set_parallel(false)
	var base_position: Vector2 = rank_change_arrow.position
	var up_offset: Vector2 = Vector2(0, -10)

	tween.tween_property(rank_change_arrow, "position", base_position, 0.0)
	tween.tween_property(rank_change_arrow, "position", base_position + up_offset, RANK_CHANGE_DURATION)
	tween.tween_property(rank_change_arrow, "position", base_position, RANK_CHANGE_DURATION)
	tween.set_ease(Tween.EASE_IN_OUT_SINE)
	tween.play()

## Play rank arrow down animation
func _play_rank_arrow_down() -> void:
	if not rank_change_arrow:
		return

	var tween = create_tween()
	tween.set_parallel(false)
	var base_position: Vector2 = rank_change_arrow.position
	var down_offset: Vector2 = Vector2(0, 10)

	tween.tween_property(rank_change_arrow, "position", base_position, 0.0)
	tween.tween_property(rank_change_arrow, "position", base_position + down_offset, RANK_CHANGE_DURATION)
	tween.tween_property(rank_change_arrow, "position", base_position, RANK_CHANGE_DURATION)
	tween.set_ease(Tween.EASE_IN_OUT_SINE)
	tween.play()

## Handle continue button press
func _on_continue_pressed() -> void:
	print("MatchResults: Continue pressed")

	# Hide screen with animation
	_play_disappear_animation()

## Play disappear animation and close screen
func _play_disappear_animation() -> void:
	var tween = create_tween()

	var target_position = Vector2(0, get_viewport_rect().size.y)
	tween.tween_property(self, "position", target_position, 0.3)
	tween.set_ease(Tween.EASE_IN_BACK)
	tween.play()

	await tween.finished

	# Emit signals
	results_closed.emit()
	continue_to_menu.emit()

	visible = false

## Load and display results from stored data
##
## @param match_id: The match ID to load results for
func load_match_results(match_id: String) -> void:
	print("MatchResults: Loading results for match ", match_id)

	# Try to load from storage (for replay/history feature)
	var network_manager = get_node_or_null("/root/NetworkManager")
	if not network_manager or not network_manager.has_method("get_storage_sync"):
		return

	var storage = network_manager.get_storage_sync()
	if not storage:
		return

	var stored_results = storage.get("match_results_" + match_id)
	if stored_results is String:
		var json = JSON.new()
		var error = json.parse(stored_results)
		if error == OK:
			show_match_results(json.data)

## Store match results for history/replay
##
## @param match_id: The match ID to store results for
## @param result_data: The result data to store
func store_match_results(match_id: String, result_data: Dictionary) -> void:
	var network_manager = get_node_or_null("/root/NetworkManager")
	if not network_manager or not network_manager.has_method("get_storage_sync"):
		return

	var storage = network_manager.get_storage_sync()
	if not storage:
		return

	storage.put("match_results_" + match_id, JSON.stringify(result_data))
	print("MatchResults: Stored results for match ", match_id)
