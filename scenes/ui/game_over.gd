extends Control

# --- Node References ---
@onready var result_label: Label = $VBoxContainer/ResultLabel
@onready var restart_button: Button = $VBoxContainer/RestartButton
@onready var loot_label: Label = $VBoxContainer/LootLabel

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Game Over Colors ---
const VICTORY_COLOR = Color("#22C55E")  # Green - DesignTokens.COLOR_SUCCESS
const DEFEAT_COLOR = Color("#EF4444")   # Red - DesignTokens.COLOR_ERROR

func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	restart_button.pressed.connect(_on_restart_button_pressed)
	GameManager.player_died.connect(_on_player_died)
	GameManager.game_won.connect(_on_game_won)
	visible = false

func _on_player_died() -> void:
	result_label.text = "Game Over"
	result_label.modulate = DEFEAT_COLOR
	restart_button.text = "Try Again"
	visible = true

func _on_game_won() -> void:
	result_label.text = "Victory!"
	result_label.modulate = VICTORY_COLOR
	restart_button.text = "Continue"
	visible = true

	# Show loot summary if PvE encounter
	var encounter_data = GameManager.current_encounter_data
	if encounter_data.size() > 0 and CampaignManager:
		var loot_config = CampaignManager.get_loot_config(GameManager.current_stage_id)
		var xp = loot_config.get("xp", 50)
		var gold = loot_config.get("gold", 25)

		if loot_label:
			loot_label.text = "+" + str(xp) + " XP  +" + str(gold) + " Gold"
			loot_label.visible = true

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

	# Apply colors to labels
	if result_label:
		result_label.modulate = colors["text_primary"]
	if restart_button:
		restart_button.modulate = DesignTokens.COLOR_PRIMARY if design_tokens else Color.WHITE

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
