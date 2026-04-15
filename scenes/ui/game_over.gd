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

	# Connect to gear manager for loot
	if gear_manager and gear_manager.has_signal("gear_generated"):
		gear_manager.gear_generated.connect(_on_gear_generated)

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

	# Show loot summary if PvE encounter
	var encounter_data = GameManager.current_encounter_data
	if encounter_data.size() > 0 and CampaignManager:
		var loot_config = CampaignManager.get_loot_config(GameManager.current_stage_id)
		var xp = loot_config.get("xp", 50)
		var gold = loot_config.get("gold", 25)

		# Grant XP to player
		if player_stats and player_stats.has_method("gain_xp"):
			player_stats.gain_xp(xp, "pve")

		# Generate gear loot
		if gear_manager and gear_manager.has_method("generate_gear"):
			var boss_id: String = encounter_data.get("boss", "")
			gear_manager.generate_gear(GameManager.current_stage_id, not boss_id.is_empty())

		# Display loot (will be updated when gear arrives)
		_update_loot_label(xp, gold)

func _update_loot_label(xp: int, gold: int) -> void:
	"""Updates loot label with XP, gold, and earned gear.

	Parameters:
		xp: XP amount gained
		gold: Gold amount gained
	"""
	var loot_text: String = "+" + str(xp) + " XP  +" + str(gold) + " Gold"

	# Add gear to display if looted
	if not _looted_gear.is_empty():
		var gear_name: String = _looted_gear.get("name", "Unknown Gear")
		var rarity: String = _looted_gear.get("rarity", "common")
		var rarity_color: String = RARITY_COLORS.get(rarity, "#FFFFFF")
		loot_text += "\n\n[color=%s][b]%s (%s)[/b][/color]" % [rarity_color, gear_name, rarity.capitalize()]

	if loot_label:
		loot_label.text = loot_text
		loot_label.visible = true

func _on_gear_generated(gear_data: Dictionary) -> void:
	"""Handle gear generation from server.

	Parameters:
		gear_data: Generated gear dictionary
	"""
	_looted_gear = gear_data.duplicate()

	# Update loot display with gear
	var encounter_data = GameManager.current_encounter_data
	if encounter_data.size() > 0 and CampaignManager:
		var loot_config = CampaignManager.get_loot_config(GameManager.current_stage_id)
		var xp = loot_config.get("xp", 50)
		var gold = loot_config.get("gold", 25)
		_update_loot_label(xp, gold)

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

	# Disconnect gear manager
	if gear_manager and gear_manager.has_signal("gear_generated"):
		if gear_manager.gear_generated.is_connected(_on_gear_generated):
			gear_manager.gear_generated.disconnect(_on_gear_generated)

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
