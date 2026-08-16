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

# --- New UI References (added in enhanced scene) ---
@onready var motivational_label: Label = $VBoxContainer/YourRankPanel/MotivationalLabel
@onready var tier_progress_bar: ProgressBar = $VBoxContainer/YourRankPanel/TierProgressBar
@onready var tier_progress_label: Label = $VBoxContainer/YourRankPanel/TierProgressLabel
@onready var decay_warning_label: Label = $VBoxContainer/YourRankPanel/DecayWarningLabel
@onready var season_message_panel: Control = $SeasonMessagePanel
@onready var reward_preview_panel: Control = $RewardPreviewPanel
@onready var preview_rewards_button: Button = $VBoxContainer/BottomPanel/PreviewRewardsButton

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- State ---
var season_manager: Node = null
var season_messenger: Node = null
var is_initialized: bool = false

# --- Rank Colors ---
const RANK_COLORS = {
	1: Color("#FFD700"),   # Gold for 1st
	2: Color("#C0C0C0"),   # Silver for 2nd
	3: Color("#CD7F32"),   # Bronze for 3rd
}

# --- Tier Boundaries for Progress ---
const TIER_BOUNDARIES: Dictionary = {
	"Legendary": 10,
	"Epic": 50,
	"Rare": 100,
	"Uncommon": 500,
	"Common": 99999,
}

# --- Initialization ---
func _ready() -> void:
	theme_manager = get_node_or_null("/root/ThemeManager")
	design_tokens = get_node_or_null("/root/ArcherDesignTokens")

	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	season_manager = get_node_or_null("/root/SeasonManager")
	season_messenger = get_node_or_null("/root/SeasonMessenger")

	rewards_button.pressed.connect(_on_rewards_pressed)
	back_button.pressed.connect(_on_back_pressed)

	if preview_rewards_button:
		preview_rewards_button.pressed.connect(_on_preview_rewards_pressed)

	# Hide optional UI elements until data is loaded
	if decay_warning_label:
		decay_warning_label.visible = false
	if tier_progress_bar:
		tier_progress_bar.visible = false
	if tier_progress_label:
		tier_progress_label.visible = false

	if season_manager:
		season_manager.season_info_loaded.connect(_on_season_info_loaded)
		season_manager.leaderboard_loaded.connect(_on_leaderboard_loaded)
		season_manager.rewards_claimed.connect(_on_rewards_claimed)
		season_manager.season_transitioned.connect(_on_season_transitioned)
		season_manager.decay_info_updated.connect(_on_decay_info_updated)

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
	var standing: int = data.get("player_rank", 0)
	var ladder_rating: int = data.get("player_score", 0)

	season_label.text = "Season %d" % season_number
	time_label.text = "Time Remaining: %s" % season_manager.format_time_remaining()

	if standing > 0:
		your_rank_label.text = "Your Standing: #%d (Ladder Rating: %d)" % [standing, ladder_rating]
		var tier: String = season_manager.get_rank_tier(standing)
		your_tier_label.text = "Tier: %s" % tier
		your_tier_label.modulate = season_manager.get_rank_color(standing)
		_update_motivational_message(standing)
		_update_tier_progress(standing)
	else:
		your_rank_label.text = "Not on the leaderboard yet"
		your_tier_label.text = "Play PvP to earn a standing!"
		if motivational_label:
			motivational_label.text = "Play PvP matches to climb the leaderboard!"
		if tier_progress_bar:
			tier_progress_bar.visible = false
		if tier_progress_label:
			tier_progress_label.visible = false

# --- Motivational Messaging ---
func _update_motivational_message(standing: int) -> void:
	if not motivational_label:
		return

	if season_messenger:
		motivational_label.text = season_messenger.get_motivational_message(standing)
	else:
		if standing <= 10:
			motivational_label.text = "Top 10! Defend your Legendary position!"
		elif standing <= 50:
			motivational_label.text = "Standing #%d! Push for Legendary!" % standing
		else:
			motivational_label.text = "Standing #%d. Keep climbing!" % standing

# --- Tier Progress Bar ---
func _update_tier_progress(standing: int) -> void:
	if not tier_progress_bar or not tier_progress_label or not season_manager:
		return

	var current_tier: String = season_manager.get_rank_tier(standing)
	var threshold: int = TIER_BOUNDARIES.get(current_tier, 99999)

	if current_tier == "Legendary":
		tier_progress_bar.visible = false
		tier_progress_label.visible = true
		tier_progress_label.text = "Max tier reached!"
		return

	# Find the current tier's upper bound and next tier's threshold
	var tier_order: Array = ["Common", "Uncommon", "Rare", "Epic", "Legendary"]
	var current_idx: int = tier_order.find(current_tier)
	if current_idx < 0:
		return

	# Calculate progress to next tier
	var next_tier: String = tier_order[current_idx + 1] if current_idx + 1 < tier_order.size() else ""
	var next_threshold: int = TIER_BOUNDARIES.get(next_tier, 0)

	if next_threshold <= 0:
		return

	# Progress: a lower (better) standing = closer to the next tier.
	# The player needs to climb to next_threshold standing to advance.
	var spots_needed: int = standing - next_threshold
	var current_tier_upper: int = TIER_BOUNDARIES.get(current_tier, 99999)
	var tier_range: int = current_tier_upper - next_threshold
	var progress_in_tier: int = current_tier_upper - standing

	if tier_range > 0:
		var progress_pct: float = clampf(float(progress_in_tier) / float(tier_range), 0.0, 1.0)
		tier_progress_bar.value = progress_pct * 100.0
		tier_progress_bar.visible = true

	tier_progress_label.visible = true
	tier_progress_label.text = "%d spots to %s tier" % [spots_needed, next_tier]

# --- Decay Warning ---
func _on_decay_info_updated(info: Dictionary) -> void:
	if not decay_warning_label:
		return

	if info.get("can_decay", false):
		var points_at_risk: int = info.get("points_at_risk", 0)
		decay_warning_label.text = "Ladder Rating decaying! %d pts at risk" % points_at_risk
		decay_warning_label.modulate = Color("#FF7351")
		decay_warning_label.visible = true
	else:
		decay_warning_label.visible = false

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

	if rank_value <= 3:
		rank_label.modulate = RANK_COLORS.get(rank_value, Color.WHITE)
	elif rank_value <= 10:
		rank_label.modulate = ArcherDesignTokens.COLOR_GOLD if design_tokens else Color.GOLD
	elif rank_value <= 50:
		rank_label.modulate = Color.SILVER
	elif rank_value <= 100:
		rank_label.modulate = Color("#CD7F32")

	rank_container.add_child(rank_label)

	# Tier badge next to rank for top tiers
	if rank_value <= 100 and season_manager:
		var tier_badge: Label = Label.new()
		var tier: String = season_manager.get_rank_tier(rank_value)
		tier_badge.text = "[%s]" % tier.left(1).to_upper()
		tier_badge.modulate = season_manager.get_rank_color(rank_value)
		tier_badge.custom_minimum_size = Vector2(30, 0)
		rank_container.add_child(tier_badge)

	var username_label: Label = Label.new()
	username_label.text = entry.get("username", "Unknown")
	username_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	if theme_manager:
		username_label.modulate = theme_manager.get_text_color()

	var score_label: Label = Label.new()
	score_label.text = str(entry.get("score", 0))
	score_label.custom_minimum_size = Vector2(100, 0)

	if theme_manager:
		score_label.modulate = theme_manager.get_text_color()

	var meta: Dictionary = entry.get("meta", {})
	var wins: int = meta.get("wins", 0)
	var losses: int = meta.get("losses", 0)
	var win_rate: float = meta.get("win_rate", 0.0)

	var stats_label: Label = Label.new()
	stats_label.text = "%dW-%dL (%.1f%%)" % [wins, losses, win_rate * 100]
	stats_label.custom_minimum_size = Vector2(120, 0)

	if theme_manager:
		stats_label.modulate = theme_manager.get_text_color()

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

# --- Reward Preview ---
func _on_preview_rewards_pressed() -> void:
	if not reward_preview_panel or not season_manager:
		return

	var player_rank: int = season_manager.get_player_rank_sync()
	reward_preview_panel.show_for_rank(player_rank)

# --- Season Transition Handler ---
func _on_season_transitioned(old_season: Dictionary, new_season: Dictionary) -> void:
	var old_season_number: int = old_season.get("season_number", 0)
	var new_season_number: int = new_season.get("season_number", 0)

	if season_label:
		season_label.text = "Season %d" % new_season_number

	if time_label:
		time_label.text = "Season just started!"

	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Season Complete!"
	dialog.unresizable = true

	var dialog_text: String = "Season %d has ended!\n\n" % old_season_number
	dialog_text += "Season %d has begun.\n\n" % new_season_number
	dialog_text += "Your Ladder Rating has been soft-reset.\n\n"
	dialog_text += "Play matches to climb the new leaderboard!"

	dialog.dialog_text = dialog_text

	get_tree().current_scene.add_child(dialog)
	dialog.show()

	refresh_leaderboard()

# --- Navigation ---
func _on_back_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")


func _exit_tree() -> void:
	if season_manager:
		if season_manager.season_info_loaded.is_connected(_on_season_info_loaded):
			season_manager.season_info_loaded.disconnect(_on_season_info_loaded)
		if season_manager.leaderboard_loaded.is_connected(_on_leaderboard_loaded):
			season_manager.leaderboard_loaded.disconnect(_on_leaderboard_loaded)
		if season_manager.rewards_claimed.is_connected(_on_rewards_claimed):
			season_manager.rewards_claimed.disconnect(_on_rewards_claimed)
		if season_manager.decay_info_updated.is_connected(_on_decay_info_updated):
			season_manager.decay_info_updated.disconnect(_on_decay_info_updated)

	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	theme_manager.apply_background(self)

	if season_label:
		season_label.modulate = colors["on_surface"]
	if time_label:
		time_label.modulate = colors["on_surface"]
	if your_rank_label:
		your_rank_label.modulate = colors["on_surface"]
	if your_tier_label:
		your_tier_label.modulate = colors["on_surface"]
	if loading_label:
		loading_label.modulate = colors["on_surface"]
	if motivational_label:
		motivational_label.modulate = colors["on_surface_variant"]
	if tier_progress_label:
		tier_progress_label.modulate = colors["on_surface"]
	if decay_warning_label:
		decay_warning_label.modulate = colors.get("error", Color.RED)

	if is_initialized:
		refresh_leaderboard()

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
