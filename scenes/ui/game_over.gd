extends Control

# --- Node References ---
@onready var result_label: Label = $VBoxContainer/ResultLabel
@onready var restart_button: ArcheryBaseButton = $VBoxContainer/ButtonContainer/RestartButton
@onready var pvp_challenge_button: ArcheryBaseButton = $VBoxContainer/ButtonContainer/PvPChallengeButton
@onready var loot_label: Label = $VBoxContainer/LootLabel

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Manager References ---
var player_stats: Node
var gear_manager: Node
var matchmaker_manager: Node
var network_manager: Node

# --- Game Over Colors ---
const VICTORY_COLOR = Color("#22C55E")  # Green - ArcherDesignTokens.COLOR_SUCCESS
const DEFEAT_COLOR = Color("#EF4444")   # Red - ArcherDesignTokens.COLOR_ERROR

# --- Looted Gear ---
var _looted_gear: Dictionary = {}
var _result_stage_id: String = ""

# --- Rarity Colors ---
const RARITY_COLORS = {
	"common": "#FFFFFF",
	"rare": "#00FF00",
	"epic": "#9B30FF",
	"legendary": "#FFA500"
}

func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")

	# Get manager references
	player_stats = get_node_or_null("/root/PlayerStatsManager")
	gear_manager = get_node_or_null("/root/GearManager")
	matchmaker_manager = get_node_or_null("/root/MatchmakerManager")
	network_manager = get_node_or_null("/root/NetworkManager")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	restart_button.pressed.connect(_on_restart_button_pressed)
	pvp_challenge_button.pressed.connect(_on_pvp_challenge_button_pressed)
	GameManager.player_died.connect(_on_player_died)
	GameManager.game_won.connect(_on_game_won)

	# Connect to MatchmakerManager for match creation feedback
	if matchmaker_manager:
		matchmaker_manager.match_created.connect(_on_match_created)

	CampaignManager.stage_sync_updated.connect(_on_stage_sync_updated)

	visible = false

func _on_player_died() -> void:
	result_label.text = "Game Over"
	result_label.modulate = DEFEAT_COLOR
	restart_button.text = "Try Again"
	visible = true
	# Hide PvP Challenge button on defeat
	pvp_challenge_button.visible = false

func _on_game_won() -> void:
	result_label.text = "Victory!"
	result_label.modulate = VICTORY_COLOR
	restart_button.text = "Continue"
	visible = true

	# Show PvP Challenge button for PvE victory (has current_stage_id)
	if GameManager.current_stage_id != "" and network_manager and network_manager.is_connected:
		pvp_challenge_button.visible = true
	else:
		pvp_challenge_button.visible = false

	# Local campaign progress is not a server reward settlement.
	if not network_manager or not network_manager.is_session_valid():
		_looted_gear.clear()
		if loot_label:
			loot_label.text = "Offline victory: progress saved on this device. Server rewards unavailable."
			loot_label.visible = true
		return

	# CampaignManager owns the one stage_complete request. Do not independently
	# request XP/gear or display configured gold as an awarded currency.
	_result_stage_id = GameManager.current_stage_id
	_looted_gear.clear()
	loot_label.text = "Server rewards pending confirmation."
	loot_label.visible = true

func _on_stage_sync_updated(stage_id: String, state: String, result: Dictionary) -> void:
	if not visible or stage_id != _result_stage_id:
		return
	match state:
		"local_replay":
			loot_label.text = "Already completed locally. No new server reward request."
		"pending":
			loot_label.text = "Server rewards pending confirmation."
		"failed":
			loot_label.text = "Progress saved on this device. Server rewards not confirmed."
		"confirmed":
			var xp: int = int(result.get("xp_gained", 0))
			loot_label.text = "Server confirmed: %d XP." % xp
			var gear: Variant = result.get("gear_dropped")
			if gear is Dictionary and not gear.is_empty():
				loot_label.text += "\nGear: " + str(gear.get("name", "Gear received"))
			else:
				loot_label.text += " No gear drop."
	loot_label.visible = true

func _on_pvp_challenge_button_pressed() -> void:
	"""Handle PvP Challenge button press - creates an async match."""
	if not matchmaker_manager:
		push_error("MatchmakerManager not available")
		return

	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	# Create a ranked match by default
	matchmaker_manager.create_match("ranked", false)

func _on_match_created(match_data: Dictionary) -> void:
	"""Handle match creation event from MatchmakerManager."""
	print("Match created from PvE victory: %s" % match_data.get("match_id", ""))
	# Show a dialog indicating the match was created
	_show_match_created_dialog(match_data)

func _show_match_created_dialog(match_data: Dictionary) -> void:
	"""Shows a dialog confirming the async match was created."""
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "PvP Match Created"
	dialog.dialog_text = "Your async PvP match has been created!\n\nWaiting for an opponent to accept...\n\nYou can check back in the Matchmaking menu."
	dialog.unresizable = true

	get_tree().current_scene.add_child(dialog)
	dialog.show()

	# Navigate to main menu after dialog is closed
	dialog.confirmed.connect(func():
		var _err = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")
	)

	# Also navigate when user closes dialog without confirming
	dialog.close_requested.connect(func():
		var _err = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")
	)

func _on_restart_button_pressed() -> void:
	# If playing campaign mode, return to campaign map
	if GameManager.current_stage_id != "":
		GameManager.current_encounter_data = {}
		var result = get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")
	else:
		GameManager.reset_stage()
		get_tree().reload_current_scene()


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if GameManager:
		if GameManager.player_died.is_connected(_on_player_died):
			GameManager.player_died.disconnect(_on_player_died)
		if GameManager.game_won.is_connected(_on_game_won):
			GameManager.game_won.disconnect(_on_game_won)

	# Disconnect MatchmakerManager signals
	if matchmaker_manager and matchmaker_manager.has_signal("match_created"):
		if matchmaker_manager.match_created.is_connected(_on_match_created):
			matchmaker_manager.match_created.disconnect(_on_match_created)

	if CampaignManager.stage_sync_updated.is_connected(_on_stage_sync_updated):
		CampaignManager.stage_sync_updated.disconnect(_on_stage_sync_updated)

	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	# Apply background color
	theme_manager.apply_background(self)

	# Apply colors to labels and buttons
	if result_label:
		result_label.modulate = colors["on_surface"]
	if restart_button:
		restart_button.modulate = ArcherDesignTokens.COLOR_PRIMARY if design_tokens else Color.WHITE
	if pvp_challenge_button:
		pvp_challenge_button.modulate = ArcherDesignTokens.COLOR_PRIMARY if design_tokens else Color.WHITE

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
