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
@onready var stats_panel: Control = $VBoxContainer/StatsPanel

# --- Theme Manager Reference ---
var theme_manager: Node

# --- State ---
var combat_manager: Node = null
var match_id: String = ""
var is_initialized: bool = false
var current_match_state: Dictionary = {}

# --- PvE State ---
var _is_pve_mode: bool = false
var _enemy_health: int = 0
var _enemy_max_health: int = 0

# --- Server-declared result routing (issue #902) ---
# combat_menu now waits for MatchmakerManager.match_completed to render
# the result screen. The `_server_result_connected` flag prevents wiring
# the same callback twice if combat ends twice (e.g. reconnect mid-match).
var _server_result_connected: bool = false
var _server_result_rendered: bool = false
var _server_result_rendered_match_id: String = ""
var _last_combat_winner_local: String = ""
var _last_combat_victory_local: bool = false

# --- Constants ---
const CRITICAL_HIT_CHANCE: float = 0.15
const CRITICAL_HIT_MULTIPLIER: float = 2.0
const BASE_DAMAGE: int = 10

# --- Initialization ---
func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

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
		combat_manager.combat_ended.connect(_on_pvp_combat_ended)

	# Auto-initialize PvE combat if encounter data is present
	if not is_initialized and GameManager.current_encounter_data.size() > 0:
		initialize_combat()

# --- Initialize Combat ---
func initialize_combat() -> void:
	var encounter_data = GameManager.current_encounter_data
	if encounter_data.size() > 0:
		_init_pve_combat(encounter_data)
	elif combat_manager and not match_id.is_empty():
		_init_pvp_combat()

# --- PvP Initialization ---
func _init_pvp_combat() -> void:
	loading_label.visible = true
	is_initialized = false
	combat_manager.get_match_state(match_id)

# --- PvE Initialization ---
func _init_pve_combat(encounter_data: Dictionary) -> void:
	_is_pve_mode = true
	_enemy_health = encounter_data.get("health", 30)
	_enemy_max_health = _enemy_health
	var difficulty = GameManager.current_difficulty

	EnemyAIManager.setup_enemy(encounter_data, difficulty)

	# Update UI with enemy stats
	opponent_health_bar.max_value = _enemy_max_health
	opponent_health_bar.value = _enemy_health
	opponent_health_label.text = str(_enemy_health) + " / " + str(_enemy_max_health)

	# Set player health from GameManager
	my_health_bar.max_value = GameManager.player_max_health
	my_health_bar.value = GameManager.player_current_health
	my_health_label.text = str(GameManager.player_current_health) + " / " + str(GameManager.player_max_health)

	turn_label.text = "Your Turn"
	shoot_button.disabled = false
	is_initialized = true

	# Hide loading, show stats
	if loading_label:
		loading_label.visible = false

	_append_combat_log("Battle begins! %s appears!" % encounter_data.get("type", "Enemy"))

# --- Combat Actions ---
func _on_shoot_pressed() -> void:
	if not is_initialized:
		return

	if _is_pve_mode:
		_handle_pve_shoot()
	else:
		_handle_pvp_shoot()

func _handle_pvp_shoot() -> void:
	if not combat_manager:
		return

	if not combat_manager.is_my_turn_sync():
		push_error("Not your turn")
		return

	var angle: float = deg_to_rad(angle_slider.value)
	combat_manager.submit_combat_action(match_id, "shoot", angle)
	shoot_button.disabled = true

func _handle_pve_shoot() -> void:
	var player_atk = BASE_DAMAGE

	# Get player attack from PlayerStatsManager if available
	var stats_manager = get_node_or_null("/root/PlayerStatsManager")
	if stats_manager and stats_manager.player_stats.has("attack"):
		player_atk = stats_manager.player_stats.get("attack", BASE_DAMAGE)

	# Calculate player damage to enemy
	var enemy_def = EnemyAIManager.get_enemy_stats().get("defense", 0)
	var damage = max(1, player_atk - enemy_def)

	# Critical hit check
	if randf() < CRITICAL_HIT_CHANCE:
		damage = int(damage * CRITICAL_HIT_MULTIPLIER)
		_append_combat_log("CRITICAL HIT!")

	# Apply to enemy
	EnemyAIManager.take_damage(damage)
	_enemy_health = EnemyAIManager.get_enemy_health()
	opponent_health_bar.value = _enemy_health
	opponent_health_label.text = str(_enemy_health) + " / " + str(_enemy_max_health)

	_append_combat_log("You dealt " + str(damage) + " damage!")

	# Check enemy defeated
	if EnemyAIManager.is_defeated():
		_on_pve_combat_ended("player")
		return

	# Enemy turn
	turn_label.text = "Enemy Turn"
	shoot_button.disabled = true

	# Small delay for feel, then enemy acts
	await get_tree().create_timer(0.5).timeout
	_handle_pve_enemy_turn()

func _handle_pve_enemy_turn() -> void:
	var player_def = 0
	var stats_manager = get_node_or_null("/root/PlayerStatsManager")
	if stats_manager and stats_manager.player_stats.has("defense"):
		player_def = stats_manager.player_stats.get("defense", 0)

	var action = EnemyAIManager.decide_action(GameManager.player_current_health, player_def)

	var enemy_damage = action.get("damage", 0)
	if action.get("action") == "defend":
		_append_combat_log("Enemy defends!")
	else:
		var actual_damage = max(1, enemy_damage - player_def)
		GameManager.take_player_damage(actual_damage)
		my_health_bar.value = GameManager.player_current_health
		my_health_label.text = str(GameManager.player_current_health) + " / " + str(GameManager.player_max_health)
		_append_combat_log("Enemy " + action.get("action", "attacks") + " for " + str(actual_damage) + " damage!")

	# Check player defeated
	if GameManager.player_current_health <= 0:
		_on_pve_combat_ended("enemy")
		return

	# Back to player turn
	turn_label.text = "Your Turn"
	shoot_button.disabled = false

func _on_pve_combat_ended(winner: String) -> void:
	shoot_button.disabled = true
	if winner == "player":
		GameManager.end_game(true)  # triggers game_won signal -> CampaignManager.complete_stage
		_append_combat_log("Victory!")
	else:
		GameManager.end_game(false)  # triggers player_died signal
		_append_combat_log("Defeat!")

func _on_angle_changed(value: float) -> void:
	angle_value_label.text = "%.1f°" % value

# --- PvP Combat Handlers ---
func _on_combat_action_submitted(_result: Dictionary) -> void:
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

func _on_pvp_combat_ended(winner: String) -> void:
	# Issue #902: the previous implementation fabricated XP/Ladder Rating
	# placeholders here and only forwarded an "old_rank=0, rank_delta=0,
	# xp_gained=150 if is_victory else 50" stub to the match results screen.
	# That display-only path diverged from the server-declared settlement
	# payload emitted by MatchmakerManager.match_completed, so the player
	# could see one set of values on the results screen and a different
	# set when reconciliation finished.
	#
	# The combat menu must now route through server-declared results only:
	# it listens to MatchmakerManager.match_completed and renders the
	# server's payload verbatim. The local `winner` argument from the
	# combat_ended signal is intentionally ignored here — the server is
	# authoritative on who won (issue #861). We guard against double-handling
	# by tracking the match_id of the result we already rendered.
	var my_user_id: String = NetworkManager.user_id if NetworkManager else ""
	var is_victory: bool = winner == my_user_id

	var matchmaker_manager = get_node_or_null("/root/MatchmakerManager")
	if matchmaker_manager and not _server_result_rendered:
		if not _server_result_connected:
			matchmaker_manager.match_completed.connect(_on_server_match_completed)
			_server_result_connected = true
		# Capture whether this is a win locally, but the actual numbers come
		# from the server signal. We just stash the outcome for the fallback
		# dialog if the server signal never arrives.
		_last_combat_winner_local = winner
		_last_combat_victory_local = is_victory

func _on_server_match_completed(server_result: Dictionary) -> void:
	# Server-declared settlement payload — render it verbatim. The combat
	# menu never invents XP, rank, or season-position numbers; whatever the
	# server sent is what the player sees (issue #861, issue #902).
	var payload: Dictionary = server_result.duplicate(true)
	var rendered_match_id: String = payload.get("match_id", match_id)
	if not rendered_match_id.is_empty() and rendered_match_id == _server_result_rendered_match_id:
		return
	_server_result_rendered_match_id = rendered_match_id

	var match_results_scene = load("res://scenes/ui/pvp/match_results.tscn")
	if match_results_scene:
		match_results_scene.show_match_results(payload)
		get_tree().change_scene_to_packed(match_results_scene)
	else:
		# Fallback only when the results scene is missing — still use the
		# server's is_victory flag (never the local derivation).
		_show_fallback_dialog(payload.get("is_victory", false))
	_server_result_rendered = true

func _show_fallback_dialog(is_victory: bool) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()

	if is_victory:
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
	var result = get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")

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

# --- Combat Log Helper ---
func _append_combat_log(message: String) -> void:
	if combat_log:
		combat_log.text += message + "\n"

# --- Navigation ---
func _on_back_pressed() -> void:
	if _is_pve_mode:
		# Return to campaign map from PvE
		GameManager.current_encounter_data = {}
		var result = get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")
	else:
		var result = get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if combat_manager:
		if combat_manager.combat_action_submitted.is_connected(_on_combat_action_submitted):
			combat_manager.combat_action_submitted.disconnect(_on_combat_action_submitted)
		if combat_manager.match_state_updated.is_connected(_on_match_state_updated):
			combat_manager.match_state_updated.disconnect(_on_match_state_updated)
		if combat_manager.turn_changed.is_connected(_on_turn_changed):
			combat_manager.turn_changed.disconnect(_on_turn_changed)
		if combat_manager.combat_ended.is_connected(_on_pvp_combat_ended):
			combat_manager.combat_ended.disconnect(_on_pvp_combat_ended)

	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Set Match ID ---
func set_match_id(new_match_id: String) -> void:
	match_id = new_match_id

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	# Apply background color
	theme_manager.apply_background(self)

	# Apply to stats panel
	if stats_panel:
		stats_panel.modulate = colors["surface"]

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
