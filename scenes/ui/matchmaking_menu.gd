extends Control

# --- UI References ---
@onready var rank_label: Label = $VBoxContainer/TopPanel/StatsContainer/RankLabel
@onready var match_type_option: OptionButton = $VBoxContainer/FilterPanel/MatchTypeOption
@onready var list_button: Button = $VBoxContainer/FilterPanel/ListButton
@onready var matches_container: VBoxContainer = $VBoxContainer/ScrollContainer/MatchesContainer
@onready var create_ranked_button: Button = $VBoxContainer/CreatePanel/CreateRankedButton
@onready var create_casual_button: Button = $VBoxContainer/CreatePanel/CreateCasualButton
@onready var punch_up_check: CheckBox = $VBoxContainer/CreatePanel/PunchUpCheck
@onready var leaderboard_button: Button = $VBoxContainer/BottomPanel/LeaderboardButton
@onready var back_button: Button = $VBoxContainer/BottomPanel/BackButton
@onready var loading_label: Label = $VBoxContainer/LoadingLabel

# --- State ---
var matchmaker_manager: Node = null
var current_matches: Array = []

# --- Initialization ---
func _ready() -> void:
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
	
	refresh_matches()

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
	
	var rank_label: Label = Label.new()
	rank_label.text = "Opponent Rank: %d" % match_data.get("creator_rank", 0)
	
	var punch_up_label: Label = Label.new()
	if match_data.get("is_punch_up", false):
		punch_up_label.text = "Punch Up Challenge!"
		punch_up_label.modulate = Color.RED
	
	info_vbox.add_child(type_label)
	info_vbox.add_child(rank_label)
	if match_data.get("is_punch_up", false):
		info_vbox.add_child(punch_up_label)
	
	var accept_button: Button = Button.new()
	accept_button.text = "Accept"
	accept_button.pressed.connect(_on_accept_match.bind(match_data.get("match_id", "")))
	
	item.add_child(info_vbox)
	item.add_child(accept_button)
	
	return item

func _on_accept_match(match_id: String) -> void:
	if not matchmaker_manager:
		return
	
	matchmaker_manager.accept_match(match_id)

func _on_leaderboard_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/leaderboard_menu.tscn")

func _on_match_created(match: Dictionary) -> void:
	print("Match created: %s" % match.get("match_id", ""))
	_show_match_created_dialog(match)

func _on_match_accepted(match: Dictionary) -> void:
	print("Match accepted: %s" % match.get("match_id", ""))
	_show_match_accepted_dialog(match)

func _on_match_accepted_dialog_confirmed(match: Dictionary) -> void:
	var combat_scene = load("res://scenes/ui/combat_menu.tscn")
	var combat_ui = combat_scene.instantiate()
	combat_ui.set_match_id(match.get("match_id", ""))
	get_tree().current_scene.add_child(combat_ui)

func _show_match_created_dialog(match: Dictionary) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Match Created"
	dialog.dialog_text = "Your match has been created!\nWaiting for opponent..."
	dialog.unresizable = true
	
	get_tree().current_scene.add_child(dialog)
	dialog.show()
	
	back_button.pressed.connect(dialog.queue_free.unbind(1), CONNECT_DEFERRED)

func _show_match_accepted_dialog(match: Dictionary) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Match Accepted"
	dialog.dialog_text = "Match joined successfully!\nGood luck!"
	dialog.unresizable = true
	
	get_tree().current_scene.add_child(dialog)
	dialog.show()
	
	dialog.confirmed.connect(_on_match_accepted_dialog_confirmed.bind(match))
	back_button.pressed.connect(dialog.queue_free.unbind(1), CONNECT_DEFERRED)

# --- Navigation ---
func _on_back_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")
