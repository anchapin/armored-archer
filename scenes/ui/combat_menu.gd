extends Control

# --- UI References ---
@onready var my_health_bar: ProgressBar = $VBoxContainer/StatsPanel/MyStatsContainer/HealthBar
@onready var my_health_label: Label = $VBoxContainer/StatsPanel/MyStatsContainer/HealthLabel
@onready var opponent_health_bar: ProgressBar = $VBoxContainer/StatsPanel/OpponentStatsContainer/HealthBar
@onready var opponent_health_label: Label = $VBoxContainer/StatsPanel/OpponentStatsContainer/HealthLabel
@onready var turn_label: Label = $VBoxContainer/TurnPanel/TurnLabel
@onready var combat_log: TextEdit = $VBoxContainer/LogPanel/CombatLog
@onready var shoot_button: Button = $VBoxContainer/ActionPanel/ShootButton
@onready var angle_slider: HSlider = $VBoxContainer/ActionPanel/AngleSlider
@onready var angle_value_label: Label = $VBoxContainer/ActionPanel/AngleValueLabel
@onready var back_button: Button = $VBoxContainer/BottomPanel/BackButton
@onready var loading_label: Label = $VBoxContainer/LoadingLabel

# --- State ---
var combat_manager: Node = null
var match_id: String = ""
var is_initialized: bool = false

# --- Initialization ---
func _ready() -> void:
	combat_manager = get_node_or_null("/root/CombatManager")
	
	if not match_id.is_empty():
		initialize_combat()
	
	shoot_button.pressed.connect(_on_shoot_pressed)
	back_button.pressed.connect(_on_back_pressed)
	angle_slider.value_changed.connect(_on_angle_changed)
	
	if combat_manager:
		combat_manager.combat_action_submitted.connect(_on_combat_action_submitted)
		combat_manager.match_state_updated.connect(_on_match_state_updated)
		combat_manager.turn_changed.connect(_on_turn_changed)
		combat_manager.combat_ended.connect(_on_combat_ended)

# --- Initialize Combat ---
func initialize_combat() -> void:
	if not combat_manager or match_id.is_empty():
		return
	
	loading_label.visible = true
	is_initialized = false
	
	combat_manager.get_match_state(match_id)

# --- Combat Actions ---
func _on_shoot_pressed() -> void:
	if not combat_manager or not is_initialized:
		return
	
	if not combat_manager.is_my_turn_sync():
		push_error("Not your turn")
		return
	
	var angle: float = deg_to_rad(angle_slider.value)
	combat_manager.submit_combat_action(match_id, "shoot", angle)
	
	shoot_button.disabled = true

func _on_angle_changed(value: float) -> void:
	angle_value_label.text = "%.1f°" % value

# --- Combat Handlers ---
func _on_combat_action_submitted(result: Dictionary) -> void:
	_refresh_match_state()

func _on_match_state_updated(match_state: Dictionary) -> void:
	current_match_state = match_state
	loading_label.visible = false
	is_initialized = true
	
	_update_health_bars()
	_update_turn_label()
	_update_combat_log()
	
	shoot_button.disabled = not combat_manager.is_my_turn_sync()

func _on_turn_changed(is_my_turn: bool) -> void:
	_update_turn_label()
	
	if is_my_turn:
		shoot_button.disabled = false
		loading_label.visible = false
	else:
		shoot_button.disabled = true
		_refresh_match_state()

func _on_combat_ended(winner: String) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	
	if winner == NetworkManager.user_id:
		dialog.title = "Victory!"
		dialog.dialog_text = "You won the match!"
	else:
		dialog.title = "Defeat"
		dialog.dialog_text = "You lost the match."
	
	dialog.unresizable = true
	get_tree().current_scene.add_child(dialog)
	dialog.show()
	
	dialog.confirmed.connect(_on_dialog_confirmed)

func _on_dialog_confirmed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")

# --- UI Updates ---
func _update_health_bars() -> void:
	my_health_bar.value = combat_manager.get_my_health()
	my_health_label.text = "%d / 100" % combat_manager.get_my_health()
	
	opponent_health_bar.value = combat_manager.get_opponent_health()
	opponent_health_label.text = "%d / 100" % combat_manager.get_opponent_health()

func _update_turn_label() -> void:
	if combat_manager.is_my_turn_sync():
		turn_label.text = "YOUR TURN"
		turn_label.modulate = Color.GREEN
	else:
		turn_label.text = "OPPONENT'S TURN"
		turn_label.modulate = Color.RED

func _update_combat_log() -> void:
	var log: Array = combat_manager.get_combat_log()
	var log_text: String = ""
	
	for entry in log:
		var attacker_id: String = entry.get("attacker_id", "")
		var is_my_action: bool = attacker_id == NetworkManager.user_id
		var attacker_name: String = "You" if is_my_action else "Opponent"
		
		var action: String = entry.get("action", "").capitalize()
		var hit: bool = entry.get("hit", false)
		var damage: int = entry.get("damage", 0)
		var is_crit: bool = entry.get("is_crit", false)
		
		if hit:
			var damage_text: String = "%d damage" % damage
			if is_crit:
				damage_text += " (CRIT!)"
			log_text += "%s %s for %s\n" % [attacker_name, action, damage_text]
		else:
			log_text += "%s %s (missed)\n" % [attacker_name, action]
	
	combat_log.text = log_text

func _refresh_match_state() -> void:
	if not combat_manager or match_id.is_empty():
		return
	
	combat_manager.get_match_state(match_id)

# --- Navigation ---
func _on_back_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")

# --- Set Match ID ---
func set_match_id(new_match_id: String) -> void:
	match_id = new_match_id

var current_match_state: Dictionary = {}
