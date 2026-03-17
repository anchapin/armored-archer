extends Control

# --- Node References ---
@onready var result_label: Label = $VBoxContainer/ResultLabel
@onready var restart_button: Button = $VBoxContainer/RestartButton

func _ready() -> void:
	restart_button.pressed.connect(_on_restart_button_pressed)
	GameManager.player_died.connect(_on_player_died)
	GameManager.game_won.connect(_on_game_won)
	visible = false

func _on_player_died() -> void:
	result_label.text = "Game Over"
	visible = true

func _on_game_won() -> void:
	result_label.text = "Stage Complete!"
	visible = true

func _on_restart_button_pressed() -> void:
	# If playing campaign mode, return to campaign map
	if GameManager.current_stage_id != "":
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
