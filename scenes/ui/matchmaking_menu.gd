extends Control

# --- UI References ---
@onready var rank_label: Label = $SafeAreaContainer/VBoxContainer/TopPanel/StatsContainer/RankLabel
@onready var match_type_option: OptionButton = $SafeAreaContainer/VBoxContainer/FilterPanel/MatchTypeOption
@onready var list_button: Button = $SafeAreaContainer/VBoxContainer/FilterPanel/ListButton
@onready var matches_container: VBoxContainer = $SafeAreaContainer/VBoxContainer/ScrollContainer/MatchesContainer
@onready var create_ranked_button: Button = $SafeAreaContainer/VBoxContainer/CreatePanel/CreateVBox/CreateRankedButton
@onready var create_casual_button: Button = $SafeAreaContainer/VBoxContainer/CreatePanel/CreateVBox/CreateCasualButton
@onready var punch_up_check: CheckBox = $SafeAreaContainer/VBoxContainer/CreatePanel/CreateVBox/PunchUpCheck
@onready var leaderboard_button: Button = $SafeAreaContainer/VBoxContainer/BottomPanel/LeaderboardButton
@onready var back_button: Button = $SafeAreaContainer/VBoxContainer/BottomPanel/BackButton
@onready var loading_label: Label = $SafeAreaContainer/VBoxContainer/LoadingLabel
@onready var punch_up_stats_label: Label = $SafeAreaContainer/VBoxContainer/TopPanel/StatsContainer/PunchUpStatsLabel

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- State ---
var matchmaker_manager: Node = null
var current_matches: Array = []

# --- Initialization ---
func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")
	
	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")
	
	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)
	
	matchmaker_manager = get_node_or_null("/root/MatchmakerManager")

	match_type_option.add_item("All", 0)
	match_type_option.add_item("Ranked", 1)
	match_type_option.add_item("Casual", 2)

	list_button.pressed.connect(_on_list_pressed)
	create_ranked_button.pressed.connect(_on_create_ranked_pressed)
	create_casual_button.pressed.connect(_on_create_casual_pressed)
	leaderboard_button.pressed.connect(_on_leaderboard_pressed)
	back_button.pressed.connect(_on_back_pressed)

	if matchmaker_manager:
		matchmaker_manager.matches_loaded.connect(_on_matches_loaded)
		matchmaker_manager.match_created.connect(_on_match_created)
		matchmaker_manager.match_accepted.connect(_on_match_accepted)
		matchmaker_manager.punch_up_stats_updated.connect(_on_punch_up_stats_updated)

	refresh_matches()
	_update_punch_up_stats_display()

# --- List Matches ---
func _on_list_pressed() -> void:
	refresh_matches()

func refresh_matches() -> void:
	if not matchmaker_manager:
		return

	loading_label.visible = true
	matches_container.visible = false

	var match_type: String = ""
	match match_type_option.selected:
		1:
			match_type = "ranked"
		2:
			match_type = "casual"
		_:
			match_type = ""

	matchmaker_manager.list_matches(match_type, 0, 0, 20)

# --- Create Match ---
func _on_create_ranked_pressed() -> void:
	if not matchmaker_manager:
		return

	var is_punch_up: bool = punch_up_check.button_pressed
	matchmaker_manager.create_match("ranked", is_punch_up)

func _on_create_casual_pressed() -> void:
	if not matchmaker_manager:
		return

	var is_punch_up: bool = punch_up_check.button_pressed
	matchmaker_manager.create_match("casual", is_punch_up)

# --- Match Handlers ---
func _on_matches_loaded(matches: Array, player_rank: int) -> void:
	current_matches = matches
	loading_label.visible = false
	matches_container.visible = true

	rank_label.text = "Rank: %d" % player_rank

	for child in matches_container.get_children():
		child.queue_free()

	if matches.is_empty():
		var no_matches_label: Label = Label.new()
		no_matches_label.text = "No matches available"
		no_matches_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		matches_container.add_child(no_matches_label)
	else:
		for match_data in matches:
			var match_item = _create_match_item(match_data)
			matches_container.add_child(match_item)

func _create_match_item(match_data: Dictionary) -> Control:
	var item: HBoxContainer = HBoxContainer.new()

	var info_vbox: VBoxContainer = VBoxContainer.new()
	info_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var type_label: Label = Label.new()
	type_label.text = "%s" % match_data.get("match_type", "unknown").capitalize()
	
	# Apply theme text color
	if theme_manager:
		type_label.modulate = theme_manager.get_text_primary_color()

	var opponent_rank: int = match_data.get("creator_rank", 0)
	var player_rank_val: int = matchmaker_manager.get_player_rank_sync() if matchmaker_manager else 0

	var rank_label: Label = Label.new()
	rank_label.text = "Opponent Rank: %d" % opponent_rank
	
	# Apply theme text color
	if theme_manager:
		rank_label.modulate = theme_manager.get_text_secondary_color()

	# Display rank difference - use DesignTokens colors
	var rank_diff_label: Label = Label.new()
	var rank_diff: int = opponent_rank - player_rank_val
	
	var success_color = DesignTokens.COLOR_SUCCESS if design_tokens else Color.GREEN
	var warning_color = DesignTokens.COLOR_WARNING if design_tokens else Color.ORANGE
	var error_color = DesignTokens.COLOR_ERROR if design_tokens else Color.RED
	
	if rank_diff > 0:
		rank_diff_label.text = "(+%d above you)" % rank_diff
		rank_diff_label.modulate = warning_color  # Orange for higher rank
	elif rank_diff < 0:
		rank_diff_label.text = "(%d below you)" % rank_diff
		rank_diff_label.modulate = success_color  # Green for lower rank
	else:
		rank_diff_label.text = "(same rank)"
		if theme_manager:
			rank_diff_label.modulate = theme_manager.get_text_secondary_color()

	var punch_up_label: Label = Label.new()
	if match_data.get("is_punch_up", false):
		punch_up_label.text = "Punch Up Challenge!"
		punch_up_label.modulate = error_color  # Red for punch up

	info_vbox.add_child(type_label)
	info_vbox.add_child(rank_label)
	info_vbox.add_child(rank_diff_label)
	if match_data.get("is_punch_up", false):
		info_vbox.add_child(punch_up_label)

	var accept_button: Button = Button.new()
	accept_button.text = "Accept"
	
	# Style button with DesignTokens
	if design_tokens:
		accept_button.modulate = DesignTokens.COLOR_PRIMARY
	
	accept_button.pressed.connect(_on_accept_match.bind(match_data.get("match_id", "")))

	item.add_child(info_vbox)
	item.add_child(accept_button)

	return item

func _on_accept_match(match_id: String) -> void:
	if not matchmaker_manager:
		return

	matchmaker_manager.accept_match(match_id)

func _on_leaderboard_pressed() -> void:
	var result = get_tree().change_scene_to_file("res://scenes/ui/leaderboard_menu.tscn")

func _on_match_created(match_data: Dictionary) -> void:
	print("Match created: %s" % match_data.get("match_id", ""))
	_show_match_created_dialog(match_data)

func _on_match_accepted(match_data: Dictionary) -> void:
	print("Match accepted: %s" % match_data.get("match_id", ""))
	_show_match_accepted_dialog(match_data)

func _on_match_accepted_dialog_confirmed(match_data: Dictionary) -> void:
	var combat_scene = load("res://scenes/ui/combat_menu.tscn")
	var combat_ui = combat_scene.instantiate()
	combat_ui.set_match_id(match_data.get("match_id", ""))
	get_tree().current_scene.add_child(combat_ui)

func _show_match_created_dialog(_match_data: Dictionary) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Match Created"
	dialog.dialog_text = "Your match has been created!\nWaiting for opponent..."
	dialog.unresizable = true

	get_tree().current_scene.add_child(dialog)
	dialog.show()

	back_button.pressed.connect(dialog.queue_free.unbind(1), CONNECT_DEFERRED)

func _show_match_accepted_dialog(match_data: Dictionary) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Match Accepted"
	dialog.dialog_text = "Match joined successfully!\nGood luck!"
	dialog.unresizable = true

	get_tree().current_scene.add_child(dialog)
	dialog.show()

	dialog.confirmed.connect(_on_match_accepted_dialog_confirmed.bind(match_data))
	back_button.pressed.connect(dialog.queue_free.unbind(1), CONNECT_DEFERRED)

# --- Navigation ---
func _on_back_pressed() -> void:
	var result = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if matchmaker_manager:
		if matchmaker_manager.matches_loaded.is_connected(_on_matches_loaded):
			matchmaker_manager.matches_loaded.disconnect(_on_matches_loaded)
		if matchmaker_manager.match_created.is_connected(_on_match_created):
			matchmaker_manager.match_created.disconnect(_on_match_created)
		if matchmaker_manager.match_accepted.is_connected(_on_match_accepted):
			matchmaker_manager.match_accepted.disconnect(_on_match_accepted)
		if matchmaker_manager.punch_up_stats_updated.is_connected(_on_punch_up_stats_updated):
			matchmaker_manager.punch_up_stats_updated.disconnect(_on_punch_up_stats_updated)
	
	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	
	# Apply background color
	modulate = colors["background"]
	
	# Apply colors to labels
	if loading_label:
		loading_label.modulate = colors["text_secondary"]
	if rank_label:
		rank_label.modulate = colors["text_primary"]
	if punch_up_stats_label:
		punch_up_stats_label.modulate = colors["text_secondary"]
	
	# Refresh matches to apply theme to entries
	if not current_matches.is_empty():
		_on_matches_loaded(current_matches, 0)

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()

# --- Punch Up Statistics ---
func _on_punch_up_stats_updated(_wins: int, _losses: int, _win_rate: float) -> void:
	"""Handles Punch Up statistics updates from MatchmakerManager."""
	_update_punch_up_stats_display()

func _update_punch_up_stats_display() -> void:
	"""Updates the Punch Up statistics display in the UI."""
	if not matchmaker_manager or punch_up_stats_label == null:
		return

	var wins: int = matchmaker_manager.get_punch_up_wins()
	var losses: int = matchmaker_manager.get_punch_up_losses()
	var win_rate: float = matchmaker_manager.get_punch_up_win_rate()
	var total: int = wins + losses

	if total == 0:
		punch_up_stats_label.text = "Punch Up: No matches yet"
	else:
		var win_rate_percent: int = int(win_rate * 100)
		punch_up_stats_label.text = "Punch Up: %dW/%dL (%d%%)" % [wins, losses, win_rate_percent]
