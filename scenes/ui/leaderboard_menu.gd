extends Control

# --- UI References ---
@onready var season_label: Label = $VBoxContainer/SeasonPanel/SeasonLabel
@onready var time_label: Label = $VBoxContainer/SeasonPanel/TimeLabel
@onready var your_rank_label: Label = $VBoxContainer/YourRankPanel/RankLabel
@onready var your_tier_label: Label = $VBoxContainer/YourRankPanel/TierLabel
@onready var leaderboard_container: VBoxContainer = $VBoxContainer/ScrollContainer/LeaderboardContainer
@onready var rewards_button: Button = $VBoxContainer/BottomPanel/RewardsButton
@onready var back_button: Button = $VBoxContainer/BottomPanel/BackButton
@onready var loading_label: Label = $VBoxContainer/LoadingLabel

# --- State ---
var season_manager: Node = null
var is_initialized: bool = false

# Custom colors for leaderboard ranks
const COLOR_BRONZE = Color(0.8, 0.5, 0.2)

# --- Initialization ---
func _ready() -> void:
	season_manager = get_node_or_null("/root/SeasonManager")

	rewards_button.pressed.connect(_on_rewards_pressed)
	back_button.pressed.connect(_on_back_pressed)

	if season_manager:
		season_manager.season_info_loaded.connect(_on_season_info_loaded)
		season_manager.leaderboard_loaded.connect(_on_leaderboard_loaded)
		season_manager.rewards_claimed.connect(_on_rewards_claimed)

	refresh_leaderboard()

# --- Load Data ---
func refresh_leaderboard() -> void:
	if not season_manager:
		return

	loading_label.visible = true
	is_initialized = false

	season_manager.get_season_info()
	season_manager.get_leaderboard(50)

# --- Season Info Handler ---
func _on_season_info_loaded(data: Dictionary) -> void:
	var season_info: Dictionary = data.get("season", {})
	var season_number: int = season_info.get("season_number", 1)
	var player_rank: int = data.get("player_rank", 0)
	var player_score: int = data.get("player_score", 0)

	season_label.text = "Season %d" % season_number
	time_label.text = "Time Remaining: %s" % season_manager.format_time_remaining()

	if player_rank > 0:
		your_rank_label.text = "Your Rank: #%d (%d Elo)" % [player_rank, player_score]
		var tier: String = season_manager.get_rank_tier(player_rank)
		your_tier_label.text = "Tier: %s" % tier
		your_tier_label.modulate = season_manager.get_rank_color(player_rank)
	else:
		your_rank_label.text = "Not ranked yet"
		your_tier_label.text = "Play PvP to get ranked!"

# --- Leaderboard Handler ---
func _on_leaderboard_loaded(leaderboard: Array) -> void:
	loading_label.visible = false
	is_initialized = true

	for child in leaderboard_container.get_children():
		child.queue_free()

	if leaderboard.is_empty():
		var no_entries_label: Label = Label.new()
		no_entries_label.text = "No leaderboard entries yet"
		no_entries_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		leaderboard_container.add_child(no_entries_label)
	else:
		for entry in leaderboard:
			var entry_item = _create_leaderboard_entry(entry)
			leaderboard_container.add_child(entry_item)

# --- Create Leaderboard Entry ---
func _create_leaderboard_entry(entry: Dictionary) -> Control:
	var item: HBoxContainer = HBoxContainer.new()

	var rank_container: HBoxContainer = HBoxContainer.new()
	var rank_label: Label = Label.new()
	var rank_value: int = entry.get("rank", 0)

	rank_label.text = "#%d" % rank_value
	rank_label.custom_minimum_size = Vector2(80, 0)

	if rank_value <= 10:
		rank_label.modulate = Color.GOLD
	elif rank_value <= 50:
		rank_label.modulate = Color.SILVER
	elif rank_value <= 100:
		rank_label.modulate = COLOR_BRONZE

	rank_container.add_child(rank_label)

	var username_label: Label = Label.new()
	username_label.text = entry.get("username", "Unknown")
	username_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var score_label: Label = Label.new()
	score_label.text = str(entry.get("score", 0))
	score_label.custom_minimum_size = Vector2(100, 0)

	var meta: Dictionary = entry.get("meta", {})
	var wins: int = meta.get("wins", 0)
	var losses: int = meta.get("losses", 0)
	var win_rate: float = meta.get("win_rate", 0.0)

	var stats_label: Label = Label.new()
	stats_label.text = "%dW-%dL (%.1f%%)" % [wins, losses, win_rate * 100]
	stats_label.custom_minimum_size = Vector2(120, 0)

	item.add_child(rank_container)
	item.add_child(username_label)
	item.add_child(score_label)
	item.add_child(stats_label)

	return item

# --- Rewards Handler ---
func _on_rewards_pressed() -> void:
	if not season_manager:
		return

	season_manager.get_season_rewards()

func _on_rewards_claimed(rewards: Dictionary) -> void:
	print("Rewards claimed: %s" % rewards)
	_show_rewards_dialog(rewards)

func _show_rewards_dialog(rewards: Dictionary) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Season Rewards"
	dialog.unresizable = true

	var tier: String = rewards.get("rank_tier", "common").capitalize()
	var coins: int = rewards.get("coins", 0)
	var gems: int = rewards.get("gems", 0)
	var cosmetics: Dictionary = rewards.get("cosmetics", {})

	var dialog_text: String = "Tier: %s\n\n" % tier
	dialog_text += "Rewards:\n"
	dialog_text += "- %d Coins\n" % coins
	if gems > 0:
		dialog_text += "- %d Gems\n" % gems

	if not cosmetics.is_empty():
		dialog_text += "\nCosmetics:\n"
		if cosmetics.has("title"):
			dialog_text += "- Title: %s\n" % cosmetics.title
		if cosmetics.has("aura"):
			dialog_text += "- Aura: %s\n" % cosmetics.aura

	dialog.dialog_text = dialog_text

	get_tree().current_scene.add_child(dialog)
	dialog.show()

# --- Navigation ---
func _on_back_pressed() -> void:
	var _ = get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if season_manager:
		if season_manager.season_info_loaded.is_connected(_on_season_info_loaded):
			season_manager.season_info_loaded.disconnect(_on_season_info_loaded)
		if season_manager.leaderboard_loaded.is_connected(_on_leaderboard_loaded):
			season_manager.leaderboard_loaded.disconnect(_on_leaderboard_loaded)
		if season_manager.rewards_claimed.is_connected(_on_rewards_claimed):
			season_manager.rewards_claimed.disconnect(_on_rewards_claimed)
